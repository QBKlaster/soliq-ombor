/* Holat, tarjima, formatlash va ma'lumot amallari */
(function () {
  const { reactive } = Vue;
  const TR = window.Translit;

  let lang = 'uz';
  try { lang = localStorage.getItem('sh_lang') || 'uz'; } catch (e) { }

  const S = reactive({
    ready: false, store: null, user: null, lang, settings: { ...Store.DEFAULT_SETTINGS },
    firms: [], users: [], firm: null, recs: [], calc: null, view: 'dash', adminView: 'users',
    units: [], content: [], toast: null, confirm: null, modals: [], busy: '', sideOpen: false, editDoc: null, sessionKicked: false
  });

  /* ---- tarjima ---- */
  const cache = { uz: {}, cy: {}, ru: {} };
  function t(key, ...args) {
    const c = cache[S.lang];
    let s = c[key];
    if (s === undefined) {
      if (S.lang === 'ru') { s = window.RU && window.RU[key]; if (!s) { (window.__miss = window.__miss || new Set()).add(key); s = TR.prettyLat(key); } }
      else if (S.lang === 'cy') s = TR.lat2cyr(key);
      else s = TR.prettyLat(key);
      c[key] = s;
    }
    if (args.length) s = s.replace(/\{(\d)\}/g, (m, i) => (args[i] === undefined ? '' : args[i]));
    return s;
  }
  function setLang(l) { S.lang = l; try { localStorage.setItem('sh_lang', l); } catch (e) { } document.documentElement.lang = l === 'ru' ? 'ru' : 'uz'; }
  // katalog nomlari kirillda: lotin rejimida o'giramiz
  const catName = (s) => (S.lang === 'uz' ? TR.cyr2lat(s) : s);
  // foydalanuvchi kiritgan matnni o'zgartirmaymiz
  const unitName = (id) => { const u = S.units.find((x) => x.id === id); if (!u) return id || ''; return S.lang === 'ru' ? u.ru : S.lang === 'cy' ? u.cy : u.uz; };

  /* ---- formatlash ---- */
  const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfq = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
  const money = (n) => nf2.format(Number(n) || 0);
  const qty = (n) => nfq.format(Number(n) || 0);
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  const monthName = (ymStr) => { const [y, m] = String(ymStr).split('-'); return t(MONTHS[Number(m) - 1]) + ' ' + y; };
  const dateFmt = (d) => (d ? d.split('-').reverse().join('.') : '');

  const DOC_LABEL = { receipt: 'Kirim', sale: 'Sotuv', return_in: 'Xaridordan qaytish', return_out: 'Yetkazib beruvchiga qaytarish', transfer: "Omborlararo ko'chirish", writeoff: 'Hisobdan chiqarish', inventory: 'Inventarizatsiya', production: 'Ishlab chiqarish', opening: "Boshlang'ich qoldiq (ombor)" };
  const vatLabel = (v, p) => {
    if (v === 'exempt') return t('QQSdan ozod');
    if (v === 'red') return t('QQS {0}%', S.settings.vat_rate_red);
    if (v === 'custom' || v === 'zero') return t('Imtiyozli {0}%', v === 'zero' ? 0 : (p === undefined || p === null || p === '' ? '?' : p));
    return t('QQS {0}%', S.settings.vat_rate);
  };
  const REGIME_LABEL = { vat: "QQS + foyda solig'i", turnover: "Aylanma solig'i", turnover_vat: "Aylanma solig'i + QQS" };
  const EXP_CATS = [
    ['salary', 'Ish haqi', true], ['social', "Ijtimoiy soliq", true], ['rent', 'Ijara', true], ['transport', 'Transport va yoqilg\'i', true],
    ['utility', 'Kommunal xizmatlar', true], ['comm', 'Aloqa va internet', true], ['bank', 'Bank xizmatlari', true], ['repair', "Ta'mirlash", true],
    ['office', 'Kanselyariya va xo\'jalik', true], ['advert', 'Reklama', true], ['taxes', "Soliqlar va yig'imlar (chegiriladigan)", true],
    ['service', 'Boshqa xizmatlar', true], ['penalty', 'Jarimalar va penyalar', false], ['charity', 'Xayriya', false],
    ['entertain', 'Vakillik xarajatlari (me\'yordan ortiq)', false], ['other_nd', 'Boshqa chegirilmaydigan', false], ['other', 'Boshqa', true]
  ];
  const expCat = (k) => { const c = EXP_CATS.find((x) => x[0] === k); return c ? t(c[1]) : k; };

  /* ---- xabarlar ---- */
  let toastTimer = null;
  function toast(text, kind = 'ok') { S.toast = { text, kind }; clearTimeout(toastTimer); toastTimer = setTimeout(() => (S.toast = null), kind === 'err' ? 6000 : 3200); }
  function ask(text, okLabel, danger) { return new Promise((resolve) => { S.confirm = { text, okLabel: okLabel || t('Tasdiqlash'), danger: !!danger, resolve }; }); }
  function answer(v) { const c = S.confirm; S.confirm = null; c && c.resolve(v); }
  function openModal(comp, props) { return new Promise((resolve) => { S.modals.push({ comp, props: props || {}, resolve, key: Math.random() }); }); }
  function closeModal(v) { const m = S.modals.pop(); m && m.resolve(v); }

  const ERR = {
    ERR_LOGIN: "Login yoki parol noto'g'ri", ERR_BLOCKED: 'Hisobingiz faol emas. Administratorga murojaat qiling',
    ERR_EXPIRED: "Obuna muddati tugagan. Administratorga murojaat qiling", ERR_FIRM_LIMIT: 'Firmalar limiti tugagan. Limitni oshirish uchun administratorga murojaat qiling',
    ERR_LOGIN_TAKEN: 'Bu login band', ERR_PERIOD_CLOSED: 'Bu davr yopilgan. O\'zgartirish uchun avval davrni oching', ERR_CLOUD_IMPORT: 'Bulut rejimida zaxiradan tiklash mavjud emas', ERR_SELF_DELETE: "O'zingizni o'chira olmaysiz", ERR_NOT_ALLOWED: "Bu foydalanuvchini o'chirishga huquqingiz yo'q"
  };
  const errText = (e) => { const m = (e && e.message) || String(e); return ERR[m] ? t(ERR[m]) : m; };

  /* ---- ma'lumot amallari ---- */
  function recalc() {
    if (!S.firm) { S.calc = null; return; }
    S.calc = Object.freeze(Engine.compute(S.firm, S.recs, effSettings()));
  }
  function effSettings() {
    const s = { ...S.settings };
    if (S.firm && S.firm.vat_rate) s.vat_rate = S.firm.vat_rate;
    return s;
  }
  const profitRate = () => Number((S.firm && S.firm.profit_rate) || S.settings.profit_rate) || 0;
  const turnoverRate = () => Number((S.firm && S.firm.turnover_rate) || S.settings.turnover_rate) || 0;

  async function loadFirms() { S.firms = await S.store.listFirms(); }
  async function openFirm(f) {
    S.busy = t('Yuklanmoqda…');
    try {
      S.firm = { ...f };
      S.recs = await S.store.loadRecords(f.id);
      recalc(); S.view = 'dash'; S.editDoc = null;
      try { localStorage.setItem('sh_last_firm', f.id); } catch (e) { }
    } catch (e) { toast(errText(e), 'err'); }
    S.busy = '';
  }
  function closeFirm() { S.firm = null; S.recs = []; S.calc = null; S.editDoc = null; }

  const DATED = { doc: 'date', expense: 'date', payment: 'date', asset: 'acquire_date', journal: 'date' };
  function lockedRec(r) { return DATED[r.kind] && Engine.isLocked(S.firm, r[DATED[r.kind]]); }

  function label(r) {
    if (!r) return '';
    if (r.kind === 'doc') return t(DOC_LABEL[r.type]) + ' №' + (r.number || '') + ' ' + dateFmt(r.date);
    if (r.kind === 'expense') return expCat(r.category) + ' ' + money(r.amount) + ' ' + dateFmt(r.date);
    if (r.kind === 'payment') return t("To'lov") + ' ' + money(r.amount) + ' ' + dateFmt(r.date);
    if (r.kind === 'journal') return t('Operatsiya') + ' №' + (r.number || '') + ' ' + dateFmt(r.date) + (r.note ? ' — ' + r.note : '');
    if (r.kind === 'asset') return t('Asosiy vosita') + ': ' + (r.name || '');
    if (r.kind === 'recipe') { const p = S.recs.find((x) => x.id === r.product); return t('Kalkulyatsiya') + ': ' + (p ? p.name : ''); }
    return r.name || r.id;
  }

  async function saveRec(kind, data) {
    const old = data.id ? S.recs.find((x) => x.id === data.id) : null;
    const rec = { ...data, kind, firm_id: S.firm.id };
    if (!rec.id) { rec.id = Store.uid(); rec.created_at = Store.nowIso(); rec.created_by = S.user.login; }
    rec.updated_at = Store.nowIso();
    if (lockedRec(rec) || (old && lockedRec(old))) throw new Error('ERR_PERIOD_CLOSED');
    await S.store.putRecord(JSON.parse(JSON.stringify(rec)));
    const i = S.recs.findIndex((x) => x.id === rec.id);
    if (i >= 0) S.recs.splice(i, 1, rec); else S.recs.push(rec);
    recalc();
    S.store.addAudit({ firm_id: S.firm.id, action: old ? 'update' : 'create', kind, rec_id: rec.id, summary: label(rec) }).catch(() => { });
    return rec;
  }
  async function delRec(rec) {
    if (lockedRec(rec)) throw new Error('ERR_PERIOD_CLOSED');
    await S.store.deleteRecord(rec.id);
    const i = S.recs.findIndex((x) => x.id === rec.id);
    if (i >= 0) S.recs.splice(i, 1);
    recalc();
    S.store.addAudit({ firm_id: S.firm.id, action: 'delete', kind: rec.kind, rec_id: rec.id, summary: label(rec) }).catch(() => { });
  }
  function usedBy(rec) {
    // bog'langan yozuvlar bormi
    const id = rec.id;
    return S.recs.some((r) => r.kind === 'doc' && (r.wh === id || r.wh2 === id || r.cp === id || (r.lines || []).some((l) => l.p === id || (l.mats || []).some((m) => m.p === id))))
      || S.recs.some((r) => r.kind === 'recipe' && (r.product === id || (r.mats || []).some((m) => m.p === id)))
      || S.recs.some((r) => (r.kind === 'expense' || r.kind === 'payment' || r.kind === 'asset') && r.cp === id);
  }
  async function saveFirm(f) {
    const saved = await S.store.saveFirm(JSON.parse(JSON.stringify(f)));
    await loadFirms();
    if (S.firm && S.firm.id === saved.id) { S.firm = { ...saved }; recalc(); }
    S.store.addAudit({ firm_id: saved.id, action: f.id ? 'update' : 'create', kind: 'firm', rec_id: saved.id, summary: saved.name }).catch(() => { });
    return saved;
  }

  const recsOf = (kind) => S.recs.filter((r) => r.kind === kind);
  const byId = (id) => S.recs.find((r) => r.id === id);
  const prodLabel = (id) => { const p = byId(id); return p ? p.name : '—'; };

  /* huquqlar: bosh admin hammasi; sayt admini — berilgan huquqlar */
  /* sotuv faoliyat turlari */
  const ACTS = [['prod', "O'zi ishlab chiqargan"], ['resale', 'Oldi-sotdi'], ['service', "Xizmat ko'rsatish"], ['none', 'Ishtirok etmaydi']];
  const actName = (k) => { const a = ACTS.find((x) => x[0] === k); return a ? t(a[1]) : ''; };
  const can = (perm) => !!S.user && (S.user.role === 'admin' || (S.user.role === 'manager' && !!(S.user.perms || {})[perm]));
  const isStaff = () => !!S.user && (S.user.role === 'admin' || S.user.role === 'manager');
  async function loadContent() { try { S.content = await S.store.listContent(); } catch (e) { S.content = []; } }

  window.App = {
    can, isStaff, loadContent, ACTS, actName,
    S, t, setLang, catName, unitName, money, qty, today, monthName, dateFmt, DOC_LABEL, vatLabel, REGIME_LABEL, EXP_CATS, expCat, MONTHS,
    toast, ask, answer, openModal, closeModal, errText, recalc, effSettings, profitRate, turnoverRate, loadFirms, openFirm, closeFirm,
    saveRec, delRec, usedBy, saveFirm, recsOf, byId, prodLabel, lockedRec, label
  };
})();
