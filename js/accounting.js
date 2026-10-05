/* Buxgalteriya: schyotlar rejasi, provodkalar, aylanma-saldo, schyot kartochkasi, balans (1-shakl) */
(function () {
  const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
  const EPS = 0.005;

  /* ---- Schyotlar ---- */
  let baseCache = null;
  function base() {
    if (baseCache) return baseCache;
    const codes = window.ACCOUNTS.map((a) => a[0]);
    baseCache = window.ACCOUNTS.map(([code, name, type, sec]) => {
      const isGroup = code.length === 4 && code.endsWith('00') && codes.some((c) => c !== code && c.length === 4 && c.slice(0, 2) === code.slice(0, 2));
      return { code, name, type, sec, group: isGroup, parent: isGroup || code.length !== 4 ? '' : code.slice(0, 2) + '00', base: true };
    });
    return baseCache;
  }
  /* firma subschyotlari bilan birga */
  function list(recs) {
    const subs = (recs || []).filter((r) => r.kind === 'account').map((r) => ({ code: r.code, name: r.name, type: '', sec: -1, group: false, parent: r.parent, base: false, id: r.id }));
    const all = base().map((a) => ({ ...a }));
    for (const s of subs) {
      const p = all.find((a) => a.code === s.parent) || subs.find((x) => x.code === s.parent);
      s.type = p ? p.type : ''; s.sec = p ? p.sec : -1;
      if (p) p.hasSubs = true;
    }
    const out = [...all, ...subs].sort((a, b) => cmp(a.code, b.code));
    out.forEach((a) => { a.postable = !a.group && !a.hasSubs; });
    return out;
  }
  // 3 xonali balansdan tashqari schyotlar oxirida
  const cmp = (a, b) => { const ka = (a.length === 3 ? 'Z' : 'A') + a, kb = (b.length === 3 ? 'Z' : 'A') + b; return ka < kb ? -1 : ka > kb ? 1 : 0; };
  const isOff = (code) => /^\d{3}(\.|$)/.test(code || '');

  /* ---- Provodkalar ---- */
  const DATE_OF = { doc: 'date', expense: 'date', payment: 'date', asset: 'acquire_date', journal: 'date' };
  function entries(recs, opts = {}) {
    const out = [];
    for (const r of recs) {
      if (!DATE_OF[r.kind] || !Array.isArray(r.entries)) continue;
      const date = r[DATE_OF[r.kind]];
      if (opts.to && date > opts.to) continue;
      r.entries.forEach((e, i) => { const sum = Number(e.sum) || 0; if (sum && (e.dt || e.kt)) out.push({ date, rec: r, i, dt: e.dt || '', kt: e.kt || '', sum, note: e.note || '' }); });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  function opening(recs) { return (recs || []).find((r) => r.kind === 'opening') || null; }
  function missing(recs) {
    // provodkasi yo'q hujjatlar (ko'chirish bundan mustasno)
    return recs.filter((r) => ['doc', 'expense', 'payment', 'asset'].includes(r.kind) && !(r.kind === 'doc' && r.type === 'transfer') && !(r.entries || []).some((e) => Number(e.sum)));
  }

  /* Hisoblar bo'yicha qoldiq: {code: {dt, kt}} */
  function balancesUntil(recs, date, inclusive) {
    const b = {};
    const add = (code, dt, kt) => { if (!code) return; const x = (b[code] = b[code] || { dt: 0, kt: 0 }); x.dt += dt; x.kt += kt; };
    const op = opening(recs);
    if (op) (op.rows || []).forEach((r) => add(r.acc, Number(r.dt) || 0, Number(r.kt) || 0));
    for (const e of entries(recs)) {
      if (date && (inclusive ? e.date > date : e.date >= date)) continue;
      add(e.dt, e.sum, 0); add(e.kt, 0, e.sum);
    }
    return b;
  }

  /* Aylanma-saldo vedomosti */
  function osv(recs, from, to) {
    const open = from ? balancesUntil(recs, from, false) : balancesUntil(recs, '0000', false);
    const turn = {};
    for (const e of entries(recs)) {
      if ((from && e.date < from) || (to && e.date > to)) continue;
      if (e.dt) { const x = (turn[e.dt] = turn[e.dt] || { dt: 0, kt: 0 }); x.dt += e.sum; }
      if (e.kt) { const x = (turn[e.kt] = turn[e.kt] || { dt: 0, kt: 0 }); x.kt += e.sum; }
    }
    const codes = new Set([...Object.keys(open), ...Object.keys(turn)]);
    const rows = [...codes].sort(cmp).map((code) => {
      const o = open[code] || { dt: 0, kt: 0 }, t = turn[code] || { dt: 0, kt: 0 };
      const on = o.dt - o.kt, cn = on + t.dt - t.kt;
      return { code, odt: on > 0 ? r2(on) : 0, okt: on < 0 ? r2(-on) : 0, tdt: r2(t.dt), tkt: r2(t.kt), cdt: cn > 0 ? r2(cn) : 0, ckt: cn < 0 ? r2(-cn) : 0 };
    }).filter((r) => r.odt || r.okt || r.tdt || r.tkt || r.cdt || r.ckt);
    return rows;
  }
  /* 4 xonali guruh bo'yicha jamlash (masalan 2910, 2920 -> 2900) */
  function groupRows(rows, level) {
    const key = (c) => (isOff(c) ? c.slice(0, 3) : level === 'group' ? c.slice(0, 2) + '00' : c.slice(0, 4));
    const m = {};
    for (const r of rows) {
      const k = key(r.code); const x = (m[k] = m[k] || { code: k, on: 0, tdt: 0, tkt: 0 });
      x.on += r.odt - r.okt; x.tdt += r.tdt; x.tkt += r.tkt;
    }
    return Object.values(m).sort((a, b) => cmp(a.code, b.code)).map((x) => {
      const cn = x.on + x.tdt - x.tkt;
      return { code: x.code, odt: x.on > 0 ? r2(x.on) : 0, okt: x.on < 0 ? r2(-x.on) : 0, tdt: r2(x.tdt), tkt: r2(x.tkt), cdt: cn > 0 ? r2(cn) : 0, ckt: cn < 0 ? r2(-cn) : 0 };
    });
  }

  /* Schyot kartochkasi: tanlangan schyot va uning subschyotlari */
  function matches(code, acc) {
    if (!code || !acc) return false;
    if (acc.length === 4 && acc.endsWith('00') && !isOff(acc)) return code.slice(0, 2) === acc.slice(0, 2) && !isOff(code);
    return code === acc || code.startsWith(acc + '.');
  }
  function card(recs, acc, from, to) {
    let start = 0;
    const op = opening(recs);
    if (op) (op.rows || []).forEach((r) => { if (matches(r.acc, acc)) start += (Number(r.dt) || 0) - (Number(r.kt) || 0); });
    const rows = [];
    for (const e of entries(recs)) {
      const d = matches(e.dt, acc), k = matches(e.kt, acc);
      if (!d && !k) continue;
      if (d && k) continue; // ichki aylanma
      const amt = d ? e.sum : -e.sum;
      if (from && e.date < from) { start += amt; continue; }
      if (to && e.date > to) continue;
      rows.push({ ...e, side: d ? 'dt' : 'kt', corr: d ? e.kt : e.dt });
    }
    let bal = start;
    rows.forEach((r) => { bal += r.side === 'dt' ? r.sum : -r.sum; r.bal = r2(bal); });
    const tdt = rows.filter((r) => r.side === 'dt').reduce((s, r) => s + r.sum, 0), tkt = rows.filter((r) => r.side === 'kt').reduce((s, r) => s + r.sum, 0);
    return { start: r2(start), rows, tdt: r2(tdt), tkt: r2(tkt), end: r2(bal) };
  }

  /* Buxgalteriya balansi (1-shakl) */
  const BAL = [
    { side: 'A', h: 'I. Uzoq muddatli aktivlar' },
    { line: '010', name: "Asosiy vositalar: boshlang'ich (qayta tiklash) qiymati", A: ['01', '03'] },
    { line: '011', name: 'Eskirish summasi', K: ['02'], sub: true },
    { line: '012', name: 'Qoldiq (balans) qiymati', f: (v) => v['010'] - v['011'] },
    { line: '020', name: "Nomoddiy aktivlar: boshlang'ich qiymati", A: ['04'] },
    { line: '021', name: 'Amortizatsiya summasi', K: ['05'], sub: true },
    { line: '022', name: 'Qoldiq (balans) qiymati', f: (v) => v['020'] - v['021'] },
    { line: '030', name: 'Uzoq muddatli investitsiyalar', A: ['06'] },
    { line: '090', name: "O'rnatiladigan asbob-uskunalar", A: ['07'] },
    { line: '100', name: "Kapital qo'yilmalar", A: ['08'] },
    { line: '110', name: 'Uzoq muddatli debitorlik qarzlari', A: ['0910', '0920', '0930', '0940'] },
    { line: '120', name: 'Uzoq muddatli kechiktirilgan xarajatlar', A: ['0950', '0960', '0990'] },
    { line: '130', name: "I bo'lim bo'yicha jami", f: (v) => v['012'] + v['022'] + v['030'] + v['090'] + v['100'] + v['110'] + v['120'], total: true },
    { side: 'A', h: 'II. Joriy aktivlar' },
    { line: '140', name: 'Tovar-moddiy zaxiralari, jami', f: (v) => v['150'] + v['160'] + v['170'] + v['180'], total: true },
    { line: '150', name: 'Ishlab chiqarish zaxiralari', A: ['10', '11', '15', '16'], sub: true },
    { line: '160', name: 'Tugallanmagan ishlab chiqarish', A: ['20', '21', '23', '25', '26', '27'], sub: true },
    { line: '170', name: 'Tayyor mahsulot', A: ['28'], sub: true },
    { line: '180', name: 'Tovarlar (savdo ustamasi chegirilgan)', A: ['29'], sub: true },
    { line: '190', name: 'Kelgusi davr xarajatlari', A: ['31'] },
    { line: '200', name: 'Muddati kechiktirilgan xarajatlar', A: ['32'] },
    { line: '210', name: 'Debitorlar, jami', f: (v) => ['220', '230', '240', '250', '260', '270', '280', '290', '300', '310'].reduce((s, k) => s + v[k], 0), total: true },
    { line: '220', name: 'Xaridorlar va buyurtmachilarning qarzi', A: ['40'], K: ['49'], sub: true },
    { line: '230', name: "Ajratilgan bo'linmalarning qarzi", A: ['4110'], sub: true },
    { line: '240', name: "Sho'ba va qaram xo'jalik jamiyatlarining qarzi", A: ['4120'], sub: true },
    { line: '250', name: "Xodimlarga berilgan bo'naklar", A: ['42'], sub: true },
    { line: '260', name: "Mol yetkazib beruvchilar va pudratchilarga berilgan bo'naklar", A: ['43'], sub: true },
    { line: '270', name: "Byudjetga soliq va yig'imlar bo'yicha bo'nak to'lovlari", A: ['44'], sub: true },
    { line: '280', name: "Maqsadli davlat jamg'armalari va sug'urtalar bo'yicha bo'nak to'lovlari", A: ['45'], sub: true },
    { line: '290', name: "Ta'sischilarning ustav kapitaliga ulushlar bo'yicha qarzi", A: ['46'], sub: true },
    { line: '300', name: "Xodimlarning boshqa operatsiyalar bo'yicha qarzi", A: ['47'], sub: true },
    { line: '310', name: 'Boshqa debitorlik qarzlari', A: ['48'], sub: true },
    { line: '320', name: "Pul mablag'lari, jami", f: (v) => v['330'] + v['340'] + v['350'] + v['360'], total: true },
    { line: '330', name: "Kassadagi pul mablag'lari", A: ['50'], sub: true },
    { line: '340', name: "Hisob-kitob schyotidagi pul mablag'lari", A: ['51'], sub: true },
    { line: '350', name: "Chet el valyutasidagi pul mablag'lari", A: ['52'], sub: true },
    { line: '360', name: "Boshqa pul mablag'lari va ekvivalentlari", A: ['55', '56', '57'], sub: true },
    { line: '370', name: 'Qisqa muddatli investitsiyalar', A: ['58'] },
    { line: '380', name: 'Boshqa joriy aktivlar', A: ['59'] },
    { line: '390', name: "II bo'lim bo'yicha jami", f: (v) => v['140'] + v['190'] + v['200'] + v['210'] + v['320'] + v['370'] + v['380'], total: true },
    { line: '400', name: 'Balans aktivi bo\'yicha jami', f: (v) => v['130'] + v['390'], grand: true },
    { side: 'P', h: "I. O'z mablag'lari manbalari" },
    { line: '410', name: 'Ustav kapitali', P: ['83'] },
    { line: '420', name: "Qo'shilgan kapital", P: ['84'] },
    { line: '430', name: 'Rezerv kapitali', P: ['85'] },
    { line: '440', name: 'Sotib olingan xususiy aksiyalar', K: ['86'], minus: true },
    { line: '450', name: 'Taqsimlanmagan foyda (qoplanmagan zarar)', P: ['87', '9'] },
    { line: '460', name: 'Maqsadli tushumlar', P: ['88'] },
    { line: '470', name: 'Kelgusi xarajatlar va to\'lovlar rezervlari', P: ['89'] },
    { line: '480', name: "I bo'lim bo'yicha jami", f: (v) => v['410'] + v['420'] + v['430'] - v['440'] + v['450'] + v['460'] + v['470'], total: true },
    { side: 'P', h: 'II. Majburiyatlar' },
    { line: '490', name: 'Majburiyatlar, jami', f: (v) => v['500'] + v['600'], total: true },
    { line: '500', name: 'Uzoq muddatli majburiyatlar', P: ['70', '71', '72', '73', '78', '79'], total: true },
    { line: '600', name: 'Joriy majburiyatlar', f: (v) => ['610', '620', '630', '640', '650', '660', '670', '680', '690', '700', '710', '720', '730', '740', '750', '760'].reduce((s, k) => s + v[k], 0), total: true },
    { line: '610', name: "Mol yetkazib beruvchilar va pudratchilarga qarz", P: ['60'], sub: true },
    { line: '620', name: "Ajratilgan bo'linmalarga qarz", P: ['6110'], sub: true },
    { line: '630', name: "Sho'ba va qaram xo'jalik jamiyatlariga qarz", P: ['6120'], sub: true },
    { line: '640', name: 'Kechiktirilgan daromadlar', P: ['6210', '6220', '6230'], sub: true },
    { line: '650', name: "Soliq va majburiy to'lovlar bo'yicha kechiktirilgan majburiyatlar", P: ['6240', '6250'], sub: true },
    { line: '660', name: 'Boshqa kechiktirilgan majburiyatlar', P: ['6290'], sub: true },
    { line: '670', name: "Olingan bo'naklar", P: ['63'], sub: true },
    { line: '680', name: "Byudjetga to'lovlar bo'yicha qarz", P: ['64'], sub: true },
    { line: '690', name: "Sug'urtalar bo'yicha qarz", P: ['6510'], sub: true },
    { line: '700', name: "Maqsadli davlat jamg'armalariga to'lovlar bo'yicha qarz", P: ['6520'], sub: true },
    { line: '710', name: "Ta'sischilarga qarzlar", P: ['66'], sub: true },
    { line: '720', name: "Mehnat haqi bo'yicha qarz", P: ['67'], sub: true },
    { line: '730', name: 'Qisqa muddatli bank kreditlari', P: ['6810'], sub: true },
    { line: '740', name: 'Qisqa muddatli qarzlar', P: ['6820', '6830', '6840'], sub: true },
    { line: '750', name: "Uzoq muddatli majburiyatlarning joriy qismi", P: ['6950'], sub: true },
    { line: '760', name: 'Boshqa kreditorlik qarzlari', P: ['6910', '6920', '6930', '6940', '6960', '6970', '6990'], sub: true },
    { line: '770', name: "II bo'lim bo'yicha jami", f: (v) => v['490'], total: true },
    { line: '780', name: "Balans passivi bo'yicha jami", f: (v) => v['480'] + v['770'], grand: true }
  ];
  function balanceSheet(recs, date) {
    const b = balancesUntil(recs, date, true);
    const net = {}; for (const c in b) net[c] = b[c].dt - b[c].kt;
    const sumPref = (prefs) => Object.entries(net).filter(([c]) => !isOff(c) && prefs.some((p) => c.startsWith(p))).reduce((s, [, v]) => s + v, 0);
    const v = {};
    const rows = [];
    for (const L of BAL) {
      if (L.h) { rows.push({ head: L.h, side: L.side }); continue; }
      let val = 0; // formulali qatorlar keyin hisoblanadi
      if (!L.f) {
        if (L.A) val = sumPref(L.A) + (L.K ? sumPref(L.K) : 0);
        else if (L.K) val = L.minus ? sumPref(L.K) : -sumPref(L.K);
        else if (L.P) val = -sumPref(L.P);
      }
      v[L.line] = val;
      rows.push({ ...L, val });
    }
    // formulalar (bir necha marta — bog'liqliklar uchun)
    for (let k = 0; k < 4; k++) for (const r of rows) if (r.f) { r.val = r.f(v); v[r.line] = r.val; }
    rows.forEach((r) => { if (r.line) r.val = r2(r.val); });
    return { rows, aktiv: r2(v['400']), passiv: r2(v['780']) };
  }

  /* ---- Provodka takliflari ---- */
  const stockAcc = (p) => (p && p.acc) || (p && p.ptype === 'produced' ? '2810' : '2910');
  const revAcc = (p) => (p && p.ptype === 'service' ? '9030' : p && p.ptype === 'produced' ? '9010' : '9020');
  const cogsAcc = (p) => (p && p.ptype === 'produced' ? '9110' : '9120');
  function addE(list, dt, kt, sum, note) {
    sum = r2(sum); if (Math.abs(sum) < EPS) return;
    const ex = list.find((e) => e.dt === dt && e.kt === kt && (e.note || '') === (note || ''));
    if (ex) ex.sum = r2(ex.sum + sum); else list.push({ dt, kt, sum, note: note || '' });
  }
  function suggestDoc(doc, dc, byId, vatPayer) {
    const out = [];
    if (!dc) return out;
    (doc.lines || []).forEach((l, i) => {
      const p = byId(l.p); const lc = dc.lines[i] || {}; if (!p) return;
      const credit = vatPayer && lc.vat > 0;
      const svc = p.ptype === 'service';
      switch (doc.type) {
        case 'receipt':
          addE(out, svc ? (p.acc || '9420') : stockAcc(p), '6010', credit ? lc.base : lc.total);
          if (credit) addE(out, '4410', '6010', lc.vat, 'QQS');
          break;
        case 'sale':
          addE(out, '4010', revAcc(p), lc.base);
          if (lc.vat) addE(out, '4010', '6410', lc.vat, 'QQS');
          if (!svc && lc.cost) addE(out, cogsAcc(p), stockAcc(p), lc.cost, 'Tannarx');
          break;
        case 'return_in':
          addE(out, '9040', '4010', lc.base);
          if (lc.vat) addE(out, '6410', '4010', lc.vat, 'QQS');
          if (!svc && lc.cost) addE(out, stockAcc(p), cogsAcc(p), lc.cost, 'Tannarx');
          break;
        case 'return_out':
          addE(out, '6010', svc ? (p.acc || '9420') : stockAcc(p), credit ? lc.base : lc.total);
          if (credit) addE(out, '6010', '4410', lc.vat, 'QQS');
          break;
        case 'writeoff':
          addE(out, '9430', stockAcc(p), lc.cost);
          break;
        case 'inventory':
          if ((lc.cost || 0) > 0) addE(out, stockAcc(p), '9390', lc.cost, 'Ortiqcha');
          if ((lc.cost || 0) < 0) addE(out, '5910', stockAcc(p), -lc.cost, 'Kamomad');
          break;
        case 'production':
          (lc.mats || []).forEach((m) => { const mp = byId(m.p); addE(out, stockAcc(p), (mp && mp.acc) || '1010', m.cost); });
          if (doc.includeCosts && lc.extra) addE(out, stockAcc(p), '2010', lc.extra, "Qo'shimcha xarajatlar");
          break;
      }
    });
    return out;
  }
  const EXP_ACC = { salary: ['9420', '6710'], social: ['9420', '6520'], rent: ['9420', '6010'], transport: ['9410', '6010'], utility: ['9420', '6010'], comm: ['9420', '6010'],
    bank: ['9420', '5110'], repair: ['9420', '6010'], office: ['9420', '6010'], advert: ['9410', '6010'], taxes: ['9420', '6410'], service: ['9420', '6010'],
    penalty: ['9430', '6410'], charity: ['9430', '6010'], entertain: ['9420', '6010'], other_nd: ['9430', '6010'], other: ['9420', '6010'] };
  function suggestExpense(e, vatPayer) {
    const out = []; const [dt, kt] = EXP_ACC[e.category] || ['9420', '6010'];
    const vat = Number(e.vat) || 0; const credit = vatPayer && vat > 0;
    addE(out, dt, kt, (Number(e.amount) || 0) + (credit ? 0 : vat));
    if (credit) addE(out, '4410', kt, vat, 'QQS');
    return out;
  }
  function suggestPayment(p) {
    const cash = p.method === 'cash' ? '5010' : '5110';
    if (p.method === 'offset') return [{ dt: '6010', kt: '4010', sum: r2(p.amount), note: '' }];
    return p.direction === 'in' ? [{ dt: cash, kt: '4010', sum: r2(p.amount), note: '' }] : [{ dt: '6010', kt: cash, sum: r2(p.amount), note: '' }];
  }
  function suggestAsset(a, vatPayer) {
    const out = []; const vat = Number(a.vat) || 0; const credit = vatPayer && vat > 0;
    addE(out, a.acc || '0190', '6010', (Number(a.cost) || 0) + (credit ? 0 : vat));
    if (credit) addE(out, '4410', '6010', vat, 'QQS');
    return out;
  }
  /* Oylik eskirish provodkasi taklifi */
  function suggestDepreciation(assets, calc, ym) {
    const out = [];
    for (const a of assets) {
      const s = ((calc.assets[a.id] || {}).schedule || {})[ym];
      if (!s) continue;
      const acc = a.acc || '0190';
      const depAcc = a.dep_acc || ('02' + acc.slice(2, 4));
      addE(out, a.exp_acc || '9420', depAcc, s, a.name);
    }
    return out;
  }

  window.Acc = { list, isOff, entries, opening, missing, osv, groupRows, card, balanceSheet, suggestDoc, suggestExpense, suggestPayment, suggestAsset, suggestDepreciation, matches, cmp };
})();
