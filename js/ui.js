/* Small helpers shared by every page. */
window.UI = (function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function parseDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  }
  // Arabic day and date with the 0-9 digits their posters use: "الخميس، 29 أكتوبر"
  function arDate(iso) {
    const d = parseDate(iso);
    return d ? d.toLocaleDateString('ar-KW-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  }
  function when(ms) {
    return new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }
  // "باقي 3 أصناف" with the right Arabic plural
  function itemsLeft(n) {
    if (n === 1) return 'باقي صنف واحد';
    if (n === 2) return 'باقي صنفان';
    if (n <= 10) return `باقي ${n} أصناف`;
    return `باقي ${n} صنفاً`;
  }
  // Titles in the logo's two colours: first word blue, the rest green
  function twoTone(text) {
    const [first, ...rest] = String(text || '').trim().split(/\s+/);
    return `<span class="w1">${esc(first)}</span>${rest.length ? ' ' + esc(rest.join(' ')) : ''}`;
  }
  const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999');

  /* How much of each item is promised. `got` counts everything promised;
     `pct` only counts up to what was needed, so extra never shows over 100%. */
  function tally(ini, pledges) {
    const got = {}, extras = {};
    for (const p of pledges || []) {
      for (const it of p.items || []) got[it.id] = (got[it.id] || 0) + (+it.qty || 0);
      for (const x of p.extras || []) {
        const key = String(x.name).trim().toLowerCase();
        if (!key) continue;
        extras[key] = extras[key] || { name: String(x.name).trim(), qty: 0 };
        extras[key].qty += +x.qty || 0;
      }
    }
    // progress counts each food equally, so 300 juice boxes don't drown out 9 bags of bread
    let need = 0, have = 0, open = 0, share = 0, kinds = 0;
    for (const it of (ini && ini.items) || []) {
      const n = +it.needed || 0;
      need += n;
      have += Math.min(got[it.id] || 0, n);
      if ((got[it.id] || 0) < n) open++;
      if (n) { kinds++; share += Math.min(got[it.id] || 0, n) / n; }
    }
    return { got, extras: Object.values(extras), need, have, open, pct: kinds ? Math.round(share / kinds * 100) : 0 };
  }

  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.6z"/>',
    chev: '<path d="M15 5l-7 7 7 7"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
  };
  // only plain web links (e.g. a Google Maps link), nothing else
  function safeUrl(u) {
    u = String(u || '').trim();
    return /^https?:\/\/\S+$/i.test(u) ? u : '';
  }

  // a WhatsApp chat link; 8-digit numbers are Kuwaiti, so add 965
  function whatsapp(phone, text) {
    let n = String(phone || '').replace(/\D/g, '').replace(/^00/, '');
    if (n.length === 8) n = '965' + n;
    return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
  }

  function icon(name, size = 18) {
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  }

  /* Loading: the bus drives along while the landscape scrolls past (clouds slowest, trees,
     then the crayon road with grass fastest), like a game's loading screen. */
  const tree = (x, s) => `<g transform="translate(${x} ${112 - 30 * s}) scale(${s})">
      <path d="M0 30 V8" stroke="#b07a4a" stroke-width="5" stroke-linecap="round"/>
      <path d="M-14 6 a10 10 0 0 1 4-16 a12 12 0 0 1 21-3 a10 10 0 0 1 6 17 a9 9 0 0 1-12 6 a10 10 0 0 1-19-4z" fill="#7fd858" stroke="#46a015" stroke-width="3" stroke-linejoin="round"/>
    </g>`;
  const cloud = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 14 a9 9 0 0 1 8-12 a12 12 0 0 1 22 0 a8 8 0 0 1 6 12z" fill="#fff" opacity=".9"/>`;
  const tuft = (x, c) => `<path transform="translate(${x} 96)" d="M3 14 Q4 7 2 3 M9 14 Q9 6 10 1 M15 14 Q14 8 16 4" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`;
  const twice = f => f(0) + f(300);
  const wave = 'M0 112 ' + Array.from({ length: 20 }, (_, i) => `Q ${i * 30 + 15} ${i % 2 ? 116 : 108} ${i * 30 + 30} 112`).join(' ');
  const LOADER = `<div class="scene" role="img" aria-label="جارٍ التحميل">
      <svg class="layer clouds" width="600" height="120" viewBox="0 0 600 120" aria-hidden="true">${twice(o => cloud(o + 30, 14, 1) + cloud(o + 190, 30, .7))}</svg>
      <svg class="layer trees" width="600" height="120" viewBox="0 0 600 120" aria-hidden="true"><defs><filter id="sceneCrayon"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.5"/></filter></defs><g filter="url(#sceneCrayon)">${twice(o => tree(o + 70, 1.35) + tree(o + 225, 1))}</g></svg>
      <svg class="layer ground" width="600" height="120" viewBox="0 0 600 120" aria-hidden="true"><g filter="url(#sceneCrayon)"><path d="${wave}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>${twice(o => tuft(o + 25, '#58c322') + tuft(o + 140, '#7fd858') + tuft(o + 255, '#58c322'))}</g></svg>
      <span class="scene-bus"><img src="img/logo-sticker.png" alt=""></span>
    </div>`;
  document.querySelectorAll('.loader').forEach(el => { el.innerHTML = LOADER; });

  /* Progress bars with the riding bus: a finish flag that says ما بقى شي!, and the bus hops
     whenever the bar moves forward. */
  const GOAL = `<span class="bar-goal">ما بقى شي!<svg class="flag" viewBox="0 0 12 14" aria-hidden="true"><path d="M2 1.5v11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2.8 1.6h8.2v5.6H2.8z" fill="#fff" stroke="currentColor" stroke-width="1"/><path d="M2.8 1.6h2.7v2.8H2.8zM5.5 4.4h2.8v2.8H5.5zM8.3 1.6h2.7v2.8H8.3z" fill="currentColor"/></svg></span>`;
  function ride(el, pct) {
    const before = el.dataset.p == null ? null : +el.dataset.p;
    el.dataset.p = pct;
    el.style.setProperty('--p', pct);
    el.querySelector('.bar-fill').style.width = pct + '%';
    const goal = el.querySelector('.bar-goal');
    if (goal) goal.hidden = pct >= 100;
    if (before != null && pct > before) {
      const bus = el.querySelector('.ride-bus');
      bus.classList.remove('hop');
      void bus.offsetWidth;   // restart the hop
      bus.classList.add('hop');
      bus.addEventListener('animationend', () => bus.classList.remove('hop'), { once: true });
    }
  }

  /* Their little characters as avatars: the heart friend or the chef in different scarf colours,
     on a matching soft colour, with a deeper shade for the name. Down a list they take turns. */
  const hash = name => [...String(name)].reduce((n, c) => n + c.codePointAt(0), 0);
  const FACES = [
    ['friend-blue', '#ddf4ff', '#1590d0'], ['chef-pink', '#ffe1ec', '#d6336c'], ['friend-green', '#e4f9d4', '#46a015'],
    ['chef-orange', '#fff3c4', '#e07800'], ['friend-purple', '#efe4ff', '#8e44c9'], ['chef-blue', '#ddf4ff', '#1590d0'],
    ['friend-pink', '#ffe1ec', '#d6336c'], ['chef-green', '#e4f9d4', '#46a015'], ['friend-yellow', '#fff3c4', '#c48a00'],
    ['chef-purple', '#efe4ff', '#8e44c9']
  ];
  const look = (name, i) => FACES[(i == null ? hash(name) : i) % FACES.length];
  const face = (name, i) => {
    const [img, bg] = look(name, i);
    return `<span class="avatar face" style="--c:${bg}"><img src="img/faces/${img}.png?v=2" alt=""></span>`;
  };
  const sameName = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();

  // "5 أصدقاء", "26 صديق", "3 قطع", "265 قطعة"
  const friendsWord = n => (n === 1 ? 'صديق' : n === 2 ? 'صديقين' : n <= 10 ? 'أصدقاء' : 'صديق');
  const piecesWord = n => (n === 1 ? 'قطعة' : n === 2 ? 'قطعتين' : n <= 10 ? 'قطع' : 'قطعة');

  // after an event: how many friends joined (same name counts once) and how many pieces they brought
  function summary(pledges, people) {
    const names = [...new Set((people || []).map(p => sameName(p.name)).filter(Boolean))];
    let pieces = 0;
    for (const p of pledges || []) {
      for (const x of p.items || []) pieces += +x.qty || 0;
      for (const x of p.extras || []) pieces += +x.qty || 0;
    }
    return { friends: names.length, pieces, names: (people || []).map(p => p.name) };
  }

  let toastTimer;
  function toast(msg) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // Preview-mode notice on the team page
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.Store || !Store.demo || !window.KBF_ADMIN) return;
    const b = document.createElement('div');
    b.className = 'preview-banner';
    b.textContent = 'وضع المعاينة — البيانات محفوظة في هذا المتصفح فقط';
    document.body.prepend(b);
  });

  return { $, $$, esc, arDate, when, itemsLeft, twoTone, byDate, tally, icon, toast, GOAL, ride, face, look, sameName, summary, friendsWord, piecesWord, safeUrl, whatsapp };
})();
