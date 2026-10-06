/* Ishlab chiqarish: kalkulyatsiyalar (retseptlar), ishlab chiqarish hujjatlari, tayyor mahsulotlar */
(function () {
  const A = window.App; const { S, t } = A; const C = window.Components; const E = window.Engine;

  // mahsulot kartasidan forma maydonlari
  const pfOf = (p) => ({ name: (p && p.name) || '', mxik: (p && p.mxik) || '', unit: (p && p.unit) || '', mxik_name: (p && p.mxik_name) || '', units: [], auto: '' });

  /* Kalkulyatsiya muharriri */
  C['recipe-editor'] = {
    props: { recipe: Object },
    emits: ['close'],
    data() {
      const r = this.recipe ? JSON.parse(JSON.stringify(this.recipe)) : { product: '', mats: [], costs: [], note: '' };
      if (!r.mats.length) r.mats.push({ p: '', per: null, loss: null });
      return { r, pf: pfOf(A.byId(r.product)), err: '', saving: false, batch: 1, wh: '' };
    },
    computed: {
      prod() { return A.byId(this.r.product); },
      unitLocked() { const id = this.r.product; return !!id && A.recsOf('doc').some((d) => (d.lines || []).some((l) => l.p === id || (l.mats || []).some((m) => m.p === id))) || A.recsOf('recipe').some((x) => x.id !== this.r.id && (x.mats || []).some((m) => m.p === id)); },
      unitOpts() { const pref = this.pf.units || []; return [...pref, ...S.units.map((u) => u.id).filter((id) => !pref.includes(id))]; },
      rc() { return E.recipeCost(this.r, S.calc, this.wh); },
      used() { return this.r.id && A.recsOf('doc').some((d) => d.type === 'production' && (d.lines || []).some((l) => l.p === this.r.product)); },
      whs() { return A.recsOf('warehouse'); }
    },
    methods: {
      addMat() { this.r.mats.push({ p: '', per: null, loss: null }); },
      addCost() { this.r.costs.push({ name: '', per: null }); },
      mrow(i) { return this.rc.mats[i] || {}; },
      async newMat(m, q) {
        const r = await Forms.editRec('product', null, { init: /^\d+$/.test(q) ? { mxik: q } : { name: q } });
        if (r && r.id) m.p = r.id;
      },
      async newProduct(q) {
        const r = await Forms.editRec('product', null, { init: { ...(/^\d+$/.test(q) ? { mxik: q } : { name: q }), ptype: 'produced' } });
        if (r && r.id) this.pickExisting(r.id);
      },
      /* mavjud mahsulotni tanlash: nomi, MXIK va o'lchovi maydonlarga tushadi */
      pickExisting(id) {
        const other = A.recsOf('recipe').find((x) => x.product === id && x.id !== this.r.id);
        if (other) { this.err = t('Bu mahsulot uchun kalkulyatsiya allaqachon bor'); return; }
        this.err = ''; this.r.product = id; this.pf = pfOf(A.byId(id));
      },
      mxPick(it) {
        const auto = A.catName(it.name);
        if (!this.pf.name.trim() || this.pf.name === this.pf.auto) this.pf.name = auto;
        this.pf.auto = auto; this.pf.mxik_name = it.name; this.pf.units = it.units || [];
        if (!this.unitLocked && it.units && it.units.length && !it.units.includes(this.pf.unit)) this.pf.unit = it.units[0];
      },
      /* boshqa o'lcham uchun: homashyo va xarajatlar ko'chiriladi, mahsulot yangi bo'ladi */
      copy() {
        const r = JSON.parse(JSON.stringify(this.r));
        this.r = { product: '', mats: r.mats.filter((m) => m.p), costs: r.costs, note: r.note || '' };
        if (!this.r.mats.length) this.addMat();
        this.pf = { ...this.pf, name: this.pf.name + ' ' + t('(nusxa)'), auto: '' };
        this.err = ''; A.toast(t('Nusxa olindi: nomini o\'zgartiring (masalan, 6 m), miqdorlarni to\'g\'rilang va saqlang'));
        this.$nextTick(() => { const el = document.getElementById('rc-name'); if (el) { el.focus(); el.select(); } });
      },
      async save() {
        this.err = '';
        const pf = this.pf; const name = (pf.name || '').trim().replace(/\s+/g, ' ');
        if (!name) return (this.err = t('Mahsulot nomini yozing (masalan: Lotok 3 m)'));
        if (!/^\d{17}$/.test(pf.mxik || '')) return (this.err = t('MXIK kodini tanlang (17 ta raqam)'));
        if (!pf.unit) return (this.err = t("O'lchov birligini tanlang"));
        if (A.dupProduct(name, this.r.product)) return (this.err = t('"{0}" nomli mahsulot allaqachon bor. Uni "Mavjud mahsulotni tanlash" orqali tanlang yoki boshqa nom bering', name));
        const mats = this.r.mats.filter((m) => m.p);
        if (!mats.length) return (this.err = t('Kamida bitta homashyo qo\'shing'));
        if (mats.some((m) => !(Number(m.per) > 0))) return (this.err = t('Homashyo miqdori noldan katta bo\'lishi kerak'));
        if (this.r.product && mats.some((m) => m.p === this.r.product)) return (this.err = t('Mahsulot o\'zining homashyosi bo\'la olmaydi'));
        const costs = this.r.costs.filter((c) => c.name || Number(c.per));
        this.saving = true;
        try {
          // mahsulot kartasi: yangi bo'lsa yaratiladi, bor bo'lsa nomi/MXIK/o'lchovi yangilanadi
          const old = this.prod;
          const upd = { name, mxik: pf.mxik, unit: pf.unit, ptype: 'produced' };
          if (pf.mxik_name) upd.mxik_name = pf.mxik_name;
          if (!old) { const np = await A.saveRec('product', { ...upd, vat: 'std', units_alt: [] }); this.r.product = np.id; }
          else if (old.name !== name || old.mxik !== pf.mxik || old.unit !== pf.unit || old.ptype !== 'produced') await A.saveRec('product', { ...old, ...upd });
          const saved = await A.saveRec('recipe', { ...this.r, mats, costs });
          this.r = JSON.parse(JSON.stringify(saved)); if (!this.r.mats.length) this.addMat();
          this.pf = pfOf(A.byId(this.r.product));
          A.toast(t('Kalkulyatsiya saqlandi'));
        } catch (e) { this.err = A.errText(e); }
        this.saving = false;
      },
      async del() {
        if (!(await A.ask(t("Kalkulyatsiyani o'chirishni tasdiqlaysizmi? Oldingi ishlab chiqarish hujjatlari o'zgarmaydi."), t("O'chirish"), true))) return;
        try { await A.delRec(A.byId(this.r.id)); this.$emit('close'); A.toast(t("O'chirildi")); } catch (e) { this.err = A.errText(e); }
      },
      produce() { this.$emit('close'); window.newDoc('production', [{ p: this.r.product, qty: this.batch || 1, mats: JSON.parse(JSON.stringify(this.r.mats.filter((m) => m.p))), costs: JSON.parse(JSON.stringify(this.r.costs)) }]); },
      async exp() {
        const p = this.prod || {}; const rc = this.rc; const n = Number(this.batch) || 1;
        const rows = this.r.mats.filter((m) => m.p).map((m, i) => { const x = rc.mats[i] || {}; const mp = A.byId(m.p) || {}; return [mp.name, mp.mxik, A.unitName(mp.unit), Number(m.per) || 0, Number(m.loss) || 0, E.r2(x.perEff || 0), E.r2(x.unit || 0), E.r2(x.cost || 0), E.r2((x.perEff || 0) * n), E.r2(x.stock || 0)]; });
        rows.push([]); rows.push([t('Qo\'shimcha xarajatlar')]);
        this.r.costs.forEach((c) => rows.push([c.name, '', '', '', '', '', '', Number(c.per) || 0, E.r2((Number(c.per) || 0) * n)]));
        rows.push([]); rows.push([t('Homashyo tannarxi (1 birlik)'), '', '', '', '', '', '', E.r2(rc.mat)]); rows.push([t('Xarajatlar (1 birlik)'), '', '', '', '', '', '', E.r2(rc.extra)]);
        rows.push([t('To\'liq tannarx (1 birlik)'), '', '', '', '', '', '', E.r2(rc.total), E.r2(rc.total * n)]);
        await Excel.exportXlsx('kalkulyatsiya_' + (p.name || '').replace(/[^\wЀ-ӿ.-]+/g, '_') + '.xlsx', [{ name: t('Kalkulyatsiya'), title: S.firm.name + ' — ' + t('Kalkulyatsiya') + ': ' + (p.name || '') + ' (MXIK ' + (p.mxik || '') + ')',
          header: [t('Homashyo'), 'MXIK', t("O'lchov"), t('1 birlikka'), t("Yo'qotish %"), t('Sarf (yo\'qotish bilan)'), t("O'rtacha narx"), t('Summa (1 birlik)'), t('{0} birlikka', n), t('Omborda')], rows }]);
      }
    },
    template: `
    <section class="page">
      <header class="page-h">
        <div><button class="link back" @click="$emit('close')">← {{t('Kalkulyatsiyalar')}}</button>
          <h1>{{t('Kalkulyatsiya')}}<span v-if="pf.name.trim()">: {{pf.name}}</span></h1>
          <p class="muted" v-if="pf.mxik">MXIK <span class="mono">{{pf.mxik}}</span><template v-if="pf.unit"> · {{t('O\\'lchov')}}: {{unitName(pf.unit)}}</template></p></div>
        <div class="row-gap wrap">
          <button v-if="r.id" class="btn ghost sm" @click="exp">⤓ Excel</button>
          <button v-if="r.id" class="btn ghost sm" @click="copy" :title="t('Masalan, 3 metrlik lotokdan 6 metrlik uchun')">⧉ {{t('Boshqa o\\'lcham uchun nusxa')}}</button>
          <button v-if="r.id" class="btn ghost sm" @click="produce">+ {{t('Ishlab chiqarish hujjati')}}</button>
          <button v-if="r.id" class="btn danger ghost sm" @click="del">{{t("O'chirish")}}</button>
        </div>
      </header>
      <div class="doc-head">
        <div class="fld wide"><label for="rc-name">{{t('Mahsulot nomi')}}<b class="req">*</b></label>
          <input id="rc-name" v-model="pf.name" :placeholder="t('Masalan: Lotok 3 m')">
          <small class="hint">{{t('Har bir o\\'lcham yoki tur alohida nom bilan: qoldig\\'i, tannarxi va kalkulyatsiyasi alohida yuritiladi')}}</small></div>
        <div class="fld wide"><label for="mxik-q">{{t('MXIK kodi')}}<b class="req">*</b></label>
          <mxik-input v-model="pf.mxik" @pick="mxPick"></mxik-input>
          <small class="hint" v-if="pf.mxik_name">{{t('Katalogda')}}: {{catName(pf.mxik_name)}}</small>
          <small class="hint" v-else>{{t('Bir nechta mahsulot bitta MXIK kodda bo\\'lishi mumkin')}}</small></div>
        <div class="fld"><label for="rc-unit">{{t("O'lchov birligi")}}<b class="req">*</b></label>
          <select id="rc-unit" v-model="pf.unit" :disabled="unitLocked"><option value="" disabled>{{t('Tanlang')}}</option>
            <option v-for="u in unitOpts" :key="u" :value="u">{{unitName(u)}}<template v-if="(pf.units||[]).includes(u)"> ★</template></option></select>
          <small class="hint" v-if="unitLocked">{{t('Hujjatlarda ishlatilgan, o\\'zgartirib bo\\'lmaydi')}}</small></div>
        <div class="fld wide"><label>{{t('Yoki mavjud mahsulotni tanlash')}}</label>
          <prod-select :model-value="r.product" @update:model-value="pickExisting" @new="newProduct" :exclude="''"></prod-select></div>
        <div class="fld"><label for="rc-batch">{{t('Necha birlik uchun hisoblash')}}</label><input id="rc-batch" type="number" step="any" class="num" v-model.number="batch"></div>
        <div class="fld"><label for="rc-wh">{{t('Qoldiqni qaysi ombordan tekshirish')}}</label>
          <select id="rc-wh" v-model="wh"><option value="">{{t('Barcha omborlar')}}</option><option v-for="w in whs" :key="w.id" :value="w.id">{{w.name}}</option></select></div>
      </div>

      <div class="panel">
        <h2>{{t('Homashyolar')}} <span class="muted small">({{t('1 birlik mahsulot uchun, homashyoning ombordagi o\\'lchov birligida')}})</span></h2>
        <div class="tbl-wrap"><table class="tbl edit">
          <thead><tr><th class="n">#</th><th class="prod">{{t('Homashyo')}}</th><th>{{t("O'lchov")}}</th><th class="num">{{t('1 birlikka')}}</th><th class="num">{{t("Yo'qotish %")}}</th>
            <th class="num">{{t("O'rtacha narx")}}</th><th class="num">{{t('Summa (1 birlik)')}}</th><th class="num">{{t('{0} birlikka kerak', qty(batch||0))}}</th><th class="num">{{t('Omborda')}}</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(m,i) in r.mats" :key="i">
              <td class="n muted">{{i+1}}</td>
              <td class="prod"><prod-select v-model="m.p" @new="newMat(m,$event)" :exclude="r.product"></prod-select><small class="mono muted" v-if="m.p">{{(byId(m.p)||{}).mxik}}</small></td>
              <td class="muted">{{unitName((byId(m.p)||{}).unit)}}</td>
              <td class="num"><input type="number" step="any" class="num" v-model.number="m.per" :aria-label="t('1 birlikka')"></td>
              <td class="num"><input type="number" step="any" class="num sm" v-model.number="m.loss" :placeholder="t('ixtiyoriy')" :aria-label="t('Yo\\'qotish %')"></td>
              <td class="num mono">{{money(mrow(i).unit)}}</td>
              <td class="num mono">{{money(mrow(i).cost)}}</td>
              <td class="num mono">{{qty((mrow(i).perEff||0) * (batch||0))}}</td>
              <td class="num">
                <template v-if="m.p">
                  <span v-if="(mrow(i).stock||0) <= 1e-9" class="bad">{{t('Omborda mahsulot yo\\'q')}}</span>
                  <span v-else class="mono" :class="{bad: mrow(i).stock < (mrow(i).perEff||0)*(batch||0)}">{{qty(mrow(i).stock)}}</span>
                  <small v-if="(mrow(i).stock||0) > 1e-9 && mrow(i).stock < (mrow(i).perEff||0)*(batch||0)" class="bad block">{{t('Yetmaydi: {0}', qty((mrow(i).perEff||0)*(batch||0) - mrow(i).stock))}}</small>
                </template>
              </td>
              <td><button class="icon-btn" @click="r.mats.splice(i,1)" :aria-label="t('Qatorni o\\'chirish')">✕</button></td>
            </tr>
          </tbody>
        </table></div>
        <button class="btn ghost sm" @click="addMat">+ {{t('Homashyo qo\\'shish')}}</button>
      </div>

      <div class="panel">
        <h2>{{t('Qo\\'shimcha xarajatlar')}} <span class="muted small">({{t('ish haqi, elektr, gaz va boshqalar — 1 birlik uchun so\\'mda')}})</span></h2>
        <div class="tbl-wrap"><table class="tbl edit">
          <thead><tr><th class="n">#</th><th>{{t('Xarajat nomi')}}</th><th class="num">{{t('1 birlikka, so\\'m')}}</th><th class="num">{{t('{0} birlikka', qty(batch||0))}}</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(c,i) in r.costs" :key="i"><td class="n muted">{{i+1}}</td>
              <td><input v-model="c.name" :placeholder="t('Masalan: ish haqi')" :aria-label="t('Xarajat nomi')"></td>
              <td class="num"><input type="number" step="any" class="num" v-model.number="c.per" :aria-label="t('1 birlikka, so\\'m')"></td>
              <td class="num mono">{{money((Number(c.per)||0)*(batch||0))}}</td>
              <td><button class="icon-btn" @click="r.costs.splice(i,1)" :aria-label="t('Qatorni o\\'chirish')">✕</button></td></tr>
            <tr v-if="!r.costs.length"><td colspan="5" class="empty">{{t('Xarajat qo\\'shilmagan')}}</td></tr>
          </tbody>
        </table></div>
        <button class="btn ghost sm" @click="addCost">+ {{t('Xarajat qo\\'shish')}}</button>
      </div>

      <div class="kpis">
        <kpi :label="t('Homashyo tannarxi (1 birlik)')" :value="money(rc.mat)"></kpi>
        <kpi :label="t('Xarajatlar (1 birlik)')" :value="money(rc.extra)"></kpi>
        <kpi :label="t('To\\'liq tannarx (1 birlik)')" :value="money(rc.total)" :sub="t('{0} birlik: {1}', qty(batch||0), money(rc.total*(batch||0)))"></kpi>
      </div>
      <div class="fld"><label for="rc-note">{{t('Izoh')}}</label><input id="rc-note" v-model="r.note"></div>
      <p class="note">{{t('Narxlar ombordagi joriy o\\'rtacha tannarx bo\\'yicha hisoblanadi. Kalkulyatsiyani istalgan vaqtda o\\'zgartirish mumkin: oldingi ishlab chiqarish hujjatlari o\\'zgarmaydi, ularni "↻" tugmasi bilan yangilash mumkin.')}}</p>
      <p class="err" v-if="err">{{err}}</p>
      <div class="sticky-actions">
        <button class="btn ghost" @click="$emit('close')">{{t('Bekor qilish')}}</button>
        <button class="btn primary" :disabled="saving" @click="save">{{t('Saqlash')}}</button>
      </div>
    </section>`
  };

  C['production-view'] = {
    data() { return { tab: 'recipes', editing: null }; },
    computed: {
      recipes() {
        return A.recsOf('recipe').map((r) => {
          const p = A.byId(r.product) || {}; const rc = E.recipeCost(r, S.calc);
          const st = S.calc.stock.filter((s) => s.p === r.product).reduce((a, s) => a + s.qty, 0);
          const missing = rc.mats.filter((m) => m.stock <= 1e-9).length;
          return { ...r, name: p.name, mxik: p.mxik, unitn: A.unitName(p.unit), nm: (r.mats || []).length, mat: rc.mat, extra: rc.extra, total: rc.total, st, missing, _cls: missing ? 'warn-row' : '' };
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      },
      rcols() {
        return [{ k: 'mxik', label: 'MXIK', mono: true }, { k: 'name', label: 'Mahsulot' }, { k: 'unitn', label: "O'lchov" }, { k: 'nm', label: 'Homashyolar', num: true },
          { k: 'mat', label: 'Homashyo (1 birlik)', num: true, f: (r) => A.money(r.mat) }, { k: 'extra', label: 'Xarajatlar (1 birlik)', num: true, f: (r) => A.money(r.extra) },
          { k: 'total', label: "To'liq tannarx (1 birlik)", num: true, f: (r) => A.money(r.total) }, { k: 'st', label: 'Tayyor qoldiq', num: true, f: (r) => A.qty(r.st) },
          { k: 'missing', label: 'Holati', f: (r) => (r.missing ? t('{0} ta homashyo omborda yo\'q', r.missing) : t('Yetarli')) }];
      },
      docs() {
        return A.recsOf('doc').filter((d) => d.type === 'production').sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => {
          const c = S.calc.docCalc[d.id] || { lines: [] };
          const names = (d.lines || []).map((l) => A.prodLabel(l.p)).join(', ');
          const q = (d.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0);
          const mat = c.lines.reduce((a, l) => a + (l.matCost || 0), 0), full = c.lines.reduce((a, l) => a + (l.full || 0), 0);
          return { ...d, names, q, mat, full, _cls: A.lockedRec(d) ? 'locked' : '' };
        });
      },
      dcols() {
        return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'number', label: '№', mono: true }, { k: 'names', label: 'Mahsulot' },
          { k: 'q', label: 'Miqdor', num: true, f: (r) => A.qty(r.q) }, { k: 'wh', label: 'Homashyo ombori', f: (r) => (A.byId(r.wh) || {}).name || '' },
          { k: 'mat', label: 'Homashyo tannarxi', num: true, f: (r) => A.money(r.mat) }, { k: 'full', label: "To'liq tannarx", num: true, f: (r) => A.money(r.full) }];
      },
      dfoot() { const s = (k) => this.docs.reduce((a, r) => a + r[k], 0); return { mat: s('mat'), full: s('full') }; }
    },
    methods: {
      openRecipe(r) { this.editing = { recipe: r && r.id ? A.byId(r.id) : null }; },
      openDoc(d) { S.editDoc = { doc: JSON.parse(JSON.stringify(A.byId(d.id))) }; S.view = 'docs'; }
    },
    template: `
    <recipe-editor v-if="editing" :recipe="editing.recipe" @close="editing=null"></recipe-editor>
    <section class="page" v-else>
      <header class="page-h"><div><h1>{{t('Ishlab chiqarish')}}</h1><p class="muted">{{t('Kalkulyatsiya bo\\'yicha homashyo ombordan chiqariladi, tayyor mahsulot omborga kiradi')}}</p></div>
        <div class="row-gap"><button class="btn ghost" @click="newDoc('production')">+ {{t('Ishlab chiqarish hujjati')}}</button>
          <button class="btn primary" @click="openRecipe()">+ {{t('Kalkulyatsiya')}}</button></div></header>
      <div class="tabs"><button :class="{on:tab==='recipes'}" @click="tab='recipes'">{{t('Kalkulyatsiyalar')}}</button><button :class="{on:tab==='docs'}" @click="tab='docs'">{{t('Ishlab chiqarish hujjatlari')}}</button></div>
      <data-table v-if="tab==='recipes'" :cols="rcols" :rows="recipes" clickable @row="openRecipe" export-name="kalkulyatsiyalar" empty="Hali kalkulyatsiya yo'q. Ishlab chiqariladigan mahsulot uchun kalkulyatsiya qo'shing"></data-table>
      <data-table v-else :cols="dcols" :rows="docs" :foot="dfoot" clickable @row="openDoc" export-name="ishlab_chiqarish"></data-table>
    </section>`
  };
})();
