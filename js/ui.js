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
  // Event dates are shown in English ("Thursday 29 October"); the rest of the page is Arabic
  function enDate(iso) {
    const d = parseDate(iso);
    return d ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
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

  /* Squiggly outline like their posters: a rounded rectangle whose edge waves in and out.
     The wave count is fitted to the size so the squiggle stays even. */
  function wavyPath(w, h, A) {
    const pad = A + 5, r = Math.min(w, h) * .07 + 10;
    const x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad;
    const sw = x1 - x0 - 2 * r, sh = y1 - y0 - 2 * r, arc = Math.PI * r / 2;
    const P = 2 * (sw + sh) + 4 * arc;
    const waves = Math.max(8, Math.round(P / (A * 10)));
    // point and outward normal at distance s along the rounded rectangle
    const corner = (cx, cy, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)];
    const at = s => {
      if (s < sw) return [x0 + r + s, y0, 0, -1]; s -= sw;
      if (s < arc) return corner(x1 - r, y0 + r, -Math.PI / 2 + s / r); s -= arc;
      if (s < sh) return [x1, y0 + r + s, 1, 0]; s -= sh;
      if (s < arc) return corner(x1 - r, y1 - r, s / r); s -= arc;
      if (s < sw) return [x1 - r - s, y1, 0, 1]; s -= sw;
      if (s < arc) return corner(x0 + r, y1 - r, Math.PI / 2 + s / r); s -= arc;
      if (s < sh) return [x0, y1 - r - s, -1, 0]; s -= sh;
      return corner(x0 + r, y0 + r, Math.PI + s / r);
    };
    const steps = Math.ceil(P / (A * .6));
    let d = '';
    for (let i = 0; i < steps; i++) {
      const s = i / steps * P, [x, y, nx, ny] = at(s);
      const f = s / P * 2 * Math.PI;
      const o = A * (1 + .3 * Math.sin(3 * f)) * Math.sin(waves * f);
      d += (i ? 'L' : 'M') + (x + nx * o).toFixed(1) + ' ' + (y + ny * o).toFixed(1);
    }
    return d + 'Z';
  }

  // Redrawn to fit the box whenever it changes size
  function wavy(el) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const path = document.createElementNS(NS, 'path');
    svg.classList.add('blob-bg');
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(path);
    el.prepend(svg);
    const draw = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      path.setAttribute('d', wavyPath(w, h, 6));
    };
    if (window.ResizeObserver) new ResizeObserver(draw).observe(el);
    draw();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $$('.blob').forEach(wavy);
    // Preview-mode notice on the team page
    if (!window.Store || !Store.demo || !window.KBF_ADMIN) return;
    const b = document.createElement('div');
    b.className = 'preview-banner';
    b.textContent = 'وضع المعاينة — البيانات محفوظة في هذا المتصفح فقط';
    document.body.prepend(b);
  });

  return { $, $$, esc, enDate, when, itemsLeft, twoTone, byDate, tally, icon, toast };
})();
