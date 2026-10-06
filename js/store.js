/* Ma'lumotlar qatlami: lokal (IndexedDB) yoki bulut (Supabase).
   Ikkala rejim bir xil interfeysga ega. */
(function () {
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const nowIso = () => new Date().toISOString();

  async function sha256(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 0; for (let i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0; } return 'x' + h;
    }
  }

  const DEFAULT_SETTINGS = { vat_rate: 12, vat_rate_red: 6, profit_rate: 15, turnover_rate: 4 };

  /* ---------------- LOKAL REJIM ---------------- */
  function idb() {
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open('soliq-hisob', 2); } catch (e) { return rej(e); }
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        if (ev.oldVersion < 1) {
          db.createObjectStore('users', { keyPath: 'id' });
          db.createObjectStore('firms', { keyPath: 'id' });
          const r = db.createObjectStore('records', { keyPath: 'id' });
          r.createIndex('firm_id', 'firm_id');
          const a = db.createObjectStore('audit', { keyPath: 'id' });
          a.createIndex('firm_id', 'firm_id');
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (ev.oldVersion < 2) {
          // biriktirilgan hujjatlar: ma'lumoti va fayl o'zi alohida
          const f = db.createObjectStore('files', { keyPath: 'id' });
          f.createIndex('firm_id', 'firm_id');
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  function makeMem() {
    const stores = { users: new Map(), firms: new Map(), records: new Map(), audit: new Map(), meta: new Map(), files: new Map(), blobs: new Map() };
    const keyOf = (s, v) => (s === 'meta' ? v.key : v.id);
    return {
      async all(s, idx, val) { const arr = [...stores[s].values()]; return idx ? arr.filter((x) => x[idx] === val) : arr; },
      async get(s, k) { return stores[s].get(k); },
      async put(s, v) { stores[s].set(keyOf(s, v), JSON.parse(JSON.stringify(v))); },
      async del(s, k) { stores[s].delete(k); },
      async clear(s) { stores[s].clear(); },
      async putRaw(s, v) { stores[s].set(v.id, v); },
      persistent: false
    };
  }

  async function makeIdb() {
    const db = await idb();
    const tx = (s, mode) => db.transaction(s, mode).objectStore(s);
    const p = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    return {
      async all(s, idx, val) { const st = tx(s, 'readonly'); return p(idx ? st.index(idx).getAll(val) : st.getAll()); },
      async get(s, k) { return p(tx(s, 'readonly').get(k)); },
      async put(s, v) { return p(tx(s, 'readwrite').put(JSON.parse(JSON.stringify(v)))); },
      async del(s, k) { return p(tx(s, 'readwrite').delete(k)); },
      async clear(s) { return p(tx(s, 'readwrite').clear()); },
      async putRaw(s, v) { return p(tx(s, 'readwrite').put(v)); },
      persistent: true
    };
  }

  async function LocalBackend() {
    let kv;
    try { kv = await makeIdb(); } catch (e) { kv = makeMem(); }
    // birinchi ishga tushirish: admin / admin
    const users = await kv.all('users');
    if (!users.length) {
      const salt = uid();
      await kv.put('users', { id: uid(), login: 'admin', full_name: 'Bosh admin', role: 'admin', firm_limit: 999, active: true, expires_at: '', salt, pass_hash: await sha256(salt + 'admin'), must_change: true, created_at: nowIso() });
    }
    let current = null;
    try { const sid = localStorage.getItem('sh_session'); if (sid) { const u = await kv.get('users', sid); if (u && u.active) current = u; } } catch (e) { }

    async function delFirmFiles(firmId) { for (const f of await kv.all('files', 'firm_id', firmId)) { await kv.del('blobs', f.id); await kv.del('files', f.id); } }
    const clean = (u) => { if (!u) return u; const c = { ...u }; delete c.pass_hash; delete c.salt; return c; };

    return {
      mode: 'local',
      persistent: kv.persistent,
      user() { return clean(current); },
      async login(login, pass) {
        const all = await kv.all('users');
        const u = all.find((x) => x.login.toLowerCase() === String(login).trim().toLowerCase());
        if (!u || (await sha256(u.salt + pass)) !== u.pass_hash) throw new Error('ERR_LOGIN');
        if (!u.active) throw new Error('ERR_BLOCKED');
        if (u.expires_at && u.expires_at < new Date().toISOString().slice(0, 10)) throw new Error('ERR_EXPIRED');
        current = u;
        try { localStorage.setItem('sh_session', u.id); } catch (e) { }
        return clean(u);
      },
      async logout() { current = null; try { localStorage.removeItem('sh_session'); } catch (e) { } },
      async checkSession() { if (!current) return true; const u = await kv.get('users', current.id); return !!(u && u.active); },
      async changePassword(newPass) {
        const u = await kv.get('users', current.id);
        u.salt = uid(); u.pass_hash = await sha256(u.salt + newPass); u.must_change = false;
        await kv.put('users', u); current = u; return clean(u);
      },
      async listUsers() { return (await kv.all('users')).map(clean); },
      async deleteUser(id) {
        const u = await kv.get('users', id);
        if (!u) return;
        if (u.id === current.id) throw new Error('ERR_SELF_DELETE');
        if (u.role === 'admin') throw new Error('ERR_NOT_ALLOWED');
        if (current.role !== 'admin' && !(current.role === 'manager' && (current.perms || {}).users && (!u.role || u.role === 'accountant'))) throw new Error('ERR_NOT_ALLOWED');
        for (const f of (await kv.all('firms')).filter((x) => x.owner_id === id)) {
          for (const r of await kv.all('records', 'firm_id', f.id)) await kv.del('records', r.id);
          for (const a of await kv.all('audit', 'firm_id', f.id)) await kv.del('audit', a.id);
          await delFirmFiles(f.id);
          await kv.del('firms', f.id);
        }
        await kv.del('users', id);
      },
      async saveUser(data, password) {
        const all = await kv.all('users');
        if (all.some((x) => x.login.toLowerCase() === data.login.toLowerCase() && x.id !== data.id)) throw new Error('ERR_LOGIN_TAKEN');
        let u = data.id ? await kv.get('users', data.id) : null;
        if (!u) u = { id: uid(), created_at: nowIso(), role: 'accountant' };
        Object.assign(u, { login: data.login.trim(), full_name: data.full_name, firm_limit: Number(data.firm_limit) || 0, active: !!data.active, expires_at: data.expires_at || '', phone: data.phone || '' });
        if (current && current.role === 'admin' && data.role && u.role !== 'admin') { u.role = data.role; u.perms = data.perms || {}; }
        if (password) { u.salt = uid(); u.pass_hash = await sha256(u.salt + password); u.must_change = true; }
        await kv.put('users', u); return clean(u);
      },
      /* yangiliklar, reklama, soliq kalendari (umumiy, firmaga bog'lanmagan) */
      async listContent() { return (await kv.all('meta')).filter((m) => String(m.key).startsWith('c:')).map((m) => m.value); },
      async saveContent(item) { const it = { ...item, id: item.id || uid(), updated_at: nowIso() }; if (!it.created_at) it.created_at = nowIso(); await kv.put('meta', { key: 'c:' + it.id, value: it }); return it; },
      async deleteContent(id) { await kv.del('meta', 'c:' + id); },
      async getSettings() { const m = await kv.get('meta', 'settings'); return { ...DEFAULT_SETTINGS, ...(m ? m.value : {}) }; },
      async saveSettings(s) { await kv.put('meta', { key: 'settings', value: s }); },
      async listFirms() {
        const all = await kv.all('firms');
        const seeAll = current.role === 'admin' || (current.role === 'manager' && current.perms && current.perms.firms);
        return seeAll ? all : all.filter((f) => f.owner_id === current.id);
      },
      async saveFirm(f) {
        const isNew = !f.id;
        if (isNew) {
          const mine = (await kv.all('firms')).filter((x) => x.owner_id === current.id);
          if (current.role !== 'admin' && mine.length >= (current.firm_limit || 0)) throw new Error('ERR_FIRM_LIMIT');
          f = { ...f, id: uid(), owner_id: f.owner_id || current.id, created_at: nowIso() };
        }
        await kv.put('firms', f); return f;
      },
      async deleteFirm(id) {
        const recs = await kv.all('records', 'firm_id', id);
        for (const r of recs) await kv.del('records', r.id);
        await delFirmFiles(id);
        await kv.del('firms', id);
      },
      /* biriktirilgan hujjatlar */
      async listFiles(firmId) { return kv.all('files', 'firm_id', firmId); },
      async addFile(meta, blob) { await kv.putRaw('blobs', { id: meta.id, blob }); await kv.put('files', meta); return meta; },
      async fileUrl(meta) { const b = await kv.get('blobs', meta.id); if (!b) throw new Error('ERR_FILE_MISSING'); return URL.createObjectURL(b.blob); },
      async deleteFile(meta) { await kv.del('blobs', meta.id); await kv.del('files', meta.id); },
      async loadRecords(firmId) { return kv.all('records', 'firm_id', firmId); },
      async putRecord(r) { await kv.put('records', r); return r; },
      async putRecords(arr) { for (const r of arr) await kv.put('records', r); },
      async deleteRecord(id) { await kv.del('records', id); },
      async addAudit(a) { await kv.put('audit', { id: uid(), at: nowIso(), user_login: current ? current.login : '', ...a }); },
      async listAudit(firmId) { return (await kv.all('audit', 'firm_id', firmId)).sort((a, b) => (a.at < b.at ? 1 : -1)); },
      async exportAll() {
        return { version: 1, exported_at: nowIso(), users: await kv.all('users'), firms: await kv.all('firms'), records: await kv.all('records'), audit: await kv.all('audit'), meta: await kv.all('meta') };
      },
      async importAll(dump) {
        for (const s of ['users', 'firms', 'records', 'audit', 'meta']) {
          if (!dump[s]) continue;
          await kv.clear(s);
          for (const v of dump[s]) await kv.put(s, v);
        }
      }
    };
  }

  /* ---------------- BULUT REJIMI (Supabase) ---------------- */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  async function SupabaseBackend(cfg) {
    if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    const domain = cfg.loginDomain || 'soliq-hisob.app';
    const toEmail = (login) => (login.includes('@') ? login : login.trim().toLowerCase() + '@' + domain);
    let profile = null;
    const chk = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
    const BUCKET = 'hujjatlar';

    async function loadProfile() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const p = chk(await sb.from('profiles').select('*').eq('id', user.id).single());
      return p;
    }
    try {
      const p = await loadProfile();
      if (p && p.active && p.session_token === localStorage.getItem('sh_token')) profile = p;
      else if (p) await sb.auth.signOut();
    } catch (e) { }

    const firmOut = (row) => ({ ...(row.data || {}), id: row.id, owner_id: row.owner_id, closed_until: row.closed_until || '', created_at: row.created_at });

    return {
      mode: 'cloud',
      persistent: true,
      user() { return profile; },
      async login(login, pass) {
        const r = await sb.auth.signInWithPassword({ email: toEmail(login), password: pass });
        if (r.error) throw new Error('ERR_LOGIN');
        const p = await loadProfile();
        if (!p || !p.active) { await sb.auth.signOut(); throw new Error('ERR_BLOCKED'); }
        if (p.expires_at && p.expires_at < new Date().toISOString().slice(0, 10)) { await sb.auth.signOut(); throw new Error('ERR_EXPIRED'); }
        const token = uid();
        chk(await sb.rpc('claim_session', { token }));
        localStorage.setItem('sh_token', token);
        profile = { ...p, session_token: token };
        return profile;
      },
      async logout() { profile = null; localStorage.removeItem('sh_token'); await sb.auth.signOut(); },
      async checkSession() {
        if (!profile) return true;
        const r = await sb.from('profiles').select('session_token,active,expires_at').eq('id', profile.id).single();
        if (r.error) return true;
        const today = new Date().toISOString().slice(0, 10);
        return r.data.session_token === localStorage.getItem('sh_token') && r.data.active && !(r.data.expires_at && r.data.expires_at < today);
      },
      async changePassword(newPass) { const r = await sb.auth.updateUser({ password: newPass }); if (r.error) throw new Error(r.error.message); chk(await sb.from('profiles').update({ must_change: false }).eq('id', profile.id)); profile.must_change = false; return profile; },
      async listUsers() { return chk(await sb.from('profiles').select('*').order('created_at')); },
      async deleteUser(id) {
        const r = await sb.rpc('admin_delete_user', { uid: id });
        if (r.error) { const m = r.error.message || ''; throw new Error(m.includes('SELF') ? 'ERR_SELF_DELETE' : m.includes('NOT_ALLOWED') || m.includes('NOT_ADMIN') ? 'ERR_NOT_ALLOWED' : m); }
        // o'chirilgan firmalarning fayllarini omborxonadan tozalaymiz
        const paths = Array.isArray(r.data) ? r.data.filter(Boolean) : [];
        for (let i = 0; i < paths.length; i += 500) { try { await sb.storage.from(BUCKET).remove(paths.slice(i, i + 500)); } catch (e) { } }
      },
      async saveUser(data, password) {
        let id = data.id;
        if (!id) {
          // alohida mijoz orqali ro'yxatdan o'tkazamiz (admin sessiyasi saqlanib qoladi)
          const tmp = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sh-tmp' } });
          const r = await tmp.auth.signUp({ email: toEmail(data.login), password, options: { data: { login: data.login.trim().toLowerCase(), full_name: data.full_name } } });
          if (r.error) throw new Error(r.error.message.includes('registered') ? 'ERR_LOGIN_TAKEN' : r.error.message);
          id = r.data.user.id;
        } else if (password) {
          chk(await sb.rpc('admin_set_password', { uid: id, new_password: password }));
        }
        const upd = { full_name: data.full_name, firm_limit: Number(data.firm_limit) || 0, active: !!data.active, expires_at: data.expires_at || null, phone: data.phone || '' };
        if (profile.role === 'admin' && data.role && data.role !== 'admin') { upd.role = data.role; upd.perms = data.perms || {}; }
        if (password) upd.must_change = true;
        chk(await sb.from('profiles').update(upd).eq('id', id));
        return { ...data, id };
      },
      async listContent() { return chk(await sb.from('content').select('*').order('created_at', { ascending: false })).map((r) => ({ ...(r.data || {}), id: r.id, kind: r.kind, created_at: r.created_at })); },
      async saveContent(item) {
        const { id, kind, created_at, ...data } = item; const nid = id || uid();
        const r = await sb.from('content').upsert({ id: nid, kind, data }).select().single(); chk(r);
        return { ...data, id: nid, kind, created_at: r.data.created_at };
      },
      async deleteContent(id) { chk(await sb.from('content').delete().eq('id', id)); },
      async getSettings() { const r = await sb.from('settings').select('data').eq('id', 1).maybeSingle(); return { ...DEFAULT_SETTINGS, ...((r.data && r.data.data) || {}) }; },
      async saveSettings(s) { chk(await sb.from('settings').upsert({ id: 1, data: s })); },
      async listFirms() {
        let q = sb.from('firms').select('*').order('created_at');
        if (!(profile.role === 'admin' || (profile.role === 'manager' && profile.perms && profile.perms.firms))) q = q.eq('owner_id', profile.id);
        return chk(await q).map(firmOut);
      },
      async saveFirm(f) {
        const { id, owner_id, closed_until, created_at, ...data } = f;
        if (!id) {
          const nid = uid();
          const r = await sb.from('firms').insert({ id: nid, owner_id: owner_id || profile.id, data, closed_until: closed_until || null }).select().single();
          if (r.error) throw new Error(r.error.message.includes('FIRM_LIMIT') ? 'ERR_FIRM_LIMIT' : r.error.message);
          return firmOut(r.data);
        }
        return firmOut(chk(await sb.from('firms').update({ data, closed_until: closed_until || null }).eq('id', id).select().single()));
      },
      async deleteFirm(id) {
        let paths = [];
        try { paths = chk(await sb.from('files').select('path').eq('firm_id', id)).map((x) => x.path); } catch (e) { }
        chk(await sb.from('firms').delete().eq('id', id));
        for (let i = 0; i < paths.length; i += 500) { try { await sb.storage.from(BUCKET).remove(paths.slice(i, i + 500)); } catch (e) { } }
      },
      /* biriktirilgan hujjatlar: ma'lumoti "files" jadvalida, fayl o'zi Storage'da */
      async listFiles(firmId) {
        const r = await sb.from('files').select('*').eq('firm_id', firmId);
        if (r.error) { if (/files|relation|schema/i.test(r.error.message)) return []; throw new Error(r.error.message); }
        return r.data;
      },
      async addFile(meta, blob) {
        const ext = meta.mime === 'application/pdf' ? 'pdf' : meta.mime === 'image/png' ? 'png' : meta.mime === 'image/webp' ? 'webp' : 'jpg';
        const path = meta.firm_id + '/' + meta.rec_id + '/' + meta.id + '.' + ext;
        const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: meta.mime, upsert: false });
        if (up.error) throw new Error(/bucket/i.test(up.error.message) ? 'ERR_NO_BUCKET' : up.error.message);
        const row = { ...meta, path }; delete row.created_by;
        const ins = await sb.from('files').insert(row).select().single();
        if (ins.error) { await sb.storage.from(BUCKET).remove([path]); throw new Error(/files|relation|schema/i.test(ins.error.message) ? 'ERR_NO_BUCKET' : ins.error.message); }
        return ins.data;
      },
      async fileUrl(meta, download) {
        const r = await sb.storage.from(BUCKET).createSignedUrl(meta.path, 3600, download ? { download: meta.name } : undefined);
        if (r.error) throw new Error(r.error.message);
        return r.data.signedUrl;
      },
      async deleteFile(meta) {
        const r = await sb.storage.from(BUCKET).remove([meta.path]);
        if (r.error) throw new Error(r.error.message);
        chk(await sb.from('files').delete().eq('id', meta.id));
      },
      async loadRecords(firmId) {
        const out = []; let from = 0; const step = 1000;
        for (; ;) {
          const rows = chk(await sb.from('records').select('id,firm_id,kind,data,updated_at').eq('firm_id', firmId).range(from, from + step - 1));
          rows.forEach((r) => out.push({ ...r.data, id: r.id, firm_id: r.firm_id, kind: r.kind }));
          if (rows.length < step) break; from += step;
        }
        return out;
      },
      async putRecord(r) {
        const { id, firm_id, kind, ...data } = r;
        const res = await sb.from('records').upsert({ id, firm_id, kind, data, updated_at: nowIso() });
        if (res.error) throw new Error(res.error.message.includes('PERIOD_CLOSED') ? 'ERR_PERIOD_CLOSED' : res.error.message);
        return r;
      },
      async putRecords(arr) {
        for (let i = 0; i < arr.length; i += 500) {
          const rows = arr.slice(i, i + 500).map(({ id, firm_id, kind, ...data }) => ({ id, firm_id, kind, data, updated_at: nowIso() }));
          chk(await sb.from('records').upsert(rows));
        }
      },
      async deleteRecord(id) {
        const res = await sb.from('records').delete().eq('id', id);
        if (res.error) throw new Error(res.error.message.includes('PERIOD_CLOSED') ? 'ERR_PERIOD_CLOSED' : res.error.message);
      },
      async addAudit(a) { await sb.from('audit').insert({ ...a, user_id: profile.id, user_login: profile.login }); },
      async listAudit(firmId) { return chk(await sb.from('audit').select('*').eq('firm_id', firmId).order('at', { ascending: false }).limit(500)); },
      async exportAll() { const firms = await this.listFirms(); const records = []; for (const f of firms) records.push(...(await this.loadRecords(f.id))); return { version: 1, exported_at: nowIso(), firms, records }; },
      async importAll() { throw new Error('ERR_CLOUD_IMPORT'); }
    };
  }

  window.Store = {
    uid, nowIso, DEFAULT_SETTINGS,
    async create() {
      const cfg = window.APP_CONFIG || {};
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) return SupabaseBackend({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey, loginDomain: cfg.loginDomain });
      return LocalBackend();
    }
  };
})();
