/* Biriktirilgan hujjatlar (PDF va rasmlar): avtomatik siqish, yuklash, ko'rish */
(function () {
  const A = window.App; const { S, t } = A;
  const C = (window.Components = window.Components || {});

  const LIM = {
    maxIn: 50 * 1024 * 1024,        // tanlanadigan fayl chegarasi
    maxOut: 10 * 1024 * 1024,       // siqilgandan keyingi chegara
    imgSide: 2000, imgQ: 0.8,        // rasm: uzun tomoni 2000 px, JPEG 80%
    pdfMin: 1024 * 1024,            // 1 MB dan katta PDF siqishga uriniladi
    pdfDpi: 150, pdfQ: 0.7, pdfPages: 80
  };
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(t("Kutubxonani yuklab bo'lmadi"))); document.head.appendChild(s); });
  let pdfLibs = null;
  function loadPdfLibs() {
    if (!pdfLibs) pdfLibs = (async () => {
      if (!window.pdfjsLib) await loadScript(CDN + 'pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + 'pdf.js/3.11.174/pdf.worker.min.js';
      if (!window.jspdf) await loadScript(CDN + 'jspdf/2.5.1/jspdf.umd.min.js');
    })().catch((e) => { pdfLibs = null; throw e; });
    return pdfLibs;
  }

  const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
  const baseName = (n) => String(n || 'fayl').replace(/\.[^.]+$/, '');
  const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

  async function decodeImage(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { } }
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('ERR_IMG_FORMAT')); };
      img.src = url;
    });
  }

  async function compressImage(file) {
    const img = await decodeImage(file);
    const w0 = img.width, h0 = img.height;
    const k = Math.min(1, LIM.imgSide / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    if (img.close) img.close();
    const out = await toBlob(c, 'image/jpeg', LIM.imgQ);
    const keepOrig = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && k === 1 && out && out.size >= file.size;
    if (keepOrig || !out) return { blob: file, mime: file.type, name: file.name };
    return { blob: out, mime: 'image/jpeg', name: baseName(file.name) + '.jpg' };
  }

  async function compressPdf(file, onProgress) {
    const orig = { blob: file, mime: 'application/pdf', name: file.name };
    if (file.size < LIM.pdfMin) return orig;
    await loadPdfLibs();
    const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (doc.numPages > LIM.pdfPages) { doc.destroy(); return orig; }
    const { jsPDF } = window.jspdf; let pdf = null;
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress && onProgress(t('{0}-bet / {1}', i, doc.numPages));
      const page = await doc.getPage(i);
      const v1 = page.getViewport({ scale: 1 });
      const scale = Math.min(LIM.pdfDpi / 72, LIM.imgSide * 1.2 / Math.max(v1.width, v1.height));
      const vp = page.getViewport({ scale });
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      const jpg = c.toDataURL('image/jpeg', LIM.pdfQ);
      const W = v1.width, H = v1.height, o = W > H ? 'l' : 'p';
      if (!pdf) pdf = new jsPDF({ orientation: o, unit: 'pt', format: [W, H], compress: true });
      else pdf.addPage([W, H], o);
      pdf.addImage(jpg, 'JPEG', 0, 0, W, H, undefined, 'FAST');
      page.cleanup();
    }
    doc.destroy();
    const out = pdf.output('blob');
    // matnli PDF lar odatda kichik: siqish 25% dan kam foyda bersa aslini qoldiramiz
    return out.size < file.size * 0.75 ? { blob: out, mime: 'application/pdf', name: file.name } : orig;
  }

  /* Faylni tayyorlash: tekshirish + siqish */
  async function prepare(file, onProgress) {
    if (file.size > LIM.maxIn) throw new Error(t('Fayl juda katta ({0}). Eng ko\'pi 50 MB', fmtSize(file.size)));
    let r;
    if (isPdf(file)) {
      try { r = await compressPdf(file, onProgress); }
      catch (e) { if (file.size > LIM.maxOut) throw e; r = { blob: file, mime: 'application/pdf', name: file.name }; }
    } else if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name)) {
      try { r = await compressImage(file); }
      catch (e) { throw new Error(t("Bu rasmni o'qib bo'lmadi. JPG, PNG yoki PDF ko'rinishida yuklang")); }
    } else throw new Error(t('Faqat PDF yoki rasm (JPG, PNG) yuklash mumkin'));
    if (r.blob.size > LIM.maxOut) throw new Error(t("Siqilgandan keyin ham fayl katta ({0}). Eng ko'pi 10 MB", fmtSize(r.blob.size)));
    return { ...r, size: r.blob.size, orig_size: file.size };
  }

  async function upload(recId, file, onProgress) {
    const p = await prepare(file, onProgress);
    onProgress && onProgress(t('Saqlanmoqda…'));
    const meta = { id: Store.uid(), firm_id: S.firm.id, rec_id: recId, name: p.name, mime: p.mime, size: p.size, orig_size: p.orig_size, created_at: Store.nowIso(), created_by: S.user.login };
    const saved = await S.store.addFile(meta, p.blob);
    S.files.push(saved);
    return saved;
  }

  async function removeFile(meta) {
    await S.store.deleteFile(meta);
    const i = S.files.findIndex((x) => x.id === meta.id);
    if (i >= 0) S.files.splice(i, 1);
  }
  async function removeRecFiles(recId) {
    for (const f of S.files.filter((x) => x.rec_id === recId)) { try { await removeFile(f); } catch (e) { } }
  }
  const countOf = (recId) => S.files.filter((x) => x.rec_id === recId).length;
  const canWrite = () => !!S.user && !!S.firm && (S.user.role === 'admin' || S.firm.owner_id === S.user.id);

  /* Yozuv formasidagi hujjatlar bloki */
  C['file-box'] = {
    props: { recId: String, readonly: Boolean },
    data() { return { pending: [], busy: '', err: '', over: false, thumbs: {} }; },
    computed: {
      list() { return this.recId ? S.files.filter((f) => f.rec_id === this.recId).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) : []; },
      ro() { return this.readonly || !canWrite(); },
      total() { return this.list.reduce((s, f) => s + (f.size || 0), 0) + this.pending.reduce((s, f) => s + f.size, 0); },
      hint() { return t("PDF yoki rasm. Rasmlar va katta PDF lar avtomatik siqiladi. Telefondan suratga olib yuklash ham mumkin"); },
      pickLabel() { return t('Fayl tanlash'); },
      dropLabel() { return t('yoki shu yerga tashlang'); }
    },
    watch: { list: { handler() { this.loadThumbs(); }, immediate: true } },
    beforeUnmount() { Object.values(this.thumbs).forEach((u) => { if (String(u).startsWith('blob:')) URL.revokeObjectURL(u); }); this.pending.forEach((p) => p.thumb && URL.revokeObjectURL(p.thumb)); },
    methods: {
      fmtSize, isImg(f) { return /^image\//.test(f.mime); },
      saved(f) { return f.orig_size && f.orig_size > f.size * 1.05 ? t('{0} dan siqildi', fmtSize(f.orig_size)) : ''; },
      async loadThumbs() {
        for (const f of this.list) {
          if (!this.isImg(f) || this.thumbs[f.id]) continue;
          try { this.thumbs[f.id] = await S.store.fileUrl(f); } catch (e) { }
        }
      },
      pick(ev) { this.add([...ev.target.files]); ev.target.value = ''; },
      drop(ev) { this.over = false; if (this.ro) return; this.add([...((ev.dataTransfer && ev.dataTransfer.files) || [])]); },
      async add(files) {
        if (!files.length) return;
        this.err = '';
        for (const file of files) {
          this.busy = t('{0}: siqilmoqda…', file.name);
          try {
            if (this.recId) await upload(this.recId, file, (s) => (this.busy = file.name + ': ' + s));
            else {
              const p = await prepare(file, (s) => (this.busy = file.name + ': ' + s));
              this.pending.push({ ...p, key: Store.uid(), thumb: /^image\//.test(p.mime) ? URL.createObjectURL(p.blob) : '' });
            }
          } catch (e) { this.err = file.name + ': ' + A.errText(e); }
        }
        this.busy = '';
      },
      /* yangi yozuv saqlangach kutilayotgan fayllarni yuklaymiz */
      async flush(recId) {
        const errs = [];
        for (const p of this.pending.splice(0)) {
          try {
            const meta = { id: Store.uid(), firm_id: S.firm.id, rec_id: recId, name: p.name, mime: p.mime, size: p.size, orig_size: p.orig_size, created_at: Store.nowIso(), created_by: S.user.login };
            S.files.push(await S.store.addFile(meta, p.blob));
          } catch (e) { errs.push(p.name + ': ' + A.errText(e)); }
          if (p.thumb) URL.revokeObjectURL(p.thumb);
        }
        if (errs.length) A.toast(t("Ba'zi fayllar saqlanmadi") + ' — ' + errs.join('; '), 'err');
      },
      async open(f, download) {
        const w = download ? null : window.open('', '_blank');
        try {
          const url = await S.store.fileUrl(f, download);
          if (download) { const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); }
          else if (w) w.location.href = url; else window.location.assign(url);
        } catch (e) { if (w) w.close(); A.toast(A.errText(e), 'err'); }
      },
      async del(f) {
        if (!(await A.ask(t('"{0}" fayli o\'chirilsinmi?', f.name), t("O'chirish"), true))) return;
        try { await removeFile(f); } catch (e) { this.err = A.errText(e); }
      },
      unpend(p) { const i = this.pending.indexOf(p); if (i >= 0) this.pending.splice(i, 1); if (p.thumb) URL.revokeObjectURL(p.thumb); }
    },
    template: `
    <div class="fbox" :class="{over}" @dragover.prevent="over=!ro" @dragleave="over=false" @drop.prevent="drop">
      <ul class="flist" v-if="list.length || pending.length">
        <li v-for="f in list" :key="f.id">
          <button type="button" class="fthumb" @click="open(f)" :title="f.name">
            <img v-if="isImg(f) && thumbs[f.id]" :src="thumbs[f.id]" alt=""><span v-else class="ficon">{{ isImg(f) ? 'IMG' : 'PDF' }}</span>
          </button>
          <div class="fmeta"><button type="button" class="link fname" @click="open(f)">{{f.name}}</button>
            <span class="muted small">{{fmtSize(f.size)}}<template v-if="saved(f)"> · {{saved(f)}}</template> · {{dateFmt((f.created_at||'').slice(0,10))}}</span></div>
          <button type="button" class="btn ghost sm" @click="open(f, true)">⤓</button>
          <button v-if="!ro" type="button" class="icon-btn" @click="del(f)" :aria-label="t('O\\'chirish')">✕</button>
        </li>
        <li v-for="p in pending" :key="p.key" class="pend">
          <span class="fthumb"><img v-if="p.thumb" :src="p.thumb" alt=""><span v-else class="ficon">PDF</span></span>
          <div class="fmeta"><span class="fname">{{p.name}}</span><span class="muted small">{{fmtSize(p.size)}}<template v-if="p.orig_size > p.size*1.05"> · {{t('{0} dan siqildi', fmtSize(p.orig_size))}}</template> · {{t('saqlanganda yuklanadi')}}</span></div>
          <button type="button" class="icon-btn" @click="unpend(p)" :aria-label="t('O\\'chirish')">✕</button>
        </li>
      </ul>
      <div class="fadd" v-if="!ro">
        <label class="btn ghost sm file">+ {{pickLabel}}<input type="file" multiple accept="application/pdf,image/*" @change="pick" class="fbox-input"></label>
        <span class="muted small">{{dropLabel}}</span><span class="grow"></span>
        <span class="muted small" v-if="list.length || pending.length">{{t('Jami: {0}', fmtSize(total))}}</span>
      </div>
      <p class="muted small" v-if="!ro && !list.length && !pending.length">{{hint}}</p>
      <p class="muted small" v-if="ro && !list.length">{{t("Hujjat biriktirilmagan")}}</p>
      <p class="hint ok" v-if="busy"><span class="spin"></span> {{busy}}</p>
      <p class="err" v-if="err">{{err}}</p>
    </div>`
  };

  window.Files = { prepare, upload, removeFile, removeRecFiles, countOf, fmtSize, LIM, loadPdfLibs };
})();
