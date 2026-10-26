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
    let need = 0, have = 0, open = 0;
    for (const it of (ini && ini.items) || []) {
      const n = +it.needed || 0;
      need += n;
      have += Math.min(got[it.id] || 0, n);
      if ((got[it.id] || 0) < n) open++;
    }
    return { got, extras: Object.values(extras), need, have, open, pct: need ? Math.round(have / need * 100) : 0 };
  }

  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
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
  function icon(name, size = 18) {
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
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

  return { $, $$, esc, arDate, when, itemsLeft, twoTone, byDate, tally, icon, toast };
})();
