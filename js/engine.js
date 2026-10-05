/* Hisob-kitob mexanizmi: ombor (FIFO / o'rtacha), QQS, foyda solig'i, aylanma solig'i, eskirish, qarzlar */
(function () {
  const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
  const ym = (d) => String(d || '').slice(0, 7);
  const EPS = 1e-9;

  const DOC_TYPES = ['opening', 'receipt', 'sale', 'return_in', 'return_out', 'transfer', 'writeoff', 'inventory', 'production'];
  const isVatPayer = (firm) => firm.regime === 'vat' || firm.regime === 'turnover_vat';
  const isProfitPayer = (firm) => firm.regime === 'vat' || !firm.regime;
  const isTurnoverPayer = (firm) => firm.regime === 'turnover' || firm.regime === 'turnover_vat';

  /* QQS turlari: std (12%), red (6%), custom (imtiyozli, foiz qo'lda), exempt (QQSdan ozod). Eski 'zero' = imtiyozli 0% */
  function vatRate(type, settings, custom) {
    if (type === 'exempt' || type === 'zero') return 0;
    if (type === 'red') return (Number(settings.vat_rate_red) || 0) / 100;
    if (type === 'custom') return (Number(custom) || 0) / 100;
    return (Number(settings.vat_rate) || 0) / 100;
  }
  const bucket = (v) => (v === 'zero' || v === 'custom' ? 'ben' : v === 'red' ? 'red' : v === 'exempt' ? 'exempt' : 'std');

  /* Hujjat qatorining summasi: asos (QQSsiz), QQS, jami */
  function lineAmounts(line, doc, firm, settings, product) {
    const qty = Number(line.qty) || 0, price = Number(line.price) || 0;
    let vtype = line.vat || (product && product.vat) || 'std';
    let vatp = line.vat ? line.vatp : (product && product.vat_custom);
    const selling = doc.type === 'sale' || doc.type === 'return_in';
    if (selling && !isVatPayer(firm)) vtype = 'exempt'; // aylanma solig'i to'lovchi QQS qo'shmaydi
    const r = vatRate(vtype, settings, vatp);
    const amt = qty * price;
    let base, total;
    if (doc.priceVat) { total = amt; base = amt / (1 + r); } else { base = amt; total = amt * (1 + r); }
    return { qty, price, vtype, rate: r, base: r2(base), vat: r2(total - base), total: r2(total) };
  }

  function emptyMonth() {
    return {
      sale_base: { std: 0, red: 0, ben: 0, exempt: 0 }, sale_vat: 0, sale_total: 0,
      ret_in_base: 0, ret_in_vat: 0, ret_in_total: 0, ret_in_cost: 0,
      purch_base: 0, purch_vat: 0, purch_vat_credit: 0, ret_out_vat_credit: 0,
      exp_ded: 0, exp_nonded: 0, exp_vat_credit: 0, asset_vat_credit: 0, dep: 0,
      cogs: 0, writeoff_ded: 0, writeoff_nonded: 0, surplus: 0, shortage_ded: 0, shortage_nonded: 0, other_income: 0
    };
  }

  function compute(firm, recs, settings, opts = {}) {
    const until = opts.until || null;
    const method = firm.cost_method === 'fifo' ? 'fifo' : 'avg';
    const vatPayer = isVatPayer(firm);
    const by = { warehouse: [], product: [], counterparty: [], doc: [], expense: [], payment: [], asset: [] };
    for (const r of recs) if (by[r.kind]) by[r.kind].push(r);
    const P = Object.fromEntries(by.product.map((p) => [p.id, p]));
    const months = {};
    const M = (d) => (months[ym(d)] = months[ym(d)] || emptyMonth());
    const ledger = {};
    const moves = [];
    const warnings = [];
    const docCalc = {};
    const debts = {};
    const D = (cp) => (debts[cp] = debts[cp] || { they_owe: 0, we_owe: 0 });

    const st = (wh, p) => { const k = wh + '|' + p; return (ledger[k] = ledger[k] || { wh, p, qty: 0, value: 0, layers: [], lastCost: 0 }); };
    function addIn(s, qty, value, pieces) {
      if (qty <= EPS && !pieces) return;
      if (method === 'fifo') {
        if (pieces) pieces.forEach((pc) => pc.q > EPS && s.layers.push({ q: pc.q, c: pc.c }));
        else s.layers.push({ q: qty, c: value / qty });
      }
      s.qty += qty; s.value += value;
      if (qty > EPS) s.lastCost = value / qty;
      if (Math.abs(s.qty) < 1e-7) { s.qty = 0; s.value = 0; }
    }
    function takeOut(s, qty) {
      const avail = Math.max(s.qty, 0);
      let cost = 0; const pieces = [];
      if (method === 'fifo') {
        let rem = qty;
        while (rem > EPS && s.layers.length) {
          const L = s.layers[0]; const t = Math.min(L.q, rem);
          cost += t * L.c; pieces.push({ q: t, c: L.c }); L.q -= t; rem -= t;
          if (L.q <= EPS) s.layers.shift();
        }
        if (rem > EPS) { cost += rem * s.lastCost; pieces.push({ q: rem, c: s.lastCost }); }
      } else {
        const unit = s.qty > EPS ? s.value / s.qty : s.lastCost;
        cost = qty * unit; pieces.push({ q: qty, c: unit });
      }
      s.qty -= qty; s.value -= cost;
      if (Math.abs(s.qty) < 1e-7) { s.qty = 0; s.value = 0; }
      if (s.qty < 0 && method === 'avg') s.value = s.qty * s.lastCost;
      return { cost, pieces, shortage: Math.max(0, qty - avail) };
    }
    const unitCost = (s) => (s.qty > EPS ? s.value / s.qty : s.lastCost);
    const mv = (doc, wh, p, qty, value) => moves.push({ date: doc.date, doc: doc.id, type: doc.type, number: doc.number, wh, p, qty, value });

    // dublikat hujjatlar
    const seen = {};
    for (const d of by.doc) {
      if (!d.number) continue;
      const k = d.type + '|' + String(d.number).trim().toLowerCase() + '|' + (d.cp || '') + '|' + ym(d.date).slice(0, 4);
      if (seen[k]) warnings.push({ kind: 'duplicate', doc: d.id, other: seen[k] }); else seen[k] = d.id;
    }

    const docs = by.doc.filter((d) => !until || d.date <= until)
      .sort((a, b) => (a.date === b.date ? String(a.created_at || '').localeCompare(String(b.created_at || '')) : a.date < b.date ? -1 : 1));

    for (const doc of docs) {
      const m = M(doc.date);
      const calc = { lines: [], base: 0, vat: 0, total: 0, cost: 0 };
      docCalc[doc.id] = calc;
      for (const line of doc.lines || []) {
        const prod = P[line.p];
        if (!prod) { warnings.push({ kind: 'missing_product', doc: doc.id }); calc.lines.push({}); continue; }
        const a = lineAmounts(line, doc, firm, settings, prod);
        const service = prod.ptype === 'service';
        const lc = { ...a, cost: 0 };
        // tanlangan o'lchov birligi -> ombordagi asosiy birlik (1 birlik = k asosiy birlik)
        const sq = doc.type === 'production' ? a.qty : a.qty * (Number(line.k) > 0 ? Number(line.k) : 1);
        lc.sq = sq;
        if (doc.type !== 'opening') { calc.base += a.base; calc.vat += a.vat; calc.total += a.total; }
        const creditable = vatPayer && a.rate > 0;
        if (doc.type === 'opening') {
          // boshlang'ich ombor qoldig'i: narx = 1 birlik tannarxi, QQS va qarz yo'q
          if (!service) { const val = a.qty * a.price; addIn(st(doc.wh, line.p), sq, val); mv(doc, doc.wh, line.p, sq, val); lc.cost = val; }
          lc.base = 0; lc.vat = 0; lc.total = 0;
        } else if (doc.type === 'receipt') {
          if (service) {
            m.exp_ded += creditable ? a.base : a.total;
            if (creditable) m.exp_vat_credit += a.vat;
          } else {
            const val = creditable ? a.base : a.total;
            addIn(st(doc.wh, line.p), sq, val); mv(doc, doc.wh, line.p, sq, val); lc.cost = val;
            m.purch_base += a.base; m.purch_vat += a.vat;
            if (creditable) m.purch_vat_credit += a.vat;
          }
        } else if (doc.type === 'sale') {
          m.sale_base[bucket(a.vtype)] += a.base; m.sale_vat += a.vat; m.sale_total += a.total;
          if (!service) {
            const s = st(doc.wh, line.p); const o = takeOut(s, sq);
            lc.cost = o.cost; m.cogs += o.cost; mv(doc, doc.wh, line.p, -sq, -o.cost);
            if (o.shortage > EPS) warnings.push({ kind: 'negative', doc: doc.id, p: line.p, wh: doc.wh, qty: o.shortage });
          }
        } else if (doc.type === 'return_in') {
          m.ret_in_base += a.base; m.ret_in_vat += a.vat; m.ret_in_total += a.total;
          if (!service) {
            const s = st(doc.wh, line.p); const val = sq * unitCost(s);
            addIn(s, sq, val); lc.cost = val; m.ret_in_cost += val; mv(doc, doc.wh, line.p, sq, val);
          }
        } else if (doc.type === 'return_out') {
          if (creditable) m.ret_out_vat_credit += a.vat;
          if (!service) {
            const s = st(doc.wh, line.p); const o = takeOut(s, sq);
            lc.cost = o.cost; mv(doc, doc.wh, line.p, -sq, -o.cost);
            m.other_income += (creditable ? a.base : a.total) - o.cost;
            if (o.shortage > EPS) warnings.push({ kind: 'negative', doc: doc.id, p: line.p, wh: doc.wh, qty: o.shortage });
          }
        } else if (doc.type === 'transfer') {
          if (!service) {
            const o = takeOut(st(doc.wh, line.p), sq);
            addIn(st(doc.wh2, line.p), sq, o.cost, o.pieces);
            lc.cost = o.cost; mv(doc, doc.wh, line.p, -sq, -o.cost); mv(doc, doc.wh2, line.p, sq, o.cost);
            if (o.shortage > EPS) warnings.push({ kind: 'negative', doc: doc.id, p: line.p, wh: doc.wh, qty: o.shortage });
          }
        } else if (doc.type === 'writeoff') {
          if (!service) {
            const o = takeOut(st(doc.wh, line.p), sq);
            lc.cost = o.cost; mv(doc, doc.wh, line.p, -sq, -o.cost);
            if (doc.deductible) m.writeoff_ded += o.cost; else m.writeoff_nonded += o.cost;
            if (o.shortage > EPS) warnings.push({ kind: 'negative', doc: doc.id, p: line.p, wh: doc.wh, qty: o.shortage });
          }
        } else if (doc.type === 'production') {
          // tayyor mahsulot: homashyolar ombordan chiqariladi, mahsulot tayyor mahsulot omboriga kiradi
          let matCost = 0; const mats = [];
          for (const mt of line.mats || []) {
            const mp = P[mt.p]; if (!mp) continue;
            const need = a.qty * (Number(mt.per) || 0) * (1 + (Number(mt.loss) || 0) / 100);
            if (need <= EPS) continue;
            let c = 0;
            if (mp.ptype !== 'service') {
              const o = takeOut(st(doc.wh, mt.p), need); c = o.cost; mv(doc, doc.wh, mt.p, -need, -o.cost);
              if (o.shortage > EPS) warnings.push({ kind: 'negative', doc: doc.id, p: mt.p, wh: doc.wh, qty: o.shortage });
            }
            matCost += c; mats.push({ p: mt.p, qty: need, cost: c });
          }
          const extra = a.qty * (line.costs || []).reduce((s, x) => s + (Number(x.per) || 0), 0);
          const val = matCost + (doc.includeCosts ? extra : 0);
          const outWh = doc.wh2 || doc.wh;
          addIn(st(outWh, line.p), a.qty, val); mv(doc, outWh, line.p, a.qty, val);
          lc.cost = val; lc.matCost = matCost; lc.extra = extra; lc.full = matCost + extra; lc.mats = mats;
          lc.unitCost = a.qty > 0 ? val / a.qty : 0; lc.unitFull = a.qty > 0 ? (matCost + extra) / a.qty : 0;
          m.prod_extra = (m.prod_extra || 0) + (doc.includeCosts ? extra : 0);
        } else if (doc.type === 'inventory') {
          const s = st(doc.wh, line.p);
          const book = s.qty; const actual = Number(line.actual) || 0; const diff = actual - book;
          lc.book = book; lc.actual = actual; lc.diff = diff;
          if (diff > EPS) {
            const unit = Number(line.price) > 0 ? Number(line.price) : unitCost(s);
            const val = diff * unit; addIn(s, diff, val); m.surplus += val; lc.cost = val; mv(doc, doc.wh, line.p, diff, val);
          } else if (diff < -EPS) {
            const o = takeOut(s, -diff); lc.cost = -o.cost; mv(doc, doc.wh, line.p, diff, -o.cost);
            if (doc.deductible) m.shortage_ded += o.cost; else m.shortage_nonded += o.cost;
          }
          calc.cost += lc.cost;
        }
        if (doc.type !== 'inventory') calc.cost += lc.cost;
        calc.lines.push(lc);
      }
      calc.base = r2(calc.base); calc.vat = r2(calc.vat); calc.total = r2(calc.total);
      if (doc.cp) {
        if (doc.type === 'sale') D(doc.cp).they_owe += calc.total;
        if (doc.type === 'return_in') D(doc.cp).they_owe -= calc.total;
        if (doc.type === 'receipt') D(doc.cp).we_owe += calc.total;
        if (doc.type === 'return_out') D(doc.cp).we_owe -= calc.total;
      }
    }

    // xarajatlar
    for (const e of by.expense) {
      if (until && e.date > until) continue;
      const m = M(e.date); const base = Number(e.amount) || 0; const vat = Number(e.vat) || 0;
      const credit = vatPayer && vat > 0;
      const val = credit ? base : base + vat;
      if (e.deductible) m.exp_ded += val; else m.exp_nonded += val;
      if (credit) m.exp_vat_credit += vat;
      if (e.cp) D(e.cp).we_owe += base + vat;
    }
    // to'lovlar
    for (const p of by.payment) {
      if (until && p.date > until) continue;
      if (!p.cp) continue;
      if (p.direction === 'in') D(p.cp).they_owe -= Number(p.amount) || 0; else D(p.cp).we_owe -= Number(p.amount) || 0;
    }
    // asosiy vositalar va eskirish
    const assets = {};
    for (const a of by.asset) {
      const cost = Number(a.cost) || 0, vat = Number(a.vat) || 0;
      const credit = vatPayer && vat > 0;
      const basis = credit ? cost : cost + vat;
      if (a.acquire_date && (!until || a.acquire_date <= until)) {
        if (credit) M(a.acquire_date).asset_vat_credit += vat;
        if (a.cp) D(a.cp).we_owe += cost + vat;
      }
      const sched = {}; let acc = 0;
      const limit = Math.max(0, basis - (Number(a.salvage) || 0));
      if (a.depreciate && a.start_date && limit > 0) {
        const monthly = a.method === 'amount' ? Number(a.rate) || 0 : basis * (Number(a.rate) || 0) / 100 / 12;
        if (monthly > 0) {
          let [y, mo] = a.start_date.slice(0, 7).split('-').map(Number);
          const stop = a.dispose_date ? ym(a.dispose_date) : null;
          for (let i = 0; i < 1200 && acc < limit - 0.005; i++) {
            mo++; if (mo > 12) { mo = 1; y++; }
            const key = y + '-' + String(mo).padStart(2, '0');
            if (stop && key > stop) break;
            const amt = r2(Math.min(monthly, limit - acc));
            sched[key] = amt; acc = r2(acc + amt);
            if (!until || key <= ym(until)) (months[key] = months[key] || emptyMonth()).dep += amt;
          }
        }
      }
      const todayYm = ym(until || new Date().toISOString());
      const accNow = Object.entries(sched).filter(([k]) => k <= todayYm).reduce((s, [, v]) => s + v, 0);
      assets[a.id] = { basis: r2(basis), schedule: sched, accumulated: r2(accNow), residual: r2(basis - accNow), monthly: Object.values(sched)[0] || 0 };
    }

    // ombor qoldiqlari
    const stock = Object.values(ledger).map((s) => ({ wh: s.wh, p: s.p, qty: s.qty, value: r2(s.value), unit: s.qty > EPS ? s.value / s.qty : s.lastCost }));

    return { firm, settings, months, stock, moves, warnings, docCalc, debts, assets, method, vatPayer };
  }

  /* ------------ Hisobotlar ------------ */
  const sumKeys = (a) => a.std + a.red + a.ben + a.exempt;

  function vatReport(calc, year) {
    const keys = Object.keys(calc.months).sort();
    let carry = 0; const rows = [];
    for (const k of keys) {
      const m = calc.months[k];
      const output = m.sale_vat - m.ret_in_vat;
      const input = m.purch_vat_credit - m.ret_out_vat_credit + m.exp_vat_credit + m.asset_vat_credit;
      const net = output - input;
      const afterCarry = net - carry;
      const payable = Math.max(0, afterCarry);
      const row = {
        ym: k, turnover_std: m.sale_base.std, turnover_red: m.sale_base.red, turnover_ben: m.sale_base.ben, turnover_exempt: m.sale_base.exempt,
        returns: m.ret_in_base, output: r2(output), input_goods: r2(m.purch_vat_credit - m.ret_out_vat_credit),
        input_exp: r2(m.exp_vat_credit), input_assets: r2(m.asset_vat_credit), input: r2(input), net: r2(net),
        carry_in: r2(carry), payable: r2(payable)
      };
      carry = afterCarry < 0 ? -afterCarry : 0;
      row.carry_out = r2(carry);
      if (k.startsWith(String(year))) rows.push(row);
    }
    // bo'sh oylarni to'ldirish
    const out = [];
    for (let i = 1; i <= 12; i++) {
      const k = year + '-' + String(i).padStart(2, '0');
      out.push(rows.find((r) => r.ym === k) || { ym: k, empty: true, turnover_std: 0, turnover_red: 0, turnover_ben: 0, turnover_exempt: 0, returns: 0, output: 0, input_goods: 0, input_exp: 0, input_assets: 0, input: 0, net: 0, carry_in: 0, payable: 0, carry_out: 0 });
    }
    // bo'sh oylarda o'tkaziladigan summani davom ettirish
    let c = 0;
    for (const r of out) { if (r.empty) { r.carry_in = c; r.carry_out = c; } else c = r.carry_out; }
    return out;
  }

  function profitPieces(m) {
    const income = sumKeys(m.sale_base) - m.ret_in_base + m.surplus + Math.max(0, m.other_income);
    const cogs = m.cogs - m.ret_in_cost;
    const ded = cogs + m.exp_ded + m.dep + m.writeoff_ded + m.shortage_ded + Math.max(0, -m.other_income);
    const nonded = m.exp_nonded + m.writeoff_nonded + m.shortage_nonded;
    return { revenue: sumKeys(m.sale_base) - m.ret_in_base, other: m.surplus + Math.max(0, m.other_income), income, cogs, exp: m.exp_ded, dep: m.dep, losses: m.writeoff_ded + m.shortage_ded + Math.max(0, -m.other_income), ded, nonded };
  }

  function profitReport(calc, year, rate) {
    const q = [];
    let prevTax = 0;
    const cum = { revenue: 0, other: 0, income: 0, cogs: 0, exp: 0, dep: 0, losses: 0, ded: 0, nonded: 0 };
    for (let qi = 1; qi <= 4; qi++) {
      const own = { revenue: 0, other: 0, income: 0, cogs: 0, exp: 0, dep: 0, losses: 0, ded: 0, nonded: 0 };
      for (let mi = (qi - 1) * 3 + 1; mi <= qi * 3; mi++) {
        const m = calc.months[year + '-' + String(mi).padStart(2, '0')];
        if (!m) continue;
        const p = profitPieces(m);
        for (const k in own) { own[k] += p[k]; cum[k] += p[k]; }
      }
      const profit = cum.income - cum.ded;
      const tax = Math.max(0, profit) * rate / 100;
      q.push({
        q: qi, own: Object.fromEntries(Object.entries(own).map(([k, v]) => [k, r2(v)])),
        cum: Object.fromEntries(Object.entries(cum).map(([k, v]) => [k, r2(v)])),
        profit: r2(profit), book_profit: r2(profit - cum.nonded), tax_cum: r2(tax), tax_q: r2(tax - prevTax)
      });
      prevTax = tax;
    }
    return q;
  }

  function turnoverReport(calc, year, rate) {
    const rows = [];
    for (let i = 1; i <= 12; i++) {
      const k = year + '-' + String(i).padStart(2, '0');
      const m = calc.months[k] || emptyMonth();
      const revenue = calc.vatPayer ? sumKeys(m.sale_base) - m.ret_in_base : m.sale_total - m.ret_in_total;
      const other = m.surplus + Math.max(0, m.other_income);
      const base = revenue + other;
      rows.push({ ym: k, revenue: r2(revenue), other: r2(other), base: r2(base), tax: r2(Math.max(0, base) * rate / 100) });
    }
    return rows;
  }

  /* Tovar aylanma qaydnomasi: davr boshi, kirim, chiqim, davr oxiri */
  function turnoverStatement(calc, from, to, wh) {
    const map = {};
    const K = (m) => { const k = m.wh + '|' + m.p; return (map[k] = map[k] || { wh: m.wh, p: m.p, oq: 0, ov: 0, iq: 0, iv: 0, xq: 0, xv: 0 }); };
    for (const m of calc.moves) {
      if (wh && m.wh !== wh) continue;
      if (to && m.date > to) continue;
      const r = K(m);
      if (from && m.date < from) { r.oq += m.qty; r.ov += m.value; continue; }
      if (m.qty >= 0) { r.iq += m.qty; r.iv += m.value; } else { r.xq += -m.qty; r.xv += -m.value; }
    }
    return Object.values(map).map((r) => ({ ...r, cq: r.oq + r.iq - r.xq, cv: r2(r.ov + r.iv - r.xv), ov: r2(r.ov), iv: r2(r.iv), xv: r2(r.xv) }))
      .filter((r) => Math.abs(r.oq) > EPS || Math.abs(r.iq) > EPS || Math.abs(r.xq) > EPS);
  }

  /* Kalkulyatsiya bo'yicha 1 birlik tannarxi (joriy o'rtacha narxlar bilan) */
  function recipeCost(recipe, calc, wh) {
    const unitOf = (p) => {
      const rows = calc.stock.filter((s) => s.p === p && (!wh || s.wh === wh));
      const q = rows.reduce((s, x) => s + Math.max(0, x.qty), 0), v = rows.reduce((s, x) => s + Math.max(0, x.value), 0);
      if (q > EPS) return v / q;
      const any = calc.stock.filter((s) => s.p === p);
      return any.length ? Math.max(...any.map((x) => x.unit || 0)) : 0;
    };
    const stockOf = (p) => calc.stock.filter((s) => s.p === p && (!wh || s.wh === wh)).reduce((s, x) => s + x.qty, 0);
    const mats = (recipe.mats || []).map((m) => {
      const per = (Number(m.per) || 0) * (1 + (Number(m.loss) || 0) / 100);
      const unit = unitOf(m.p);
      return { ...m, perEff: per, unit, cost: per * unit, stock: stockOf(m.p) };
    });
    const mat = mats.reduce((s, x) => s + x.cost, 0);
    const extra = (recipe.costs || []).reduce((s, x) => s + (Number(x.per) || 0), 0);
    return { mats, mat, extra, total: mat + extra };
  }

  function isLocked(firm, date) { return !!(firm.closed_until && date && ym(date) <= firm.closed_until); }

  window.Engine = { recipeCost, vatRate, bucket, compute, lineAmounts, vatReport, profitReport, turnoverReport, turnoverStatement, isLocked, isVatPayer, isProfitPayer, isTurnoverPayer, DOC_TYPES, r2, ym };
})();
