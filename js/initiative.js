/* One initiative, like a lesson: tap the foods you'll bring, add your name, confirm. */
(function () {
  const { $, $$, esc, tally, arDate, twoTone, icon, toast, safeUrl, whatsapp } = UI;
  const iid = new URLSearchParams(location.search).get('id');
  const done = $('#thanks');
  const cards = new Map();
  const pick = {};          // item id -> how many I'll bring
  let extras = [];          // my own extra items [{name, qty}]
  let ini = null, iniLoaded = false, pledges = [], people = [], got = {}, submitting = false;
  // sign-ups made on this phone, so the list can mark them "أنت"
  let mine = new Set();
  try { mine = new Set(JSON.parse(localStorage.getItem('kbf-mine') || '[]')); } catch (e) {}
  const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !!Element.prototype.animate;

  if (!iid) return notFound();
  Store.watchInitiative(iid, d => { ini = d; iniLoaded = true; render(); }, loadFailed);
  Store.watchPledges(iid, p => { pledges = p; render(); }, loadFailed);
  Store.watchPeople(iid, p => { newcomers(p); people = p; render(); });
  try { $('#name').value = localStorage.getItem('kbf-name') || ''; } catch (e) {}

  const isOpen = () => !!ini && ini.status === 'open';
  // only touch the page when something changed, so chips and tags don't re-pop on every update
  const setHTML = (el, html) => { if (el.lastHTML !== html) { el.lastHTML = html; el.innerHTML = html; } };
  const remaining = it => Math.max(0, (+it.needed || 0) - (got[it.id] || 0));
  const pct = (a, b) => (b ? Math.min(100, a / b * 100) : 0).toFixed(2) + '%';

  function render() {
    if (!iniLoaded) return;
    $('#loader').hidden = true;
    if (!ini) return notFound();
    const t = tally(ini, pledges);
    got = t.got;
    if (!submitting) clampPicks();
    renderHead(t);
    renderItems();
    renderExtras(t.extras);
    renderBasket();
    renderList();
  }

  // If others sign up while you're choosing, never offer more than is still needed.
  function clampPicks() {
    const items = ini.items || [];
    const changed = [];
    for (const id of Object.keys(pick)) {
      const it = items.find(x => x.id === id);
      if (!it || !isOpen()) { delete pick[id]; continue; }
      if (pick[id] > remaining(it)) {
        changed.push(it.name);
        if (remaining(it)) pick[id] = remaining(it); else delete pick[id];
      }
    }
    if (!isOpen()) extras = [];
    if (changed.length) toast(`تم التحديث، أحد سجّل للتو: ${changed.join('، ')}`);
  }

  function renderHead(t) {
    document.title = `${ini.title} · أصدقاء باص الخير`;
    $('#iniTitle').innerHTML = twoTone(ini.title);
    // date, time, place, phone — whichever the team filled in
    const info = [];
    if (ini.date) info.push(`<span class="info-chip">${icon('cal', 18)}${esc(arDate(ini.date))}</span>`);
    if (ini.time) info.push(`<span class="info-chip">${icon('clock', 18)}${esc(ini.time)}</span>`);
    // place opens the map link if there is one; the number opens a WhatsApp chat
    const map = safeUrl(ini.map);
    if (ini.place || map) info.push(map
      ? `<a class="info-chip" href="${esc(map)}" target="_blank" rel="noopener">${icon('pin', 18)}${esc(ini.place || 'الموقع')}</a>`
      : `<span class="info-chip">${icon('pin', 18)}${esc(ini.place)}</span>`);
    const wa = whatsapp(ini.phone, `السلام عليكم، بخصوص ${ini.title}`);
    if (wa) info.push(`<a class="info-chip" href="${esc(wa)}" target="_blank" rel="noopener">${icon('chat', 18)}<span dir="ltr">${esc(ini.phone)}</span></a>`);
    setHTML($('#iniInfo'), info.join(''));
    const photo = $('#iniPhoto'), src = ini.photo || 'img/logo.png';
    if (photo.getAttribute('src') !== src) photo.src = src;
    $('#prompt').hidden = !isOpen();
    $('#stickyTitle').textContent = ini.title;
    $('#ovBar').style.width = t.pct + '%';
    $('#ride').style.setProperty('--p', t.pct);
    $('#content').hidden = false;
    $('#closedNote').hidden = isOpen();
  }

  // once the big title scrolls away, keep the event name on the top bar
  if (window.IntersectionObserver) {
    new IntersectionObserver(([e]) => { $('#stickyTitle').hidden = e.isIntersecting || !ini; })
      .observe($('#iniTitle'));
  }

  /* ---------- the foods: tap a card to add one ---------- */

  function renderItems() {
    const list = $('#items');
    const items = ini.items || [];
    if (!items.length) {
      list.innerHTML = '<li class="empty">القائمة قيد التجهيز</li>';
      cards.clear();
      return;
    }
    const empty = list.querySelector('.empty');
    if (empty) empty.remove();
    const seen = new Set();
    items.forEach((it, i) => {
      let card = cards.get(it.id);
      if (!card) { card = makeCard(it.id, i); cards.set(it.id, card); }
      updateCard(card, it);
      if (list.children[i] !== card) list.insertBefore(card, list.children[i] || null);
      seen.add(it.id);
    });
    for (const [id, card] of cards) if (!seen.has(id)) { card.remove(); cards.delete(id); }
  }

  function makeCard(id, i) {
    const li = document.createElement('li');
    li.className = 'choice';
    li.dataset.id = id;
    li.style.setProperty('--i', i);
    li.innerHTML = `
      <button type="button" class="choice-hit">
        <span class="choice-img"><img alt=""><span class="full-stamp" hidden>${icon('check', 36)}</span></span>
        <span class="choice-name"></span>
        <span class="choice-unit"></span>
      </button>
      <span class="mine-badge" dir="ltr" hidden></span>
      <div class="choice-foot">
        <div class="bar"><span class="bar-fill"></span><span class="bar-mine"></span></div>
        <p class="choice-left"></p>
        <div class="stepper" hidden>
          <button type="button" class="step-btn minus">−</button>
          <input class="qty" type="number" inputmode="numeric" min="0" value="0">
          <button type="button" class="step-btn plus">+</button>
        </div>
      </div>`;
    return li;
  }

  function updateCard(li, it) {
    const need = +it.needed || 0, g = got[it.id] || 0, left = remaining(it);
    const mineQty = Math.min(pick[it.id] || 0, left);
    const full = left === 0;
    // someone else just finished this item: stamp it and burst sparkles
    if (li.dataset.full === '0' && full && !submitting && done.hidden) party(li);
    li.dataset.full = full ? '1' : '0';
    li.querySelector('.full-stamp').hidden = !full;
    li.classList.toggle('is-full', full);
    li.classList.toggle('is-picked', mineQty > 0);
    li.querySelector('.choice-name').textContent = it.name;
    li.querySelector('.choice-unit').textContent = it.unit || '';
    const img = li.querySelector('.choice-img img'), src = it.img || 'img/logo-180.png';
    if (img.getAttribute('src') !== src) img.src = src;
    img.classList.toggle('placeholder', !it.img);
    const hit = li.querySelector('.choice-hit');
    hit.disabled = full || !isOpen();
    hit.setAttribute('aria-label', `أضف ${it.name}`);
    li.querySelector('.bar-fill').style.width = pct(Math.min(g, need), need);
    li.querySelector('.bar-mine').style.width = mineQty ? `calc(${pct(mineQty, need)} + 10px)` : '0';
    const leftEl = li.querySelector('.choice-left');
    leftEl.classList.toggle('done', full);
    if (full) leftEl.innerHTML = `${icon('check', 16)} اكتمل`;
    else {
      let num = leftEl.querySelector('b');
      if (!num) { leftEl.innerHTML = 'باقي <b></b>'; num = leftEl.querySelector('b'); }
      const was = parseInt(num.textContent, 10);
      if (was && was !== left) countTo(num, was, left); else num.textContent = left;
    }
    const badge = li.querySelector('.mine-badge');
    badge.hidden = !mineQty;
    badge.textContent = `+${mineQty}`;
    li.querySelector('.stepper').hidden = !mineQty || !isOpen();
    const q = li.querySelector('.qty'), minus = li.querySelector('.minus'), plus = li.querySelector('.plus');
    if (document.activeElement !== q) q.value = mineQty;
    q.max = left;
    q.setAttribute('aria-label', `عدد ${it.name}`);
    minus.setAttribute('aria-label', `إنقاص ${it.name}`);
    plus.setAttribute('aria-label', `زيادة ${it.name}`);
    plus.disabled = mineQty >= left;
  }

  function bump(id) {
    const card = cards.get(id);
    if (!card) return;
    card.classList.remove('bump');
    void card.offsetWidth;   // restart the animation
    card.classList.add('bump');
  }

  // roll a number from old to new
  function countTo(el, from, to) {
    if (!motionOK()) { el.textContent = to; return; }
    cancelAnimationFrame(el.raf);
    const t0 = performance.now(), ms = 700;
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) el.raf = requestAnimationFrame(step);
    };
    el.raf = requestAnimationFrame(step);
    replay(el, 'tick');
  }

  function party(li) {
    replay(li.querySelector('.full-stamp'), 'stamp');
    sparkle(li, 12);
  }

  function setPick(id, n, typed) {
    const it = (ini.items || []).find(x => x.id === id);
    if (!it || !isOpen()) return;
    const max = remaining(it);
    if (typed && n > max) toast(`المطلوب ${max} فقط`);
    n = Math.max(0, Math.min(n, max));
    if (n === (pick[id] || 0)) return;
    const more = n > (pick[id] || 0);
    if (n) pick[id] = n; else delete pick[id];
    renderItems();
    renderBasket();
    bump(id);
    if (more) { cheer(); sparkle(cards.get(id)); }
  }

  /* ---------- the chef cheers you on ---------- */

  const CHEERS = ['كفو!', 'تسلم!', 'يمّي!', 'عساك عالقوة!', 'يا حلوك!'];
  let cheerTimer, lastCheer = -1;

  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;   // restart the animation
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  function cheer() {
    const bubble = $('#bubble');
    let i;
    do { i = Math.floor(Math.random() * CHEERS.length); } while (i === lastCheer && CHEERS.length > 1);
    lastCheer = i;
    bubble.textContent = CHEERS[i];
    replay(bubble, 'cheer');
    replay($('#iniPhoto'), 'cheer');
    clearTimeout(cheerTimer);
    cheerTimer = setTimeout(() => { bubble.textContent = 'شنو بتييب؟'; }, 2200);
  }

  // a little pop of their sparkles out of the food you tapped
  function sparkle(card, n = 7) {
    if (!card || !motionOK()) return;
    const r = card.querySelector('.choice-img').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('img');
      const size = 16 + Math.random() * 14;
      s.className = 'spark-pop';
      s.src = `img/deco/sparkle-${i % 6 + 1}.png`;
      s.alt = '';
      s.style.width = size + 'px';
      s.style.left = cx - size / 2 + 'px';
      s.style.top = cy - size / 2 + 'px';
      document.body.appendChild(s);
      const ang = i / n * Math.PI * 2 + Math.random() * .6, dist = 55 + Math.random() * (n > 7 ? 70 : 40);
      s.animate([
        { transform: 'translate(0, 0) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(1) rotate(${(Math.random() - .5) * 200}deg)`, opacity: 0 }
      ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2, .8, .3, 1)' }).onfinish = () => s.remove();
    }
  }

  $('#items').addEventListener('click', e => {
    const card = e.target.closest('.choice');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('.choice-hit') || e.target.closest('.plus')) setPick(id, (pick[id] || 0) + 1);
    else if (e.target.closest('.minus')) setPick(id, (pick[id] || 0) - 1);
  });
  $('#items').addEventListener('change', e => {
    if (!e.target.classList.contains('qty')) return;
    const id = e.target.closest('.choice').dataset.id;
    setPick(id, parseInt(e.target.value, 10) || 0, true);
    e.target.value = pick[id] || 0;
  });

  /* ---------- something else ---------- */

  $('#extraForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#exName').value.trim();
    const qty = Math.max(1, parseInt($('#exQty').value, 10) || 1);
    if (!name) return $('#exName').focus();
    const listed = (ini.items || []).find(it => it.name.trim().toLowerCase() === name.toLowerCase());
    if (listed) { toast(`${listed.name} موجود في القائمة`); return; }
    const same = extras.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (same) same.qty += qty; else extras.push({ name, qty });
    $('#exName').value = '';
    $('#exQty').value = 1;
    renderExtras();
    renderBasket();
  });

  $('#myExtras').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    extras.splice(+b.dataset.i, 1);
    renderExtras();
    renderBasket();
  });

  let others = [];
  function renderExtras(list) {
    if (list) others = list;
    setHTML($('#myExtras'), extras.map((x, i) =>
      `<li class="tag mine">${esc(x.name)} × ${x.qty}<button type="button" data-i="${i}" aria-label="إزالة ${esc(x.name)}">×</button></li>`).join(''));
    setHTML($('#others'), others.map(x => `<li class="tag">${esc(x.name)} × ${x.qty}</li>`).join(''));
    $('#extraForm').hidden = !isOpen();
    $('#extraCard').hidden = !isOpen() && !others.length;
  }

  /* ---------- the list at the end: who's bringing what, and what's still needed ---------- */

  const AVATAR = ['#1cb0f6', '#58c322', '#ff9600', '#ce82ff', '#ff4b4b', '#2b70c9'];
  const avatarColor = name => AVATAR[[...String(name)].reduce((n, c) => n + c.codePointAt(0), 0) % AVATAR.length];

  function renderList() {
    const items = ini.items || [];
    const names = Object.fromEntries(people.map(p => [p.id, p.name]));
    const byId = Object.fromEntries(items.map(it => [it.id, it]));
    const rows = pledges.filter(p => names[p.id]).sort((a, b) => a.createdAt - b.createdAt);
    $('#whoWrap').hidden = !rows.length;
    // each thing as a little chip: photo, name, how many
    const chip = (name, qty, img) => `<span class="mini">${img ? `<img src="${esc(img)}" alt="">` : ''}<span>${esc(name)}</span><b>${qty}</b></span>`;
    setHTML($('#whoList'), rows.map(p => {
      const what = [
        ...(p.items || []).filter(x => byId[x.id]).map(x => chip(byId[x.id].name, x.qty, byId[x.id].img)),
        ...(p.extras || []).map(x => chip(x.name, x.qty))
      ].join('');
      const me = mine.has(p.id), name = names[p.id];
      return `<li class="row${me ? ' mine' : ''}" data-pid="${esc(p.id)}">
        <span class="avatar" style="--c:${avatarColor(name)}">${esc([...name.trim()][0] || '؟')}</span>
        <span class="row-main"><b>${esc(name)}</b><span class="minis">${what}</span></span>
        ${me ? '<span class="pill">أنت</span>' : ''}
      </li>`;
    }).join(''));
    const left = items.filter(it => remaining(it) > 0);
    setHTML($('#leftList'), left.length
      ? left.map(it => `<li class="row">
          <span class="row-main"><b>${esc(it.name)}</b>${it.unit ? `<span class="row-sub">${esc(it.unit)}</span>` : ''}</span>
          <span class="count">${remaining(it)}</span>
        </li>`).join('')
      : `<li class="row all-done">${icon('check', 18)} اكتملت كل الأصناف</li>`);
    $('#listCard').hidden = !items.length && !rows.length;
  }

  /* ---------- someone else just joined ---------- */

  let seenPeople = null, popTimer;
  function newcomers(list) {
    const fresh = seenPeople ? list.filter(p => !seenPeople.has(p.id) && !mine.has(p.id)) : [];
    seenPeople = new Set(list.map(p => p.id));
    if (!fresh.length || submitting) return;
    let pop = $('#livePop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'livePop'; pop.className = 'live-pop'; pop.setAttribute('role', 'status');
      document.body.appendChild(pop);
    }
    const name = fresh[fresh.length - 1].name || '';
    const who = fresh.length > 1 ? `${esc(name)} و${fresh.length - 1}` : esc(name);
    pop.innerHTML = `<span class="avatar" style="--c:${avatarColor(name)}">${esc([...name.trim()][0] || '؟')}</span><span>${who} معانا!</span>`;
    pop.classList.add('show');
    clearTimeout(popTimer);
    popTimer = setTimeout(() => pop.classList.remove('show'), 3200);
  }

  /* ---------- name & confirm ---------- */

  function chosen() {
    const items = Object.entries(pick).map(([id, qty]) => ({ id, qty }));
    const pieces = items.reduce((n, x) => n + x.qty, 0) + extras.reduce((n, x) => n + x.qty, 0);
    return { items, extras, count: items.length + extras.length, pieces };
  }

  function renderBasket() {
    $('#basket').hidden = !isOpen();
    document.body.classList.toggle('has-basket', isOpen());
    $('#sendBtn').disabled = !chosen().count;
  }

  $('#sendForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#name').value.trim();
    if (!name) { $('#name').focus(); return; }
    const { items, count, pieces } = chosen();
    if (!count) return;
    const send = $('#sendBtn');
    submitting = true;
    send.disabled = true;
    try {
      const pid = await Store.pledge(iid, { name, items, extras });
      mine.add(pid);
      try {
        localStorage.setItem('kbf-name', name);
        localStorage.setItem('kbf-mine', JSON.stringify([...mine].slice(-200)));
      } catch (_) {}
      for (const id of Object.keys(pick)) delete pick[id];
      extras = [];
      showDone(name, count, pieces);
    } catch (err) {
      toast(isOpen() ? 'لم يتم الحفظ، حاول مرة أخرى' : 'أُغلقت هذه المبادرة');
    } finally {
      submitting = false;
      render();
    }
  });

  function showDone(name, kinds, pieces) {
    $('#thanksTitle').innerHTML = twoTone(`شكراً يا ${name}!`);
    $('#statKinds').textContent = kinds;
    $('#statPieces').textContent = pieces;
    done.hidden = false;
    document.body.classList.add('no-scroll');
    $('#doneBtn').focus();
    confetti();
  }

  // Continue: back to the page, at your row in the list
  $('#doneBtn').addEventListener('click', () => {
    done.hidden = true;
    document.body.classList.remove('no-scroll');
    const rows = $$('#whoList .row.mine');
    const row = rows[rows.length - 1];
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1800);
  });

  // a burst of their hand-drawn sparkles behind the done screen
  function confetti() {
    if (!motionOK()) return;
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('img');
      p.className = 'confetti';
      p.src = i % 2 ? `img/deco/sparkle-w${i % 3 + 1}.png` : `img/deco/sparkle-${i % 3 + 4}.png`;   // white + green show on the blue
      p.alt = '';
      p.style.width = 18 + Math.random() * 22 + 'px';
      p.style.left = 50 + (Math.random() - .5) * 30 + 'vw';
      done.appendChild(p);
      const dx = (Math.random() - .5) * 90, rise = 30 + Math.random() * 40, spin = (Math.random() - .5) * 1080;
      p.animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx / 2}vw, -${rise}vh) rotate(${spin / 2}deg)`, opacity: 1, offset: .35 },
        { transform: `translate(${dx}vw, 20vh) rotate(${spin}deg)`, opacity: 0 }
      ], { duration: 1600 + Math.random() * 900, easing: 'cubic-bezier(.2, .7, .4, 1)' }).onfinish = () => p.remove();
    }
  }

  function notFound() {
    $('#loader').hidden = true;
    document.title = 'غير موجودة · أصدقاء باص الخير';
    $('#iniTitle').textContent = 'المبادرة غير موجودة';
    $('#content').hidden = true;
    $('#basket').hidden = true;
    // the little friend shrugs, with a way back home
    $('#iniPhoto').src = 'img/deco/friend.png';
    $('#bubble').textContent = 'ما لقيناها!';
    $('#prompt').hidden = false;
    if (!$('.lost-home')) $('#prompt').insertAdjacentHTML('afterend', '<a class="btn btn-primary btn-wide lost-home" href="index.html">الرئيسية</a>');
  }

  function loadFailed() {
    $('#loader').hidden = true;
    $('#iniTitle').textContent = 'تعذّر التحميل، حدّث الصفحة';
  }
})();
