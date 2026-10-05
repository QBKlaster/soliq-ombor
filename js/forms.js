/* Yozuv formalari: mahsulot, ombor, kontragent, xarajat, to'lov, asosiy vosita, firma, buxgalter */
(function () {
  const A = window.App; const { S, t } = A;

  const vatOpts = () => [['std', A.vatLabel('std')], ['red', A.vatLabel('red')], ['custom', t('Imtiyozli (foizni kiriting)')], ['exempt', A.vatLabel('exempt')]];
  const unitOpts = (m) => {
    const pref = (m._units || []);
    const all = S.units.map((u) => [u.id, A.unitName(u.id)]);
    if (!pref.length) return all;
    return [...pref.map((id) => [id, A.unitName(id) + ' ★']), ...all.filter((o) => !pref.includes(o[0]))];
  };
  const cpOpts = () => A.recsOf('counterparty').sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c) => [c.id, c.name + (c.inn ? ' · ' + c.inn : '')]);

  const F = {};

  F.product = () => [
    { k: 'mxik', type: 'mxik', label: 'MXIK kodi', full: true, req: true,
      validate: (v) => (/^\d{17}$/.test(v || '') ? '' : t("MXIK kodi 17 ta raqamdan iborat bo'lishi kerak")),
      onPick(m, it, vm) {
        // foydalanuvchi o'zi yozgan nomni o'chirmaymiz
        const auto = A.catName(it.name);
        if (!m.name || m.name === m._autoName) m.name = auto;
        m._autoName = auto; m.mxik_name = it.name; m._units = it.units;
        if (it.units.length) m.unit = it.units[0];
        vm.hints.mxik = it.hint ? t('Qadoq: {0}', A.catName(it.hint)) : '';
        if (it.benefit) vm.hints.vat = t('Katalogda imtiyoz belgilangan (ID {0}). QQS turini tekshiring', it.benefit);
      } },
    { k: 'name', label: 'Nomi', full: true, req: true, hint: "Katalog nomi o'zi qo'yiladi, xohlasangiz o'zgartiring. Bitta MXIK kodga bir nechta mahsulot ochish mumkin (masalan: Sheben 5-10 mm, Sheben 10-20 mm) — har birining qoldig'i alohida yuritiladi" },
    { k: 'unit', type: 'select', label: "Asosiy o'lchov birligi (ombor)", options: unitOpts, req: true, def: 'dona' },
    { k: 'units_alt', type: 'altunits', label: "Qo'shimcha o'lchov birliklari", full: true, def: () => [],
      hint: "Kirim va chiqimda tanlash uchun. Masalan: 1 qop = 50 kilogramm. Ombor qoldig'i asosiy birlikda yuritiladi",
      validate: (v, m) => ((v || []).some((u) => !u.unit || !(Number(u.k) > 0)) ? t("Qo'shimcha o'lchov birligi va uning miqdorini to'liq kiriting") : (v || []).some((u) => u.unit === m.unit) ? t("Asosiy birlikni qo'shimcha sifatida qo'shib bo'lmaydi") : '') },
    { k: 'vat', type: 'select', label: 'QQS turi', options: vatOpts, def: 'std' },
    { k: 'vat_custom', type: 'number', label: 'Imtiyozli QQS stavkasi (%)', show: (m) => m.vat === 'custom', req: true, hint: 'Masalan: 0, 3, 7' },
    { k: 'benefit_code', label: 'Imtiyoz kodi', mono: true, show: (m) => m.vat === 'custom' || m.vat === 'exempt' },
    { k: 'ptype', type: 'select', label: 'Turi', options: () => [['goods', t('Tovar (omborda hisoblanadi)')], ['produced', t('Ishlab chiqariladigan mahsulot')], ['service', t('Xizmat (omborsiz)')]], def: 'goods',
      hint: (m) => (m.ptype === 'produced' ? t('Kalkulyatsiyani "Ishlab chiqarish" bo\'limida kiriting') : '') },
    { k: 'acc', type: 'acc', label: 'Schyot (provodka taklifi uchun)', hint: (m) => t("Bo'sh qolsa: tovar 2910, tayyor mahsulot 2810. Xomashyo uchun 1010, qurilish materiali 1050") },
    { k: 'barcode', label: 'Shtrix kod', mono: true },
    { k: 'note', type: 'textarea', label: 'Izoh', full: true }
  ];

  F.warehouse = () => [
    { k: 'name', label: 'Ombor nomi', req: true, full: true },
    { k: 'address', label: 'Manzil', full: true },
    { k: 'responsible', label: "Mas'ul shaxs" }
  ];

  F.counterparty = () => [
    { k: 'name', label: 'Nomi', req: true, full: true },
    { k: 'inn', label: 'STIR (INN)', mono: true, validate: (v) => (!v || /^\d{9}$|^\d{14}$/.test(v) ? '' : t("STIR 9 ta (yuridik shaxs) yoki JShShIR 14 ta raqam bo'lishi kerak")) },
    { k: 'phone', label: 'Telefon' },
    { k: 'address', label: 'Manzil', full: true },
    { k: 'bank', label: 'Bank' },
    { k: 'account', label: 'Hisob raqami', mono: true },
    { k: 'note', type: 'textarea', label: 'Izoh', full: true }
  ];

  F.expense = () => [
    { k: 'date', type: 'date', label: 'Sana', req: true, def: A.today },
    { k: 'number', label: 'Hujjat raqami' },
    { k: 'category', type: 'select', label: 'Xarajat turi', req: true, def: 'other', options: () => A.EXP_CATS.map((c) => [c[0], t(c[1])]),
      onChange(m) { const c = A.EXP_CATS.find((x) => x[0] === m.category); if (c) m.deductible = c[2]; } },
    { k: 'cp', type: 'select', label: 'Kontragent', options: cpOpts, empty: 'Tanlanmagan' },
    { k: 'descr', label: 'Tavsif', full: true },
    { k: 'amount', type: 'number', label: 'Summa (QQSsiz)', req: true },
    { k: 'vat', type: 'number', label: 'QQS summasi', def: 0, hint: (m) => (Engine.isVatPayer(S.firm) ? t('Hisobga olinadigan QQS (hisob-faktura bo\'lsa)') : t('Firma QQS to\'lovchi emas: QQS xarajatga qo\'shiladi')) },
    { k: 'deductible', type: 'check', label: "Foyda solig'ida chegiriladi", def: true, full: true },
    { k: 'note', type: 'textarea', label: 'Izoh', full: true },
    { k: 'entries', type: 'entries', label: 'Provodkalar', full: true, def: () => [], suggest: (m) => Acc.suggestExpense(m, Engine.isVatPayer(S.firm)), validate: (v) => A.checkEntries(v, false) },
  ];

  F.payment = () => [
    { k: 'date', type: 'date', label: 'Sana', req: true, def: A.today },
    { k: 'number', label: 'Hujjat raqami' },
    { k: 'direction', type: 'select', label: "Yo'nalish", req: true, def: 'in', options: () => [['in', t('Kirim (bizga to\'landi)')], ['out', t('Chiqim (biz to\'ladik)')]] },
    { k: 'cp', type: 'select', label: 'Kontragent', req: true, options: cpOpts },
    { k: 'amount', type: 'number', label: 'Summa', req: true },
    { k: 'method', type: 'select', label: "To'lov usuli", def: 'bank', options: () => [['bank', t('Bank o\'tkazmasi')], ['cash', t('Naqd')], ['card', t('Plastik karta')], ['offset', t('O\'zaro hisob')]] },
    { k: 'note', type: 'textarea', label: 'Izoh', full: true },
    { k: 'entries', type: 'entries', label: 'Provodkalar', full: true, def: () => [], suggest: (m) => Acc.suggestPayment(m), validate: (v) => A.checkEntries(v, false) },
  ];

  F.asset = () => [
    { k: 'name', label: 'Nomi', req: true, full: true },
    { k: 'inv_no', label: 'Inventar raqami', mono: true },
    { k: 'group', label: 'Guruhi', ph: 'Masalan: transport, kompyuter' },
    { k: 'acquire_date', type: 'date', label: 'Olingan sana', req: true, def: A.today },
    { k: 'start_date', type: 'date', label: 'Foydalanishga topshirilgan sana', req: true, def: A.today, hint: 'Eskirish keyingi oydan boshlanadi' },
    { k: 'cost', type: 'number', label: "Boshlang'ich qiymati (QQSsiz)", req: true },
    { k: 'vat', type: 'number', label: 'QQS summasi', def: 0 },
    { k: 'cp', type: 'select', label: 'Yetkazib beruvchi', options: cpOpts, empty: 'Tanlanmagan' },
    { k: 'depreciate', type: 'check', label: 'Eskirish hisoblansin', def: true, full: true },
    { k: 'method', type: 'select', label: 'Eskirish usuli', def: 'percent', show: (m) => m.depreciate, options: () => [['percent', t("Yillik foizda (%)")], ['amount', t("Oyiga so'mda")]] },
    { k: 'rate', type: 'number', label: (m) => (m.method === 'amount' ? t("Oylik eskirish summasi (so'm)") : t('Yillik eskirish foizi (%)')), show: (m) => m.depreciate, req: true,
      hint: (m) => (m.method === 'amount' ? '' : t('Masalan, 20% bo\'lsa vosita 5 yilda to\'liq eskiradi')) },
    { k: 'salvage', type: 'number', label: 'Tugatish qiymati', def: 0, show: (m) => m.depreciate, hint: 'Shu summagacha eskiradi (odatda 0)' },
    { k: 'dispose_date', type: 'date', label: 'Hisobdan chiqarilgan sana', hint: "Sotilsa yoki tugatilsa to'ldiring" },
    { k: 'acc', type: 'acc', label: 'Asosiy vosita schyoti', hint: 'Masalan: 0160 transport, 0150 kompyuter' },
    { k: 'dep_acc', type: 'acc', label: 'Eskirish schyoti', show: (m) => m.depreciate, hint: "Bo'sh qolsa 02xx (vosita schyotiga mos)" },
    { k: 'note', type: 'textarea', label: 'Izoh', full: true },
    { k: 'entries', type: 'entries', label: 'Provodkalar', full: true, def: () => [], suggest: (m) => Acc.suggestAsset(m, Engine.isVatPayer(S.firm)), validate: (v) => A.checkEntries(v, false) },
  ];

  F.firm = (isNew) => [
    { k: 'name', label: 'Firma nomi', req: true, full: true },
    { k: 'inn', label: 'STIR (INN)', req: true, mono: true, validate: (v) => (/^\d{9}$/.test(v || '') ? '' : t("STIR 9 ta raqamdan iborat bo'lishi kerak")) },
    { k: 'regime', type: 'select', label: 'Soliq rejimi', req: true, def: 'vat', options: () => Object.entries(A.REGIME_LABEL).map(([k, v]) => [k, t(v)]) },
    { k: 'cost_method', type: 'select', label: 'Tannarx usuli', req: true, def: 'avg', options: () => [['avg', t("O'rtacha tannarx")], ['fifo', 'FIFO']],
      hint: isNew ? 'Hujjatlar kiritilgandan keyin o\'zgartirmaslik tavsiya etiladi' : 'O\'zgartirilsa barcha tannarxlar qayta hisoblanadi' },
    { k: 'turnover_rate', type: 'number', label: "Aylanma solig'i stavkasi (%)", show: (m) => m.regime !== 'vat', hint: (m) => t("Bo'sh qolsa umumiy stavka: {0}%", S.settings.turnover_rate) },
    { k: 'profit_rate', type: 'number', label: "Foyda solig'i stavkasi (%)", show: (m) => m.regime === 'vat', hint: (m) => t("Bo'sh qolsa umumiy stavka: {0}%", S.settings.profit_rate) },
    { k: 'address', label: 'Yuridik manzil', full: true },
    { k: 'director', label: 'Rahbar' },
    { k: 'chief_accountant', label: 'Bosh buxgalter' },
    { k: 'phone', label: 'Telefon' },
    { k: 'oked', label: 'IFUT (OKED)', mono: true },
    { k: 'bank', label: 'Bank' },
    { k: 'mfo', label: 'MFO', mono: true },
    { k: 'account', label: 'Hisob raqami', mono: true, full: true }
  ];

  F.user = (isNew) => [
    { k: 'login', label: 'Login', req: true, mono: true, validate: (v) => (/^[a-z0-9._-]{3,30}$/i.test(v || '') ? '' : t("Login 3–30 ta lotin harfi, raqam yoki . _ - belgilaridan iborat bo'lsin")) },
    { k: 'full_name', label: 'F.I.Sh.', req: true },
    { k: 'phone', label: 'Telefon' },
    { k: 'firm_limit', type: 'number', label: 'Firmalar limiti', req: true, def: 3 },
    { k: 'expires_at', type: 'date', label: 'Obuna tugash sanasi', hint: "Bo'sh qolsa muddatsiz" },
    { k: 'active', type: 'check', label: 'Faol (tizimga kira oladi)', def: true },
    { k: 'password', type: 'password', label: isNew ? 'Parol' : 'Yangi parol', req: isNew, hint: isNew ? 'Kamida 6 belgi. Birinchi kirishda almashtirish so\'raladi' : "Almashtirmaslik uchun bo'sh qoldiring",
      validate: (v) => (v && v.length < 6 ? t('Parol kamida 6 belgidan iborat bo\'lsin') : '') }
  ];

  F.settings = () => [
    { k: 'vat_rate', type: 'number', label: 'QQS stavkasi (%)', req: true },
    { k: 'vat_rate_red', type: 'number', label: 'Pasaytirilgan QQS stavkasi (%)', req: true },
    { k: 'profit_rate', type: 'number', label: "Foyda solig'i stavkasi (%)", req: true },
    { k: 'turnover_rate', type: 'number', label: "Aylanma solig'i stavkasi (%), umumiy", req: true, hint: 'Har bir firmada alohida stavka belgilash mumkin' }
  ];

  /* Qisqa yordamchilar: forma ochish va saqlash */
  async function editRec(kind, rec, extra) {
    const titles = { product: ['Yangi mahsulot', 'Mahsulot'], warehouse: ['Yangi ombor', 'Ombor'], counterparty: ['Yangi kontragent', 'Kontragent'], expense: ['Yangi xarajat', 'Xarajat'], payment: ["Yangi to'lov", "To'lov"], asset: ['Yangi asosiy vosita', 'Asosiy vosita'] };
    const isNew = !rec || !rec.id;
    const locked = rec && A.lockedRec(rec);
    return A.openModal('rec-form', {
      title: t(titles[kind][isNew ? 0 : 1]), fields: F[kind](isNew), value: rec || (extra && extra.init) || {}, wide: kind === 'product' || kind === 'asset',
      readonly: !!locked, note: locked ? t('Bu davr yopilgan, yozuvni faqat ko\'rish mumkin') : '',
      onSave: async (m) => { const d = { ...m }; delete d._units; delete d._autoName; return A.saveRec(kind, d); },
      onDelete: async (m) => {
        if (['product', 'warehouse', 'counterparty'].includes(kind) && A.usedBy(m)) throw new Error(t("Bu yozuv hujjatlarda ishlatilgan, o'chirib bo'lmaydi"));
        return A.delRec(A.byId(m.id));
      }
    });
  }

  window.Forms = { F, editRec, cpOpts, vatOpts };
})();
