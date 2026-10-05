/* Umumiy komponentlar: modal, forma, jadval, MXIK qidiruv, mahsulot tanlash */
(function () {
  const A = window.App; const { S, t } = A;
  const C = (window.Components = window.Components || {});

  C['x-modal'] = {
    props: { title: String, wide: Boolean },
    emits: ['close'],
    template: `
    <div class="modal-back" @mousedown.self="$emit('close')">
      <div class="modal" :class="{wide}" role="dialog" aria-modal="true">
        <header class="modal-h"><h3>{{title}}</h3><button class="icon-btn" @click="$emit('close')" :aria-label="t('Yopish')">✕</button></header>
        <div class="modal-b"><slot></slot></div>
        <footer class="modal-f" v-if="$slots.footer"><slot name="footer"></slot></footer>
      </div>
    </div>`
  };

  /* MXIK qidiruv maydoni */
  C['mxik-input'] = {
    props: { modelValue: String, autofocus: Boolean },
    emits: ['update:modelValue', 'pick'],
    data() { return { q: this.modelValue || '', res: null, open: false, loading: '', hi: 0, timer: null, seq: 0 }; },
    watch: { modelValue(v) { if (v !== this.q) this.q = v || ''; } },
    methods: {
      onInput() {
        this.$emit('update:modelValue', this.q.trim());
        clearTimeout(this.timer);
        this.timer = setTimeout(this.run, /^\d+$/.test(this.q.trim()) ? 120 : 380);
      },
      async run() {
        const q = this.q.trim(); const my = ++this.seq;
        if (!q) { this.res = null; return; }
        this.open = true;
        const isText = !/^\d+$/.test(q);
        if (isText && q.length < 3) { this.res = { items: [], total: 0, groups: [], short: true }; return; }
        this.loading = t('Qidirilmoqda…');
        try {
          const r = await Mxik.search(q, { limit: 80, onProgress: (d, n) => { if (my === this.seq) this.loading = t('Katalog yuklanmoqda: {0}%', Math.round(d / n * 100)); } });
          if (my === this.seq) { this.res = r; this.hi = 0; }
        } catch (e) { this.res = { items: [], total: 0, groups: [], error: true }; }
        if (my === this.seq) this.loading = '';
      },
      pick(it) { this.q = it.code; this.$emit('update:modelValue', it.code); this.$emit('pick', it); this.open = false; },
      pickGroup(g) { this.q = g.g; this.onInput(); this.$refs.inp.focus(); },
      key(e) {
        if (!this.open || !this.res) return;
        const n = this.res.items.length;
        if (e.key === 'ArrowDown') { this.hi = Math.min(n - 1, this.hi + 1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { this.hi = Math.max(0, this.hi - 1); e.preventDefault(); }
        else if (e.key === 'Enter' && n) { this.pick(this.res.items[this.hi]); e.preventDefault(); }
        else if (e.key === 'Escape') this.open = false;
      },
      blur() { setTimeout(() => (this.open = false), 180); }
    },
    mounted() { if (this.autofocus) this.$refs.inp.focus(); },
    template: `
    <div class="mxik">
      <input ref="inp" id="mxik-q" class="mono" v-model="q" @input="onInput" @focus="q && (open=true) && !res && run()" @keydown="key" @blur="blur"
        :placeholder="t('Kod raqamlari yoki nomi bilan qidiring')" autocomplete="off">
      <div class="mxik-drop" v-if="open && (res || loading)">
        <div class="mxik-st" v-if="loading">{{loading}}</div>
        <template v-else-if="res">
          <div class="mxik-st" v-if="res.short">{{t('Nom bo\\'yicha qidirish uchun kamida 3 harf yozing')}}</div>
          <template v-else-if="res.groups.length">
            <div class="mxik-st">{{t('Guruhni tanlang yoki raqam yozishda davom eting')}}</div>
            <button type="button" class="mxik-row" v-for="g in res.groups" :key="g.g" @mousedown.prevent="pickGroup(g)">
              <span class="mono code">{{g.g}}</span><span>{{catName(g.n)}}</span><span class="muted">{{qty(g.c)}}</span>
            </button>
          </template>
          <template v-else>
            <div class="mxik-st">{{ res.total ? t('{0} ta topildi', qty(res.total)) + (res.total > res.items.length ? ' · ' + t('birinchi {0} tasi ko\\'rsatilgan', res.items.length) : '') : t('Hech narsa topilmadi') }}</div>
            <button type="button" class="mxik-row" v-for="(it,i) in res.items" :key="it.code" :class="{hi:i===hi}" @mousedown.prevent="pick(it)" @mousemove="hi=i">
              <span class="mono code">{{it.code}}</span><span>{{catName(it.name)}}</span><span class="muted">{{it.units.slice(0,2).map(unitName).join(', ')}}</span>
            </button>
          </template>
        </template>
      </div>
    </div>`
  };

  /* Firma mahsulotini tanlash (hujjat qatorlari uchun) */
  C['prod-select'] = {
    props: { modelValue: String, wh: String, only: String, exclude: String },
    emits: ['update:modelValue', 'new'],
    data() { return { q: '', open: false, hi: 0 }; },
    computed: {
      current() { return A.byId(this.modelValue); },
      list() {
        const q = this.q.trim().toLowerCase();
        const ps = A.recsOf('product').filter((p) => (!this.only || p.ptype === this.only) && p.id !== this.exclude);
        const f = q ? ps.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.mxik || '').startsWith(q)) : ps;
        return f.slice(0, 50);
      }
    },
    methods: {
      pick(p) { this.$emit('update:modelValue', p.id); this.open = false; this.q = ''; },
      focus() { this.open = true; this.hi = 0; },
      key(e) {
        if (e.key === 'ArrowDown') { this.hi = Math.min(this.list.length, this.hi + 1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { this.hi = Math.max(0, this.hi - 1); e.preventDefault(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (this.hi < this.list.length) this.pick(this.list[this.hi]); else this.addNew(); }
        else if (e.key === 'Escape') this.open = false;
        else this.open = true;
      },
      addNew() { this.open = false; this.$emit('new', this.q); },
      blur() { setTimeout(() => { this.open = false; this.q = ''; }, 180); }
    },
    template: `
    <div class="psel">
      <input :value="open ? q : (current ? current.name : '')" @input="q=$event.target.value; open=true; hi=0" @focus="focus" @blur="blur" @keydown="key"
        :placeholder="t('Mahsulot nomi yoki MXIK')" autocomplete="off">
      <div class="mxik-drop" v-if="open">
        <button type="button" class="mxik-row" v-for="(p,i) in list" :key="p.id" :class="{hi:i===hi}" @mousedown.prevent="pick(p)">
          <span class="mono code">{{p.mxik || '—'}}</span><span>{{p.name}}</span><span class="muted">{{unitName(p.unit)}}</span>
        </button>
        <button type="button" class="mxik-row add" :class="{hi:hi===list.length}" @mousedown.prevent="addNew">+ {{t('Yangi mahsulot qo\\'shish')}}</button>
      </div>
    </div>`
  };

  /* Umumiy forma (modal ichida) */
  C['rec-form'] = {
    props: { title: String, fields: Array, value: Object, onSave: Function, onDelete: Function, deleteText: String, readonly: Boolean, wide: Boolean, note: String },
    data() { const m = JSON.parse(JSON.stringify(this.value || {})); (this.fields || []).forEach((f) => { if (m[f.k] === undefined && f.def !== undefined) m[f.k] = typeof f.def === 'function' ? f.def() : f.def; }); return { m, err: '', saving: false, hints: {} }; },
    computed: { visible() { return this.fields.filter((f) => !f.show || f.show(this.m)); } },
    methods: {
      lbl(f) { return typeof f.label === 'function' ? f.label(this.m) : t(f.label); },
      opts(f) { return typeof f.options === 'function' ? f.options(this.m) : f.options; },
      changed(f) { f.onChange && f.onChange(this.m, this); },
      picked(f, it) { f.onPick && f.onPick(this.m, it, this); },
      async pickImg(f, ev) { const file = ev.target.files[0]; if (!file) return; try { this.m[f.k] = await A.calendar.imageToDataUrl(file); } catch (e) { this.err = t("Rasmni o'qib bo'lmadi"); } ev.target.value = ''; },
      async save() {
        this.err = '';
        for (const f of this.visible) {
          if (f.req && (this.m[f.k] === undefined || this.m[f.k] === '' || this.m[f.k] === null)) { this.err = t('"{0}" maydonini to\'ldiring', this.lbl(f)); return; }
          if (f.validate) { const e = f.validate(this.m[f.k], this.m); if (e) { this.err = e; return; } }
        }
        for (const f of this.visible) if (f.type === 'entries') this.m[f.k] = (this.m[f.k] || []).filter((e) => e.dt || e.kt || Number(e.sum));
        this.saving = true;
        try { const r = await this.onSave(this.m); A.closeModal(r || true); }
        catch (e) { this.err = A.errText(e); }
        this.saving = false;
      },
      async del() {
        if (!(await A.ask(this.deleteText || t("O'chirishni tasdiqlaysizmi?"), t("O'chirish"), true))) return;
        try { await this.onDelete(this.m); A.closeModal('deleted'); } catch (e) { this.err = A.errText(e); }
      }
    },
    template: `
    <x-modal :title="title" :wide="wide" @close="closeModal()">
      <form class="form-grid" @submit.prevent="save" :id="'f-'+(title||'').length">
        <p class="note full" v-if="note">{{note}}</p>
        <template v-for="f in visible" :key="f.k">
          <label v-if="f.type==='check'" class="check" :class="{full:f.full}">
            <input type="checkbox" v-model="m[f.k]" :id="'fld-'+f.k" :disabled="readonly" @change="changed(f)"> <span>{{lbl(f)}}</span>
          </label>
          <div v-else class="fld" :class="{full:f.full, half:f.half}">
            <label :for="'fld-'+f.k">{{lbl(f)}}<b v-if="f.req" class="req">*</b></label>
            <mxik-input v-if="f.type==='mxik'" v-model="m[f.k]" @pick="picked(f,$event)" :autofocus="!value || !value.id"></mxik-input>
            <select v-else-if="f.type==='select'" :id="'fld-'+f.k" v-model="m[f.k]" :disabled="readonly" @change="changed(f)">
              <option v-if="f.empty" value="">{{t(f.empty)}}</option>
              <option v-for="o in opts(f)" :key="o[0]" :value="o[0]">{{o[1]}}</option>
            </select>
            <textarea v-else-if="f.type==='textarea'" :id="'fld-'+f.k" v-model="m[f.k]" rows="2" :readonly="readonly"></textarea>
            <input v-else-if="f.type==='number'" :id="'fld-'+f.k" type="number" step="any" v-model.number="m[f.k]" class="num" :readonly="readonly" @input="changed(f)">
            <entries-editor v-else-if="f.type==='entries'" :rows="m[f.k]" :suggest="f.suggest ? () => f.suggest(m) : null" :locked="readonly"></entries-editor>
            <acc-select v-else-if="f.type==='acc'" v-model="m[f.k]"></acc-select>
            <div v-else-if="f.type==='image'" class="img-fld">
              <img v-if="m[f.k]" :src="m[f.k]" alt="">
              <label class="btn ghost sm file">{{ m[f.k] ? t('Rasmni almashtirish') : t('Rasm tanlash') }}<input type="file" accept="image/*" @change="pickImg(f, $event)" :id="'fld-'+f.k"></label>
              <button v-if="m[f.k]" type="button" class="btn ghost sm" @click="m[f.k]=''">{{t("O'chirish")}}</button>
            </div>
            <div v-else-if="f.type==='multi'" class="multi">
              <label v-for="o in opts(f)" :key="o[0]" class="check"><input type="checkbox" :value="o[0]" v-model="m[f.k]"> <span>{{o[1]}}</span></label>
              <span v-if="!opts(f).length" class="muted small">{{t("Ro'yxat bo'sh")}}</span>
            </div>
            <pw-input v-else-if="f.type==='password'" :id="'fld-'+f.k" v-model="m[f.k]" autocomplete="new-password"></pw-input>
            <div v-else-if="f.type==='altunits'" class="alt-units">
              <div v-for="(u,j) in m[f.k]" :key="j" class="alt-row">
                <span class="muted">1</span>
                <select v-model="u.unit" :aria-label="t('O\\'lchov birligi')"><option value="" disabled>{{t('Tanlang')}}</option><option v-for="x in S.units" :key="x.id" :value="x.id" :disabled="x.id===m.unit">{{unitName(x.id)}}</option></select>
                <span class="muted">=</span>
                <input type="number" step="any" class="num" v-model.number="u.k" :aria-label="t('Asosiy birlikdagi miqdor')">
                <span class="muted">{{unitName(m.unit)}}</span>
                <button type="button" class="icon-btn" @click="m[f.k].splice(j,1)" :aria-label="t('Qatorni o\\'chirish')">✕</button>
              </div>
              <button type="button" class="btn ghost sm" @click="(m[f.k] = m[f.k] || []).push({ unit: '', k: null })">+ {{t('O\\'lchov birligi qo\\'shish')}}</button>
            </div>
            <input v-else :id="'fld-'+f.k" :type="f.type||'text'" v-model="m[f.k]" :readonly="readonly" @change="changed(f)" :placeholder="f.ph ? t(f.ph) : ''" :class="{mono:f.mono}">
            <small v-if="f.hint" class="hint">{{ typeof f.hint==='function' ? f.hint(m) : t(f.hint) }}</small>
            <small v-if="hints[f.k]" class="hint ok">{{hints[f.k]}}</small>
          </div>
        </template>
        <p class="err full" v-if="err">{{err}}</p>
        <button type="submit" hidden></button>
      </form>
      <template #footer>
        <button v-if="onDelete && value && value.id && !readonly" class="btn danger ghost" @click="del">{{t("O'chirish")}}</button>
        <span class="grow"></span>
        <button class="btn ghost" @click="closeModal()">{{t('Bekor qilish')}}</button>
        <button v-if="!readonly" class="btn primary" :disabled="saving" @click="save">{{t('Saqlash')}}</button>
      </template>
    </x-modal>`
  };

  /* Jadval: qidiruv, saralash, Excel */
  C['data-table'] = {
    props: { cols: Array, rows: Array, exportName: String, exportTitle: String, clickable: Boolean, empty: String, foot: Object, searchable: { type: Boolean, default: true } },
    emits: ['row'],
    data() { return { q: '', sort: null, dir: 1, limit: 200 }; },
    computed: {
      shown() {
        let r = this.rows;
        const q = this.q.trim().toLowerCase();
        if (q) r = r.filter((row) => this.cols.some((c) => String(this.cell(c, row)).toLowerCase().includes(q)));
        if (this.sort) {
          const c = this.cols.find((x) => x.k === this.sort);
          const v = (row) => (c.sv ? c.sv(row) : c.x ? c.x(row) : row[c.k]);
          r = [...r].sort((a, b) => { const x = v(a), y = v(b); return (x > y ? 1 : x < y ? -1 : 0) * this.dir; });
        }
        return r;
      }
    },
    methods: {
      cell(c, row) { return c.f ? c.f(row) : row[c.k] == null ? '' : row[c.k]; },
      xval(c, row) { return c.x ? c.x(row) : c.num ? Number(row[c.k]) || 0 : this.cell(c, row); },
      sortBy(c) { if (this.sort === c.k) this.dir = -this.dir; else { this.sort = c.k; this.dir = 1; } },
      async exp() {
        const header = this.cols.filter((c) => !c.noexp).map((c) => t(c.label));
        const rows = this.shown.map((row) => this.cols.filter((c) => !c.noexp).map((c) => this.xval(c, row)));
        if (this.foot) rows.push(this.cols.filter((c) => !c.noexp).map((c, i) => (this.foot[c.k] !== undefined ? this.foot[c.k] : i === 0 ? t('Jami') : '')));
        await Excel.exportXlsx((this.exportName || 'jadval') + '.xlsx', [{ name: this.exportName || 'Sheet1', title: this.exportTitle, header, rows }]);
      }
    },
    template: `
    <div class="dt">
      <div class="dt-tools">
        <input v-if="searchable" class="search" v-model="q" :placeholder="t('Qidirish')" :aria-label="t('Qidirish')">
        <span class="muted small">{{t('{0} ta yozuv', shown.length)}}</span>
        <span class="grow"></span>
        <slot name="tools"></slot>
        <button v-if="exportName" class="btn ghost sm" @click="exp">⤓ Excel</button>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th v-for="c in cols" :key="c.k" :class="{num:c.num}" @click="sortBy(c)">{{t(c.label)}}<span v-if="sort===c.k">{{dir>0?' ▲':' ▼'}}</span></th></tr></thead>
          <tbody>
            <tr v-for="row in shown.slice(0,limit)" :key="row.id || JSON.stringify(row)" :class="[{click:clickable}, row._cls]" @click="$emit('row',row)">
              <td v-for="c in cols" :key="c.k" :class="[{num:c.num, mono:c.mono}, c.cls]">{{cell(c,row)}}</td>
            </tr>
            <tr v-if="!shown.length"><td :colspan="cols.length" class="empty">{{ empty ? t(empty) : t("Hozircha yozuv yo'q") }}</td></tr>
          </tbody>
          <tfoot v-if="foot && shown.length"><tr><td v-for="(c,i) in cols" :key="c.k" :class="{num:c.num}">{{ foot[c.k] !== undefined ? (c.num ? money(foot[c.k]) : foot[c.k]) : (i===0 ? t('Jami') : '') }}</td></tr></tfoot>
        </table>
      </div>
      <button v-if="shown.length > limit" class="btn ghost sm more" @click="limit += 500">{{t("Yana ko'rsatish")}} ({{shown.length - limit}})</button>
    </div>`
  };

  /* Parol maydoni: ko'rsatish / yashirish */
  C['pw-input'] = {
    props: { modelValue: String, id: String, autocomplete: String, autofocus: Boolean },
    emits: ['update:modelValue'],
    data() { return { show: false }; },
    template: `<div class="pw"><input :id="id" :type="show ? 'text' : 'password'" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" :autocomplete="autocomplete || 'current-password'" :autofocus="autofocus">
      <button type="button" class="pw-eye" @click="show=!show" :aria-label="show ? t('Parolni yashirish') : t('Parolni ko\\'rsatish')" :title="show ? t('Parolni yashirish') : t('Parolni ko\\'rsatish')">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path v-if="show" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8"/></svg>
      </button></div>`
  };

  C['kpi'] = {
    props: { label: String, value: [String, Number], sub: String, tone: String },
    template: `<div class="kpi" :class="tone"><div class="kpi-l">{{label}}</div><div class="kpi-v mono">{{value}}</div><div class="kpi-s" v-if="sub">{{sub}}</div></div>`
  };
})();
