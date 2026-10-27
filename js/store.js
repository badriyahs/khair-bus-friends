/* Data layer.
   Preview mode (no Firebase config): everything lives in this browser's localStorage,
   with sample data, so the site can be tried straight away.
   Live mode (Firebase config in js/config.js): Firestore, updating live for everyone.

   initiatives/{id}                 title, date, time, place, phone, photo (small image data URL), status, items[{id,name,unit,needed,img}]
   initiatives/{id}/pledges/{pid}   items[{id,qty}], extras[{name,qty}]   (public, no names)
   initiatives/{id}/people/{pid}    name                                  (team only) */
window.Store = (function () {
  const cfg = (window.KBF_CONFIG || {}).firebase;
  const demo = !cfg;
  const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';

  const clone = o => JSON.parse(JSON.stringify(o));
  const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const cleanName = n => String(n || '').trim().slice(0, 80);
  const cleanItems = items => (items || [])
    .map(it => ({ id: String(it.id), qty: Math.max(0, Math.floor(+it.qty || 0)) }))
    .filter(it => it.qty > 0);
  const cleanExtras = list => (list || [])
    .map(x => ({ name: cleanName(x.name), qty: Math.max(1, Math.floor(+x.qty || 1)) }))
    .filter(x => x.name);

  /* ---------- preview mode ---------- */

  const KEY = 'kbf-preview-v7';
  const listeners = new Set();
  let mem = null;

  function readLS() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function db() {
    if (!mem) { mem = readLS(); if (!mem) { mem = seed(); persist(); } }
    return mem;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  function commit() { persist(); listeners.forEach(fn => fn()); }
  function watch(read, cb) {
    const fn = () => cb(clone(read()));
    listeners.add(fn);
    Promise.resolve().then(() => listeners.has(fn) && fn());
    return () => listeners.delete(fn);
  }
  if (demo) {
    // other tabs of the site see changes straight away
    window.addEventListener('storage', e => {
      if (e.key !== KEY) return;
      mem = readLS() || seed();
      listeners.forEach(fn => fn());
    });
  }

  // Preview data: Thursday's sandwich initiative (their poster + checklist), no sign-ups yet
  function seed() {
    const item = (id, name, unit, needed) => ({ id, name, unit, needed, img: `img/items/${id}.jpg` });
    return {
      initiatives: {
        'sandwiches-oct': {
          id: 'sandwiches-oct', title: 'مبادرة تجهيز السندويشات', date: '2026-10-29', time: '6 - 8 مساءً', place: '', phone: '94725505',
          status: 'open', createdAt: Date.now(),
          photo: 'img/events/sandwich-chef.png',
          items: [
            item('toast', 'خبز توست', 'أكياس', 25),
            item('hotdog', 'خبز هوت دوغ', 'أكياس (6 حبات)', 9),
            item('turkey', 'ديك رومي', 'علب', 34),
            item('cheese', 'جبن', 'علب', 15),
            item('cupcakes', 'كب كيك', 'حبات', 300),
            item('crackers', 'بسكوت', 'حبات', 300),
            item('fruit', 'تفاح أو برتقال', 'حبات', 300),
            item('juice', 'عصير', 'علب', 300)
          ]
        }
      },
      pledges: {},
      people: {}
    };
  }

  const previewApi = {
    watchInitiatives: cb => watch(() => Object.values(db().initiatives), cb),
    watchInitiative: (id, cb) => watch(() => db().initiatives[id] || null, cb),
    watchPledges: (id, cb) => watch(() => Object.values(db().pledges[id] || {}), cb),
    watchPeople: (id, cb) => watch(() => Object.values(db().people[id] || {}), cb),

    async pledge(iid, { name, items, extras }) {
      const d = db(), ini = d.initiatives[iid];
      if (!ini || ini.status !== 'open') throw new Error('This initiative is closed');
      const id = newId(), t = Date.now();
      (d.pledges[iid] = d.pledges[iid] || {})[id] = { id, items: cleanItems(items), extras: cleanExtras(extras), createdAt: t };
      (d.people[iid] = d.people[iid] || {})[id] = { id, name: cleanName(name), createdAt: t };
      commit();
      return id;
    },
    async saveInitiative(id, data) {
      const d = db();
      id = id || newId();
      d.initiatives[id] = { ...(d.initiatives[id] || { createdAt: Date.now() }), ...clone(data), id };
      commit();
      return id;
    },
    async deleteInitiative(id) {
      const d = db();
      delete d.initiatives[id]; delete d.pledges[id]; delete d.people[id];
      commit();
    },
    async deletePledge(iid, pid) {
      const d = db();
      if (d.pledges[iid]) delete d.pledges[iid][pid];
      if (d.people[iid]) delete d.people[iid][pid];
      commit();
    },
    async resetPreview() { mem = seed(); commit(); },

    onAuth(cb) { Promise.resolve().then(() => cb({ state: 'in', email: 'Preview mode' })); return () => {}; },
    async signIn() {},
    async signOut() {}
  };

  /* ---------- live mode (Firebase) ---------- */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  let fs = null;
  const ready = demo ? Promise.resolve() : loadScript(FB + 'firebase-app-compat.js')
    .then(() => Promise.all([
      loadScript(FB + 'firebase-firestore-compat.js'),
      window.KBF_ADMIN ? loadScript(FB + 'firebase-auth-compat.js') : null
    ]))
    .then(() => { firebase.initializeApp(cfg); fs = firebase.firestore(); });

  /* Team logins are a username + password. Firebase accounts need an email,
     so a username like "khairbus" is stored as khairbus@<project>.firebaseapp.com. */
  const TEAM_DOMAIN = cfg ? '@' + cfg.authDomain : '';
  const teamEmail = name => {
    const n = String(name || '').trim().toLowerCase();
    return n.includes('@') ? n : n + TEAM_DOMAIN;
  };
  const username = email => String(email || '').replace(TEAM_DOMAIN, '');

  const inis = () => fs.collection('initiatives');
  const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const millis = ts => (ts && ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : Date.now()));
  const fromDoc = d => ({ ...d.data(), id: d.id, createdAt: millis(d.data().createdAt) });

  function live(query, map, cb, onErr) {
    let off = null, stopped = false;
    ready.then(() => {
      if (stopped) return;
      off = query().onSnapshot(s => cb(map(s)), e => onErr && onErr(e));
    }).catch(e => onErr && onErr(e));
    return () => { stopped = true; if (off) off(); };
  }

  const liveApi = {
    watchInitiatives: (cb, onErr) => live(() => inis(), s => s.docs.map(fromDoc), cb, onErr),
    watchInitiative: (id, cb, onErr) => live(() => inis().doc(id), s => (s.exists ? fromDoc(s) : null), cb, onErr),
    watchPledges: (id, cb, onErr) => live(() => inis().doc(id).collection('pledges'), s => s.docs.map(fromDoc), cb, onErr),
    watchPeople: (id, cb, onErr) => live(() => inis().doc(id).collection('people'), s => s.docs.map(fromDoc), cb, onErr),

    async pledge(iid, { name, items, extras }) {
      await ready;
      const ref = inis().doc(iid), p = ref.collection('pledges').doc(), b = fs.batch();
      b.set(p, { items: cleanItems(items), extras: cleanExtras(extras), createdAt: stamp() });
      b.set(ref.collection('people').doc(p.id), { name: cleanName(name), createdAt: stamp() });
      await b.commit();
      return p.id;
    },
    async saveInitiative(id, data) {
      await ready;
      const body = clone(data);
      delete body.id; delete body.createdAt;
      if (id) { await inis().doc(id).update(body); return id; }
      return (await inis().add({ ...body, createdAt: stamp() })).id;
    },
    async deleteInitiative(id) {
      await ready;
      const ref = inis().doc(id);
      for (const sub of ['pledges', 'people']) {
        const snap = await ref.collection(sub).get();
        const b = fs.batch();
        snap.docs.forEach(d => b.delete(d.ref));
        await b.commit();
      }
      await ref.delete();
    },
    async deletePledge(iid, pid) {
      await ready;
      const ref = inis().doc(iid), b = fs.batch();
      b.delete(ref.collection('pledges').doc(pid));
      b.delete(ref.collection('people').doc(pid));
      await b.commit();
    },

    onAuth(cb) {
      let off = null, stopped = false;
      ready.then(() => {
        if (stopped) return;
        // only the team has accounts (made in the Firebase console), so signed in = team
        off = firebase.auth().onAuthStateChanged(user => {
          cb(user ? { state: 'in', email: username(user.email) } : { state: 'out' });
        });
      }).catch(() => cb({ state: 'out', error: true }));
      return () => { stopped = true; if (off) off(); };
    },
    async signIn(name, password) {
      await ready;
      await firebase.auth().signInWithEmailAndPassword(teamEmail(name), password);
    },
    async signOut() { await ready; await firebase.auth().signOut(); }
  };

  return { demo, ready, ...(demo ? previewApi : liveApi) };
})();
