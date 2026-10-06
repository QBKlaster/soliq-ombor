/* Bank (hisob raqam): kirim-chiqim harakati, qoldiq va hisob-fakturalar bilan solishtirish */
(function () {
  const A = window.App; const { S, t } = A; const C = window.Components;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const EPS = 0.005;
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.created_at || '') < String(b.created_at || '') ? -1 : 1);
  const DOC_IN = { sale: 1, return_in: -1 };          // biz yuborgan fakturalar (xaridorga)
  const DOC_OUT = { receipt: 1, return_out: -1 };     // bizga kelgan fakturalar (yetkazib beruvchidan)

  /* Hisob-fakturalar ro'yxati: kontragent va yo'nalish bo'yicha */
  function invoices() {
    const out = [];
    const total = (d) => ((S.calc.docCalc[d.id] || {}).total) || 0;
    for (const d of A.recsOf('doc')) {
      if (!d.cp) continue;
      if (DOC_IN[d.type]) out.push({ id: d.id, rec: d, dir: 'in', cp: d.cp, date: d.date, created_at: d.created_at, amount: r2(total(d) * DOC_IN[d.type]), label: A.label(d) });
      if (DOC_OUT[d.type]) out.push({ id: d.id, rec: d, dir: 'out', cp: d.cp, date: d.date, created_at: d.created_at, amount: r2(total(d) * DOC_OUT[d.type]), label: A.label(d) });
    }
    for (const e of A.recsOf('expense')) if (e.cp) out.push({ id: e.id, rec: e, dir: 'out', cp: e.cp, date: e.date, created_at: e.created_at, amount: r2((Number(e.amount) || 0) + (Number(e.vat) || 0)), label: A.label(e) });
    for (const a of A.recsOf('asset')) if (a.cp) out.push({ id: a.id, rec: a, dir: 'out', cp: a.cp, date: a.acquire_date, created_at: a.created_at, amount: r2((Number(a.cost) || 0) + (Number(a.vat) || 0)), label: A.label(a) });
    return out;
  }

  /* To'lovlarni fakturalarga navbat bilan (FIFO) bog'lash.
     Avans: to'lov fakturadan oldin bo'lsa, keyingi faktura uni yopadi. */
  function match() {
    const inv = invoices(); const pays = A.recsOf('payment').filter((p) => p.cp);
    const res = { pay: {}, inv: {} };
    const groups = {};
    const key = (cp, dir) => cp + '|' + dir;
    for (const i of inv) (groups[key(i.cp, i.dir)] = groups[key(i.cp, i.dir)] || { inv: [], pay: [] }).inv.push(i);
    for (const p of pays) {
      const mode = p.fak || 'auto';
      if (mode !== 'auto') { res.pay[p.id] = { mode, covered: mode === 'manual' ? Number(p.amount) || 0 : 0, alloc: [] }; continue; }
      (groups[key(p.cp, p.direction)] = groups[key(p.cp, p.direction)] || { inv: [], pay: [] }).pay.push(p);
    }
    for (const g of Object.values(groups)) {
      g.inv.sort(byDate); g.pay.sort(byDate);
      // qaytarishlar (manfiy) eng oxirgi oldingi fakturalarni kamaytiradi
      const q = [];
      for (const i of g.inv) {
        if (i.amount >= 0) { const o = { ...i, left: i.amount, paid: 0, alloc: [] }; q.push(o); res.inv[i.id] = o; continue; }
        let back = -i.amount;
        for (let k = q.length - 1; k >= 0 && back > EPS; k--) { const take = Math.min(q[k].left, back); q[k].left = r2(q[k].left - take); q[k].reduced = r2((q[k].reduced || 0) + take); back = r2(back - take); }
      }
      let k = 0;
      for (const p of g.pay) {
        let left = Number(p.amount) || 0; const alloc = [];
        while (left > EPS && k < q.length) {
          if (q[k].left <= EPS) { k++; continue; }
          const take = Math.min(left, q[k].left);
          q[k].left = r2(q[k].left - take); q[k].paid = r2(q[k].paid + take); q[k].alloc.push({ pay: p, amt: r2(take) });
          alloc.push({ inv: q[k], amt: r2(take) }); left = r2(left - take);
        }
        res.pay[p.id] = { mode: 'auto', covered: r2((Number(p.amount) || 0) - left), alloc };
      }
    }
    return res;
  }

  /* holat: full | part | none | skip (talab qilinmaydi) */
  function payStatus(p, m) {
    const x = (m || match()).pay[p.id] || { mode: 'auto', covered: 0, alloc: [] };
    const amt = Number(p.amount) || 0; const verb = p.direction === 'in' ? t('yuborilgan') : t('qabul qilingan');
    if (x.mode === 'none') return { st: 'skip', text: t('Faktura talab qilinmaydi'), short: '—', ...x };
    if (x.mode === 'manual') return { st: 'full', text: '✓ ' + t('Faktura {0}', verb) + (p.fak_no ? ' №' + p.fak_no : '') + (p.fak_date ? ' ' + A.dateFmt(p.fak_date) : '') + ' ' + t('(tizimdan tashqari)'), short: '✓', ...x };
    const docs = x.alloc.map((a) => a.inv.label + (Math.abs(a.amt - a.inv.amount) > EPS ? ' (' + A.money(a.amt) + ')' : '')).join('; ');
    if (x.covered >= amt - EPS && amt > 0) return { st: 'full', text: '✓ ' + t('Faktura {0}', verb) + ': ' + docs, short: '✓', ...x };
    if (x.covered > EPS) return { st: 'part', text: '◐ ' + t('Qisman: {0} fakturasiz', A.money(amt - x.covered)) + ' · ' + docs, short: '◐', ...x };
    return { st: 'none', text: '✕ ' + (p.direction === 'in' ? t('Faktura yuborilmagan (avans)') : t('Faktura kelmagan (avans)')), short: '✕', ...x };
  }

  /* bank hisobidagi boshlang'ich qoldiq: boshlang'ich qoldiqlardagi 51xx schyotlar */
  function bankOpening() {
    const op = Acc.opening(S.recs); if (!op) return { sum: 0, date: '' };
    const sum = (op.rows || []).filter((r) => String(r.acc || '').startsWith('51')).reduce((s, r) => s + (Number(r.dt) || 0) - (Number(r.kt) || 0), 0);
    return { sum: r2(sum), date: op.date || '' };
  }

  /* bank harakati: bank orqali to'lovlar + bankdan to'langan xarajatlar (kontragentsiz) */
  function moves(m) {
    const out = [];
    for (const p of A.recsOf('payment')) {
      if ((p.method || 'bank') !== 'bank') continue;
      const s = payStatus(p, m);
      out.push({ id: p.id, rec: p, kind: 'payment', date: p.date, created_at: p.created_at, number: p.number || '', cp: p.cp, inn: (A.byId(p.cp) || {}).inn || '',
        inA: p.direction === 'in' ? Number(p.amount) || 0 : 0, outA: p.direction === 'out' ? Number(p.amount) || 0 : 0, st: s.st, stText: s.text, note: p.note || '' });
    }
    for (const e of A.recsOf('expense')) {
      if (e.cp || e.paid !== 'bank') continue;
      out.push({ id: e.id, rec: e, kind: 'expense', date: e.date, created_at: e.created_at, number: e.number || '', cp: '', inn: '', cpText: e.descr || A.expCat(e.category),
        inA: 0, outA: (Number(e.amount) || 0) + (Number(e.vat) || 0), st: 'skip', stText: t('Xarajat: {0}', A.expCat(e.category)), note: e.note || '' });
    }
    return out.sort(byDate);
  }

  const ST_LABEL = { full: 'Faktura bor', part: 'Qisman', none: 'Fakturasiz', skip: 'Talab qilinmaydi' };
  const stCls = (r) => ({ full: 'st-ok', part: 'st-warn', none: 'st-bad', skip: 'muted' }[r.st] || '');

  C['bank-view'] = {
    data() { const y = A.today().slice(0, 4); return { tab: 'moves', from: y + '-01-01', to: A.today(), dir: '', st: '', cp: '' }; },
    computed: {
      m() { void S.recs.length; return match(); },
      open() { return bankOpening(); },
      all() { return moves(this.m); },
      startBal() { return r2(this.open.sum + this.all.filter((x) => x.date < this.from).reduce((s, x) => s + x.inA - x.outA, 0)); },
      rows() {
        let bal = this.startBal; const out = [];
        for (const x of this.all) {
          if (x.date < this.from || x.date > this.to) continue;
          bal = r2(bal + x.inA - x.outA);
          if (this.dir === 'in' && !x.inA) continue; if (this.dir === 'out' && !x.outA) continue;
          if (this.st && x.st !== this.st) continue; if (this.cp && x.cp !== this.cp) continue;
          out.push({ ...x, bal, cpName: x.cpText || (A.byId(x.cp) || {}).name || '' });
        }
        return out;
      },
      tot() { const s = (f) => r2(this.rows.reduce((a, r) => a + f(r), 0)); return { inA: s((r) => r.inA), outA: s((r) => r.outA), inNo: s((r) => (r.inA && (r.st === 'none' || r.st === 'part') ? r.inA - (this.m.pay[r.id] || {}).covered : 0)), outNo: s((r) => (r.outA && (r.st === 'none' || r.st === 'part') ? r.outA - (this.m.pay[r.id] || {}).covered : 0)) }; },
      endBal() { return r2(this.startBal + this.all.filter((x) => x.date >= this.from && x.date <= this.to).reduce((s, x) => s + x.inA - x.outA, 0)); },
      cols() {
        return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'number', label: '№', mono: true },
          { k: 'cpName', label: 'Kontragent' }, { k: 'inn', label: 'STIR', mono: true },
          { k: 'inA', label: 'Kirim', num: true, f: (r) => (r.inA ? A.money(r.inA) : '') }, { k: 'outA', label: 'Chiqim', num: true, f: (r) => (r.outA ? A.money(r.outA) : '') },
          { k: 'bal', label: 'Qoldiq', num: true, f: (r) => A.money(r.bal) },
          { k: 'st', label: 'Hisob-faktura', f: (r) => r.stText, x: (r) => t(ST_LABEL[r.st]) + ': ' + r.stText, cls: stCls, sv: (r) => r.st },
          { k: 'note', label: 'Izoh' }];
      },
      foot() { return { inA: this.tot.inA, outA: this.tot.outA }; },
      invRows() {
        const out = [];
        for (const i of Object.values(this.m.inv)) {
          if (i.date < this.from || i.date > this.to) continue;
          if (this.dir && i.dir !== this.dir) continue; if (this.cp && i.cp !== this.cp) continue;
          const net = r2(i.amount - (i.reduced || 0));
          const st = i.left <= EPS ? 'full' : i.paid > EPS ? 'part' : 'none';
          if (this.st && this.st !== st && !(this.st === 'skip')) continue;
          out.push({ id: i.id, rec: i.rec, date: i.date, label: i.label, dir: i.dir, cpName: (A.byId(i.cp) || {}).name || '', inn: (A.byId(i.cp) || {}).inn || '', amount: net, paid: i.paid, left: i.left, st,
            pays: i.alloc.map((a) => A.dateFmt(a.pay.date) + (a.pay.number ? ' №' + a.pay.number : '') + ' — ' + A.money(a.amt)).join('; ') });
        }
        return out.sort((a, b) => (a.date < b.date ? -1 : 1));
      },
      invCols() {
        const stT = { full: "✓ To'langan", part: "◐ Qisman to'langan", none: "✕ To'lanmagan" };
        return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'label', label: 'Hujjat (faktura)' },
          { k: 'dir', label: "Yo'nalish", f: (r) => (r.dir === 'in' ? t('Biz yuborgan') : t('Bizga kelgan')) },
          { k: 'cpName', label: 'Kontragent' }, { k: 'inn', label: 'STIR', mono: true },
          { k: 'amount', label: 'Faktura summasi', num: true, f: (r) => A.money(r.amount) }, { k: 'paid', label: "To'langan", num: true, f: (r) => A.money(r.paid) },
          { k: 'left', label: "To'lanmagan", num: true, f: (r) => (r.left > EPS ? A.money(r.left) : '') },
          { k: 'st', label: 'Holati', f: (r) => t(stT[r.st]), cls: stCls, sv: (r) => r.st }, { k: 'pays', label: "To'lovlar" }];
      },
      invFoot() { const s = (k) => r2(this.invRows.reduce((a, r) => a + r[k], 0)); return { amount: s('amount'), paid: s('paid'), left: s('left') }; },
      acct() { const f = S.firm || {}; return [f.bank, f.mfo ? 'MFO ' + f.mfo : '', f.account].filter(Boolean).join(' · '); }
    },
    methods: {
      openRow(r) { if (r.kind === 'expense') Forms.editRec('expense', A.byId(r.id)); else Forms.editRec('payment', A.byId(r.id)); },
      openInv(r) { const x = A.byId(r.id); if (!x) return; if (x.kind === 'doc') { S.editDoc = { doc: JSON.parse(JSON.stringify(x)) }; S.view = 'docs'; } else Forms.editRec(x.kind, x); },
      add(dir) { Forms.editRec('payment', null, { init: { direction: dir, method: 'bank', date: A.today() } }); },
      reset() { const y = A.today().slice(0, 4); Object.assign(this, { from: y + '-01-01', to: A.today(), dir: '', st: '', cp: '' }); }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Bank (hisob raqam)')}}</h1>
          <p class="muted">{{ acct || t('Firma rekvizitlarida bank va hisob raqamni kiriting') }}</p></div>
        <div class="row-gap"><button class="btn ghost" @click="add('out')">− {{t('Chiqim (biz to\\'ladik)')}}</button>
          <button class="btn primary" @click="add('in')">+ {{t('Kirim (bizga to\\'landi)')}}</button></div></header>
      <div class="filter-grid">
        <label class="fld"><span>{{t('Dan')}}</span><input type="date" v-model="from" id="bk-from"></label>
        <label class="fld"><span>{{t('Gacha')}}</span><input type="date" v-model="to" id="bk-to"></label>
        <label class="fld"><span>{{t("Yo'nalish")}}</span><select v-model="dir" id="bk-dir"><option value="">{{t('Hammasi')}}</option><option value="in">{{t('Kirim')}}</option><option value="out">{{t('Chiqim')}}</option></select></label>
        <label class="fld"><span>{{t('Hisob-faktura')}}</span><select v-model="st" id="bk-st"><option value="">{{t('Hammasi')}}</option>
          <option value="full">{{t('Faktura bor')}}</option><option value="part">{{t('Qisman')}}</option><option value="none">{{t('Fakturasiz')}}</option><option value="skip" v-if="tab==='moves'">{{t('Talab qilinmaydi')}}</option></select></label>
        <label class="fld"><span>{{t('Kontragent')}}</span><select v-model="cp" id="bk-cp"><option value="">{{t('Hammasi')}}</option><option v-for="o in Forms.cpOpts()" :key="o[0]" :value="o[0]">{{o[1]}}</option></select></label>
        <div class="fld fl-actions"><button class="btn ghost sm" @click="reset">{{t('Filtrni tozalash')}}</button></div>
      </div>
      <div class="kpis">
        <kpi :label="t('Davr boshiga qoldiq')" :value="money(startBal)" :sub="open.date ? t('Boshlang\\'ich qoldiq: {0}', money(open.sum)) : t('Boshlang\\'ich qoldiq kiritilmagan')"></kpi>
        <kpi :label="t('Kirim')" :value="money(tot.inA)" :sub="tot.inNo > 0.005 ? t('Fakturasiz: {0}', money(tot.inNo)) : t('Hammasiga faktura yuborilgan')" :tone="tot.inNo > 0.005 ? 'warn' : ''"></kpi>
        <kpi :label="t('Chiqim')" :value="money(tot.outA)" :sub="tot.outNo > 0.005 ? t('Fakturasiz: {0}', money(tot.outNo)) : t('Hammasiga faktura kelgan')" :tone="tot.outNo > 0.005 ? 'warn' : ''"></kpi>
        <kpi :label="t('Davr oxiriga qoldiq')" :value="money(endBal)" :tone="endBal < -0.005 ? 'warn' : ''"></kpi>
      </div>
      <div class="tabs"><button :class="{on:tab==='moves'}" @click="tab='moves'">{{t('Bank harakati')}}</button><button :class="{on:tab==='inv'}" @click="tab='inv'">{{t('Fakturalar bo\\'yicha to\\'lovlar')}}</button></div>
      <data-table v-if="tab==='moves'" :cols="cols" :rows="rows" :foot="foot" clickable @row="openRow" export-name="bank_harakati" :export-title="(S.firm||{}).name + ' — ' + t('Bank harakati') + ' ' + dateFmt(from) + '–' + dateFmt(to)"
        empty="Bu davrda bank orqali to'lov yo'q"></data-table>
      <data-table v-else :cols="invCols" :rows="invRows" :foot="invFoot" clickable @row="openInv" export-name="fakturalar_tolovi" empty="Bu davrda faktura yo'q"></data-table>
      <p class="note">{{t('To\\'lovlar kontragentning fakturalariga sana tartibida (eng eskisidan) bog\\'lanadi: avans to\\'langan bo\\'lsa, keyin yozilgan faktura uni yopadi. Soliq, ish haqi, qarz kabi fakturasi bo\\'lmaydigan to\\'lovlarda to\\'lov kartasida "Faktura talab qilinmaydi" ni tanlang. Kontragentsiz bankdan to\\'langan xarajatlar ham shu yerda ko\\'rinadi.')}}</p>
    </section>`
  };

  window.Bank = { match, payStatus, invoices, moves, bankOpening };
})();
