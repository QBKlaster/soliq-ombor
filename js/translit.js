/* O'zbek lotin <-> kirill transliteratsiyasi */
(function () {
  const VOW_L = 'aeiouAEIOU';
  const VOW_C = 'аеёиоуўэюяАЕЁИОУЎЭЮЯъьЪЬ';
  const KEEP = /^(Excel|FIFO|Supabase|Vercel|ID|PDF|JSON|URL|e-mail|email|admin|kVt|Gkal|PWA|anon|key)$/;
  const APOS = "'‘’ʻʼ`";

  const L2C = {
    a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н',
    o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'ц', w: 'в'
  };

  function caseLike(src, out) {
    if (src.toUpperCase() === src && src.toLowerCase() !== src) {
      return out.length > 1 && src.length === 1 ? out[0].toUpperCase() + out.slice(1) : out.toUpperCase();
    }
    if (src[0].toUpperCase() === src[0] && src[0].toLowerCase() !== src[0]) return out[0].toUpperCase() + out.slice(1);
    return out;
  }

  function latWord(w) {
    if (KEEP.test(w)) return w;
    let r = '';
    for (let i = 0; i < w.length; i++) {
      const ch = w[i], lo = ch.toLowerCase(), nx = (w[i + 1] || ''), nlo = nx.toLowerCase();
      const prev = r.slice(-1);
      if ((lo === 'o' || lo === 'g') && nx && APOS.includes(nx)) {
        r += caseLike(ch, lo === 'o' ? 'ў' : 'ғ'); i++; continue;
      }
      if (lo === 's' && nlo === 'h') { r += caseLike(ch + nx, 'ш'); i++; continue; }
      if (lo === 'c' && nlo === 'h') { r += caseLike(ch + nx, 'ч'); i++; continue; }
      if (lo === 't' && nlo === 's') { r += caseLike(ch, 'ц'); i++; continue; }
      if (lo === 'y' && 'oauei'.includes(nlo) && nlo) {
        const m = { o: 'ё', u: 'ю', a: 'я', e: 'е', i: 'йи' }[nlo];
        // "yo'" -> йў
        if (nlo === 'o' && w[i + 2] && APOS.includes(w[i + 2])) { r += caseLike(ch, 'й'); continue; }
        r += caseLike(ch + (w[i + 1] || ''), m); i++; continue;
      }
      if (APOS.includes(ch)) { r += (i > 0 && i < w.length - 1) ? 'ъ' : ch; continue; }
      if (lo === 'e') {
        const atStart = i === 0 || !/[a-zа-яёўқғҳ]/i.test(w[i - 1]);
        const afterVowel = i > 0 && VOW_L.includes(w[i - 1]);
        r += caseLike(ch, atStart || afterVowel ? 'э' : 'е'); continue;
      }
      if (L2C[lo]) { r += caseLike(ch, L2C[lo]); continue; }
      r += ch;
    }
    return r;
  }

  function lat2cyr(s) {
    if (!s) return s;
    return String(s).replace(/[A-Za-z][A-Za-z'‘’ʻʼ`\-]*/g, (w) => {
      // trailing apostrophe should not become ъ
      return latWord(w);
    });
  }

  const C2L = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
    'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '’', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o‘', 'қ': 'q',
    'ғ': 'g‘', 'ҳ': 'h'
  };
  function cyr2lat(s) {
    if (!s) return s;
    s = String(s);
    let r = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i], lo = ch.toLowerCase();
      const isUp = ch !== lo;
      let out;
      if (lo === 'е') {
        const p = s[i - 1] || ' ';
        out = (!/[а-яёўқғҳ]/i.test(p) || VOW_C.includes(p)) ? 'ye' : 'e';
      } else if (lo === 'ц') {
        const p = s[i - 1] || ' ';
        out = (/[аеиоуэюяў]/i.test(p)) ? 'ts' : 's';
      } else if (C2L[lo] !== undefined) out = C2L[lo];
      else { r += ch; continue; }
      if (isUp && out) {
        const nx = s[i + 1] || '';
        const nextUp = nx && nx !== nx.toLowerCase();
        out = nextUp ? out.toUpperCase() : out[0].toUpperCase() + out.slice(1);
      }
      r += out;
    }
    return r;
  }

  // latin UI text: o' g' -> o‘ g‘
  function prettyLat(s) {
    return String(s).replace(/([oOgG])'/g, '$1‘').replace(/'/g, '’');
  }

  window.Translit = { lat2cyr, cyr2lat, prettyLat };
})();
