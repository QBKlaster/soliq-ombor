/* Yangiliklar, reklama, soliq kalendari, eslatmalar va sayt adminlari */
(function () {
  const A = window.App; const { S, t } = A; const C = window.Components;
  const today = () => A.today();
  /* ko'p tilli matn: lotinda kiritiladi, kirill avtomatik, ruscha ixtiyoriy */
  function loc(item, f) {
    if (!item) return '';
    const v = item[f] || '';
    if (S.lang === 'ru') return item[f + '_ru'] || v;
    if (S.lang === 'cy') return window.Translit.lat2cyr(v);
    return v;
  }
  A.loc = loc;
  const cyrHint = (k) => (m) => (m[k] ? t('Kirillda: {0}', window.Translit.lat2cyr(String(m[k]).slice(0, 160))) : t("Lotin alifbosida yozing, kirill avtomatik bo'ladi"));
  const ruHint = "Bo'sh qolsa rus tilida o'zbekcha matn ko'rsatiladi";
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };

  /* ---- Kalendar: takrorlanuvchi muddatlar ---- */
  function occurrences(e, from, to) {
    const out = [];
    if (!e.date) return out;
    const step = e.repeat === 'monthly' ? 1 : e.repeat === 'quarterly' ? 3 : e.repeat === 'yearly' ? 12 : 0;
    if (!step) { if (e.date >= from && e.date <= to) out.push(e.date); return out; }
    const [y0, m0, d0] = e.date.split('-').map(Number);
    for (let i = 0; i < 400; i++) {
      const mm = m0 - 1 + i * step; const y = y0 + Math.floor(mm / 12); const m = (mm % 12) + 1;
      const last = new Date(y, m, 0).getDate();
      const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(d0, last)).padStart(2, '0');
      if (e.until && ds > e.until) break;
      if (ds > to) break;
      if (ds >= from) out.push(ds);
    }
    return out;
  }
  const calEntries = () => S.content.filter((c) => c.kind === 'cal');
  const doneKey = () => 'sh_done_' + (S.user ? S.user.id : '');
  const isDone = (id, date) => !!((store(doneKey()) || {})[id + '|' + date]);
  function setDone(id, date, v) { const m = store(doneKey()) || {}; if (v) m[id + '|' + date] = 1; else delete m[id + '|' + date]; store(doneKey(), m); A.S.content = [...A.S.content]; }
  /* yaqinlashayotgan muddatlar (eslatma oynasi ichida) */
  function upcoming() {
    const td = today();
    const to = new Date(); to.setDate(to.getDate() + 45);
    const out = [];
    for (const e of calEntries()) {
      const win = Number(e.remind_days === undefined || e.remind_days === '' ? 5 : e.remind_days);
      for (const d of occurrences(e, addDays(td, -3), to.toISOString().slice(0, 10))) {
        const left = daysBetween(td, d);
        if (left <= win && left >= -3 && !isDone(e.id, d)) out.push({ e, date: d, left });
      }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  function addDays(d, n) { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); const z = new Date(x.getTime() - x.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
  const leftText = (n) => (n < 0 ? t('{0} kun o\'tdi', -n) : n === 0 ? t('Bugun oxirgi kun') : n === 1 ? t('Ertaga oxirgi kun') : t('{0} kun qoldi', n));

  /* Brauzer bildirishnomalari (sayt ochiq bo'lganda) */
  function notifySupported() { try { return 'Notification' in window && Notification.permission !== 'denied'; } catch (e) { return false; } }
  function notifyNow() {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted' || !S.user) return;
      const td = today();
      for (const u of upcoming()) {
        const k = 'sh_notif_' + S.user.id + '_' + u.e.id + '_' + u.date + '_' + td;
        if (store(k)) continue;
        new Notification(loc(u.e, 'title'), { body: A.dateFmt(u.date) + ' — ' + leftText(u.left) + (u.e.note ? '\n' + loc(u.e, 'note') : ''), tag: u.e.id + u.date });
        store(k, 1);
      }
    } catch (e) { }
  }
  async function askNotify() {
    try { const p = await Notification.requestPermission(); if (p === 'granted') { notifyNow(); A.toast(t('Bildirishnomalar yoqildi')); } else A.toast(t('Brauzer bildirishnomaga ruxsat bermadi'), 'err'); }
    catch (e) { A.toast(t('Bu yerda bildirishnomalar ishlamaydi'), 'err'); }
  }

  /* ---- Reklama va yangiliklar ---- */
  function activeAds() {
    const td = today();
    return S.content.filter((c) => c.kind === 'ad' && c.active !== false && (!c.start || c.start <= td) && (!c.end || c.end >= td)
      && (c.audience !== 'selected' || (c.users || []).includes(S.user && S.user.id)));
  }
  function activeNews() { return S.content.filter((c) => c.kind === 'news' && c.active !== false && (!c.date || c.date <= today())).sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1)); }

  /* Rasmni kichraytirib data URL qilish */
  function imageToDataUrl(file, max = 1200) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = rej; img.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }

  C['ad-banner'] = {
    data() { return { i: 0, closed: !!store('sh_ad_closed_' + today()) }; },
    computed: { ads() { return activeAds(); }, ad() { return this.ads.length ? this.ads[this.i % this.ads.length] : null; } },
    mounted() { this.tm = setInterval(() => { this.i++; }, 8000); },
    unmounted() { clearInterval(this.tm); },
    methods: { close() { this.closed = true; store('sh_ad_closed_' + today(), 1); } },
    template: `
    <aside class="ad" v-if="ad && !closed" :aria-label="t('Reklama')">
      <img v-if="ad.image" :src="ad.image" alt="">
      <div class="ad-body"><span class="ad-tag">{{t('Reklama')}}</span><b>{{loc(ad,'title')}}</b><span v-if="ad.text">{{loc(ad,'text')}}</span>
        <a v-if="ad.link" :href="ad.link" target="_blank" rel="noopener">{{t('Batafsil')}} →</a></div>
      <button class="icon-btn" @click="close" :aria-label="t('Yopish')">✕</button>
    </aside>`
  };

  C['news-block'] = {
    data() { return { open: null }; },
    computed: { news() { return activeNews().slice(0, 5); } },
    template: `
    <div class="panel news" v-if="news.length">
      <h2>{{t('Yangiliklar')}}</h2>
      <ul class="news-list"><li v-for="n in news" :key="n.id">
        <button class="link" @click="open = open===n.id ? null : n.id"><span class="muted mono small">{{dateFmt(n.date)}}</span> <b>{{loc(n,'title')}}</b></button>
        <p v-if="open===n.id" class="news-body">{{loc(n,'body')}}</p></li></ul>
    </div>`
  };

  C['deadline-banner'] = {
    computed: { items() { return upcoming().filter((u) => u.left <= 3); } },
    methods: { done(u) { setDone(u.e.id, u.date, true); }, leftText },
    template: `
    <div class="deadline" v-if="items.length" role="status">
      <div v-for="u in items" :key="u.e.id+u.date" class="dl-row" :class="{late: u.left < 0, today: u.left === 0}">
        <span class="dl-date mono">{{dateFmt(u.date)}}</span><b>{{loc(u.e,'title')}}</b><span class="dl-left">{{leftText(u.left)}}</span>
        <span class="grow"></span><button class="btn ghost sm" @click="done(u)">✓ {{t('Topshirildi')}}</button>
      </div>
    </div>`
  };

  C['bell'] = {
    data() { return { open: false }; },
    computed: { items() { return upcoming(); }, canNotify() { try { return 'Notification' in window && Notification.permission === 'default'; } catch (e) { return false; } } },
    methods: { done(u) { setDone(u.e.id, u.date, true); }, ask() { askNotify(); }, go() { this.open = false; window.goCalendar(); }, leftText },
    template: `
    <div class="menu-wrap">
      <button class="icon-btn bell" @click="open=!open" :aria-label="t('Eslatmalar')" :title="t('Eslatmalar')">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 20a2 2 0 0 0 4 0"/></svg>
        <span class="bell-n" v-if="items.length">{{items.length}}</span></button>
      <div class="menu right bell-menu" v-if="open" @mouseleave="open=false">
        <div class="menu-head"><b>{{t('Soliq hisobotlari muddatlari')}}</b></div>
        <p class="muted small pad" v-if="!items.length">{{t('Yaqin kunlarda muddat yo\\'q')}}</p>
        <div v-for="u in items" :key="u.e.id+u.date" class="bell-item" :class="{late: u.left < 0}">
          <div><b>{{loc(u.e,'title')}}</b><div class="muted small">{{dateFmt(u.date)}} · {{leftText(u.left)}}</div></div>
          <button class="btn ghost sm" @click="done(u)">✓</button></div>
        <button v-if="canNotify" @click="ask">🔔 {{t('Bildirishnomalarni yoqish')}}</button>
        <button @click="go">{{t('Soliq kalendarini ochish')}}</button>
      </div>
    </div>`
  };

  /* ---- Kalendar ko'rinishi ---- */
  C['calendar-view'] = {
    data() { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, sel: null }; },
    computed: {
      editable() { return A.can('content'); },
      first() { return this.y + '-' + String(this.m).padStart(2, '0') + '-01'; },
      last() { return this.y + '-' + String(this.m).padStart(2, '0') + '-' + String(new Date(this.y, this.m, 0).getDate()).padStart(2, '0'); },
      occ() {
        const map = {};
        for (const e of calEntries()) for (const d of occurrences(e, this.first, this.last)) (map[d] = map[d] || []).push(e);
        return map;
      },
      cells() {
        const startDow = (new Date(this.y, this.m - 1, 1).getDay() + 6) % 7; // dushanbadan
        const n = new Date(this.y, this.m, 0).getDate(); const out = [];
        for (let i = 0; i < startDow; i++) out.push(null);
        for (let d = 1; d <= n; d++) { const ds = this.y + '-' + String(this.m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); out.push({ d, ds, items: this.occ[ds] || [] }); }
        while (out.length % 7) out.push(null);
        return out;
      },
      list() { return Object.entries(this.occ).sort().flatMap(([d, es]) => es.map((e) => ({ d, e }))); },
      days() { return ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']; }
    },
    methods: {
      move(k) { this.m += k; if (this.m < 1) { this.m = 12; this.y--; } if (this.m > 12) { this.m = 1; this.y++; } },
      async edit(e, date) {
        if (!this.editable) return;
        const r = await A.openModal('rec-form', {
          title: e ? t('Muddatni tahrirlash') : t('Yangi muddat'), value: e || { date },
          fields: [
            { k: 'title', label: 'Hisobot yoki soliq nomi (lotin)', req: true, full: true, ph: 'Masalan: QQS hisoboti', hint: cyrHint('title') },
            { k: 'title_ru', label: 'Nomi ruscha', full: true, ph: 'Например: Отчёт по НДС', hint: ruHint },
            { k: 'date', type: 'date', label: 'Oxirgi kun', req: true },
            { k: 'repeat', type: 'select', label: 'Takrorlanishi', def: 'none', options: () => [['none', t('Takrorlanmaydi')], ['monthly', t('Har oy')], ['quarterly', t('Har chorak')], ['yearly', t('Har yili')]] },
            { k: 'until', type: 'date', label: 'Qachongacha takrorlansin', show: (m) => m.repeat && m.repeat !== 'none', hint: "Bo'sh qolsa muddatsiz" },
            { k: 'remind_days', type: 'number', label: 'Necha kun oldin eslatilsin', def: 5 },
            { k: 'note', type: 'textarea', label: 'Izoh (lotin)', full: true, hint: cyrHint('note') },
            { k: 'note_ru', type: 'textarea', label: 'Izoh ruscha', full: true, hint: ruHint }
          ],
          onSave: async (m) => { const it = await S.store.saveContent({ ...m, kind: 'cal' }); await A.loadContent(); return it; },
          onDelete: async (m) => { await S.store.deleteContent(m.id); await A.loadContent(); }
        });
        if (r) A.toast(t('Saqlandi'));
      },
      toggle(e, d) { setDone(e.id, d, !isDone(e.id, d)); },
      isDone(e, d) { return isDone(e.id, d); }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Soliq kalendari')}}</h1><p class="muted">{{ editable ? t('Kunni bosib soliq hisobotining oxirgi muddatini kiriting') : t('Hisobotlarni topshirishning oxirgi kunlari') }}</p></div>
        <div class="row-gap"><button class="btn ghost" @click="move(-1)" :aria-label="t('Oldingi oy')">←</button><b class="cal-title">{{t(MONTHS[m-1])}} {{y}}</b><button class="btn ghost" @click="move(1)" :aria-label="t('Keyingi oy')">→</button>
          <button v-if="editable" class="btn primary" @click="edit(null, first)">+ {{t('Muddat qo\\'shish')}}</button></div></header>
      <div class="cal">
        <div class="cal-h" v-for="d in days" :key="d">{{t(d)}}</div>
        <div v-for="(c,i) in cells" :key="i" class="cal-c" :class="{empty:!c, today: c && c.ds===today(), has: c && c.items.length}" @click="c && editable && edit(null, c.ds)">
          <template v-if="c"><span class="cal-d">{{c.d}}</span>
            <button v-for="e in c.items" :key="e.id" class="cal-e" :class="{done: isDone(e, c.ds)}" @click.stop="editable ? edit(e) : toggle(e, c.ds)" :title="loc(e,'note') || loc(e,'title')">{{loc(e,'title')}}</button>
            <button v-if="editable" class="cal-add" @click.stop="edit(null, c.ds)" :aria-label="t('Muddat qo\\'shish')">+ {{t('qo\\'shish')}}</button></template>
        </div>
      </div>
      <div class="panel">
        <h2>{{t('Shu oydagi muddatlar')}}</h2>
        <p class="muted" v-if="!list.length">{{t('Bu oyga muddat kiritilmagan')}}</p>
        <ul class="doc-list"><li v-for="x in list" :key="x.e.id+x.d"><div class="cal-li" :class="{done: isDone(x.e, x.d)}">
          <span class="mono">{{dateFmt(x.d)}}</span><b>{{loc(x.e,'title')}}</b><span class="muted small">{{loc(x.e,'note')}}</span><span class="grow"></span>
          <label class="check small"><input type="checkbox" :checked="isDone(x.e, x.d)" @change="toggle(x.e, x.d)"> {{t('Topshirildi')}}</label>
          <button v-if="editable" class="btn ghost sm" @click="edit(x.e)">{{t('Tahrirlash')}}</button></div></li></ul>
      </div>
    </section>`
  };

  /* ---- Yangilik va reklama boshqaruvi ---- */
  C['content-admin'] = {
    data() { return { tab: 'news' }; },
    computed: {
      news() { return S.content.filter((c) => c.kind === 'news').sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1)); },
      ads() { return S.content.filter((c) => c.kind === 'ad'); },
      nCols() { return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date) }, { k: 'title', label: 'Sarlavha' }, { k: 'active', label: 'Holati', f: (r) => (r.active === false ? t('Yashirin') : t('Ko\'rinadi')) }]; },
      aCols() {
        const td = A.today();
        return [{ k: 'title', label: 'Sarlavha' }, { k: 'start', label: 'Boshlanishi', f: (r) => A.dateFmt(r.start) }, { k: 'end', label: 'Tugashi', f: (r) => A.dateFmt(r.end) },
          { k: 'audience', label: 'Kimga', f: (r) => (r.audience === 'selected' ? t('{0} ta buxgalter', (r.users || []).length) : t('Hammaga')) },
          { k: 'st', label: 'Holati', f: (r) => (r.active === false ? t('Yashirin') : r.end && r.end < td ? t('Muddati tugagan') : r.start && r.start > td ? t('Kutilmoqda') : t('Ko\'rinadi')) }];
      }
    },
    methods: {
      async editNews(n) {
        const r = await A.openModal('rec-form', { title: n ? t('Yangilik') : t('Yangi yangilik'), value: n || {}, wide: true,
          fields: [{ k: 'title', label: 'Sarlavha (lotin)', req: true, full: true, hint: cyrHint('title') }, { k: 'title_ru', label: 'Sarlavha ruscha', full: true, hint: ruHint },
            { k: 'date', type: 'date', label: 'Sana', def: A.today, req: true }, { k: 'active', type: 'check', label: 'Buxgalterlarga ko\'rinsin', def: true },
            { k: 'body', type: 'textarea', label: 'Matn (lotin)', req: true, full: true, hint: cyrHint('body') }, { k: 'body_ru', type: 'textarea', label: 'Matn ruscha', full: true, hint: ruHint }],
          onSave: async (m) => { const it = await S.store.saveContent({ ...m, kind: 'news' }); await A.loadContent(); return it; },
          onDelete: async (m) => { await S.store.deleteContent(m.id); await A.loadContent(); } });
        if (r) A.toast(t('Saqlandi'));
      },
      async editAd(a) {
        const accs = S.users.filter((u) => !u.role || u.role === 'accountant').map((u) => [u.id, u.login + ' — ' + (u.full_name || '')]);
        const r = await A.openModal('rec-form', { title: a ? t('Reklama') : t('Yangi reklama'), value: a || {}, wide: true,
          fields: [{ k: 'title', label: 'Sarlavha (lotin)', req: true, full: true, hint: cyrHint('title') }, { k: 'title_ru', label: 'Sarlavha ruscha', full: true, hint: ruHint },
            { k: 'text', type: 'textarea', label: 'Matn (lotin)', full: true, hint: cyrHint('text') }, { k: 'text_ru', type: 'textarea', label: 'Matn ruscha', full: true, hint: ruHint },
            { k: 'image', type: 'image', label: 'Rasm', full: true, hint: 'Ixtiyoriy. Rasm avtomatik kichraytiriladi' },
            { k: 'link', label: 'Havola (https://...)', full: true, validate: (v) => (!v || /^https?:\/\//.test(v) ? '' : t("Havola https:// bilan boshlanishi kerak")) },
            { k: 'start', type: 'date', label: 'Boshlanish sanasi', def: A.today }, { k: 'end', type: 'date', label: 'Tugash sanasi', hint: "Bo'sh qolsa muddatsiz" },
            { k: 'audience', type: 'select', label: 'Kimga ko\'rsatilsin', def: 'all', options: () => [['all', t('Barcha buxgalterlarga')], ['selected', t('Tanlangan buxgalterlarga')]] },
            { k: 'users', type: 'multi', label: 'Buxgalterlar', full: true, options: () => accs, show: (m) => m.audience === 'selected', def: () => [] },
            { k: 'active', type: 'check', label: 'Faol', def: true }],
          onSave: async (m) => { const it = await S.store.saveContent({ ...m, kind: 'ad' }); await A.loadContent(); return it; },
          onDelete: async (m) => { await S.store.deleteContent(m.id); await A.loadContent(); } });
        if (r) A.toast(t('Saqlandi'));
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Yangiliklar va reklama')}}</h1><p class="muted">{{t('Faol yangilik yoki reklama bo\\'lmasa, buxgalterlarda bu joylar ko\\'rinmaydi')}}</p></div>
        <button class="btn primary" @click="tab==='news' ? editNews() : editAd()">+ {{ tab==='news' ? t('Yangilik') : t('Reklama') }}</button></header>
      <div class="tabs"><button :class="{on:tab==='news'}" @click="tab='news'">{{t('Yangiliklar')}}</button><button :class="{on:tab==='ads'}" @click="tab='ads'">{{t('Reklama')}}</button></div>
      <data-table v-if="tab==='news'" :cols="nCols" :rows="news" clickable @row="editNews" :searchable="false"></data-table>
      <data-table v-else :cols="aCols" :rows="ads" clickable @row="editAd" :searchable="false"></data-table>
    </section>`
  };

  /* ---- Sayt adminlari (faqat bosh admin) ---- */
  const PERMS = [['users', 'Buxgalterlarni qo\'shish va bloklash'], ['content', 'Yangilik, reklama va soliq kalendari'], ['rates', "Soliq stavkalarini o'zgartirish"], ['firms', "Buxgalterlarning firmalarini ko'rish"]];
  C['admins-view'] = {
    computed: {
      rows() { return S.users.filter((u) => u.role === 'manager').map((u) => ({ ...u, p: PERMS.filter((p) => (u.perms || {})[p[0]]).map((p) => t(p[1])).join('; ') })); },
      cols() { return [{ k: 'login', label: 'Login', mono: true }, { k: 'full_name', label: 'F.I.Sh.' }, { k: 'p', label: 'Huquqlari' }, { k: 'active', label: 'Holati', f: (r) => (r.active ? t('Faol') : t('Bloklangan')) }]; }
    },
    methods: {
      async edit(u) {
        const val = u ? { ...u, ...Object.fromEntries(PERMS.map((p) => ['perm_' + p[0], !!(u.perms || {})[p[0]]])) } : { perm_users: true, perm_content: true, perm_rates: true, perm_firms: true };
        const fields = [...Forms.F.user(!u).filter((f) => !['firm_limit', 'expires_at'].includes(f.k)), ...PERMS.map((p) => ({ k: 'perm_' + p[0], type: 'check', label: p[1], full: true }))];
        const r = await A.openModal('rec-form', { title: u ? t('Sayt admini') + ': ' + u.login : t('Yangi sayt admini'), fields, value: val,
          note: t('Sayt admini bosh adminni va boshqa adminlarni o\'zgartira olmaydi'),
          onSave: async (m) => { const { password, p, ...d } = m; d.role = 'manager'; d.firm_limit = d.firm_limit || 0; d.perms = Object.fromEntries(PERMS.map((x) => [x[0], !!m['perm_' + x[0]]])); PERMS.forEach((x) => delete d['perm_' + x[0]]); return S.store.saveUser(d, password); } });
        if (r) { S.users = await S.store.listUsers(); A.toast(t('Saqlandi')); }
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Sayt adminlari')}}</h1><p class="muted">{{t('Saytni yurituvchi adminlar va ularning huquqlari')}}</p></div>
        <button class="btn primary" @click="edit()">+ {{t('Admin qo\\'shish')}}</button></header>
      <data-table :cols="cols" :rows="rows" clickable @row="edit" empty="Hali sayt admini qo'shilmagan" :searchable="false"></data-table>
    </section>`
  };

  A.calendar = { upcoming, notifyNow, occurrences, imageToDataUrl };
})();
