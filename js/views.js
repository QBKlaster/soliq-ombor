/* Ekranlar */
(function () {
  const A = window.App; const { S, t } = A; const C = window.Components; const E = window.Engine;
  const curYear = () => new Date().getFullYear();
  const whName = (id) => { const w = A.byId(id); return w ? w.name : '—'; };
  const cpName = (id) => { const c = A.byId(id); return c ? c.name : ''; };

  /* ---------------- Kirish ---------------- */
  C['login-view'] = {
    data() { return { login: '', pass: '', err: '', busy: false }; },
    methods: {
      async go() {
        this.err = ''; this.busy = true;
        try { S.user = await S.store.login(this.login, this.pass); await window.afterLogin(); }
        catch (e) { this.err = A.errText(e); }
        this.busy = false;
      }
    },
    template: `
    <div class="login-wrap">
      <form class="login-card" @submit.prevent="go">
        <div class="brand big"><span class="mark">Σ</span><span>{{t('Soliq va ombor')}}</span></div>
        <p class="muted">{{t('Buxgalterlar uchun QQS, foyda solig\\'i va ombor hisobi')}}</p>
        <div class="fld"><label for="lg-login">{{t('Login')}}</label><input id="lg-login" v-model="login" autocomplete="username" autofocus></div>
        <div class="fld"><label for="lg-pass">{{t('Parol')}}</label><pw-input id="lg-pass" v-model="pass" autocomplete="current-password"></pw-input></div>
        <p class="err" v-if="err">{{err}}</p>
        <button class="btn primary block" :disabled="busy">{{t('Kirish')}}</button>
        <p class="note" v-if="S.store && S.store.mode==='local'">{{t('Lokal rejim. Birinchi kirish: login admin, parol admin')}}</p>
        <div class="lang-row">
          <button type="button" v-for="l in [['uz','Lotin'],['cy','Кирилл'],['ru','Русский']]" :key="l[0]" class="chip" :class="{on:S.lang===l[0]}" @click="setLang(l[0])">{{l[1]}}</button>
        </div>
      </form>
    </div>`
  };

  C['change-pass'] = {
    props: { forced: Boolean },
    data() { return { p1: '', p2: '', err: '' }; },
    methods: {
      async save() {
        if (this.p1.length < 6) { this.err = t('Parol kamida 6 belgidan iborat bo\'lsin'); return; }
        if (this.p1 !== this.p2) { this.err = t('Parollar mos emas'); return; }
        try { S.user = await S.store.changePassword(this.p1); A.toast(t('Parol almashtirildi')); A.closeModal(true); }
        catch (e) { this.err = A.errText(e); }
      }
    },
    template: `
    <x-modal :title="t('Parolni almashtirish')" @close="!forced && closeModal()">
      <form class="form-grid" @submit.prevent="save">
        <p class="note full" v-if="forced">{{t('Xavfsizlik uchun vaqtinchalik parolni o\\'zingizning parolingizga almashtiring')}}</p>
        <div class="fld full"><label for="cp1">{{t('Yangi parol')}}</label><pw-input id="cp1" v-model="p1" autocomplete="new-password"></pw-input></div>
        <div class="fld full"><label for="cp2">{{t('Parolni takrorlang')}}</label><pw-input id="cp2" v-model="p2" autocomplete="new-password"></pw-input></div>
        <p class="err full" v-if="err">{{err}}</p>
        <button hidden></button>
      </form>
      <template #footer><span class="grow"></span><button class="btn primary" @click="save">{{t('Saqlash')}}</button></template>
    </x-modal>`
  };

  /* ---------------- Admin ---------------- */
  C['admin-users'] = {
    computed: {
      rows() {
        return S.users.filter((u) => !u.role || u.role === 'accountant').map((u) => ({ ...u, used: S.firms.filter((f) => f.owner_id === u.id).length }));
      },
      cols() {
        return [
          { k: 'login', label: 'Login', mono: true }, { k: 'full_name', label: 'F.I.Sh.' }, { k: 'phone', label: 'Telefon' },
          { k: 'used', label: 'Firmalar', f: (r) => r.used + ' / ' + r.firm_limit },
          { k: 'expires_at', label: 'Obuna tugashi', f: (r) => (r.expires_at ? A.dateFmt(r.expires_at) : t('Muddatsiz')) },
          { k: 'active', label: 'Holati', f: (r) => (!r.active ? t('Bloklangan') : r.expires_at && r.expires_at < A.today() ? t('Muddati tugagan') : t('Faol')) }
        ];
      }
    },
    methods: {
      async edit(u) {
        const r = await A.openModal('rec-form', {
          title: u ? t('Buxgalter') + ': ' + u.login : t('Yangi buxgalter'), fields: Forms.F.user(!u), value: u || {},
          onSave: async (m) => { const { password, used, ...d } = m; return S.store.saveUser(d, password); },
          onDelete: u ? async () => { await S.store.deleteUser(u.id); } : null,
          deleteText: u ? t('"{0}" buxgalteri va uning {1} ta firmasi barcha ma\'lumotlari bilan butunlay o\'chiriladi. Buni qaytarib bo\'lmaydi. Davom etasizmi?', u.login, S.firms.filter((f) => f.owner_id === u.id).length) : ''
        });
        if (r === 'deleted') { S.users = await S.store.listUsers(); await A.loadFirms(); A.toast(t("O'chirildi")); }
        else if (r) { S.users = await S.store.listUsers(); A.toast(t('Saqlandi')); }
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Buxgalterlar')}}</h1><p class="muted">{{t('Login beriladi, firmalar limiti va obuna muddati shu yerda boshqariladi')}}</p></div>
        <button class="btn primary" @click="edit()">+ {{t('Buxgalter qo\\'shish')}}</button></header>
      <data-table :cols="cols" :rows="rows" clickable @row="edit" export-name="buxgalterlar" empty="Hali buxgalter qo'shilmagan"></data-table>
    </section>`
  };

  C['admin-firms'] = {
    computed: {
      rows() { return S.firms.map((f) => ({ ...f, owner: (S.users.find((u) => u.id === f.owner_id) || {}).login || '—' })); },
      cols() { return [{ k: 'name', label: 'Firma' }, { k: 'inn', label: 'STIR', mono: true }, { k: 'regime', label: 'Soliq rejimi', f: (r) => t(A.REGIME_LABEL[r.regime] || '') }, { k: 'owner', label: 'Buxgalter', mono: true }, { k: 'created_at', label: 'Yaratilgan', f: (r) => A.dateFmt((r.created_at || '').slice(0, 10)) }]; }
    },
    methods: {
      async del(f) {
        if (!(await A.ask(t('"{0}" firmasi va uning barcha ma\'lumotlari o\'chiriladi. Davom etasizmi?', f.name), t("O'chirish"), true))) return;
        try { await S.store.deleteFirm(f.id); await A.loadFirms(); A.toast(t("O'chirildi")); } catch (e) { A.toast(A.errText(e), 'err'); }
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Barcha firmalar')}}</h1><p class="muted">{{t('Firmani ochish uchun qatorni bosing')}}</p></div></header>
      <data-table :cols="cols" :rows="rows" clickable @row="openFirm" export-name="firmalar"></data-table>
      <details class="danger-zone"><summary>{{t('Firmani o\\'chirish')}}</summary>
        <div class="chips"><button v-for="f in S.firms" :key="f.id" class="btn danger ghost sm" @click="del(f)">✕ {{f.name}}</button></div>
      </details>
    </section>`
  };

  C['admin-settings'] = {
    methods: {
      async edit() {
        const r = await A.openModal('rec-form', { title: t('Soliq stavkalari'), fields: Forms.F.settings(), value: S.settings, onSave: async (m) => { await S.store.saveSettings(m); S.settings = { ...S.settings, ...m }; return true; } });
        if (r) A.toast(t('Saqlandi'));
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Soliq stavkalari')}}</h1><p class="muted">{{t('Stavka o\\'zgarsa shu yerda yangilang, barcha firmalarda darhol kuchga kiradi')}}</p></div>
        <button class="btn primary" @click="edit">{{t('O\\'zgartirish')}}</button></header>
      <div class="kpis">
        <kpi :label="t('QQS')" :value="S.settings.vat_rate + '%'"></kpi>
        <kpi :label="t('Pasaytirilgan QQS')" :value="(S.settings.vat_rate_red ?? 6) + '%'"></kpi>
        <kpi :label="t('Foyda solig\\'i')" :value="S.settings.profit_rate + '%'"></kpi>
        <kpi :label="t('Aylanma solig\\'i (umumiy)')" :value="S.settings.turnover_rate + '%'"></kpi>
      </div>
    </section>`
  };

  /* ---------------- Firmalar ro'yxati ---------------- */
  C['firms-view'] = {
    computed: {
      mine() { return A.isStaff() ? S.firms.filter((f) => f.owner_id === S.user.id) : S.firms; },
      canAdd() { return S.user.role === 'admin' || this.mine.length < (S.user.firm_limit || 0); }
    },
    methods: {
      async add() {
        if (!this.canAdd) { A.toast(A.errText(new Error('ERR_FIRM_LIMIT')), 'err'); return; }
        const r = await A.openModal('rec-form', { title: t('Yangi firma'), fields: Forms.F.firm(true), value: {}, wide: true, onSave: (m) => A.saveFirm(m) });
        if (r && r.id) { A.toast(t('Firma yaratildi')); A.openFirm(r); }
      },
      async demo() {
        if (!this.canAdd) { A.toast(A.errText(new Error('ERR_FIRM_LIMIT')), 'err'); return; }
        S.busy = t('Namuna firma yaratilmoqda…');
        try { const f = await window.Demo.create(); await A.openFirm(f); A.toast(t('Namuna firma yaratildi')); } catch (e) { A.toast(A.errText(e), 'err'); }
        S.busy = '';
      }
    },
    template: `
    <section class="page narrow">
      <header class="page-h"><div><h1>{{t('Firmalarim')}}</h1>
        <p class="muted" v-if="S.user.role!=='admin'">{{t('Limit: {0} / {1} firma', mine.length, S.user.firm_limit)}}</p></div>
        <div class="row-gap wrap"><button class="btn ghost" v-if="!isStaff()" @click="S.adminView='calendar'">▣ {{t('Soliq kalendari')}}</button><button class="btn ghost" @click="demo" v-if="canAdd">{{t('Namuna firma')}}</button>
        <button class="btn primary" @click="add" :disabled="!canAdd">+ {{t('Yangi firma')}}</button></div></header>
      <div class="firm-grid">
        <button class="firm-card" v-for="f in mine" :key="f.id" @click="openFirm(f)">
          <span class="fc-name">{{f.name}}</span>
          <span class="mono muted">{{t('STIR')}} {{f.inn}}</span>
          <span class="pill">{{t(REGIME_LABEL[f.regime] || '')}}</span>
          <span class="muted small">{{t('Tannarx')}}: {{ f.cost_method==='fifo' ? 'FIFO' : t('O\\'rtacha') }}<template v-if="f.closed_until"> · {{t('Yopilgan')}}: {{monthName(f.closed_until)}}</template></span>
        </button>
        <div class="empty-card" v-if="!mine.length">
          <p>{{t('Hali firma yo\\'q. Yangi firma qo\\'shing yoki tizimni sinab ko\\'rish uchun namuna firma yarating.')}}</p>
        </div>
      </div>
      <news-block v-if="!isStaff()"></news-block>
      <p class="note" v-if="!canAdd && S.user.role!=='admin'">{{t('Firmalar limiti tugagan. Limitni oshirish uchun administratorga murojaat qiling')}}</p>
    </section>`
  };

  /* ---------------- Bosh sahifa ---------------- */
  C['dash-view'] = {
    computed: {
      c() { return S.calc; },
      ymNow() { return A.today().slice(0, 7); },
      vat() { if (!E.isVatPayer(S.firm)) return null; return E.vatReport(this.c, curYear()).find((r) => r.ym === this.ymNow); },
      profit() { if (!E.isProfitPayer(S.firm)) return null; const q = Math.floor((new Date().getMonth()) / 3); return E.profitReport(this.c, curYear(), A.profitRate())[q]; },
      turnover() { if (!E.isTurnoverPayer(S.firm)) return null; return E.turnoverReport(this.c, curYear(), A.turnoverRate()).find((r) => r.ym === this.ymNow); },
      stockValue() { return this.c.stock.reduce((s, x) => s + x.value, 0); },
      debts() { let a = 0, b = 0; for (const k in this.c.debts) { const d = this.c.debts[k]; const bal = d.they_owe - d.we_owe; if (bal > 0) a += bal; else b -= bal; } return { recv: a, pay: b }; },
      warns() {
        return this.c.warnings.slice(0, 30).map((w) => {
          const d = A.byId(w.doc);
          if (w.kind === 'negative') return { id: w.doc, text: t('{0}: "{1}" omborda yetarli emas ({2} {3} kam)', A.label(d), A.prodLabel(w.p), A.qty(w.qty), A.unitName((A.byId(w.p) || {}).unit)) };
          if (w.kind === 'duplicate') return { id: w.doc, text: t('{0}: shu raqamli hujjat ikki marta kiritilgan', A.label(d)) };
          return { id: w.doc, text: t('{0}: mahsulot topilmadi', A.label(d)) };
        });
      },
      recent() { return A.recsOf('doc').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 8); }
    },
    methods: {
      newDoc(type) { window.newDoc(type); },
      open(id) { const d = A.byId(id); if (d) S.editDoc = { doc: JSON.parse(JSON.stringify(d)) }; S.view = 'docs'; }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{S.firm.name}}</h1><p class="muted">{{t('STIR')}} <span class="mono">{{S.firm.inn}}</span> · {{t(REGIME_LABEL[S.firm.regime])}} · {{ S.firm.cost_method==='fifo' ? 'FIFO' : t('O\\'rtacha tannarx') }}</p></div>
        <div class="row-gap wrap">
          <button class="btn" @click="newDoc('receipt')">+ {{t('Kirim')}}</button>
          <button class="btn" @click="newDoc('sale')">+ {{t('Sotuv')}}</button>
          <button class="btn ghost" @click="Forms.editRec('expense')">+ {{t('Xarajat')}}</button>
        </div></header>
      <div class="kpis">
        <kpi v-if="vat" :label="t('QQS, {0}', monthName(ymNow))" :value="money(vat.payable)" :sub="vat.carry_out ? t('Keyingi oyga o\\'tadi: {0}', money(vat.carry_out)) : t('To\\'lanadigan')"></kpi>
        <kpi v-if="profit" :label="t('Foyda solig\\'i, {0}-chorak', profit.q)" :value="money(profit.tax_q)" :sub="t('Yil boshidan foyda: {0}', money(profit.profit))" :tone="profit.profit < 0 ? 'warn' : ''"></kpi>
        <kpi v-if="turnover" :label="t('Aylanma solig\\'i, {0}', monthName(ymNow))" :value="money(turnover.tax)" :sub="t('Soliq bazasi: {0}', money(turnover.base))"></kpi>
        <kpi :label="t('Ombordagi tovarlar')" :value="money(stockValue)" :sub="t('{0} ta pozitsiya', c.stock.filter(s=>s.qty>0).length)"></kpi>
        <kpi :label="t('Debitorlik (bizga qarz)')" :value="money(debts.recv)"></kpi>
        <kpi :label="t('Kreditorlik (bizning qarz)')" :value="money(debts.pay)"></kpi>
      </div>
      <news-block></news-block>
      <div class="two">
        <div class="panel">
          <h2>{{t('Ogohlantirishlar')}} <span class="count" v-if="c.warnings.length">{{c.warnings.length}}</span></h2>
          <p class="muted" v-if="!warns.length">{{t('Muammo topilmadi')}}</p>
          <ul class="warn-list"><li v-for="(w,i) in warns" :key="i"><button class="link" @click="open(w.id)">{{w.text}}</button></li></ul>
        </div>
        <div class="panel">
          <h2>{{t('Oxirgi hujjatlar')}}</h2>
          <p class="muted" v-if="!recent.length">{{t('Hali hujjat kiritilmagan')}}</p>
          <ul class="doc-list"><li v-for="d in recent" :key="d.id"><button class="link" @click="open(d.id)">
            <span class="tag" :class="d.type">{{t(DOC_LABEL[d.type])}}</span> №{{d.number}} <span class="muted">{{dateFmt(d.date)}}</span>
            <span class="grow"></span><span class="mono">{{money((c.docCalc[d.id]||{}).total)}}</span></button></li></ul>
        </div>
      </div>
    </section>`
  };

  /* ---------------- Hujjatlar ro'yxati ---------------- */
  C['docs-view'] = {
    data() { return { type: '', month: '', menu: false }; },
    computed: {
      rows() {
        return A.recsOf('doc').filter((d) => (!this.type || d.type === this.type) && (!this.month || d.date.startsWith(this.month)))
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.created_at).localeCompare(String(a.created_at))))
          .map((d) => { const c = S.calc.docCalc[d.id] || {}; return { ...d, base: c.base || 0, vatS: c.vat || 0, total: c.total || 0, cost: c.cost || 0, _cls: A.lockedRec(d) ? 'locked' : '' }; });
      },
      cols() {
        return [
          { k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date },
          { k: 'number', label: '№', mono: true },
          { k: 'type', label: 'Turi', f: (r) => t(A.DOC_LABEL[r.type]) },
          { k: 'cp', label: 'Kontragent', f: (r) => cpName(r.cp) },
          { k: 'wh', label: 'Ombor', f: (r) => whName(r.wh) + (r.wh2 ? ' → ' + whName(r.wh2) : '') },
          { k: 'base', label: 'QQSsiz', num: true, f: (r) => A.money(r.base) },
          { k: 'vatS', label: 'QQS', num: true, f: (r) => A.money(r.vatS) },
          { k: 'total', label: 'Jami', num: true, f: (r) => A.money(r.total) },
          { k: 'cost', label: 'Tannarx', num: true, f: (r) => A.money(r.cost) }
        ];
      },
      foot() { const s = (k) => this.rows.reduce((a, r) => a + r[k], 0); return { base: s('base'), vatS: s('vatS'), total: s('total'), cost: s('cost') }; }
    },
    methods: {
      open(d) { S.editDoc = { doc: JSON.parse(JSON.stringify(A.byId(d.id))) }; },
      newDoc(type) { this.menu = false; window.newDoc(type); },
      async expLines() {
        const header = ['Sana', '№', 'Turi', 'Kontragent', 'STIR', 'Ombor', 'MXIK', 'Mahsulot', "O'lchov", 'Miqdor', 'Narx', 'QQS turi', 'QQSsiz', 'QQS', 'Jami', 'Tannarx', 'Faoliyat turi', 'Belgi'].map((x) => t(x));
        const rows = [];
        for (const d of this.rows) {
          const c = S.calc.docCalc[d.id] || { lines: [] };
          (d.lines || []).forEach((l, i) => {
            const p = A.byId(l.p) || {}; const lc = c.lines[i] || {}; const cp = A.byId(d.cp) || {};
            rows.push([d.date, d.number, t(A.DOC_LABEL[d.type]), cp.name || '', cp.inn || '', whName(d.wh), p.mxik || '', (p.name || '') + (l.lname ? ' — ' + l.lname : ''), A.unitName(l.u || p.unit), Number(d.type === 'inventory' ? lc.diff : l.qty) || 0, Number(l.price) || 0, A.vatLabel(lc.vtype || l.vat, l.vatp), lc.base || 0, lc.vat || 0, lc.total || 0, E.r2(lc.cost || 0), A.actName(l.act), l.tag || '']);
          });
        }
        await Excel.exportXlsx('hujjatlar_qatorlar.xlsx', [{ name: t('Hujjat qatorlari'), title: S.firm.name + ' — ' + t('Hujjat qatorlari'), header, rows }]);
      }
    },
    template: `
    <section class="page" v-if="!S.editDoc">
      <header class="page-h"><div><h1>{{t('Hujjatlar')}}</h1><p class="muted">{{t('Kirim, sotuv, qaytarish, ko\\'chirish, hisobdan chiqarish va inventarizatsiya')}}</p></div>
        <div class="menu-wrap"><button class="btn primary" @click="menu=!menu" :aria-expanded="menu">+ {{t('Yangi hujjat')}} ▾</button>
          <div class="menu" v-if="menu" @mouseleave="menu=false">
            <button v-for="(l,k) in DOC_LABEL" :key="k" @click="newDoc(k)"><span class="tag" :class="k">{{t(l)}}</span></button>
          </div></div></header>
      <div class="filters">
        <div class="chips"><button class="chip" :class="{on:!type}" @click="type=''">{{t('Hammasi')}}</button>
          <button v-for="(l,k) in DOC_LABEL" :key="k" class="chip" :class="{on:type===k}" @click="type=k">{{t(l)}}</button></div>
        <label class="inline"><span>{{t('Oy')}}</span><input type="month" v-model="month" id="docs-month"></label>
      </div>
      <data-table :cols="cols" :rows="rows" :foot="foot" clickable @row="open" export-name="hujjatlar" :export-title="S.firm.name + ' — ' + t('Hujjatlar')">
        <template #tools><button class="btn ghost sm" @click="expLines">⤓ {{t('Qatorlar bilan')}}</button></template>
      </data-table>
    </section>
    <doc-editor v-else></doc-editor>`
  };

  /* ---------------- Hujjat muharriri ---------------- */
  C['doc-editor'] = {
    data() {
      const d = S.editDoc.doc;
      if (!d.lines || !d.lines.length) d.lines = [{ p: '', qty: null, price: null, vat: '' }];
      if (!Array.isArray(d.entries)) d.entries = [];
      return { d, err: '', saving: false, bookCalc: null, tried: false };
    },
    computed: {
      locked() { return A.lockedRec({ kind: 'doc', date: this.d.date }) || (this.d.id && A.lockedRec(A.byId(this.d.id) || {})); },
      needCp() { return ['receipt', 'sale', 'return_in', 'return_out'].includes(this.d.type); },
      priced() { return !['transfer', 'writeoff', 'inventory', 'production', 'opening'].includes(this.d.type); },
      isOpen() { return this.d.type === 'opening'; },
      isInv() { return this.d.type === 'inventory'; },
      isProd() { return this.d.type === 'production'; },
      prodLines() {
        if (!this.isProd || !this.bookCalc) return [];
        return this.d.lines.map((l) => { const q = Number(l.qty) || 0; const rc = E.recipeCost({ mats: l.mats || [], costs: l.costs || [] }, this.bookCalc, this.d.wh); return { ...rc, q, sumMat: rc.mat * q, sumFull: rc.total * q }; });
      },
      prodNeeds() {
        // jami homashyo ehtiyoji va ombordagi qoldiq
        const need = {};
        this.d.lines.forEach((l) => (l.mats || []).forEach((m) => {
          const n = (Number(l.qty) || 0) * (Number(m.per) || 0) * (1 + (Number(m.loss) || 0) / 100);
          need[m.p] = (need[m.p] || 0) + n;
        }));
        return Object.entries(need).map(([p, n]) => { const a = this.avail(p) || 0; return { p, need: n, avail: a, short: Math.max(0, n - a) }; });
      },
      whs() { return A.recsOf('warehouse'); },
      calcLines() {
        const firm = S.firm, st = A.effSettings();
        return this.d.lines.map((l) => { const p = A.byId(l.p); return p ? E.lineAmounts(l, this.d, firm, st, p) : { base: 0, vat: 0, total: 0, vtype: l.vat }; });
      },
      totals() { return this.calcLines.reduce((s, x) => ({ base: s.base + x.base, vat: s.vat + x.vat, total: s.total + x.total }), { base: 0, vat: 0, total: 0 }); },
      sellNoVat() { return (this.d.type === 'sale' || this.d.type === 'return_in') && !E.isVatPayer(S.firm); },
      hasAct() { return this.d.type === 'sale' || this.d.type === 'return_in'; },
      cpTitle() { return { receipt: 'Yetkazib beruvchi', sale: 'Xaridor', return_in: 'Xaridor', return_out: 'Yetkazib beruvchi' }[this.d.type]; }
    },
    watch: { 'd.date'() { this.refreshBook(); }, 'd.wh'() { this.refreshBook(); } },
    mounted() { this.refreshBook(); },
    methods: {
      refreshBook() {
        // hujjat sanasidagi qoldiq (shu hujjatni hisobga olmasdan)
        const others = S.recs.filter((r) => r.id !== this.d.id);
        this.bookCalc = E.compute(S.firm, others, A.effSettings(), { until: this.d.date || A.today() });
      },
      avail(pid) {
        if (!this.bookCalc || !pid) return null;
        const s = this.bookCalc.stock.find((x) => x.wh === this.d.wh && x.p === pid);
        return s ? s.qty : 0;
      },
      lineWarn(l) {
        if (!l.p || !this.d.wh || this.isInv || this.isProd || this.isOpen || this.d.type === 'receipt' || this.d.type === 'return_in') return '';
        const p = A.byId(l.p); if (!p || p.ptype === 'service') return '';
        const a = this.avail(l.p); const need = Number(l.qty) * (Number(l.k) || 1);
        return a !== null && need > a + 1e-9 ? t('Omborda {0} bor', A.qty(a) + ' ' + A.unitName(p.unit)) : '';
      },
      setProd(l, id) {
        l.p = id; const p = A.byId(id);
        if (p && !l.vat) { l.vat = p.vat || 'std'; l.vatp = p.vat_custom; }
        if (this.isInv && (l.actual === undefined || l.actual === null)) l.actual = this.avail(id);
        if (this.isProd) this.snapRecipe(l);
      },
      snapRecipe(l) {
        // kalkulyatsiyaning shu kundagi nusxasi hujjatda saqlanadi
        const r = A.recsOf('recipe').find((x) => x.product === l.p);
        if (!r) { l.mats = []; l.costs = []; this.err = t('"{0}" uchun kalkulyatsiya kiritilmagan. Avval "Ishlab chiqarish" bo\'limida kalkulyatsiya qo\'shing', A.prodLabel(l.p)); return; }
        this.err = ''; l.mats = JSON.parse(JSON.stringify(r.mats || [])); l.costs = JSON.parse(JSON.stringify(r.costs || []));
      },
      unitsOf(pid) { const p = A.byId(pid); if (!p) return []; return [{ unit: p.unit, k: 1 }, ...(p.units_alt || []).filter((u) => u.unit && Number(u.k) > 0)]; },
      unitChange(l, unit) { const u = this.unitsOf(l.p).find((x) => x.unit === unit); if (!u) return; l.u = unit === (A.byId(l.p) || {}).unit ? undefined : unit; l.k = Number(u.k) === 1 ? undefined : Number(u.k); },
      lineUnit(l) { return l.u || (A.byId(l.p) || {}).unit; },
      setTotal(l, i, v) {
        // teskari hisob: miqdor, QQS turi va jami summadan 1 birlik narxini topish
        const total = Number(String(v).replace(/\s/g, '').replace(',', '.'));
        const q = Number(l.qty);
        if (!(q > 0)) { this.err = t('Avval miqdorni kiriting'); return; }
        if (!(total >= 0)) return;
        this.err = '';
        const r = this.calcLines[i].rate || 0;
        const price = this.d.priceVat ? total / q : total / (1 + r) / q;
        l.price = Math.round(price * 1e6) / 1e6;
      },
      setBase(l, v) {
        const base = Number(String(v).replace(/\s/g, '').replace(',', '.')); const q = Number(l.qty);
        if (!(q > 0)) { this.err = t('Avval miqdorni kiriting'); return; }
        if (!(base >= 0)) return; this.err = '';
        const i = this.d.lines.indexOf(l); const r = this.calcLines[i].rate || 0;
        l.price = Math.round((this.d.priceVat ? base * (1 + r) / q : base / q) * 1e6) / 1e6;
      },
      suggestEntries() {
        const tmp = { ...this.d, id: this.d.id || '__draft', created_at: this.d.created_at || '9999' };
        const calc = E.compute(S.firm, [...S.recs.filter((r) => r.id !== this.d.id), tmp], A.effSettings(), { until: this.d.date });
        return Acc.suggestDoc(tmp, calc.docCalc[tmp.id], A.byId, E.isVatPayer(S.firm));
      },
      vatChange(l) { if (l.vat === 'custom' && (l.vatp === undefined || l.vatp === null || l.vatp === '')) { const p = A.byId(l.p); l.vatp = p && p.vat === 'custom' ? p.vat_custom : 0; } },
      async newProd(l, q) {
        const init = /^\d+$/.test(q) ? { mxik: q } : { name: q }; if (this.isProd) init.ptype = 'produced';
        const r = await Forms.editRec('product', null, { init });
        if (r && r.id) this.setProd(l, r.id);
      },
      addLine() { this.d.lines.push({ p: '', qty: null, price: null, vat: '' }); },
      delLine(i) { this.d.lines.splice(i, 1); if (!this.d.lines.length) this.addLine(); },
      fillInv() {
        if (!this.d.wh) { this.err = t('Avval omborni tanlang'); return; }
        const items = this.bookCalc.stock.filter((s) => s.wh === this.d.wh && Math.abs(s.qty) > 1e-9);
        this.d.lines = items.map((s) => ({ p: s.p, actual: s.qty, qty: null, price: null, vat: '' }));
        if (!this.d.lines.length) { this.addLine(); this.err = t('Bu omborda qoldiq yo\'q'); }
      },
      back() { S.editDoc = null; },
      async save() {
        this.err = '';
        const d = this.d;
        if (!d.date) return (this.err = t('Sanani kiriting'));
        if (!d.wh) return (this.err = t('Omborni tanlang'));
        if (d.type === 'transfer' && (!d.wh2 || d.wh2 === d.wh)) return (this.err = t('Qabul qiluvchi boshqa omborni tanlang'));
        if (d.type === 'production' && !d.wh2) d.wh2 = d.wh;
        d.entries = (d.entries || []).filter((e) => e.dt || e.kt || Number(e.sum));
        { const ee = A.checkEntries(d.entries, false); if (ee) return (this.err = ee); }
        if (d.type === 'production' && d.lines.some((l) => l.p && !(l.mats || []).length)) return (this.err = t('Har bir mahsulot uchun kalkulyatsiya bo\'lishi kerak'));
        d.lines = d.lines.filter((l) => l.p);
        if (!d.lines.length) { this.addLine(); return (this.err = t('Kamida bitta mahsulot qo\'shing')); }
        for (const l of d.lines) {
          if (this.isInv) { if (l.actual === null || l.actual === '' || isNaN(Number(l.actual))) return (this.err = t('Haqiqiy qoldiqni kiriting')); }
          else if (!(Number(l.qty) > 0)) return (this.err = t('Miqdor noldan katta bo\'lishi kerak'));
          if ((this.priced || this.isOpen) && !(Number(l.price) >= 0)) return (this.err = t('Narxni kiriting'));
          if (this.hasAct && !l.act) { this.tried = true; return (this.err = t('Har bir qatorda faoliyat turini tanlang: ishlab chiqarish, oldi-sotdi, xizmat yoki ishtirok etmaydi')); }
        }
        if (d.number) {
          const dup = A.recsOf('doc').find((x) => x.id !== d.id && x.type === d.type && String(x.number).trim().toLowerCase() === String(d.number).trim().toLowerCase() && (x.cp || '') === (d.cp || '') && x.date.slice(0, 4) === d.date.slice(0, 4));
          if (dup && !(await A.ask(t('Shu raqamli hujjat allaqachon bor ({0}). Baribir saqlansinmi?', A.label(dup)), t('Saqlash')))) return;
        }
        const short = this.isProd ? this.prodNeeds.filter((x) => x.short > 1e-9) : d.lines.map((l) => this.lineWarn(l)).filter(Boolean);
        if (short.length && !(await A.ask(t('Ba\'zi mahsulotlar omborda yetarli emas. Qoldiq minusga tushadi. Baribir saqlansinmi?'), t('Saqlash')))) return;
        this.saving = true;
        try { const r = await A.saveRec('doc', d); S.editDoc = { doc: JSON.parse(JSON.stringify(r)) }; this.d = S.editDoc.doc; A.toast(t('Hujjat saqlandi')); }
        catch (e) { this.err = A.errText(e); }
        this.saving = false;
      },
      async del() {
        if (!(await A.ask(t("Hujjatni o'chirishni tasdiqlaysizmi?"), t("O'chirish"), true))) return;
        try { await A.delRec(A.byId(this.d.id)); S.editDoc = null; A.toast(t("O'chirildi")); } catch (e) { this.err = A.errText(e); }
      },
      async copy() {
        const c = JSON.parse(JSON.stringify(this.d)); delete c.id; delete c.created_at; c.date = A.today(); c.number = window.nextNumber(c.type);
        S.editDoc = { doc: c }; this.d = c; this.refreshBook(); A.toast(t('Nusxa yaratildi. Saqlashni unutmang'));
      },
      async exportDoc() {
        const d = this.d; const cp = A.byId(d.cp) || {};
        const head = [t('Mahsulot'), 'MXIK', t("O'lchov")];
        const header = this.isInv ? [...head, t('Hisobdagi qoldiq'), t('Haqiqiy qoldiq'), t('Farq')] : this.isProd ? [...head, t('Miqdor'), t('Homashyo (1 birlik)'), t('Xarajatlar (1 birlik)'), t('Tannarx (1 birlik)'), t('Jami tannarx')] : [...head, t('Miqdor'), t('Narx'), t('QQS turi'), t('QQSsiz'), t('QQS'), t('Jami'), t('Faoliyat turi'), t('Belgi')];
        const rows = d.lines.filter((l) => l.p).map((l, i) => {
          const p = A.byId(l.p) || {}; const lc = this.calcLines[i];
          if (this.isInv) { const b = this.avail(l.p) || 0; return [p.name, p.mxik, A.unitName(p.unit), b, Number(l.actual) || 0, (Number(l.actual) || 0) - b]; }
          if (this.isProd) { const pl = this.prodLines[i]; return [p.name, p.mxik, A.unitName(p.unit), Number(l.qty) || 0, E.r2(pl.mat), E.r2(pl.extra), E.r2(pl.total), E.r2(pl.sumFull)]; }
          return [p.name + (l.lname ? ' — ' + l.lname : ''), p.mxik, A.unitName(l.u || p.unit), Number(l.qty) || 0, Number(l.price) || 0, A.vatLabel(lc.vtype, l.vatp), lc.base, lc.vat, lc.total, A.actName(l.act), l.tag || ''];
        });
        if (this.isProd) { rows.push([]); rows.push([t('Sarflangan homashyo')]); this.prodNeeds.forEach((x) => { const p = A.byId(x.p) || {}; rows.push([p.name, p.mxik, A.unitName(p.unit), E.r2(x.need)]); }); }
        const title = t(A.DOC_LABEL[d.type]) + ' №' + (d.number || '') + ' — ' + A.dateFmt(d.date) + (cp.name ? ' — ' + cp.name : '');
        await Excel.exportXlsx((A.DOC_LABEL[d.type] + '_' + (d.number || '')).replace(/[^\w.-]+/g, '_') + '.xlsx', [{ name: t('Hujjat'), title: S.firm.name + ': ' + title, header, rows }]);
      }
    },
    template: `
    <section class="page">
      <header class="page-h">
        <div><button class="link back" @click="back">← {{t('Hujjatlar')}}</button>
          <h1><span class="tag big" :class="d.type">{{t(DOC_LABEL[d.type])}}</span> <span v-if="d.id">№{{d.number}}</span><span v-else class="muted">{{t('yangi')}}</span></h1></div>
        <div class="row-gap wrap">
          <button v-if="d.id" class="btn ghost sm" @click="copy">{{t('Nusxa olish')}}</button>
          <button v-if="d.id" class="btn ghost sm" @click="exportDoc">⤓ Excel</button>
          <button v-if="d.id && !locked" class="btn danger ghost sm" @click="del">{{t("O'chirish")}}</button>
        </div>
      </header>
      <p class="note lock" v-if="locked">🔒 {{t('Bu davr yopilgan, hujjatni faqat ko\\'rish mumkin')}}</p>
      <fieldset class="doc-head" :disabled="locked">
        <div class="fld"><label for="d-num">{{t('Raqami')}}</label><input id="d-num" v-model="d.number" class="mono"></div>
        <div class="fld"><label for="d-date">{{t('Sana')}}</label><input id="d-date" type="date" v-model="d.date"></div>
        <div class="fld"><label for="d-wh">{{ d.type==='transfer' ? t('Qaysi ombordan') : isProd ? t('Homashyo ombori') : t('Ombor') }}</label>
          <select id="d-wh" v-model="d.wh"><option value="" disabled>{{t('Tanlang')}}</option><option v-for="w in whs" :key="w.id" :value="w.id">{{w.name}}</option></select>
          <small v-if="!whs.length" class="hint">{{t('Avval "Omborlar" bo\\'limida ombor yarating')}}</small></div>
        <div class="fld" v-if="isProd"><label for="d-wh2p">{{t('Tayyor mahsulot ombori')}}</label>
          <select id="d-wh2p" v-model="d.wh2"><option value="">{{t('Homashyo ombori bilan bir xil')}}</option><option v-for="w in whs" :key="w.id" :value="w.id">{{w.name}}</option></select></div>
        <label class="check full" v-if="isProd"><input type="checkbox" v-model="d.includeCosts" id="d-ic"> <span>{{t('Kalkulyatsiyadagi xarajatlarni (ish haqi, elektr va b.) ombordagi tannarxga qo\\'shish')}}</span></label>
        <p class="note full" v-if="isProd && d.includeCosts">{{t('Diqqat: tannarxga qo\\'shilgan xarajatlarni "Xarajatlar" bo\\'limida qayta kiritmang, aks holda foyda solig\\'ida ikki marta chegiriladi.')}}</p>
        <div class="fld" v-if="d.type==='transfer'"><label for="d-wh2">{{t('Qaysi omborga')}}</label>
          <select id="d-wh2" v-model="d.wh2"><option value="" disabled>{{t('Tanlang')}}</option><option v-for="w in whs" :key="w.id" :value="w.id" :disabled="w.id===d.wh">{{w.name}}</option></select></div>
        <div class="fld wide" v-if="needCp"><label for="d-cp">{{t(cpTitle)}}</label>
          <div class="row-gap"><select id="d-cp" v-model="d.cp"><option value="">{{t('Tanlanmagan')}}</option><option v-for="o in Forms.cpOpts()" :key="o[0]" :value="o[0]">{{o[1]}}</option></select>
          <button type="button" class="btn ghost sm" @click="Forms.editRec('counterparty').then(r => r && r.id && (d.cp = r.id))">+</button></div></div>
        <div class="fld" v-if="needCp"><label for="d-ef">{{t('E-faktura raqami')}}</label><input id="d-ef" v-model="d.efaktura" class="mono"></div>
        <div class="fld" v-if="hasAct && !locked"><label for="d-act">{{t('Barcha qatorlarga faoliyat turi')}}</label>
          <select id="d-act" @change="d.lines.forEach(l => l.act = $event.target.value); $event.target.value=''"><option value="">{{t('Tanlang')}}</option><option v-for="o in ACTS" :key="o[0]" :value="o[0]">{{t(o[1])}}</option></select></div>
        <label class="check" v-if="priced"><input type="checkbox" v-model="d.priceVat" id="d-pv"> <span>{{t('Narxlar QQS bilan kiritiladi')}}</span></label>
        <label class="check" v-if="d.type==='writeoff' || isInv"><input type="checkbox" v-model="d.deductible" id="d-ded"> <span>{{ isInv ? t('Kamomad foyda solig\\'ida chegiriladi') : t('Foyda solig\\'ida chegiriladi (me\\'yor doirasida)') }}</span></label>
        <div class="fld full"><label for="d-note">{{t('Izoh')}}</label><input id="d-note" v-model="d.note"></div>
      </fieldset>
      <p class="note" v-if="priced && !isProd">{{t('Teskari hisob: miqdor va QQS turini tanlab, "QQSsiz" yoki "Jami" katagiga summani yozing, 1 birlik narxi o\\'zi hisoblanadi.')}}</p>
      <p class="note" v-if="sellNoVat">{{t('Firma aylanma solig\\'i to\\'lovchi, sotuvga QQS qo\\'shilmaydi')}}</p>
      <div class="tbl-wrap lines">
        <table class="tbl edit">
          <thead><tr>
            <th class="n">#</th><th class="prod">{{t('Mahsulot')}}</th><th>{{t("O'lchov")}}</th>
            <template v-if="isProd"><th class="num">{{t('Miqdor')}}</th><th class="num">{{t('Homashyo (1 birlik)')}}</th><th class="num">{{t('Xarajatlar (1 birlik)')}}</th><th class="num">{{t('Tannarx (1 birlik)')}}</th><th class="num">{{t('Jami tannarx')}}</th><th></th></template>
            <template v-else-if="isInv"><th class="num">{{t('Hisobda')}}</th><th class="num">{{t('Haqiqatda')}}</th><th class="num">{{t('Farq')}}</th><th class="num">{{t('Ortiqcha narxi')}}</th></template>
            <template v-else><th class="num">{{t('Miqdor')}}</th>
              <template v-if="isOpen"><th class="num">{{t('Tannarx (1 birlik)')}}</th><th class="num">{{t('Summa')}}</th></template>
              <template v-if="priced"><th class="num">{{t('Narx')}}</th><th>{{t('QQS turi')}}</th><th class="num">{{t('QQSsiz')}}</th><th class="num">{{t('QQS')}}</th><th class="num">{{t('Jami')}}</th>
                <th v-if="hasAct">{{t('Faoliyat turi')}}<b class="req">*</b></th><th>{{t('Belgi')}}</th></template></template>
            <th></th></tr></thead>
          <tbody>
            <tr v-for="(l,i) in d.lines" :key="i">
              <td class="n muted">{{i+1}}</td>
              <td class="prod"><prod-select :model-value="l.p" @update:model-value="setProd(l,$event)" @new="newProd(l,$event)" :wh="d.wh" :only="isProd ? 'produced' : ''" v-if="!locked"></prod-select><span v-else>{{prodLabel(l.p)}}</span>
                <small class="mono muted" v-if="l.p">{{(byId(l.p)||{}).mxik}}</small>
                <input v-if="l.p && !isProd && !locked" v-model="l.lname" class="lname" :placeholder="t('Nomi (ixtiyoriy)')" :aria-label="t('Qatordagi mahsulot nomi')">
                <small v-else-if="l.lname" class="block">{{l.lname}}</small></td>
              <td class="muted">
                <select v-if="!isInv && !isProd && unitsOf(l.p).length > 1" :value="lineUnit(l)" @change="unitChange(l, $event.target.value)" :disabled="locked" class="unit-sel" :aria-label="t('O\\'lchov birligi')">
                  <option v-for="u in unitsOf(l.p)" :key="u.unit" :value="u.unit">{{unitName(u.unit)}}<template v-if="u.k !== 1"> (={{qty(u.k)}} {{unitName((byId(l.p)||{}).unit)}})</template></option></select>
                <span v-else>{{unitName((byId(l.p)||{}).unit)}}</span>
                <small v-if="l.k && l.qty" class="block">= {{qty(l.qty * l.k)}} {{unitName((byId(l.p)||{}).unit)}}</small></td>
              <template v-if="isProd">
                <td class="num"><input type="number" step="any" class="num" v-model.number="l.qty" :disabled="locked" :aria-label="t('Miqdor')"></td>
                <td class="num mono">{{money(prodLines[i] && prodLines[i].mat)}}</td><td class="num mono">{{money(prodLines[i] && prodLines[i].extra)}}</td>
                <td class="num mono strong">{{money(prodLines[i] && prodLines[i].total)}}</td><td class="num mono">{{money(prodLines[i] && prodLines[i].sumFull)}}</td>
                <td><button class="icon-btn" v-if="!locked && l.p" @click="snapRecipe(l)" :title="t('Kalkulyatsiyadan yangilash')">↻</button></td>
              </template>
              <template v-else-if="isInv">
                <td class="num mono">{{qty(avail(l.p))}}</td>
                <td class="num"><input type="number" step="any" class="num" v-model.number="l.actual" :disabled="locked" :aria-label="t('Haqiqatda')"></td>
                <td class="num mono" :class="{neg: (l.actual - avail(l.p)) < 0, pos: (l.actual - avail(l.p)) > 0}">{{qty((Number(l.actual)||0) - (avail(l.p)||0))}}</td>
                <td class="num"><input type="number" step="any" class="num" v-model.number="l.price" :disabled="locked" :placeholder="t('o\\'rtacha')" :aria-label="t('Ortiqcha narxi')"></td>
              </template>
              <template v-else>
                <td class="num"><input type="number" step="any" class="num" v-model.number="l.qty" :disabled="locked" :aria-label="t('Miqdor')"><small class="warn-t" v-if="lineWarn(l)">{{lineWarn(l)}}</small></td>
                <template v-if="isOpen">
                  <td class="num"><input type="number" step="any" class="num" v-model.number="l.price" :disabled="locked" :aria-label="t('Tannarx (1 birlik)')"></td>
                  <td class="num mono">{{money((Number(l.qty)||0)*(Number(l.price)||0))}}</td>
                </template>
                <template v-if="priced">
                  <td class="num"><input type="number" step="any" class="num" v-model.number="l.price" :disabled="locked" :aria-label="t('Narx')"></td>
                  <td><div class="vat-cell"><select v-model="l.vat" :disabled="locked || sellNoVat" :aria-label="t('QQS turi')" @change="vatChange(l)"><option v-for="o in Forms.vatOpts()" :key="o[0]" :value="o[0]">{{o[1]}}</option></select>
                    <span v-if="l.vat==='custom' && !sellNoVat" class="pct"><input type="number" step="any" class="num" v-model.number="l.vatp" :disabled="locked" :aria-label="t('Imtiyozli QQS stavkasi (%)')">%</span></div></td>
                  <td class="num"><input class="num" :value="calcLines[i].base.toFixed(2)" @change="setBase(l, $event.target.value)" :disabled="locked" :aria-label="t('QQSsiz')" :title="t('Summani yozsangiz narx o\\'zi hisoblanadi')"></td>
                  <td class="num mono">{{money(calcLines[i].vat)}}</td>
                  <td class="num"><input class="num strong" :value="calcLines[i].total.toFixed(2)" @change="setTotal(l, i, $event.target.value)" :disabled="locked" :aria-label="t('Jami')" :title="t('Summani yozsangiz narx o\\'zi hisoblanadi')"></td>
                  <td v-if="hasAct"><select v-model="l.act" :disabled="locked" class="act-sel" :class="{badin: tried && l.p && !l.act}" :aria-label="t('Faoliyat turi')"><option value="" disabled>{{t('Tanlang')}}</option><option v-for="o in ACTS" :key="o[0]" :value="o[0]">{{t(o[1])}}</option></select></td>
                  <td><input v-model="l.tag" :disabled="locked" class="tag-in" :placeholder="t('ixtiyoriy')" :aria-label="t('Belgi')"></td>
                </template>
              </template>
              <td><button class="icon-btn" v-if="!locked" @click="delLine(i)" :aria-label="t('Qatorni o\\'chirish')">✕</button></td>
            </tr>
          </tbody>
          <tfoot v-if="priced && !isInv"><tr><td></td><td colspan="5">{{t('Jami')}}</td><td class="num mono">{{money(totals.base)}}</td><td class="num mono">{{money(totals.vat)}}</td><td class="num mono strong">{{money(totals.total)}}</td><td v-if="hasAct"></td><td></td><td></td></tr></tfoot>
        </table>
      </div>
      <div class="panel" v-if="isProd && prodNeeds.length">
        <h2>{{t('Sarflanadigan homashyo')}}</h2>
        <div class="tbl-wrap"><table class="tbl compact">
          <thead><tr><th>{{t('Homashyo')}}</th><th>{{t("O'lchov")}}</th><th class="num">{{t('Kerak')}}</th><th class="num">{{t('Omborda')}}</th><th>{{t('Holati')}}</th></tr></thead>
          <tbody><tr v-for="x in prodNeeds" :key="x.p"><td>{{prodLabel(x.p)}}</td><td class="muted">{{unitName((byId(x.p)||{}).unit)}}</td>
            <td class="num mono">{{qty(x.need)}}</td><td class="num mono" :class="{neg: x.avail <= 0}">{{qty(x.avail)}}</td>
            <td><span v-if="x.avail <= 1e-9" class="bad">{{t('Omborda mahsulot yo\\'q')}}</span><span v-else-if="x.short > 1e-9" class="bad">{{t('Yetmaydi: {0}', qty(x.short))}}</span><span v-else class="good">{{t('Yetarli')}}</span></td></tr></tbody>
        </table></div>
      </div>
      <div class="row-gap" v-if="!locked">
        <button class="btn ghost" @click="addLine">+ {{t('Qator qo\\'shish')}}</button>
        <button class="btn ghost" v-if="isInv" @click="fillInv">{{t('Ombordagi qoldiqlarni to\\'ldirish')}}</button>
      </div>
      <div class="panel" v-if="!isOpen && d.type !== 'transfer'">
        <div class="panel-h"><h2>{{t('Provodkalar')}}</h2><span class="muted small">{{t('Ixtiyoriy. Buxgalteriya hisobotlari (aylanma-saldo, balans) shu provodkalar asosida tuziladi')}}</span></div>
        <entries-editor :rows="d.entries" :suggest="suggestEntries" :locked="locked"></entries-editor>
      </div>
      <p class="err" v-if="err">{{err}}</p>
      <div class="sticky-actions" v-if="!locked">
        <button class="btn ghost" @click="back">{{t('Bekor qilish')}}</button>
        <button class="btn primary" :disabled="saving" @click="save">{{t('Saqlash')}}</button>
      </div>
    </section>`
  };

  /* ---------------- Mahsulotlar ---------------- */
  C['products-view'] = {
    computed: {
      rows() {
        const tot = {}; for (const s of S.calc.stock) { tot[s.p] = tot[s.p] || { q: 0, v: 0 }; tot[s.p].q += s.qty; tot[s.p].v += s.value; }
        return A.recsOf('product').map((p) => ({ ...p, sq: (tot[p.id] || {}).q || 0, sv: (tot[p.id] || {}).v || 0 })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      },
      cols() {
        return [{ k: 'mxik', label: 'MXIK', mono: true }, { k: 'name', label: 'Nomi' }, { k: 'unit', label: "O'lchov", f: (r) => A.unitName(r.unit) },
          { k: 'vat', label: 'QQS turi', f: (r) => A.vatLabel(r.vat, r.vat_custom) }, { k: 'kind', label: 'Turi', f: (r) => (r.ptype === 'service' ? t('Xizmat') : r.ptype === 'produced' ? t('Ishlab chiqariladi') : t('Tovar')) },
          { k: 'sq', label: 'Qoldiq', num: true, f: (r) => (r.ptype === 'service' ? '' : A.qty(r.sq)), x: (r) => r.sq }, { k: 'sv', label: 'Qiymati', num: true, f: (r) => A.money(r.sv) }];
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Mahsulotlar')}}</h1><p class="muted">{{t('MXIK kodini yozing: bir necha raqamdan keyin katalogdan mos kodlar chiqadi')}}</p></div>
        <button class="btn primary" @click="Forms.editRec('product')">+ {{t('Mahsulot qo\\'shish')}}</button></header>
      <data-table :cols="cols" :rows="rows" clickable @row="Forms.editRec('product', $event)" export-name="mahsulotlar"></data-table>
    </section>`
  };

  C['warehouses-view'] = {
    computed: {
      rows() { return A.recsOf('warehouse').map((w) => { const s = S.calc.stock.filter((x) => x.wh === w.id); return { ...w, items: s.filter((x) => x.qty > 0).length, value: s.reduce((a, x) => a + x.value, 0) }; }); },
      cols() { return [{ k: 'name', label: 'Ombor' }, { k: 'address', label: 'Manzil' }, { k: 'responsible', label: "Mas'ul" }, { k: 'items', label: 'Pozitsiyalar', num: true }, { k: 'value', label: 'Qiymati', num: true, f: (r) => A.money(r.value) }]; }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Omborlar')}}</h1><p class="muted">{{t('Firmada istalgancha ombor yaratish mumkin')}}</p></div>
        <button class="btn primary" @click="Forms.editRec('warehouse')">+ {{t('Ombor qo\\'shish')}}</button></header>
      <data-table :cols="cols" :rows="rows" clickable @row="Forms.editRec('warehouse', $event)" export-name="omborlar" :searchable="false"></data-table>
    </section>`
  };

  /* ---------------- Qoldiqlar va aylanma qaydnoma ---------------- */
  C['stock-view'] = {
    data() { const y = A.today().slice(0, 4); return { tab: 'stock', asOf: A.today(), wh: '', from: y + '-01-01', to: A.today(), hideZero: true }; },
    computed: {
      calc() { return this.asOf === A.today() || !this.asOf ? S.calc : E.compute(S.firm, S.recs, A.effSettings(), { until: this.asOf }); },
      rows() {
        return this.calc.stock.filter((s) => (!this.wh || s.wh === this.wh) && (!this.hideZero || Math.abs(s.qty) > 1e-9) && (this.tab !== 'prod' || (A.byId(s.p) || {}).ptype === 'produced'))
          .map((s) => { const p = A.byId(s.p) || {}; return { ...s, id: s.wh + s.p, whn: whName(s.wh), mxik: p.mxik, name: p.name, unitn: A.unitName(p.unit), _cls: s.qty < 0 ? 'neg-row' : '' }; })
          .sort((a, b) => (a.whn + a.name).localeCompare(b.whn + b.name));
      },
      cols() { return [{ k: 'whn', label: 'Ombor' }, { k: 'mxik', label: 'MXIK', mono: true }, { k: 'name', label: 'Mahsulot' }, { k: 'unitn', label: "O'lchov" }, { k: 'qty', label: 'Qoldiq', num: true, f: (r) => A.qty(r.qty) }, { k: 'unit', label: "O'rtacha tannarx", num: true, f: (r) => A.money(r.unit), x: (r) => E.r2(r.unit) }, { k: 'value', label: 'Qiymati', num: true, f: (r) => A.money(r.value) }]; },
      foot() { return { value: this.rows.reduce((a, r) => a + r.value, 0) }; },
      stmt() {
        return E.turnoverStatement(S.calc, this.from, this.to, this.wh).map((r) => { const p = A.byId(r.p) || {}; return { ...r, id: r.wh + r.p, whn: whName(r.wh), mxik: p.mxik, name: p.name, unitn: A.unitName(p.unit) }; })
          .sort((a, b) => (a.whn + a.name).localeCompare(b.whn + b.name));
      },
      stmtCols() {
        const q = (k) => ({ k, num: true, f: (r) => A.qty(r[k]) }); const v = (k) => ({ k, num: true, f: (r) => A.money(r[k]) });
        return [{ k: 'whn', label: 'Ombor' }, { k: 'mxik', label: 'MXIK', mono: true }, { k: 'name', label: 'Mahsulot' }, { k: 'unitn', label: "O'lchov" },
          { ...q('oq'), label: 'Boshida, miqdor' }, { ...v('ov'), label: "Boshida, so'm" }, { ...q('iq'), label: 'Kirim, miqdor' }, { ...v('iv'), label: "Kirim, so'm" },
          { ...q('xq'), label: 'Chiqim, miqdor' }, { ...v('xv'), label: "Chiqim, so'm" }, { ...q('cq'), label: 'Oxirida, miqdor' }, { ...v('cv'), label: "Oxirida, so'm" }];
      },
      stmtFoot() { const s = (k) => this.stmt.reduce((a, r) => a + r[k], 0); return { ov: s('ov'), iv: s('iv'), xv: s('xv'), cv: s('cv') }; }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Ombor qoldiqlari')}}</h1><p class="muted">{{t('Tannarx usuli')}}: {{ S.firm.cost_method==='fifo' ? 'FIFO' : t('O\\'rtacha tannarx') }}</p></div></header>
      <div class="tabs"><button :class="{on:tab==='stock'}" @click="tab='stock'">{{t('Qoldiqlar')}}</button><button :class="{on:tab==='prod'}" @click="tab='prod'">{{t('Ishlab chiqarilgan mahsulotlar')}}</button><button :class="{on:tab==='stmt'}" @click="tab='stmt'">{{t('Tovar aylanma qaydnomasi')}}</button></div>
      <div class="filters">
        <label class="inline"><span>{{t('Ombor')}}</span><select v-model="wh" id="st-wh"><option value="">{{t('Barcha omborlar')}}</option><option v-for="w in recsOf('warehouse')" :key="w.id" :value="w.id">{{w.name}}</option></select></label>
        <template v-if="tab!=='stmt'"><label class="inline"><span>{{t('Sana holatiga')}}</span><input type="date" v-model="asOf" id="st-asof"></label>
          <label class="check"><input type="checkbox" v-model="hideZero" id="st-hz"> <span>{{t('Nol qoldiqlarni yashirish')}}</span></label></template>
        <template v-else><label class="inline"><span>{{t('Dan')}}</span><input type="date" v-model="from" id="st-from"></label><label class="inline"><span>{{t('Gacha')}}</span><input type="date" v-model="to" id="st-to"></label></template>
      </div>
      <data-table v-if="tab!=='stmt'" :cols="cols" :rows="rows" :foot="foot" export-name="qoldiqlar" :export-title="S.firm.name + ' — ' + t('Ombor qoldiqlari') + ' ' + dateFmt(asOf)"></data-table>
      <data-table v-else :cols="stmtCols" :rows="stmt" :foot="stmtFoot" export-name="aylanma_qaydnoma" :export-title="S.firm.name + ' — ' + t('Tovar aylanma qaydnomasi') + ' ' + dateFmt(from) + ' – ' + dateFmt(to)"></data-table>
    </section>`
  };

  /* ---------------- Asosiy vositalar ---------------- */
  C['assets-view'] = {
    data() { return { year: curYear() }; },
    computed: {
      rows() {
        return A.recsOf('asset').map((a) => { const c = S.calc.assets[a.id] || {}; return { ...a, basis: c.basis || 0, monthly: c.monthly || 0, acc: c.accumulated || 0, residual: c.residual || 0, _cls: a.dispose_date ? 'muted-row' : '' }; })
          .sort((a, b) => (a.acquire_date < b.acquire_date ? -1 : 1));
      },
      cols() {
        return [{ k: 'inv_no', label: 'Inv. №', mono: true }, { k: 'name', label: 'Nomi' }, { k: 'start_date', label: 'Ishga tushgan', f: (r) => A.dateFmt(r.start_date), x: (r) => r.start_date },
          { k: 'basis', label: "Boshlang'ich qiymat", num: true, f: (r) => A.money(r.basis) },
          { k: 'rate', label: 'Eskirish', f: (r) => (!r.depreciate ? t('Hisoblanmaydi') : r.method === 'amount' ? A.money(r.rate) + ' ' + t("so'm/oy") : r.rate + '% ' + t('yiliga')) },
          { k: 'monthly', label: 'Oylik eskirish', num: true, f: (r) => A.money(r.monthly) }, { k: 'acc', label: 'Jamg\'arilgan eskirish', num: true, f: (r) => A.money(r.acc) },
          { k: 'residual', label: 'Qoldiq qiymat', num: true, f: (r) => A.money(r.residual) }];
      },
      foot() { const s = (k) => this.rows.reduce((a, r) => a + r[k], 0); return { basis: s('basis'), monthly: s('monthly'), acc: s('acc'), residual: s('residual') }; },
      sched() {
        const ms = Array.from({ length: 12 }, (_, i) => this.year + '-' + String(i + 1).padStart(2, '0'));
        return { ms, rows: A.recsOf('asset').filter((a) => a.depreciate).map((a) => { const s = (S.calc.assets[a.id] || {}).schedule || {}; const v = ms.map((m) => s[m] || 0); return { a, v, sum: v.reduce((x, y) => x + y, 0) }; }) };
      }
    },
    methods: {
      async exp() {
        const s = this.sched;
        await Excel.exportXlsx('eskirish_' + this.year + '.xlsx', [{ name: t('Eskirish') + ' ' + this.year, title: S.firm.name + ' — ' + t('Eskirish jadvali') + ' ' + this.year, header: [t('Inv. №'), t('Nomi'), ...s.ms.map((m) => A.monthName(m)), t('Jami')], rows: s.rows.map((r) => [r.a.inv_no || '', r.a.name, ...r.v, E.r2(r.sum)]) }]);
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Asosiy vositalar')}}</h1><p class="muted">{{t('Eskirish qaysi vositalarga hisoblanishini va uning miqdorini (foizda yoki so\\'mda) o\\'zingiz belgilaysiz')}}</p></div>
        <button class="btn primary" @click="Forms.editRec('asset')">+ {{t('Vosita qo\\'shish')}}</button></header>
      <data-table :cols="cols" :rows="rows" :foot="foot" clickable @row="Forms.editRec('asset', $event)" export-name="asosiy_vositalar"></data-table>
      <div class="panel">
        <div class="panel-h"><h2>{{t('Eskirish jadvali')}}</h2><span class="grow"></span>
          <select v-model.number="year" id="as-year"><option v-for="y in [curYear()-2,curYear()-1,curYear(),curYear()+1]" :key="y" :value="y">{{y}}</option></select>
          <button class="btn ghost sm" @click="exp">⤓ Excel</button></div>
        <div class="tbl-wrap"><table class="tbl compact">
          <thead><tr><th>{{t('Nomi')}}</th><th v-for="m in sched.ms" :key="m" class="num">{{monthName(m).slice(0,3)}}</th><th class="num">{{t('Jami')}}</th></tr></thead>
          <tbody><tr v-for="r in sched.rows" :key="r.a.id"><td>{{r.a.name}}</td><td v-for="(v,i) in r.v" :key="i" class="num mono">{{ v ? money(v) : '·' }}</td><td class="num mono strong">{{money(r.sum)}}</td></tr>
            <tr v-if="!sched.rows.length"><td :colspan="14" class="empty">{{t('Eskirish hisoblanadigan vosita yo\\'q')}}</td></tr></tbody>
        </table></div>
      </div>
    </section>`
  };

  /* ---------------- Xarajatlar ---------------- */
  C['expenses-view'] = {
    data() { return { month: '' }; },
    computed: {
      rows() { return A.recsOf('expense').filter((e) => !this.month || e.date.startsWith(this.month)).sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => ({ ...e, total: (Number(e.amount) || 0) + (Number(e.vat) || 0), _cls: A.lockedRec(e) ? 'locked' : '' })); },
      cols() {
        return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'number', label: '№', mono: true }, { k: 'category', label: 'Turi', f: (r) => A.expCat(r.category) },
          { k: 'descr', label: 'Tavsif' }, { k: 'cp', label: 'Kontragent', f: (r) => cpName(r.cp) },
          { k: 'amount', label: 'QQSsiz', num: true, f: (r) => A.money(r.amount) }, { k: 'vat', label: 'QQS', num: true, f: (r) => A.money(r.vat) }, { k: 'total', label: 'Jami', num: true, f: (r) => A.money(r.total) },
          { k: 'deductible', label: 'Chegiriladi', f: (r) => (r.deductible ? t('Ha') : t("Yo'q")) }];
      },
      foot() { const s = (k) => this.rows.reduce((a, r) => a + (Number(r[k]) || 0), 0); return { amount: s('amount'), vat: s('vat'), total: s('total') }; }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Xarajatlar')}}</h1><p class="muted">{{t('Foyda solig\\'ida chegiriladigan va chegirilmaydigan xarajatlar alohida hisoblanadi')}}</p></div>
        <button class="btn primary" @click="Forms.editRec('expense')">+ {{t('Xarajat qo\\'shish')}}</button></header>
      <div class="filters"><label class="inline"><span>{{t('Oy')}}</span><input type="month" v-model="month" id="ex-month"></label></div>
      <data-table :cols="cols" :rows="rows" :foot="foot" clickable @row="Forms.editRec('expense', $event)" export-name="xarajatlar"></data-table>
    </section>`
  };

  /* ---------------- Kontragentlar va to'lovlar ---------------- */
  C['cps-view'] = {
    data() { return { tab: 'list' }; },
    computed: {
      rows() {
        return A.recsOf('counterparty').map((c) => { const d = S.calc.debts[c.id] || { they_owe: 0, we_owe: 0 }; return { ...c, they: d.they_owe, we: d.we_owe, bal: d.they_owe - d.we_owe }; })
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      },
      cols() {
        return [{ k: 'name', label: 'Nomi' }, { k: 'inn', label: 'STIR', mono: true }, { k: 'phone', label: 'Telefon' },
          { k: 'they', label: 'Ular bizga qarz', num: true, f: (r) => A.money(r.they) }, { k: 'we', label: 'Biz ularga qarz', num: true, f: (r) => A.money(r.we) },
          { k: 'bal', label: 'Saldo', num: true, f: (r) => A.money(r.bal), cls: '' }];
      },
      foot() { const s = (k) => this.rows.reduce((a, r) => a + r[k], 0); return { they: s('they'), we: s('we'), bal: s('bal') }; },
      pays() { return A.recsOf('payment').sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => ({ ...p, _cls: A.lockedRec(p) ? 'locked' : '' })); },
      payCols() {
        return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'number', label: '№', mono: true },
          { k: 'direction', label: "Yo'nalish", f: (r) => (r.direction === 'in' ? t('Kirim') : t('Chiqim')) }, { k: 'cp', label: 'Kontragent', f: (r) => cpName(r.cp) },
          { k: 'amount', label: 'Summa', num: true, f: (r) => A.money(r.amount) }, { k: 'method', label: 'Usul', f: (r) => ({ bank: t('Bank'), cash: t('Naqd'), card: t('Karta'), offset: t("O'zaro hisob") }[r.method] || '') }, { k: 'note', label: 'Izoh' }];
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Kontragentlar')}}</h1><p class="muted">{{t('Saldo musbat bo\\'lsa kontragent bizga qarz, manfiy bo\\'lsa biz qarzmiz')}}</p></div>
        <div class="row-gap"><button class="btn ghost" @click="Forms.editRec('payment')">+ {{t('To\\'lov')}}</button>
        <button class="btn primary" @click="Forms.editRec('counterparty')">+ {{t('Kontragent')}}</button></div></header>
      <div class="tabs"><button :class="{on:tab==='list'}" @click="tab='list'">{{t('Kontragentlar va qarzlar')}}</button><button :class="{on:tab==='pay'}" @click="tab='pay'">{{t('To\\'lovlar')}}</button></div>
      <data-table v-if="tab==='list'" :cols="cols" :rows="rows" :foot="foot" clickable @row="Forms.editRec('counterparty', $event)" export-name="kontragentlar"></data-table>
      <data-table v-else :cols="payCols" :rows="pays" clickable @row="Forms.editRec('payment', $event)" export-name="tolovlar"></data-table>
    </section>`
  };

  /* ---------------- Soliq hisobotlari ---------------- */
  C['reports-view'] = {
    data() { const tabs = []; if (E.isVatPayer(S.firm)) tabs.push('vat'); if (E.isProfitPayer(S.firm)) tabs.push('profit'); if (E.isTurnoverPayer(S.firm)) tabs.push('turnover'); return { year: curYear(), tab: tabs[0], tabs }; },
    computed: {
      vat() { return E.vatReport(S.calc, this.year); },
      profit() { return E.profitReport(S.calc, this.year, A.profitRate()); },
      turn() { return E.turnoverReport(S.calc, this.year, A.turnoverRate()); },
      years() { const ys = new Set([curYear()]); for (const k in S.calc.months) ys.add(Number(k.slice(0, 4))); return [...ys].sort(); },
      vatTotal() { const s = (k) => this.vat.reduce((a, r) => a + r[k], 0); return { turnover_std: s('turnover_std'), turnover_red: s('turnover_red'), turnover_ben: s('turnover_ben'), turnover_exempt: s('turnover_exempt'), output: s('output'), input: s('input'), net: s('net'), payable: s('payable') }; },
      turnTotal() { const s = (k) => this.turn.reduce((a, r) => a + r[k], 0); return { revenue: s('revenue'), other: s('other'), base: s('base'), tax: s('tax') }; }
    },
    methods: {
      async expVat() {
        const H = ['Oy', "QQS {0}% bo'yicha aylanma", "QQS {1}% bo'yicha aylanma", "Imtiyozli stavkalar bo'yicha aylanma", 'QQSdan ozod aylanma', 'Qaytarilgan', 'Hisoblangan QQS', 'Tovarlar bo\'yicha hisobga olinadigan QQS', 'Xarajatlar bo\'yicha', 'Asosiy vositalar bo\'yicha', 'Jami hisobga olinadigan QQS', 'Oy natijasi', "O'tgan oydan ortiqcha", "To'lanadigan", "Keyingi oyga o'tadi"].map((h) => t(h, S.settings.vat_rate, S.settings.vat_rate_red));
        const rows = this.vat.map((r) => [A.monthName(r.ym), r.turnover_std, r.turnover_red, r.turnover_ben, r.turnover_exempt, r.returns, r.output, r.input_goods, r.input_exp, r.input_assets, r.input, r.net, r.carry_in, r.payable, r.carry_out]);
        await Excel.exportXlsx('QQS_' + this.year + '.xlsx', [{ name: 'QQS ' + this.year, title: S.firm.name + ' (STIR ' + S.firm.inn + ') — ' + t("QQS hisob-kitobi") + ' ' + this.year, header: H, rows }]);
      },
      async expProfit() {
        const H = ['Ko\'rsatkich', 'I chorak', 'Yarim yil', '9 oy', 'Yil'].map((h) => t(h));
        const P = this.profit; const L = (lab, f) => [t(lab), ...P.map(f)];
        const rows = [
          L('Sotishdan tushum (QQSsiz, qaytarishlar chegirilgan)', (q) => q.cum.revenue), L('Boshqa daromadlar', (q) => q.cum.other), L('Jami daromad', (q) => q.cum.income),
          L('Sotilgan tovarlar tannarxi', (q) => q.cum.cogs), L('Chegiriladigan xarajatlar', (q) => q.cum.exp), L('Asosiy vositalar eskirishi', (q) => q.cum.dep),
          L('Chegiriladigan yo\'qotishlar', (q) => q.cum.losses), L('Jami chegirmalar', (q) => q.cum.ded), L('Soliq solinadigan foyda', (q) => q.profit),
          L("Foyda solig'i (yil boshidan)", (q) => q.tax_cum), L("Chorak uchun to'lanadigan", (q) => q.tax_q), L('Chegirilmaydigan xarajatlar', (q) => q.cum.nonded), L('Buxgalteriya foydasi', (q) => q.book_profit)
        ];
        await Excel.exportXlsx('Foyda_solig_' + this.year + '.xlsx', [{ name: t("Foyda solig'i") + ' ' + this.year, title: S.firm.name + ' (STIR ' + S.firm.inn + ') — ' + t("Foyda solig'i hisob-kitobi") + ' ' + this.year + ', ' + t('stavka') + ' ' + A.profitRate() + '%', header: H, rows }]);
      },
      async expTurn() {
        const H = ['Oy', 'Sotishdan tushum', 'Boshqa daromadlar', 'Soliq bazasi', "Aylanma solig'i"].map((h) => t(h));
        const rows = this.turn.map((r) => [A.monthName(r.ym), r.revenue, r.other, r.base, r.tax]);
        for (let q = 0; q < 4; q++) { const s = (k) => this.turn.slice(q * 3, q * 3 + 3).reduce((a, r) => a + r[k], 0); rows.push([t('{0}-chorak', q + 1), s('revenue'), s('other'), s('base'), s('tax')]); }
        await Excel.exportXlsx('Aylanma_solig_' + this.year + '.xlsx', [{ name: t("Aylanma solig'i") + ' ' + this.year, title: S.firm.name + ' — ' + t("Aylanma solig'i") + ' ' + this.year + ', ' + t('stavka') + ' ' + A.turnoverRate() + '%', header: H, rows }]);
      },
      qsum(k, q) { return this.turn.slice(q * 3, q * 3 + 3).reduce((a, r) => a + r[k], 0); }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Soliq hisobotlari')}}</h1><p class="muted">{{t(REGIME_LABEL[S.firm.regime])}}</p></div>
        <label class="inline"><span>{{t('Yil')}}</span><select v-model.number="year" id="rp-year"><option v-for="y in years" :key="y" :value="y">{{y}}</option></select></label></header>
      <div class="tabs">
        <button v-if="tabs.includes('vat')" :class="{on:tab==='vat'}" @click="tab='vat'">{{t('QQS (oylik)')}}</button>
        <button v-if="tabs.includes('profit')" :class="{on:tab==='profit'}" @click="tab='profit'">{{t('Foyda solig\\'i (choraklik)')}}</button>
        <button v-if="tabs.includes('turnover')" :class="{on:tab==='turnover'}" @click="tab='turnover'">{{t('Aylanma solig\\'i')}}</button>
      </div>

      <div v-if="tab==='vat'" class="panel">
        <div class="panel-h"><h2>{{t('QQS hisob-kitobi')}}, {{year}}</h2><span class="grow"></span><button class="btn ghost sm" @click="expVat">⤓ Excel</button></div>
        <div class="tbl-wrap"><table class="tbl compact report">
          <thead><tr><th>{{t('Oy')}}</th><th class="num">{{t("Aylanma {0}%", S.settings.vat_rate)}}</th><th class="num">{{t("Aylanma {0}%", S.settings.vat_rate_red)}}</th><th class="num">{{t('Imtiyozli aylanma')}}</th><th class="num">{{t('Ozod aylanma')}}</th>
            <th class="num">{{t('Hisoblangan QQS')}}</th><th class="num">{{t('Hisobga olinadigan QQS')}}</th><th class="num">{{t('Oy natijasi')}}</th><th class="num">{{t("O'tgan oydan ortiqcha")}}</th><th class="num">{{t("To'lanadigan")}}</th></tr></thead>
          <tbody><tr v-for="r in vat" :key="r.ym" :class="{dim:r.empty}"><td>{{monthName(r.ym)}}</td><td class="num mono">{{money(r.turnover_std)}}</td><td class="num mono">{{money(r.turnover_red)}}</td><td class="num mono">{{money(r.turnover_ben)}}</td><td class="num mono">{{money(r.turnover_exempt)}}</td>
            <td class="num mono">{{money(r.output)}}</td><td class="num mono" :title="t('Tovarlar: {0}; xarajatlar: {1}; asosiy vositalar: {2}', money(r.input_goods), money(r.input_exp), money(r.input_assets))">{{money(r.input)}}</td>
            <td class="num mono" :class="{neg:r.net<0}">{{money(r.net)}}</td><td class="num mono">{{money(r.carry_in)}}</td><td class="num mono strong">{{money(r.payable)}}</td></tr></tbody>
          <tfoot><tr><td>{{t('Jami')}}</td><td class="num mono">{{money(vatTotal.turnover_std)}}</td><td class="num mono">{{money(vatTotal.turnover_red)}}</td><td class="num mono">{{money(vatTotal.turnover_ben)}}</td><td class="num mono">{{money(vatTotal.turnover_exempt)}}</td><td class="num mono">{{money(vatTotal.output)}}</td><td class="num mono">{{money(vatTotal.input)}}</td><td class="num mono">{{money(vatTotal.net)}}</td><td></td><td class="num mono strong">{{money(vatTotal.payable)}}</td></tr></tfoot>
        </table></div>
        <p class="note">{{t('Hisobga olinadigan QQS: kirim hujjatlari, xarajatlar va asosiy vositalar bo\\'yicha. Oy natijasi manfiy bo\\'lsa ortiqcha summa keyingi oyga o\\'tkaziladi.')}}</p>
      </div>

      <div v-if="tab==='profit'" class="panel">
        <div class="panel-h"><h2>{{t('Foyda solig\\'i hisob-kitobi')}}, {{year}} · {{t('stavka')}} {{profitRate()}}%</h2><span class="grow"></span><button class="btn ghost sm" @click="expProfit">⤓ Excel</button></div>
        <div class="tbl-wrap"><table class="tbl compact report">
          <thead><tr><th>{{t('Yil boshidan o\\'sib boruvchi')}}</th><th class="num">{{t('I chorak')}}</th><th class="num">{{t('Yarim yil')}}</th><th class="num">{{t('9 oy')}}</th><th class="num">{{t('Yil')}}</th></tr></thead>
          <tbody>
            <tr><td>{{t('Sotishdan tushum (QQSsiz, qaytarishlar chegirilgan)')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.revenue)}}</td></tr>
            <tr><td>{{t('Boshqa daromadlar')}} <small class="muted">({{t('inventarizatsiya ortiqchasi va b.')}})</small></td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.other)}}</td></tr>
            <tr class="sub"><td>{{t('Jami daromad')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.income)}}</td></tr>
            <tr><td>{{t('Sotilgan tovarlar tannarxi')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.cogs)}}</td></tr>
            <tr><td>{{t('Chegiriladigan xarajatlar')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.exp)}}</td></tr>
            <tr><td>{{t('Asosiy vositalar eskirishi')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.dep)}}</td></tr>
            <tr><td>{{t('Chegiriladigan yo\\'qotishlar')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.losses)}}</td></tr>
            <tr class="sub"><td>{{t('Jami chegirmalar')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.ded)}}</td></tr>
            <tr class="sub"><td>{{t('Soliq solinadigan foyda')}}</td><td v-for="q in profit" :key="q.q" class="num mono" :class="{neg:q.profit<0}">{{money(q.profit)}}</td></tr>
            <tr><td>{{t('Foyda solig\\'i (yil boshidan)')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.tax_cum)}}</td></tr>
            <tr class="total"><td>{{t('Chorak uchun to\\'lanadigan')}}</td><td v-for="q in profit" :key="q.q" class="num mono strong">{{money(q.tax_q)}}</td></tr>
            <tr class="dim"><td>{{t('Chegirilmaydigan xarajatlar')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.cum.nonded)}}</td></tr>
            <tr class="dim"><td>{{t('Buxgalteriya foydasi')}}</td><td v-for="q in profit" :key="q.q" class="num mono">{{money(q.book_profit)}}</td></tr>
          </tbody>
        </table></div>
        <p class="note">{{t('Foyda solig\\'i yil boshidan o\\'sib boruvchi yakun bilan hisoblanadi. Chorak uchun to\\'lov = yil boshidan hisoblangan soliq − oldingi choraklar soligi.')}}</p>
      </div>

      <div v-if="tab==='turnover'" class="panel">
        <div class="panel-h"><h2>{{t('Aylanma solig\\'i')}}, {{year}} · {{t('stavka')}} {{turnoverRate()}}%</h2><span class="grow"></span><button class="btn ghost sm" @click="expTurn">⤓ Excel</button></div>
        <div class="tbl-wrap"><table class="tbl compact report">
          <thead><tr><th>{{t('Oy')}}</th><th class="num">{{t('Sotishdan tushum')}}</th><th class="num">{{t('Boshqa daromadlar')}}</th><th class="num">{{t('Soliq bazasi')}}</th><th class="num">{{t('Aylanma solig\\'i')}}</th></tr></thead>
          <tbody><template v-for="(r,i) in turn" :key="r.ym"><tr><td>{{monthName(r.ym)}}</td><td class="num mono">{{money(r.revenue)}}</td><td class="num mono">{{money(r.other)}}</td><td class="num mono">{{money(r.base)}}</td><td class="num mono strong">{{money(r.tax)}}</td></tr>
            <tr v-if="i%3===2" class="sub"><td>{{t('{0}-chorak', (i+1)/3)}}</td><td class="num mono">{{money(qsum('revenue',(i-2)/3))}}</td><td class="num mono">{{money(qsum('other',(i-2)/3))}}</td><td class="num mono">{{money(qsum('base',(i-2)/3))}}</td><td class="num mono strong">{{money(qsum('tax',(i-2)/3))}}</td></tr></template></tbody>
          <tfoot><tr><td>{{t('Yil')}}</td><td class="num mono">{{money(turnTotal.revenue)}}</td><td class="num mono">{{money(turnTotal.other)}}</td><td class="num mono">{{money(turnTotal.base)}}</td><td class="num mono strong">{{money(turnTotal.tax)}}</td></tr></tfoot>
        </table></div>
      </div>
      <p class="note">{{t('Hisob-kitoblar yordamchi xarakterga ega. Deklaratsiyani topshirishdan oldin raqamlarni tekshiring.')}}</p>
    </section>`
  };

  /* ---------------- Firma sozlamalari ---------------- */
  C['settings-view'] = {
    data() { return { closeM: S.firm.closed_until || '', audit: [], showAudit: false, restoreText: '' }; },
    methods: {
      async edit() {
        const r = await A.openModal('rec-form', { title: t('Firma ma\'lumotlari'), fields: Forms.F.firm(false), value: S.firm, wide: true, onSave: (m) => A.saveFirm(m) });
        if (r) A.toast(t('Saqlandi'));
      },
      async closePeriod() {
        if (!this.closeM) return;
        if (!(await A.ask(t('{0} oxirigacha bo\'lgan barcha yozuvlar qulflanadi. Davom etasizmi?', A.monthName(this.closeM)), t('Davrni yopish')))) return;
        try { await A.saveFirm({ ...S.firm, closed_until: this.closeM }); A.toast(t('Davr yopildi')); } catch (e) { A.toast(A.errText(e), 'err'); }
      },
      async openPeriod() {
        if (!(await A.ask(t('Yopilgan davr ochiladi va eski yozuvlarni o\'zgartirish mumkin bo\'ladi. Davom etasizmi?'), t('Davrni ochish'), true))) return;
        try { await A.saveFirm({ ...S.firm, closed_until: '' }); this.closeM = ''; A.toast(t('Davr ochildi')); } catch (e) { A.toast(A.errText(e), 'err'); }
      },
      async loadAudit() { this.showAudit = true; this.audit = await S.store.listAudit(S.firm.id); },
      async exportAll() {
        const sh = (kind, header, f) => ({ name: t(kind[1]), header: header.map((h) => t(h)), rows: A.recsOf(kind[0]).map(f) });
        await Excel.exportXlsx((S.firm.name || 'firma').replace(/[^\wЀ-ӿ.-]+/g, '_') + '_baza.xlsx', [
          sh(['product', 'Mahsulotlar'], ['MXIK', 'Nomi', "O'lchov", 'QQS turi', 'Turi', 'Shtrix kod'], (p) => [p.mxik, p.name, A.unitName(p.unit), A.vatLabel(p.vat, p.vat_custom), p.ptype === 'service' ? t('Xizmat') : p.ptype === 'produced' ? t('Ishlab chiqariladi') : t('Tovar'), p.barcode || '']),
          sh(['warehouse', 'Omborlar'], ['Nomi', 'Manzil', "Mas'ul"], (w) => [w.name, w.address || '', w.responsible || '']),
          sh(['counterparty', 'Kontragentlar'], ['Nomi', 'STIR', 'Telefon', 'Manzil', 'Bank', 'Hisob raqami'], (c) => [c.name, c.inn || '', c.phone || '', c.address || '', c.bank || '', c.account || '']),
          sh(['expense', 'Xarajatlar'], ['Sana', '№', 'Turi', 'Tavsif', 'QQSsiz', 'QQS', 'Chegiriladi'], (e) => [e.date, e.number || '', A.expCat(e.category), e.descr || '', Number(e.amount) || 0, Number(e.vat) || 0, e.deductible ? t('Ha') : t("Yo'q")]),
          sh(['payment', "To'lovlar"], ['Sana', '№', "Yo'nalish", 'Kontragent', 'Summa'], (p) => [p.date, p.number || '', p.direction === 'in' ? t('Kirim') : t('Chiqim'), cpName(p.cp), Number(p.amount) || 0]),
          sh(['asset', 'Asosiy vositalar'], ['Inv. №', 'Nomi', 'Olingan sana', 'Ishga tushgan', "Boshlang'ich qiymat", 'QQS', 'Usul', 'Stavka'], (a) => [a.inv_no || '', a.name, a.acquire_date, a.start_date, Number(a.cost) || 0, Number(a.vat) || 0, a.depreciate ? (a.method === 'amount' ? t("Oyiga so'mda") : t('Yillik foizda (%)')) : t('Hisoblanmaydi'), Number(a.rate) || 0])
        ]);
      },
      async backup() {
        const dump = await S.store.exportAll();
        await Excel.saveBlob('soliq_hisob_zaxira_' + A.today() + '.json', new Blob([JSON.stringify(dump)], { type: 'application/json' }));
      },
      async restore(ev) {
        const f = ev.target.files[0]; if (!f) return;
        try {
          const dump = JSON.parse(await f.text());
          if (!(await A.ask(t('Joriy barcha ma\'lumotlar zaxira nusxasi bilan almashtiriladi. Davom etasizmi?'), t('Tiklash'), true))) return;
          await S.store.importAll(dump); location.reload();
        } catch (e) { A.toast(A.errText(e), 'err'); }
        ev.target.value = '';
      }
    },
    template: `
    <section class="page narrow">
      <header class="page-h"><div><h1>{{t('Firma sozlamalari')}}</h1></div><button class="btn primary" @click="edit">{{t('Tahrirlash')}}</button></header>
      <div class="panel">
        <dl class="props">
          <dt>{{t('Firma nomi')}}</dt><dd>{{S.firm.name}}</dd><dt>{{t('STIR')}}</dt><dd class="mono">{{S.firm.inn}}</dd>
          <dt>{{t('Soliq rejimi')}}</dt><dd>{{t(REGIME_LABEL[S.firm.regime])}}</dd>
          <dt>{{t('Tannarx usuli')}}</dt><dd>{{ S.firm.cost_method==='fifo' ? 'FIFO' : t('O\\'rtacha tannarx') }}</dd>
          <template v-if="S.firm.regime!=='vat'"><dt>{{t("Aylanma solig'i stavkasi")}}</dt><dd>{{turnoverRate()}}%</dd></template>
          <template v-else><dt>{{t("Foyda solig'i stavkasi")}}</dt><dd>{{profitRate()}}%</dd></template>
          <dt>{{t('Rahbar')}}</dt><dd>{{S.firm.director || '—'}}</dd><dt>{{t('Bosh buxgalter')}}</dt><dd>{{S.firm.chief_accountant || '—'}}</dd>
          <dt>{{t('Manzil')}}</dt><dd>{{S.firm.address || '—'}}</dd>
        </dl>
      </div>
      <div class="panel">
        <h2>{{t('Davrni yopish')}}</h2>
        <p class="muted">{{t('Hisobot topshirilgandan keyin oyni yoping. Yopilgan davrdagi hujjatlar, xarajatlar va to\\'lovlarni o\\'zgartirib yoki o\\'chirib bo\\'lmaydi.')}}</p>
        <div class="row-gap wrap"><label class="inline"><span>{{t('Qaysi oygacha')}}</span><input type="month" v-model="closeM" id="cl-m"></label>
          <button class="btn" @click="closePeriod" :disabled="!closeM">{{t('Davrni yopish')}}</button>
          <button class="btn danger ghost" v-if="S.firm.closed_until" @click="openPeriod">{{t('Davrni ochish')}}</button></div>
        <p v-if="S.firm.closed_until" class="pill lockp">🔒 {{t('Yopilgan')}}: {{monthName(S.firm.closed_until)}} {{t('gacha')}}</p>
      </div>
      <div class="panel">
        <h2>{{t('Ma\\'lumotlarni yuklab olish')}}</h2>
        <div class="row-gap wrap">
          <button class="btn" @click="exportAll">⤓ {{t('Barcha ma\\'lumotnomalar (Excel)')}}</button>
          <template v-if="S.store.mode==='local'">
            <button class="btn ghost" @click="backup">⤓ {{t('Zaxira nusxa (JSON)')}}</button>
            <label class="btn ghost file">{{t('Zaxiradan tiklash')}}<input type="file" accept=".json" @change="restore" id="restore-f"></label>
          </template>
        </div>
        <p class="muted small" v-if="S.store.mode==='local'">{{t('Lokal rejimda ma\\'lumotlar shu brauzerda saqlanadi. Muntazam zaxira nusxa olib turing.')}}</p>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>{{t('O\\'zgarishlar tarixi')}}</h2><span class="grow"></span><button class="btn ghost sm" @click="loadAudit">{{t('Ko\\'rsatish')}}</button></div>
        <div class="tbl-wrap" v-if="showAudit"><table class="tbl compact">
          <thead><tr><th>{{t('Vaqt')}}</th><th>{{t('Foydalanuvchi')}}</th><th>{{t('Amal')}}</th><th>{{t('Yozuv')}}</th></tr></thead>
          <tbody><tr v-for="a in audit" :key="a.id"><td class="mono">{{(a.at||'').replace('T',' ').slice(0,16)}}</td><td class="mono">{{a.user_login}}</td>
            <td>{{ {create:t('Yaratildi'), update:t('O\\'zgartirildi'), delete:t('O\\'chirildi')}[a.action] }}</td><td>{{a.summary}}</td></tr>
            <tr v-if="!audit.length"><td colspan="4" class="empty">{{t("Hozircha yozuv yo'q")}}</td></tr></tbody>
        </table></div>
      </div>
    </section>`
  };
})();
