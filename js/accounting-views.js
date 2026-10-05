/* Buxgalteriya ekranlari va kirim-chiqim tahlili */
(function () {
  const A = window.App; const { S, t } = A; const C = window.Components; const E = window.Engine;
  const accName = (code) => { const a = Acc.list(S.recs).find((x) => x.code === code); return a ? A.accText(a.name) : ''; };
  A.accText = (s) => (S.lang === 'cy' ? window.Translit.lat2cyr(s) : s);
  A.accName = accName;

  /* Schyot tanlash */
  C['acc-select'] = {
    props: { modelValue: String, all: Boolean, placeholder: String },
    emits: ['update:modelValue'],
    data() { return { q: '', open: false, hi: 0 }; },
    computed: {
      accs() { return Acc.list(S.recs); },
      cur() { return this.accs.find((a) => a.code === this.modelValue); },
      list() {
        const q = this.q.trim().toLowerCase();
        let l = this.accs.filter((a) => this.all || a.postable);
        if (q) l = l.filter((a) => a.code.startsWith(q) || a.name.toLowerCase().includes(q));
        return l.slice(0, 60);
      },
      bad() { return this.modelValue && (!this.cur || (!this.all && !this.cur.postable)); }
    },
    methods: {
      pick(a) { this.$emit('update:modelValue', a.code); this.open = false; this.q = ''; },
      key(e) {
        if (e.key === 'ArrowDown') { this.hi = Math.min(this.list.length - 1, this.hi + 1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { this.hi = Math.max(0, this.hi - 1); e.preventDefault(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (this.list[this.hi]) this.pick(this.list[this.hi]); }
        else if (e.key === 'Escape') this.open = false;
      },
      blur() { setTimeout(() => { this.open = false; this.q = ''; }, 180); }
    },
    template: `
    <div class="psel acc">
      <input :value="open ? q : (modelValue || '')" @input="q=$event.target.value; open=true; hi=0" @focus="open=true" @blur="blur" @keydown="key"
        :placeholder="placeholder || t('Schyot')" class="mono" :class="{badin: bad}" :title="cur ? cur.code + ' ' + accText(cur.name) : ''" autocomplete="off">
      <small class="acc-n" v-if="cur && !open">{{accText(cur.name)}}</small>
      <div class="mxik-drop" v-if="open">
        <button type="button" class="mxik-row" v-for="(a,i) in list" :key="a.code" :class="{hi:i===hi}" @mousedown.prevent="pick(a)">
          <span class="mono code">{{a.code}}</span><span>{{accText(a.name)}}</span><span class="muted">{{a.type}}</span></button>
        <div class="mxik-st" v-if="!list.length">{{t('Hech narsa topilmadi')}}</div>
      </div>
    </div>`
  };

  /* Provodkalar muharriri */
  C['entries-editor'] = {
    props: { rows: Array, suggest: Function, locked: Boolean, hint: String },
    computed: { total() { return this.rows.reduce((s, e) => s + (Number(e.sum) || 0), 0); } },
    methods: {
      add() { this.rows.push({ dt: '', kt: '', sum: null, note: '' }); },
      async fill() {
        const s = this.suggest ? this.suggest() : [];
        if (!s.length) { A.toast(t("Bu yozuv uchun taklif yo'q. Provodkani qo'lda kiriting"), 'err'); return; }
        if (this.rows.some((e) => e.dt || e.kt || e.sum) && !(await A.ask(t('Joriy provodkalar taklif qilinganlari bilan almashtirilsinmi?'), t('Almashtirish')))) return;
        this.rows.splice(0, this.rows.length, ...s.map((e) => ({ ...e, note: e.note ? t(e.note) : '' })));
      }
    },
    template: `
    <div class="entries">
      <div class="tbl-wrap"><table class="tbl edit compact">
        <thead><tr><th>{{t('Debet')}}</th><th>{{t('Kredit')}}</th><th class="num">{{t('Summa')}}</th><th>{{t('Izoh')}}</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(e,i) in rows" :key="i">
            <td><acc-select v-model="e.dt" v-if="!locked"></acc-select><span v-else class="mono">{{e.dt}}</span></td>
            <td><acc-select v-model="e.kt" v-if="!locked"></acc-select><span v-else class="mono">{{e.kt}}</span></td>
            <td class="num"><input type="number" step="any" class="num" v-model.number="e.sum" :disabled="locked" :aria-label="t('Summa')"></td>
            <td><input v-model="e.note" :disabled="locked" :aria-label="t('Izoh')"></td>
            <td><button class="icon-btn" v-if="!locked" @click="rows.splice(i,1)" :aria-label="t('Qatorni o\\'chirish')">✕</button></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="5" class="empty">{{t("Provodka kiritilmagan")}}</td></tr>
        </tbody>
        <tfoot v-if="rows.length"><tr><td colspan="2">{{t('Jami')}}</td><td class="num mono">{{money(total)}}</td><td colspan="2"></td></tr></tfoot>
      </table></div>
      <div class="row-gap wrap" v-if="!locked">
        <button type="button" class="btn ghost sm" @click="add">+ {{t('Provodka')}}</button>
        <button type="button" class="btn ghost sm" v-if="suggest" @click="fill">✦ {{t('Taklif qilinganini qo\\'yish')}}</button>
        <span class="muted small">{{hint || t('Taklif faqat yordam uchun: schyotlarni tekshirib, kerak bo\\'lsa o\\'zgartiring')}}</span>
      </div>
    </div>`
  };

  /* ---------------- Buxgalteriya bo'limi ---------------- */
  C['accounting-view'] = {
    data() {
      const y = A.today().slice(0, 4);
      return { tab: 'osv', from: y + '-01-01', to: A.today(), level: 'acc', acc: '', q: '', date: A.today(), jAcc: '', op: null, depM: A.today().slice(0, 7) };
    },
    computed: {
      tabsList() { return [['osv', 'Aylanma-saldo'], ['card', 'Schyot kartochkasi'], ['balance', 'Balans'], ['journal', 'Provodkalar jurnali'], ['ops', "Qo'lda operatsiyalar"], ['opening', "Boshlang'ich qoldiqlar"], ['chart', 'Schyotlar rejasi']]; },
      accs() { return Acc.list(S.recs); },
      chartRows() {
        const q = this.q.trim().toLowerCase();
        return this.accs.filter((a) => !q || a.code.startsWith(q) || a.name.toLowerCase().includes(q))
          .map((a) => ({ ...a, id: a.code, nm: A.accText(a.name), secn: a.sec >= 0 ? A.accText(window.ACCOUNT_SECTIONS[a.sec]) : '', _cls: a.group ? 'grp-row' : a.base ? '' : 'sub-row' }));
      },
      chartCols() { return [{ k: 'code', label: 'Schyot', mono: true }, { k: 'nm', label: 'Nomi' }, { k: 'type', label: 'Turi' }, { k: 'secn', label: "Bo'lim" }]; },
      opening() { return Acc.opening(S.recs); },
      ops() { return A.recsOf('journal').sort((a, b) => (a.date < b.date ? 1 : -1)).map((j) => ({ ...j, sum: (j.entries || []).reduce((s, e) => s + (Number(e.sum) || 0), 0), _cls: A.lockedRec(j) ? 'locked' : '' })); },
      opsCols() { return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'number', label: '№', mono: true }, { k: 'note', label: 'Mazmuni' }, { k: 'n', label: 'Provodkalar', num: true, f: (r) => (r.entries || []).length }, { k: 'sum', label: 'Summa', num: true, f: (r) => A.money(r.sum) }]; },
      journal() {
        return Acc.entries(S.recs).filter((e) => (!this.from || e.date >= this.from) && (!this.to || e.date <= this.to) && (!this.jAcc || Acc.matches(e.dt, this.jAcc) || Acc.matches(e.kt, this.jAcc)))
          .map((e, i) => ({ ...e, id: e.rec.id + '-' + e.i, src: A.label(e.rec), sumv: e.sum }));
      },
      jCols() { return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'src', label: 'Hujjat' }, { k: 'dt', label: 'Debet', mono: true }, { k: 'kt', label: 'Kredit', mono: true }, { k: 'sumv', label: 'Summa', num: true, f: (r) => A.money(r.sumv) }, { k: 'note', label: 'Izoh' }]; },
      jFoot() { return { sumv: this.journal.reduce((s, r) => s + r.sum, 0) }; },
      missing() { return Acc.missing(S.recs).filter((r) => !(r.kind === 'doc' && r.type === 'opening')); },
      osv() {
        let rows = Acc.osv(S.recs, this.from, this.to);
        if (this.level !== 'sub') rows = Acc.groupRows(rows, this.level === 'group' ? 'group' : 'acc');
        return rows.map((r) => ({ ...r, id: r.code, nm: accName(r.code) || accName(r.code.slice(0, 4)) }));
      },
      osvCols() {
        const m = (k, l) => ({ k, label: l, num: true, f: (r) => (r[k] ? A.money(r[k]) : '') });
        return [{ k: 'code', label: 'Schyot', mono: true }, { k: 'nm', label: 'Nomi' }, m('odt', "Boshida Dt"), m('okt', 'Boshida Kt'), m('tdt', 'Aylanma Dt'), m('tkt', 'Aylanma Kt'), m('cdt', 'Oxirida Dt'), m('ckt', 'Oxirida Kt')];
      },
      osvFoot() { const s = (k) => this.osv.filter((r) => !Acc.isOff(r.code)).reduce((a, r) => a + r[k], 0); return { odt: s('odt'), okt: s('okt'), tdt: s('tdt'), tkt: s('tkt'), cdt: s('cdt'), ckt: s('ckt') }; },
      cardData() { return this.acc ? Acc.card(S.recs, this.acc, this.from, this.to) : null; },
      bal() { return Acc.balanceSheet(S.recs, this.date); }
    },
    methods: {
      async addSub(a) {
        const used = this.accs.filter((x) => x.parent === a.code).map((x) => Number(x.code.split('.')[1]) || 0);
        const next = String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0');
        const r = await A.openModal('rec-form', { title: t('Subschyot') + ': ' + a.code, value: { suffix: next },
          note: a.code + ' — ' + A.accText(a.name) + '. ' + t('Subschyot qo\'shilgach, provodkalar subschyotga yoziladi'),
          fields: [{ k: 'suffix', label: 'Subschyot raqami', req: true, mono: true, validate: (v) => (/^\d{1,3}$/.test(v || '') ? (this.accs.some((x) => x.code === a.code + '.' + v) ? t('Bu raqam band') : '') : t('1–3 ta raqam kiriting')) },
            { k: 'name', label: 'Nomi', req: true, full: true, ph: 'Masalan: Xalq banki hisob raqami' }],
          onSave: (m) => A.saveRec('account', { code: a.code + '.' + m.suffix, name: m.name, parent: a.code }) });
        if (r) A.toast(t('Saqlandi'));
      },
      async editSub(a) {
        const rec = A.byId(a.id); if (!rec) return;
        const used = Acc.entries(S.recs).some((e) => e.dt === a.code || e.kt === a.code) || ((Acc.opening(S.recs) || {}).rows || []).some((r) => r.acc === a.code);
        await A.openModal('rec-form', { title: t('Subschyot') + ': ' + a.code, value: rec, fields: [{ k: 'name', label: 'Nomi', req: true, full: true }],
          onSave: (m) => A.saveRec('account', m),
          onDelete: async () => { if (used) throw new Error(t("Bu subschyotda provodkalar bor, o'chirib bo'lmaydi")); return A.delRec(rec); } });
      },
      chartClick(a) { if (!a.base) this.editSub(a); else if (!a.group) this.addSub(a); },
      async editOpening() {
        const v = this.opening ? JSON.parse(JSON.stringify(this.opening)) : { date: A.today().slice(0, 4) + '-01-01', rows: [] };
        await A.openModal('opening-form', { value: v });
      },
      async editOp(j) {
        const r = await A.openModal('rec-form', { title: j && j.id ? t("Qo'lda operatsiya") : t("Yangi operatsiya"), value: j || {}, wide: true,
          readonly: !!(j && j.id && A.lockedRec(j)),
          fields: [{ k: 'date', type: 'date', label: 'Sana', req: true, def: A.today }, { k: 'number', label: 'Raqami' }, { k: 'note', label: 'Mazmuni', full: true, req: true },
            { k: 'entries', type: 'entries', label: 'Provodkalar', full: true, def: () => [{ dt: '', kt: '', sum: null, note: '' }],
              validate: (v) => checkEntries(v, true) }],
          onSave: (m) => A.saveRec('journal', m), onDelete: (m) => A.delRec(A.byId(m.id)) });
        if (r) A.toast(t('Saqlandi'));
      },
      depOp() {
        const ents = Acc.suggestDepreciation(A.recsOf('asset'), S.calc, this.depM);
        if (!ents.length) { A.toast(t("Bu oyda eskirish yo'q"), 'err'); return; }
        const last = this.depM + '-' + String(new Date(Number(this.depM.slice(0, 4)), Number(this.depM.slice(5, 7)), 0).getDate()).padStart(2, '0');
        this.editOp({ date: last, note: t('Asosiy vositalar eskirishi, {0}', A.monthName(this.depM)), entries: ents });
      },
      openSrc(e) { openRec(e.rec); },
      toCard(r) { this.acc = r.code; this.tab = 'card'; },
      async expOsv() {
        await Excel.exportXlsx('aylanma_saldo.xlsx', [{ name: t('Aylanma-saldo'), title: S.firm.name + ' — ' + t('Aylanma-saldo vedomosti') + ' ' + A.dateFmt(this.from) + ' – ' + A.dateFmt(this.to),
          header: this.osvCols.map((c) => t(c.label)), rows: [...this.osv.map((r) => [r.code, r.nm, r.odt, r.okt, r.tdt, r.tkt, r.cdt, r.ckt]), [t('Jami'), '', ...['odt', 'okt', 'tdt', 'tkt', 'cdt', 'ckt'].map((k) => E.r2(this.osvFoot[k]))]] }]);
      },
      async expCard() {
        const c = this.cardData; if (!c) return;
        await Excel.exportXlsx('kartochka_' + this.acc + '.xlsx', [{ name: this.acc, title: S.firm.name + ' — ' + t('Schyot kartochkasi') + ' ' + this.acc + ' ' + accName(this.acc) + ', ' + A.dateFmt(this.from) + ' – ' + A.dateFmt(this.to),
          header: [t('Sana'), t('Hujjat'), t('Korr. schyot'), t('Debet'), t('Kredit'), t('Saldo'), t('Izoh')],
          rows: [[t('Boshlang\'ich qoldiq'), '', '', '', '', c.start, ''], ...c.rows.map((r) => [r.date, A.label(r.rec), r.corr, r.side === 'dt' ? r.sum : '', r.side === 'kt' ? r.sum : '', r.bal, r.note]), [t('Jami aylanma'), '', '', c.tdt, c.tkt, c.end, '']] }]);
      },
      async expBal() {
        const b = this.bal;
        await Excel.exportXlsx('balans_' + this.date + '.xlsx', [{ name: t('Balans'), title: S.firm.name + ' (STIR ' + S.firm.inn + ') — ' + t('Buxgalteriya balansi') + ' ' + A.dateFmt(this.date),
          header: [t('Qator kodi'), t('Ko\'rsatkich'), t('Summa')], rows: b.rows.map((r) => (r.head ? ['', t(r.head), ''] : [r.line, t(r.name), r.val])) }]);
      },
      async expJournal() {
        await Excel.exportXlsx('provodkalar.xlsx', [{ name: t('Provodkalar'), title: S.firm.name + ' — ' + t('Provodkalar jurnali'), header: this.jCols.map((c) => t(c.label)), rows: this.journal.map((r) => [r.date, r.src, r.dt, r.kt, r.sum, r.note]) }]);
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Buxgalteriya')}}</h1><p class="muted">{{t('21-BHMS schyotlar rejasi, provodkalar va hisobotlar')}}</p></div></header>
      <div class="tabs">
        <button v-for="x in tabsList" :key="x[0]" :class="{on:tab===x[0]}" @click="tab=x[0]">{{t(x[1])}}</button>
      </div>
      <div class="filters" v-if="['osv','card','journal'].includes(tab)">
        <label class="inline"><span>{{t('Dan')}}</span><input type="date" v-model="from" id="ac-from"></label>
        <label class="inline"><span>{{t('Gacha')}}</span><input type="date" v-model="to" id="ac-to"></label>
        <label class="inline" v-if="tab==='osv'"><span>{{t('Daraja')}}</span><select v-model="level" id="ac-lvl"><option value="sub">{{t('Subschyotlar bilan')}}</option><option value="acc">{{t('Schyotlar')}}</option><option value="group">{{t('Guruhlar (xx00)')}}</option></select></label>
        <div class="inline" v-if="tab==='card'"><span>{{t('Schyot')}}</span><acc-select v-model="acc" all></acc-select></div>
        <div class="inline" v-if="tab==='journal'"><span>{{t('Schyot')}}</span><acc-select v-model="jAcc" all :placeholder="t('Hammasi')"></acc-select><button v-if="jAcc" class="icon-btn" @click="jAcc=''">✕</button></div>
      </div>
      <p class="note warnp" v-if="missing.length && ['osv','balance','journal'].includes(tab)">⚠ {{t('{0} ta yozuvda provodka kiritilmagan, ular hisobotlarga tushmaydi.', missing.length)}} <button class="link" @click="tab='journal'">{{t("Ro'yxatni ko'rish")}}</button></p>

      <template v-if="tab==='osv'">
        <data-table :cols="osvCols" :rows="osv" :foot="osvFoot" clickable @row="toCard" :searchable="false">
          <template #tools><button class="btn ghost sm" @click="expOsv">⤓ Excel</button></template></data-table>
        <p class="note">{{t('Schyotni bosib uning kartochkasini oching. Balansdan tashqari schyotlar jamiga qo\\'shilmaydi.')}}</p>
      </template>

      <template v-if="tab==='card'">
        <p class="muted" v-if="!acc">{{t('Schyotni tanlang')}}</p>
        <div class="panel" v-if="cardData">
          <div class="panel-h"><h2>{{acc}} — {{accName(acc)}}</h2><span class="grow"></span><button class="btn ghost sm" @click="expCard">⤓ Excel</button></div>
          <div class="tbl-wrap"><table class="tbl compact">
            <thead><tr><th>{{t('Sana')}}</th><th>{{t('Hujjat')}}</th><th>{{t('Korr. schyot')}}</th><th class="num">{{t('Debet')}}</th><th class="num">{{t('Kredit')}}</th><th class="num">{{t('Saldo')}}</th><th>{{t('Izoh')}}</th></tr></thead>
            <tbody><tr class="sub"><td colspan="5">{{t('Boshlang\\'ich qoldiq')}}</td><td class="num mono">{{money(cardData.start)}}</td><td></td></tr>
              <tr v-for="r in cardData.rows" :key="r.rec.id+r.i+r.side" class="click" @click="openSrc(r)"><td class="mono">{{dateFmt(r.date)}}</td><td>{{label(r.rec)}}</td><td class="mono">{{r.corr}}</td>
                <td class="num mono">{{r.side==='dt' ? money(r.sum) : ''}}</td><td class="num mono">{{r.side==='kt' ? money(r.sum) : ''}}</td><td class="num mono">{{money(r.bal)}}</td><td>{{r.note}}</td></tr>
              <tr v-if="!cardData.rows.length"><td colspan="7" class="empty">{{t('Bu davrda harakat yo\\'q')}}</td></tr></tbody>
            <tfoot><tr><td colspan="3">{{t('Jami aylanma')}}</td><td class="num mono">{{money(cardData.tdt)}}</td><td class="num mono">{{money(cardData.tkt)}}</td><td class="num mono">{{money(cardData.end)}}</td><td></td></tr></tfoot>
          </table></div>
        </div>
      </template>

      <template v-if="tab==='balance'">
        <div class="filters"><label class="inline"><span>{{t('Sana holatiga')}}</span><input type="date" v-model="date" id="ac-date"></label><span class="grow"></span><button class="btn ghost sm" @click="expBal">⤓ Excel</button></div>
        <p class="note" :class="Math.abs(bal.aktiv - bal.passiv) > 0.01 ? 'warnp' : 'okp'">{{ Math.abs(bal.aktiv - bal.passiv) > 0.01 ? t('Aktiv va passiv teng emas: farq {0}. Provodkalar va boshlang\\'ich qoldiqlarni tekshiring.', money(bal.aktiv - bal.passiv)) : t('Aktiv passivga teng') }}</p>
        <div class="tbl-wrap"><table class="tbl compact report bal">
          <thead><tr><th>{{t('Qator')}}</th><th>{{t('Ko\\'rsatkich')}}</th><th class="num">{{t('Summa')}}</th></tr></thead>
          <tbody><tr v-for="(r,i) in bal.rows" :key="i" :class="{head: r.head, sub: r.total, total: r.grand, dim: r.sub && !r.val}">
            <template v-if="r.head"><td colspan="3">{{ r.side==='A' ? t('AKTIV') : t('PASSIV') }} · {{t(r.head)}}</td></template>
            <template v-else><td class="mono">{{r.line}}</td><td :class="{indent: r.sub}">{{t(r.name)}}</td><td class="num mono">{{money(r.val)}}</td></template></tr></tbody>
        </table></div>
        <p class="note">{{t('Balans provodkalar va boshlang\\'ich qoldiqlar asosida tuziladi. 9-schyotlar yopilmagan bo\\'lsa, ularning natijasi 450-qatorga (taqsimlanmagan foyda) qo\\'shiladi. Qator kodlarini rasmiy shakl bilan solishtirib tekshiring.')}}</p>
      </template>

      <template v-if="tab==='journal'">
        <div class="panel" v-if="missing.length">
          <h2>{{t('Provodkasiz yozuvlar')}} <span class="count">{{missing.length}}</span></h2>
          <ul class="doc-list"><li v-for="r in missing.slice(0,30)" :key="r.id"><button class="link" @click="openSrc({rec:r})">{{label(r)}}</button></li></ul>
        </div>
        <data-table :cols="jCols" :rows="journal" :foot="jFoot" clickable @row="openSrc">
          <template #tools><button class="btn ghost sm" @click="expJournal">⤓ Excel</button></template></data-table>
      </template>

      <template v-if="tab==='ops'">
        <div class="row-gap wrap"><button class="btn primary" @click="editOp()">+ {{t('Operatsiya')}}</button>
          <span class="grow"></span><label class="inline"><span>{{t('Eskirish oyi')}}</span><input type="month" v-model="depM" id="ac-dep"></label>
          <button class="btn ghost" @click="depOp">{{t('Eskirish provodkasini taklif qilish')}}</button></div>
        <data-table :cols="opsCols" :rows="ops" clickable @row="editOp" export-name="operatsiyalar"></data-table>
      </template>

      <template v-if="tab==='opening'">
        <div class="panel">
          <div class="panel-h"><h2>{{t('Boshlang\\'ich qoldiqlar')}}</h2><span class="grow"></span><button class="btn primary sm" @click="editOpening">{{ opening ? t('Tahrirlash') : t('Kiritish') }}</button></div>
          <p class="muted" v-if="!opening">{{t('Firma tizimga ishlab turgan holda kirsa, ma\\'lum sanadagi schyotlar qoldig\\'ini kiriting: kassa, bank, qarzlar, ustav kapitali va boshqalar.')}}</p>
          <template v-else><p>{{t('Sana')}}: <b>{{dateFmt(opening.date)}}</b></p>
            <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>{{t('Schyot')}}</th><th>{{t('Nomi')}}</th><th class="num">{{t('Debet')}}</th><th class="num">{{t('Kredit')}}</th></tr></thead>
              <tbody><tr v-for="(r,i) in opening.rows" :key="i"><td class="mono">{{r.acc}}</td><td>{{accName(r.acc)}}</td><td class="num mono">{{r.dt ? money(r.dt) : ''}}</td><td class="num mono">{{r.kt ? money(r.kt) : ''}}</td></tr></tbody></table></div></template>
          <p class="note">{{t('Ombordagi tovar qoldiqlari "Boshlang\\'ich qoldiq (ombor)" hujjati bilan kiritiladi: Hujjatlar → Yangi hujjat.')}}</p>
        </div>
      </template>

      <template v-if="tab==='chart'">
        <div class="filters"><input class="search" v-model="q" :placeholder="t('Schyot raqami yoki nomi')" id="ac-q"></div>
        <p class="note">{{t('Schyotni bosib subschyot qo\\'shing (masalan, 5110 ostida har bir bank hisob raqami). O\\'zingiz qo\\'shgan subschyotni bosib tahrirlaysiz.')}}</p>
        <data-table :cols="chartCols" :rows="chartRows" clickable @row="chartClick" :searchable="false" export-name="schyotlar_rejasi"></data-table>
      </template>
    </section>`
  };

  function checkEntries(v, required) {
    const rows = (v || []).filter((e) => e.dt || e.kt || Number(e.sum));
    if (required && !rows.length) return t("Kamida bitta provodka kiriting");
    const accs = Acc.list(S.recs);
    for (const e of rows) {
      if (!(Number(e.sum) > 0)) return t("Provodka summasi noldan katta bo'lishi kerak");
      const one = (c) => accs.find((a) => a.code === c);
      for (const c of [e.dt, e.kt]) { if (!c) continue; const a = one(c); if (!a) return t('"{0}" schyoti topilmadi', c); if (!a.postable) return t('"{0}" guruh schyoti. Uning ichidagi schyotni tanlang', c); }
      if (!e.dt || !e.kt) { const o = e.dt || e.kt; if (!Acc.isOff(o)) return t('Provodkada debet va kredit schyoti bo\'lishi kerak'); }
    }
    return '';
  }
  A.checkEntries = checkEntries;

  function openRec(rec) {
    if (!rec) return;
    if (rec.kind === 'doc') { S.editDoc = { doc: JSON.parse(JSON.stringify(A.byId(rec.id))) }; S.view = 'docs'; return; }
    if (rec.kind === 'journal') { S.view = 'accounting'; return; }
    Forms.editRec(rec.kind, A.byId(rec.id));
  }

  /* Boshlang'ich qoldiqlar formasi */
  C['opening-form'] = {
    props: { value: Object },
    data() { const v = JSON.parse(JSON.stringify(this.value)); if (!v.rows.length) v.rows.push({ acc: '', dt: null, kt: null }); return { v, err: '' }; },
    computed: {
      tdt() { return this.v.rows.reduce((s, r) => s + (Number(r.dt) || 0), 0); },
      tkt() { return this.v.rows.reduce((s, r) => s + (Number(r.kt) || 0), 0); }
    },
    methods: {
      async save() {
        this.err = '';
        if (!this.v.date) return (this.err = t('Sanani kiriting'));
        const rows = this.v.rows.filter((r) => r.acc || Number(r.dt) || Number(r.kt));
        const accs = Acc.list(S.recs);
        for (const r of rows) { const a = accs.find((x) => x.code === r.acc); if (!a) return (this.err = t('"{0}" schyoti topilmadi', r.acc || '?')); if (!a.postable) return (this.err = t('"{0}" guruh schyoti. Uning ichidagi schyotni tanlang', r.acc)); }
        if (Math.abs(this.tdt - this.tkt) > 0.005 && !(await A.ask(t('Debet ({0}) va kredit ({1}) teng emas. Baribir saqlansinmi?', A.money(this.tdt), A.money(this.tkt)), t('Saqlash')))) return;
        try { await A.saveRec('opening', { ...this.v, rows }); A.toast(t('Saqlandi')); A.closeModal(true); } catch (e) { this.err = A.errText(e); }
      }
    },
    template: `
    <x-modal :title="t('Boshlang\\'ich qoldiqlar')" wide @close="closeModal()">
      <div class="fld"><label for="op-date">{{t('Qaysi sanaga')}}</label><input id="op-date" type="date" v-model="v.date" style="max-width:200px"></div>
      <div class="tbl-wrap" style="margin-top:.8rem"><table class="tbl edit compact">
        <thead><tr><th>{{t('Schyot')}}</th><th class="num">{{t('Debet')}}</th><th class="num">{{t('Kredit')}}</th><th></th></tr></thead>
        <tbody><tr v-for="(r,i) in v.rows" :key="i"><td><acc-select v-model="r.acc"></acc-select></td>
          <td class="num"><input type="number" step="any" class="num" v-model.number="r.dt" :aria-label="t('Debet')"></td><td class="num"><input type="number" step="any" class="num" v-model.number="r.kt" :aria-label="t('Kredit')"></td>
          <td><button class="icon-btn" @click="v.rows.splice(i,1)" :aria-label="t('Qatorni o\\'chirish')">✕</button></td></tr></tbody>
        <tfoot><tr><td>{{t('Jami')}}</td><td class="num mono">{{money(tdt)}}</td><td class="num mono">{{money(tkt)}}</td><td></td></tr></tfoot>
      </table></div>
      <button class="btn ghost sm" @click="v.rows.push({acc:'',dt:null,kt:null})" style="margin-top:.5rem">+ {{t('Qator qo\\'shish')}}</button>
      <p class="note" :class="{warnp: Math.abs(tdt-tkt) > 0.005}">{{ Math.abs(tdt-tkt) > 0.005 ? t('Farq: {0}. Odatda debet va kredit jami teng bo\\'ladi.', money(tdt-tkt)) : t('Debet va kredit teng') }}</p>
      <p class="err" v-if="err">{{err}}</p>
      <template #footer><span class="grow"></span><button class="btn ghost" @click="closeModal()">{{t('Bekor qilish')}}</button><button class="btn primary" @click="save">{{t('Saqlash')}}</button></template>
    </x-modal>`
  };

  /* ---------------- Kirim-chiqim tahlili (filtr) ---------------- */
  C['lines-view'] = {
    data() {
      const y = A.today().slice(0, 4);
      return { act: '', tag: '', from: y + '-01-01', to: A.today(), types: ['receipt', 'sale'], name: '', mxik: '', unit: '', wh: '', cp: '', vat: '', ptype: '', pmin: null, pmax: null, smin: null, smax: null, group: false };
    },
    computed: {
      all() {
        const out = [];
        for (const d of A.recsOf('doc')) {
          const c = S.calc.docCalc[d.id]; if (!c) continue;
          (d.lines || []).forEach((l, i) => {
            const p = A.byId(l.p) || {}; const lc = c.lines[i] || {};
            const qty = d.type === 'inventory' ? lc.diff || 0 : Number(l.qty) || 0;
            out.push({ id: d.id + '-' + i, doc: d, date: d.date, number: d.number, type: d.type, cp: d.cp, wh: d.wh, p: l.p, mxik: p.mxik || '', name: (p.name || '') + (l.lname ? ' — ' + l.lname : ''), ptype: p.ptype || 'goods',
              unit: l.u || p.unit, baseUnit: p.unit, qty, sq: d.type === 'inventory' ? qty : (lc.sq !== undefined ? lc.sq : qty), price: Number(l.price) || 0, vtype: lc.vtype || l.vat || '', vatp: l.vatp,
              base: lc.base || 0, vat: lc.vat || 0, total: lc.total || 0, cost: E.r2(Math.abs(lc.cost || 0)), act: l.act || '', tag: l.tag || '' });
          });
        }
        return out;
      },
      units() { return [...new Set(this.all.map((r) => r.unit).filter(Boolean))]; },
      rows() {
        const n = this.name.trim().toLowerCase();
        const vb = (v) => (v === 'zero' ? 'custom' : v);
        let r = this.all.filter((x) => (!this.from || x.date >= this.from) && (!this.to || x.date <= this.to) && (!this.types.length || this.types.includes(x.type))
          && (!n || x.name.toLowerCase().includes(n) || window.Translit.cyr2lat(x.name).toLowerCase().includes(n) || x.name.toLowerCase().includes(window.Translit.lat2cyr(n).toLowerCase())) && (!this.mxik || x.mxik.startsWith(this.mxik.trim())) && (!this.unit || x.unit === this.unit)
          && (!this.wh || x.wh === this.wh || x.doc.wh2 === this.wh) && (!this.cp || x.cp === this.cp) && (!this.vat || vb(x.vtype) === this.vat) && (!this.ptype || x.ptype === this.ptype) && (!this.act || x.act === this.act) && (!this.tag.trim() || x.tag.toLowerCase().includes(this.tag.trim().toLowerCase()))
          && (this.pmin === null || this.pmin === '' || x.price >= this.pmin) && (this.pmax === null || this.pmax === '' || x.price <= this.pmax)
          && (this.smin === null || this.smin === '' || x.total >= this.smin) && (this.smax === null || this.smax === '' || x.total <= this.smax));
        r = r.sort((a, b) => (a.date < b.date ? 1 : -1));
        if (!this.group) return r;
        const m = {};
        for (const x of r) {
          const k = x.p + '|' + x.type; const g = (m[k] = m[k] || { id: k, type: x.type, mxik: x.mxik, name: x.name, unit: x.baseUnit, sq: 0, base: 0, vat: 0, total: 0, cost: 0, n: 0 });
          g.sq += x.sq; g.base += x.base; g.vat += x.vat; g.total += x.total; g.cost += x.cost; g.n++;
        }
        return Object.values(m).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      },
      cols() {
        const money = (k, l) => ({ k, label: l, num: true, f: (r) => A.money(r[k]) });
        if (this.group) return [{ k: 'type', label: 'Turi', f: (r) => t(A.DOC_LABEL[r.type]) }, { k: 'mxik', label: 'MXIK', mono: true }, { k: 'name', label: 'Mahsulot' }, { k: 'unit', label: "O'lchov", f: (r) => A.unitName(r.unit) },
          { k: 'sq', label: 'Miqdor', num: true, f: (r) => A.qty(r.sq) }, { k: 'n', label: 'Qatorlar', num: true }, money('base', 'QQSsiz'), money('vat', 'QQS'), money('total', 'Jami'), money('cost', 'Tannarx')];
        return [{ k: 'date', label: 'Sana', f: (r) => A.dateFmt(r.date), x: (r) => r.date }, { k: 'number', label: '№', mono: true }, { k: 'type', label: 'Turi', f: (r) => t(A.DOC_LABEL[r.type]) },
          { k: 'cpn', label: 'Kontragent', f: (r) => (A.byId(r.cp) || {}).name || '' }, { k: 'whn', label: 'Ombor', f: (r) => (A.byId(r.wh) || {}).name || '' },
          { k: 'mxik', label: 'MXIK', mono: true }, { k: 'name', label: 'Mahsulot' }, { k: 'unit', label: "O'lchov", f: (r) => A.unitName(r.unit) },
          { k: 'qty', label: 'Miqdor', num: true, f: (r) => A.qty(r.qty) }, { k: 'price', label: 'Narx', num: true, f: (r) => A.money(r.price) },
          { k: 'vtype', label: 'QQS turi', f: (r) => (r.vtype ? A.vatLabel(r.vtype, r.vatp) : '') }, money('base', 'QQSsiz'), money('vat', 'QQS'), money('total', 'Jami'), money('cost', 'Tannarx'),
          { k: 'act', label: 'Faoliyat turi', f: (r) => A.actName(r.act) }, { k: 'tag', label: 'Belgi' }];
      },
      foot() { const s = (k) => this.rows.reduce((a, r) => a + (r[k] || 0), 0); return { base: s('base'), vat: s('vat'), total: s('total'), cost: s('cost') }; }
    },
    methods: {
      tog(k) { const i = this.types.indexOf(k); if (i >= 0) this.types.splice(i, 1); else this.types.push(k); },
      reset() { Object.assign(this, { act: '', tag: '', name: '', mxik: '', unit: '', wh: '', cp: '', vat: '', ptype: '', pmin: null, pmax: null, smin: null, smax: null }); },
      open(r) { if (r.doc) { S.editDoc = { doc: JSON.parse(JSON.stringify(A.byId(r.doc.id))) }; S.view = 'docs'; } }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Kirim-chiqim tahlili')}}</h1><p class="muted">{{t('Har bir kirgan va chiqqan mahsulot alohida qator. Istalgan belgisi bo\\'yicha filtrlang')}}</p></div></header>
      <div class="chips"><button v-for="(l,k) in DOC_LABEL" :key="k" class="chip" :class="{on:types.includes(k)}" @click="tog(k)">{{t(l)}}</button></div>
      <div class="filter-grid">
        <label class="fld"><span>{{t('Dan')}}</span><input type="date" v-model="from" id="ln-from"></label>
        <label class="fld"><span>{{t('Gacha')}}</span><input type="date" v-model="to" id="ln-to"></label>
        <label class="fld"><span>{{t('Mahsulot nomi')}}</span><input v-model="name" id="ln-name"></label>
        <label class="fld"><span>MXIK</span><input v-model="mxik" class="mono" id="ln-mxik" :placeholder="t('kod boshi')"></label>
        <label class="fld"><span>{{t("O'lchov birligi")}}</span><select v-model="unit" id="ln-unit"><option value="">{{t('Hammasi')}}</option><option v-for="u in units" :key="u" :value="u">{{unitName(u)}}</option></select></label>
        <label class="fld"><span>{{t('Ombor')}}</span><select v-model="wh" id="ln-wh"><option value="">{{t('Hammasi')}}</option><option v-for="w in recsOf('warehouse')" :key="w.id" :value="w.id">{{w.name}}</option></select></label>
        <label class="fld"><span>{{t('Kontragent')}}</span><select v-model="cp" id="ln-cp"><option value="">{{t('Hammasi')}}</option><option v-for="o in Forms.cpOpts()" :key="o[0]" :value="o[0]">{{o[1]}}</option></select></label>
        <label class="fld"><span>{{t('QQS turi')}}</span><select v-model="vat" id="ln-vat"><option value="">{{t('Hammasi')}}</option><option v-for="o in Forms.vatOpts()" :key="o[0]" :value="o[0]">{{o[1]}}</option></select></label>
        <label class="fld"><span>{{t('Turi')}}</span><select v-model="ptype" id="ln-pt"><option value="">{{t('Hammasi')}}</option><option value="goods">{{t('Tovar')}}</option><option value="produced">{{t('Ishlab chiqariladi')}}</option><option value="service">{{t('Xizmat')}}</option></select></label>
        <label class="fld"><span>{{t('Faoliyat turi')}}</span><select v-model="act" id="ln-act"><option value="">{{t('Hammasi')}}</option><option v-for="o in ACTS" :key="o[0]" :value="o[0]">{{t(o[1])}}</option></select></label>
        <label class="fld"><span>{{t('Belgi')}}</span><input v-model="tag" id="ln-tag" :placeholder="t('so\\'z yoki raqam')"></label>
        <label class="fld"><span>{{t('Narx, dan / gacha')}}</span><div class="row-gap"><input type="number" step="any" class="num" v-model.number="pmin" id="ln-pmin"><input type="number" step="any" class="num" v-model.number="pmax" id="ln-pmax"></div></label>
        <label class="fld"><span>{{t('Jami summa, dan / gacha')}}</span><div class="row-gap"><input type="number" step="any" class="num" v-model.number="smin" id="ln-smin"><input type="number" step="any" class="num" v-model.number="smax" id="ln-smax"></div></label>
        <div class="fld fl-actions"><label class="check"><input type="checkbox" v-model="group" id="ln-grp"> <span>{{t('Mahsulot bo\\'yicha jamlash')}}</span></label><button class="btn ghost sm" @click="reset">{{t('Filtrni tozalash')}}</button></div>
      </div>
      <data-table :cols="cols" :rows="rows" :foot="foot" :clickable="!group" @row="open" export-name="kirim_chiqim_tahlili" :export-title="S.firm.name + ' — ' + t('Kirim-chiqim tahlili') + ' ' + dateFmt(from) + ' – ' + dateFmt(to)"></data-table>
    </section>`
  };

  /* ---------------- Statistika: faoliyat turlari bo'yicha daromad va foyda ---------------- */
  C['stats-view'] = {
    data() { const y = A.today().slice(0, 4); return { from: y + '-01-01', to: A.today() }; },
    computed: {
      data() {
        const keys = ['prod', 'resale', 'service', 'none', ''];
        const z = () => ({ rev: 0, ret: 0, cost: 0, n: 0 });
        const tot = Object.fromEntries(keys.map((k) => [k, z()]));
        const months = {};
        for (const d of A.recsOf('doc')) {
          if (d.type !== 'sale' && d.type !== 'return_in') continue;
          if ((this.from && d.date < this.from) || (this.to && d.date > this.to)) continue;
          const c = S.calc.docCalc[d.id]; if (!c) continue;
          (d.lines || []).forEach((l, i) => {
            const lc = c.lines[i] || {}; const k = keys.includes(l.act) ? l.act || '' : '';
            const m = (months[d.date.slice(0, 7)] = months[d.date.slice(0, 7)] || Object.fromEntries(keys.map((x) => [x, z()])));
            for (const x of [tot[k], m[k]]) {
              if (d.type === 'sale') { x.rev += lc.base || 0; x.cost += lc.cost || 0; x.n++; }
              else { x.ret += lc.base || 0; x.cost -= lc.cost || 0; }
            }
          });
        }
        const fin = (x) => { const net = x.rev - x.ret; const gp = net - x.cost; return { ...x, net: E.r2(net), cost: E.r2(x.cost), gp: E.r2(gp), margin: net ? gp / net * 100 : 0 }; };
        return { tot: Object.fromEntries(keys.map((k) => [k, fin(tot[k])])), months: Object.entries(months).sort().map(([ym, v]) => ({ ym, ...Object.fromEntries(keys.map((k) => [k, fin(v[k])])) })) };
      },
      rows() {
        const L = [['prod', "O'zi ishlab chiqargan"], ['resale', 'Oldi-sotdi'], ['service', "Xizmat ko'rsatish"], ['none', 'Ishtirok etmaydi'], ['', 'Belgilanmagan']];
        return L.map(([k, l]) => ({ k, l, ...this.data.tot[k] })).filter((r) => r.k !== '' || r.n || r.ret);
      },
      inc() { return this.rows.filter((r) => r.k !== 'none'); },
      sum() { const s = (f) => this.inc.reduce((a, r) => a + r[f], 0); const net = s('net'), gp = s('gp'); return { net, cost: s('cost'), gp, margin: net ? gp / net * 100 : 0 }; },
      maxNet() { return Math.max(1, ...this.rows.map((r) => Math.abs(r.net))); }
    },
    methods: {
      pct(v) { return (Math.round(v * 10) / 10).toLocaleString('ru-RU') + '%'; },
      async exp() {
        const H = ['Faoliyat turi', 'Sotuv qatorlari', 'Tushum (QQSsiz)', 'Qaytarilgan', 'Sof tushum', 'Tannarx', 'Yalpi foyda', 'Rentabellik %'].map((x) => t(x));
        const rows = this.rows.map((r) => [t(r.l), r.n, E.r2(r.rev), E.r2(r.ret), r.net, r.cost, r.gp, Math.round(r.margin * 10) / 10]);
        rows.push([t('Jami (ishtirok etmaydiganlarsiz)'), '', '', '', E.r2(this.sum.net), E.r2(this.sum.cost), E.r2(this.sum.gp), Math.round(this.sum.margin * 10) / 10]);
        const mH = [t('Oy'), ...['prod', 'resale', 'service'].flatMap((k) => [A.actName(k) + ': ' + t('Sof tushum'), A.actName(k) + ': ' + t('Yalpi foyda')])];
        const mRows = this.data.months.map((m) => [A.monthName(m.ym), ...['prod', 'resale', 'service'].flatMap((k) => [m[k].net, m[k].gp])]);
        await Excel.exportXlsx('statistika.xlsx', [{ name: t('Statistika'), title: S.firm.name + ' — ' + t('Faoliyat turlari bo\'yicha foyda') + ' ' + A.dateFmt(this.from) + ' – ' + A.dateFmt(this.to), header: H, rows },
          { name: t('Oylar bo\'yicha'), header: mH, rows: mRows }]);
      }
    },
    template: `
    <section class="page">
      <header class="page-h"><div><h1>{{t('Statistika')}}</h1><p class="muted">{{t('Sotuvlarda belgilangan faoliyat turi bo\\'yicha daromad va yalpi foyda')}}</p></div>
        <div class="row-gap wrap"><label class="inline"><span>{{t('Dan')}}</span><input type="date" v-model="from" id="st2-from"></label><label class="inline"><span>{{t('Gacha')}}</span><input type="date" v-model="to" id="st2-to"></label>
        <button class="btn ghost sm" @click="exp">⤓ Excel</button></div></header>
      <div class="kpis">
        <kpi v-for="r in rows.filter(x => ['prod','resale','service'].includes(x.k))" :key="r.k" :label="t(r.l)" :value="money(r.gp)" :sub="t('Sof tushum: {0} · rentabellik {1}', money(r.net), pct(r.margin))" :tone="r.gp < 0 ? 'warn' : ''"></kpi>
        <kpi :label="t('Jami yalpi foyda')" :value="money(sum.gp)" :sub="t('Sof tushum: {0} · rentabellik {1}', money(sum.net), pct(sum.margin))"></kpi>
      </div>
      <div class="panel">
        <h2>{{t('Faoliyat turlari bo\\'yicha')}}</h2>
        <div class="tbl-wrap"><table class="tbl compact report">
          <thead><tr><th>{{t('Faoliyat turi')}}</th><th class="num">{{t('Sotuv qatorlari')}}</th><th class="num">{{t('Sof tushum')}}</th><th class="num">{{t('Tannarx')}}</th><th class="num">{{t('Yalpi foyda')}}</th><th class="num">{{t('Rentabellik %')}}</th><th class="barcol"></th></tr></thead>
          <tbody><tr v-for="r in rows" :key="r.k" :class="{dim: r.k==='none' || r.k===''}"><td>{{t(r.l)}}</td><td class="num mono">{{r.n}}</td><td class="num mono">{{money(r.net)}}</td><td class="num mono">{{money(r.cost)}}</td>
            <td class="num mono strong" :class="{neg: r.gp < 0}">{{money(r.gp)}}</td><td class="num mono">{{pct(r.margin)}}</td>
            <td class="barcol"><div class="bar"><span :style="{width: Math.max(0, r.net) / maxNet * 100 + '%'}"></span><span class="gp" :style="{width: Math.max(0, r.gp) / maxNet * 100 + '%'}"></span></div></td></tr></tbody>
          <tfoot><tr><td>{{t('Jami (ishtirok etmaydiganlarsiz)')}}</td><td></td><td class="num mono">{{money(sum.net)}}</td><td class="num mono">{{money(sum.cost)}}</td><td class="num mono strong">{{money(sum.gp)}}</td><td class="num mono">{{pct(sum.margin)}}</td><td></td></tr></tfoot>
        </table></div>
        <p class="legend small muted"><span class="lg net"></span> {{t('Sof tushum')}} <span class="lg gp"></span> {{t('Yalpi foyda')}}</p>
      </div>
      <div class="panel" v-if="data.months.length">
        <h2>{{t('Oylar bo\\'yicha')}}</h2>
        <div class="tbl-wrap"><table class="tbl compact report">
          <thead><tr><th>{{t('Oy')}}</th><th class="num" v-for="k in ['prod','resale','service']" :key="k">{{actName(k)}}</th><th class="num">{{t('Jami yalpi foyda')}}</th></tr></thead>
          <tbody><tr v-for="m in data.months" :key="m.ym"><td>{{monthName(m.ym)}}</td>
            <td class="num mono" v-for="k in ['prod','resale','service']" :key="k" :title="t('Sof tushum: {0}', money(m[k].net))">{{money(m[k].gp)}}</td>
            <td class="num mono strong">{{money(m.prod.gp + m.resale.gp + m.service.gp + m[''].gp)}}</td></tr></tbody>
        </table></div>
        <p class="note">{{t('Jadvalda yalpi foyda ko\\'rsatilgan (sof tushum − sotilgan mahsulot tannarxi). Sichqonchani raqam ustiga olib borsangiz, sof tushum chiqadi.')}}</p>
      </div>
      <p class="note">{{t('Yalpi foyda = sof tushum (QQSsiz, qaytarishlar chegirilgan) − sotilgan mahsulot tannarxi. Umumiy xarajatlar (ish haqi, ijara va b.) faoliyat turlariga taqsimlanmaydi. "Ishtirok etmaydi" deb belgilangan sotuvlar jamiga qo\\'shilmaydi.')}}</p>
    </section>`
  };
})();
