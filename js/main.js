/* Ilovaning ildizi: navigatsiya, ishga tushirish, namuna ma'lumot */
(function () {
  const A = window.App; const { S, t } = A;

  window.nextNumber = (type) => {
    const nums = A.recsOf('doc').filter((d) => d.type === type).map((d) => parseInt(String(d.number).replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  };
  window.newDoc = (type, lines) => {
    const whs = A.recsOf('warehouse');
    S.editDoc = { doc: { kind: 'doc', type, number: window.nextNumber(type), date: A.today(), wh: whs.length === 1 ? whs[0].id : '', wh2: '', cp: '', priceVat: false, includeCosts: false, deductible: type === 'inventory' ? false : true, lines: lines || [] } };
    S.view = 'docs';
  };

  window.afterLogin = async () => {
    S.settings = await S.store.getSettings();
    await A.loadFirms();
    await A.loadContent();
    if (A.can('users') || A.can('content')) S.users = await S.store.listUsers();
    S.adminView = A.isStaff() ? (A.can('users') ? 'users' : A.can('content') ? 'content' : 'mine') : 'mine';
    if (S.user.must_change) A.openModal('change-pass', { forced: true });
    setTimeout(() => A.calendar.notifyNow(), 1500);
    if (!A.isStaff()) {
      let last = null; try { last = localStorage.getItem('sh_last_firm'); } catch (e) { }
      const f = S.firms.find((x) => x.id === last) || (S.firms.length === 1 ? S.firms[0] : null);
      if (f) await A.openFirm(f);
    }
  };

  async function logout(msg) {
    await S.store.logout(); S.user = null; A.closeFirm(); S.firms = []; S.users = []; S.modals = []; S.content = [];
    if (msg) A.toast(msg, 'err');
  }

  /* Namuna firma: tizimni sinash uchun */
  window.Demo = {
    async create() {
      const f = await A.saveFirm({ name: t('Namuna') + ' MCHJ', inn: '312345678', regime: 'vat', cost_method: 'avg', director: 'Karimov A.', address: 'Qarshi sh.' });
      S.firm = { ...f }; S.recs = [];
      const y = new Date().getFullYear(); const m = new Date().getMonth() + 1;
      const d = (mm, dd) => y + '-' + String(Math.max(1, Math.min(mm, 12))).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      const id = () => Store.uid(); const now = Store.nowIso();
      const base = { firm_id: f.id, created_at: now, created_by: S.user.login };
      const w1 = { ...base, id: id(), kind: 'warehouse', name: t('Asosiy ombor') }, w2 = { ...base, id: id(), kind: 'warehouse', name: t('Obyekt ombori') };
      const c1 = { ...base, id: id(), kind: 'counterparty', name: '"Qurilish Savdo" MCHJ', inn: '301112233' };
      const c2 = { ...base, id: id(), kind: 'counterparty', name: '"Bunyodkor Invest" MCHJ', inn: '302223344' };
      const c3 = { ...base, id: id(), kind: 'counterparty', name: '"Texno Servis" XK', inn: '303334455' };
      const P = (mxik, name, unit) => ({ ...base, id: id(), kind: 'product', mxik, name, unit, vat: 'std', ptype: 'goods' });
      const p1 = P('02523002009000000', 'Sement M400', 'tonna'), p2 = P('06810006010000000', 'Temir-beton quvur D500', 'dona'), p3 = P('06901001001000000', "G'isht", 'dona');
      const prev = Math.max(1, m - 1);
      const docs = [
        { type: 'receipt', number: '1', date: d(prev, 3), wh: w1.id, cp: c1.id, lines: [{ p: p1.id, qty: 20, price: 950000, vat: 'std' }, { p: p3.id, qty: 5000, price: 1200, vat: 'std' }] },
        { type: 'receipt', number: '2', date: d(prev, 10), wh: w1.id, cp: c1.id, lines: [{ p: p1.id, qty: 10, price: 1010000, vat: 'std' }, { p: p2.id, qty: 40, price: 620000, vat: 'std' }] },
        { type: 'sale', number: '1', date: d(prev, 18), wh: w1.id, cp: c2.id, lines: [{ p: p1.id, qty: 15, price: 2200000, vat: 'std', act: 'resale' }, { p: p2.id, qty: 25, price: 1400000, vat: 'std', act: 'resale', tag: 'Ulgurji' }] },
        { type: 'transfer', number: '1', date: d(prev, 20), wh: w1.id, wh2: w2.id, lines: [{ p: p3.id, qty: 2000 }] },
        { type: 'sale', number: '2', date: d(m, 2), wh: w2.id, cp: c2.id, lines: [{ p: p3.id, qty: 1800, price: 1900, vat: 'std', act: 'resale' }] },
        { type: 'writeoff', number: '1', date: d(m, 3), wh: w1.id, deductible: true, note: t('Tabiiy kamayish'), lines: [{ p: p1.id, qty: 0.5 }] },
        { type: 'inventory', number: '1', date: d(m, 4), wh: w1.id, deductible: false, lines: [{ p: p2.id, actual: 14 }, { p: p3.id, actual: 3000 }] }
      ].map((x, i) => ({ ...base, id: id(), kind: 'doc', priceVat: false, created_at: new Date(Date.now() + i).toISOString(), ...x }));
      const ex = [
        { date: d(prev, 28), category: 'salary', descr: t('Ish haqi'), amount: 6000000, vat: 0, deductible: true },
        { date: d(prev, 28), category: 'social', descr: t('Ijtimoiy soliq'), amount: 720000, vat: 0, deductible: true },
        { date: d(prev, 15), category: 'rent', descr: t('Ombor ijarasi'), amount: 5000000, vat: 600000, deductible: true, cp: c3.id },
        { date: d(m, 1), category: 'penalty', descr: t('Jarima'), amount: 340000, vat: 0, deductible: false }
      ].map((x) => ({ ...base, id: id(), kind: 'expense', ...x }));
      const pays = [
        { date: d(prev, 12), direction: 'out', cp: c1.id, amount: 30000000, method: 'bank' },
        { date: d(prev, 25), direction: 'in', cp: c2.id, amount: 25000000, method: 'bank' }
      ].map((x) => ({ ...base, id: id(), kind: 'payment', ...x }));
      const asset = { ...base, id: id(), kind: 'asset', name: t('Yuk avtomobili') + ' Isuzu', inv_no: 'AV-001', acquire_date: d(1, 15), start_date: d(1, 20), cost: 96000000, vat: 11520000, cp: c3.id, depreciate: true, method: 'percent', rate: 20, salvage: 0 };
      // ishlab chiqarish: lotok
      const q1 = P('02505001004000000', 'Qum', 'kg'), q2 = P('02517001004000000', 'Sheben', 'kg'), q3 = P('03824001003000000', "Beton uchun kimyoviy qo'shimcha", 'litr'), q4 = P('07214001001000000', 'Armatura A500 d10', 'kg');
      const lot = { ...P('06810006023000000', 'Temir-beton lotok L-1', 'dona'), ptype: 'produced' };
      const recipe = { ...base, id: id(), kind: 'recipe', product: lot.id, mats: [{ p: q3.id, per: 1 }, { p: q2.id, per: 100 }, { p: q1.id, per: 200, loss: 2 }, { p: p1.id, per: 0.3 }, { p: q4.id, per: 12 }],
        costs: [{ name: t('Ish haqi'), per: 25000 }, { name: t('Elektr energiyasi'), per: 6000 }] };
      const pd = [
        { type: 'receipt', number: '3', date: d(m, 1), wh: w1.id, cp: c1.id, lines: [{ p: q1.id, qty: 50000, price: 120, vat: 'std' }, { p: q2.id, qty: 25000, price: 150, vat: 'std' }, { p: q3.id, qty: 250, price: 18000, vat: 'std' }, { p: q4.id, qty: 3000, price: 9800, vat: 'std' }, { p: p1.id, qty: 60, price: 1000000, vat: 'std' }] },
        { type: 'production', number: '1', date: d(m, 2), wh: w1.id, wh2: w2.id, includeCosts: false, lines: [{ p: lot.id, qty: 220, mats: recipe.mats, costs: recipe.costs }] },
        { type: 'sale', number: '3', date: d(m, 3), wh: w2.id, cp: c2.id, lines: [{ p: lot.id, qty: 200, price: 950000, vat: 'std', act: 'prod', tag: 'L-1 buyurtma' }] }
      ].map((x, i) => ({ ...base, id: id(), kind: 'doc', priceVat: false, created_at: new Date(Date.now() + 100 + i).toISOString(), ...x }));
      const all = [w1, w2, c1, c2, c3, p1, p2, p3, q1, q2, q3, q4, lot, recipe, ...docs, ...pd, ...ex, ...pays, asset];
      await S.store.putRecords(all);
      return f;
    }
  };

  const NAV = [
    ['dash', 'Bosh sahifa', '◧'], ['docs', 'Hujjatlar', '▤'], ['lines', 'Kirim-chiqim tahlili', '⧉'], ['products', 'Mahsulotlar', '▦'], ['stock', 'Ombor qoldiqlari', '▥'], ['warehouses', 'Omborlar', '⌂'], ['production', 'Ishlab chiqarish', '⚒'],
    ['assets', 'Asosiy vositalar', '◫'], ['expenses', 'Xarajatlar', '▿'], ['cps', 'Kontragentlar', '◎'], ['accounting', 'Buxgalteriya', '⊞'], ['reports', 'Soliq hisobotlari', '∑'], ['stats', 'Statistika', '◔'], ['calendar', 'Soliq kalendari', '▣'], ['settings', 'Sozlamalar', '⚙']
  ];
  const ADMIN_NAV = [['users', 'Buxgalterlar', '◎', 'users'], ['admins', 'Sayt adminlari', '◉', 'ADMIN'], ['firms', 'Barcha firmalar', '▦', 'firms'], ['content', 'Yangiliklar va reklama', '✎', 'content'],
    ['calendar', 'Soliq kalendari', '▣', ''], ['settings', 'Soliq stavkalari', '%', 'rates'], ['mine', 'Firmalarim', '◧', '']];
  window.goCalendar = () => { if (S.firm) { S.view = 'calendar'; S.editDoc = null; } else S.adminView = 'calendar'; };

  const Root = {
    data() { return { NAV, userMenu: false }; },
    computed: {
      adminNav() { return ADMIN_NAV.filter((n) => !n[3] || (n[3] === 'ADMIN' ? S.user.role === 'admin' : A.can(n[3]))); },
      roleName() { return S.user.role === 'admin' ? t('Bosh admin') : S.user.role === 'manager' ? t('Sayt admini') : t('Buxgalter'); },
      viewComp() { return { stats: 'stats-view', lines: 'lines-view', accounting: 'accounting-view', calendar: 'calendar-view', dash: 'dash-view', docs: 'docs-view', products: 'products-view', stock: 'stock-view', warehouses: 'warehouses-view', production: 'production-view', assets: 'assets-view', expenses: 'expenses-view', cps: 'cps-view', reports: 'reports-view', settings: 'settings-view' }[S.view]; } },
    methods: {
      go(v) { S.view = v; S.editDoc = null; S.sideOpen = false; window.scrollTo(0, 0); },
      adminGo(v) { A.closeFirm(); S.adminView = v; S.sideOpen = false; },
      toFirms() { A.closeFirm(); S.adminView = 'mine'; },
      logout() { this.userMenu = false; logout(); },
      chpass() { this.userMenu = false; A.openModal('change-pass', {}); }
    },
    template: `
    <div v-if="!S.ready" class="boot">{{t('Yuklanmoqda…')}}</div>
    <login-view v-else-if="!S.user"></login-view>
    <div v-else class="shell" :class="{firm: !!S.firm}">
      <header class="topbar">
        <button class="icon-btn burger" @click="S.sideOpen=!S.sideOpen" :aria-label="t('Menyu')">☰</button>
        <div class="brand"><span class="mark">Σ</span><span class="brand-t">{{t('Soliq va ombor')}}</span></div>
        <button v-if="S.firm" class="firm-switch" @click="toFirms" :title="t('Firmalar ro\\'yxatiga qaytish')"><span class="fs-name">{{S.firm.name}}</span><span class="muted mono">{{S.firm.inn}}</span><span class="muted">⇄</span></button>
        <span class="grow"></span>
 <bell></bell>
        <span class="mode-pill" :class="S.store.mode">{{ S.store.mode==='local' ? t('Lokal') : t('Bulut') }}</span>
        <select class="lang" v-model="S.lang" @change="setLang(S.lang)" :aria-label="t('Til')" id="lang-sel"><option value="uz">O‘zb</option><option value="cy">Ўзб</option><option value="ru">Рус</option></select>
        <div class="menu-wrap"><button class="user-btn" @click="userMenu=!userMenu"><span class="avatar">{{(S.user.full_name||S.user.login||'?')[0]}}</span><span class="u-name">{{S.user.login}}</span></button>
          <div class="menu right" v-if="userMenu" @mouseleave="userMenu=false">
            <div class="menu-head"><b>{{S.user.full_name}}</b><span class="muted small">{{roleName}}</span></div>
            <button @click="chpass">{{t('Parolni almashtirish')}}</button><button @click="logout">{{t('Chiqish')}}</button></div></div>
      </header>
      <aside class="side" :class="{open:S.sideOpen}" v-if="S.firm || isStaff()">
        <nav v-if="S.firm">
          <button v-for="n in NAV" :key="n[0]" :class="{on:S.view===n[0]}" @click="go(n[0])"><span class="ni">{{n[2]}}</span>{{t(n[1])}}</button>
        </nav>
        <nav v-else>
          <button v-for="n in adminNav" :key="n[0]" :class="{on:S.adminView===n[0]}" @click="adminGo(n[0])"><span class="ni">{{n[2]}}</span>{{t(n[1])}}</button>
        </nav>
        <div class="side-foot" v-if="S.firm && S.firm.closed_until">🔒 {{t('Yopilgan')}}: {{monthName(S.firm.closed_until)}}</div>
      </aside>
      <div class="scrim" v-if="S.sideOpen" @click="S.sideOpen=false"></div>
      <main class="main">
        <div class="tops" v-if="!isStaff()"><ad-banner></ad-banner><deadline-banner></deadline-banner></div>
        <template v-if="S.firm && S.calc"><component :is="viewComp" :key="S.firm.id + S.view"></component></template>
        <template v-else-if="isStaff()">
          <admin-users v-if="S.adminView==='users' && can('users')"></admin-users>
          <admins-view v-else-if="S.adminView==='admins' && S.user.role==='admin'"></admins-view>
          <admin-firms v-else-if="S.adminView==='firms' && can('firms')"></admin-firms>
          <content-admin v-else-if="S.adminView==='content' && can('content')"></content-admin>
          <calendar-view v-else-if="S.adminView==='calendar'"></calendar-view>
          <admin-settings v-else-if="S.adminView==='settings' && can('rates')"></admin-settings>
          <firms-view v-else></firms-view>
        </template>
        <calendar-view v-else-if="S.adminView==='calendar'"></calendar-view>
        <firms-view v-else></firms-view>
      </main>
    </div>
    <component v-for="m in S.modals" :key="m.key" :is="m.comp" v-bind="m.props"></component>
    <div class="modal-back top" v-if="S.confirm" @mousedown.self="answer(false)">
      <div class="modal small" role="alertdialog"><div class="modal-b"><p>{{S.confirm.text}}</p></div>
        <footer class="modal-f"><span class="grow"></span><button class="btn ghost" @click="answer(false)">{{t('Bekor qilish')}}</button>
        <button class="btn" :class="S.confirm.danger ? 'danger' : 'primary'" @click="answer(true)" autofocus>{{S.confirm.okLabel}}</button></footer></div>
    </div>
    <div class="toast" v-if="S.toast" :class="S.toast.kind" role="status">{{S.toast.text}}</div>
    <div class="busy" v-if="S.busy"><div class="busy-box">{{S.busy}}</div></div>`
  };

  async function boot() {
    const app = Vue.createApp(Root);
    Object.entries(window.Components).forEach(([k, v]) => app.component(k, v));
    const gp = app.config.globalProperties;
    Object.assign(gp, A, { Forms: window.Forms, curYear: () => new Date().getFullYear(), newDoc: (...a) => window.newDoc(...a) });
    gp.S = S;
    app.mount('#app');
    try {
      S.store = await Store.create();
      S.units = await Mxik.getUnits();
      A.setLang(S.lang);
      S.user = S.store.user();
      if (S.user) await window.afterLogin();
    } catch (e) { console.error(e); A.toast(A.errText(e), 'err'); }
    S.ready = true;
    // bitta login faqat bitta qurilmada
    setInterval(async () => {
      if (!S.user) return;
      try { const ok = await S.store.checkSession(); if (!ok) logout(t('Sessiya tugadi: hisobingizga boshqa qurilmadan kirildi yoki hisob bloklandi')); } catch (e) { }
    }, 60000);
    // soliq muddatlari: har soatda eslatma va yangiliklarni yangilash
    setInterval(async () => { if (!S.user) return; await A.loadContent(); A.calendar.notifyNow(); }, 3600000);
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
})();
