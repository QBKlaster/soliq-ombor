/* MXIK katalogi: 87 ta guruh fayli (gzip), kerak bo'lganda yuklanadi */
(function () {
  const BASE = (window.APP_CONFIG && window.APP_CONFIG.mxikPath) || 'mxik/';
  let index = null, units = null;
  // qidiruv uchun yumshoq solishtirish: ц=с, ё=е, э=е, ъ/ь tashlanadi
  const norm = (s) => String(s).toLowerCase().replace(/ц/g, 'с').replace(/[ёэ]/g, 'е').replace(/щ/g, 'ш').replace(/ы/g, 'и').replace(/[ъь’'‘`]/g, '');
  const cache = {};
  const loading = {};

  async function getIndex() {
    if (!index) index = await (await fetch(BASE + 'index.json')).json();
    return index;
  }
  async function getUnits() {
    if (!units) units = await (await fetch(BASE + 'units.json')).json();
    return units;
  }

  let pakoP = null;
  function pako() {
    if (window.pako) return Promise.resolve(window.pako);
    if (!pakoP) pakoP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'; s.onload = () => res(window.pako); s.onerror = rej; document.head.appendChild(s); });
    return pakoP;
  }

  async function gunzip(buf) {
    let u8 = new Uint8Array(buf);
    // base64 ko'rinishidagi gzip ("H4sI..." bilan boshlanadi)
    if (u8[0] === 0x48 && u8[1] === 0x34 && u8[2] === 0x73 && u8[3] === 0x49) {
      const bin = atob(new TextDecoder().decode(u8).trim());
      u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    }
    if (!(u8[0] === 0x1f && u8[1] === 0x8b)) return new TextDecoder().decode(u8); // server allaqachon ochgan
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(ds).text();
    }
    const p = await pako();
    return p.ungzip(u8, { to: 'string' });
  }

  function loadGroup(g) {
    if (cache[g]) return Promise.resolve(cache[g]);
    if (!loading[g]) {
      loading[g] = (async () => {
        const r = await fetch(BASE + g + ((window.APP_CONFIG && window.APP_CONFIG.mxikExt) || '.gz'));
        if (!r.ok) throw new Error('MXIK ' + g);
        const text = await gunzip(await r.arrayBuffer());
        const rows = text.split('\n').map((l) => {
          const [code, name, u, hint, ben] = l.split('\t');
          return { code, name, units: u ? u.split(',') : [], hint: hint || '', benefit: ben || '', lname: norm(name) };
        });
        cache[g] = rows; return rows;
      })();
    }
    return loading[g];
  }

  async function loadAll(onProgress) {
    const idx = await getIndex();
    let done = 0;
    const q = idx.groups.map((x) => x.g);
    const workers = Array.from({ length: 6 }, async () => {
      while (q.length) { const g = q.shift(); await loadGroup(g); done++; onProgress && onProgress(done, idx.groups.length); }
    });
    await Promise.all(workers);
  }

  function allLoaded() { return index && index.groups.every((x) => cache[x.g]); }

  /* qidiruv: raqam bo'lsa kod boshi bo'yicha, matn bo'lsa nom bo'yicha */
  async function search(q, opts = {}) {
    q = String(q || '').trim();
    const limit = opts.limit || 60;
    if (!q) return { items: [], total: 0, groups: [] };
    const idx = await getIndex();
    if (/^\d+$/.test(q)) {
      if (q.length < 3) {
        const groups = idx.groups.filter((x) => x.g.startsWith(q));
        return { items: [], total: groups.reduce((s, x) => s + x.c, 0), groups };
      }
      const g = q.slice(0, 3);
      if (!idx.groups.some((x) => x.g === g)) return { items: [], total: 0, groups: [] };
      const rows = await loadGroup(g);
      const items = []; let total = 0;
      for (const r of rows) if (r.code.startsWith(q)) { total++; if (items.length < limit) items.push(r); }
      return { items, total, groups: [] };
    }
    // matn bo'yicha: lotincha yozilsa kirillga o'giramiz
    const qq = q.toLowerCase();
    const variants = [norm(qq), norm(window.Translit.lat2cyr(qq))];
    const words = variants.map((v) => v.split(/\s+/).filter(Boolean));
    if (!allLoaded()) await loadAll(opts.onProgress);
    const items = []; let total = 0;
    for (const gr of idx.groups) {
      for (const r of cache[gr.g]) {
        if (words.some((ws) => ws.every((w) => r.lname.includes(w)))) { total++; if (items.length < limit) items.push(r); }
      }
    }
    return { items, total, groups: [] };
  }

  async function get(code) {
    code = String(code || '').trim();
    if (code.length < 3) return null;
    const idx = await getIndex();
    if (!idx.groups.some((x) => x.g === code.slice(0, 3))) return null;
    const rows = await loadGroup(code.slice(0, 3));
    return rows.find((r) => r.code === code) || null;
  }

  window.Mxik = { getIndex, getUnits, search, get, loadAll };
})();
