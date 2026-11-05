/* One initiative, like a lesson: tap the foods you'll bring, add your name, confirm. */
(function () {
  const { $, $$, esc, tally, arDate, twoTone, icon, toast, safeUrl, whatsapp } = UI;
  const iid = new URLSearchParams(location.search).get('id');
  if (Store.forced) $('.close-btn').href = 'index.html?demo';
  $('#goal').outerHTML = UI.GOAL;
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
    allDoneCheck((ini.items || []).length > 0 && t.open === 0);
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
    // box events: he's holding the box; tap him to see what goes in it (shown by itself the first time)
    const boxy = +ini.boxes > 0;
    const holder = $('#holder');
    holder.classList.toggle('tappable', boxy);
    if (boxy) { holder.setAttribute('role', 'button'); holder.tabIndex = 0; holder.setAttribute('aria-label', 'شنو في الصندوق؟'); }
    if (boxy && isOpen() && !introSeen()) { markIntroSeen(); setTimeout(() => openBoxIntro(false), 700); }
    $('#prompt').hidden = !isOpen();
    $('#stickyTitle').textContent = ini.title;
    UI.ride($('#ride'), t.pct);
    $('#content').hidden = false;
    $('#closedNote').hidden = isOpen();
    $('#leftWrap').hidden = !isOpen();
    if (!isOpen()) {
      // the event is over: thank everyone, no "ما بقى شي!", and a burst of confetti the first time
      const s = UI.summary(pledges, people);
      $('#doneFriends').textContent = s.friends;
      $('#doneFriendsWord').textContent = UI.friendsWord(s.friends);
      $('#donePieces').textContent = s.pieces.toLocaleString('en');
      $('#donePiecesWord').textContent = UI.piecesWord(s.pieces);
      const goal = $('#ride .bar-goal');
      if (goal) goal.hidden = true;
      if (!celebrated && motionOK()) { celebrated = true; setTimeout(allDoneParty, 500); }
    }
  }
  let celebrated = false;

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
    li.querySelector('.choice-unit').textContent = +ini.boxes > 0 ? `${amount(it)} بكل صندوق` : (it.unit || '');
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

  const CHEERS = ['كفو!', 'تسلم!', 'يمي!', 'يا حلوك!', 'بميزانكم!', 'تسلم ايدكم!', 'ما قصرتوا!'];
  let cheerTimer, lastCheer = -1, bubbleText = 'شنو بتييب؟';

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
    replay($('#holder'), 'cheer');
    clearTimeout(cheerTimer);
    cheerTimer = setTimeout(() => { cheerTimer = null; bubble.textContent = bubbleText; }, 2200);
    peekChef(CHEERS[i]);
  }

  // when the big chef has scrolled out of view, a little one peeks up from behind the bottom bar
  let peekTimer;
  function chefInView() {
    const r = $('#iniPhoto').getBoundingClientRect();   // below the top bar, above the bottom bar
    return r.height > 0 && r.bottom > 110 && r.top < innerHeight - 110;
  }
  function peekChef(text) {
    if (chefInView() || !isOpen()) return;
    const peek = $('#peekChef'), img = $('#peekChefImg');
    if (img.getAttribute('src') !== $('#iniPhoto').getAttribute('src')) img.src = $('#iniPhoto').getAttribute('src');
    $('#peekBubble').textContent = text;
    replay($('#peekBubble'), 'cheer');
    peek.classList.add('show');
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => peek.classList.remove('show'), 2000);
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
    $('#extraCard').hidden = !isOpen();   // once it's over, extras already show by each name
  }

  /* ---------- the list at the end: who's bringing what, and what's still needed ---------- */

  const { face, look } = UI;

  function renderList() {
    const items = ini.items || [];
    const names = Object.fromEntries(people.map(p => [p.id, p.name]));
    const rows = pledges.filter(p => names[p.id]).sort((a, b) => a.createdAt - b.createdAt);
    $('#whoWrap').hidden = !rows.length;
    // someone who signs up more than once shows once, with everything they're bringing added up
    const people_ = [], byName = new Map();
    for (const p of rows) {
      const name = names[p.id], key = name.trim().replace(/\s+/g, ' ').toLowerCase();
      let who = byName.get(key);
      if (!who) { who = { name, items: {}, extras: new Map(), mine: false }; byName.set(key, who); people_.push(who); }
      for (const x of p.items || []) who.items[x.id] = (who.items[x.id] || 0) + x.qty;
      for (const x of p.extras || []) {
        const k = String(x.name).trim().toLowerCase(), e = who.extras.get(k) || { name: x.name, qty: 0 };
        e.qty += x.qty; who.extras.set(k, e);
      }
      if (mine.has(p.id)) who.mine = true;
    }
    // each thing as a little chip: photo, name, how many
    const chip = (name, qty, img) => `<span class="mini">${img ? `<img src="${esc(img)}" alt="">` : ''}<span>${esc(name)}</span><b>${qty}</b></span>`;
    setHTML($('#whoList'), people_.map((who, i) => {
      const what = [
        ...items.filter(it => who.items[it.id]).map(it => chip(it.name, who.items[it.id], it.img)),
        ...[...who.extras.values()].map(x => chip(x.name, x.qty))
      ].join('');
      return `<li class="row${who.mine ? ' mine' : ''}">
        ${face(who.name, i)}
        <span class="row-main"><b style="color:${look(who.name, i)[2]}">${esc(who.name)}</b><span class="minis">${what}</span></span>
        ${who.mine ? '<span class="pill">أنت</span>' : ''}
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
    pop.innerHTML = `${face(name)}<span>${who} معانا!</span>`;
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
    // stays off while saving: the live update during saving used to switch it back on, so a quick double tap sent it twice
    $('#sendBtn').disabled = submitting || !chosen().count;
  }

  $('#sendForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
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
    if (partyWaiting) { partyWaiting = false; setTimeout(allDoneParty, 700); }
    document.body.classList.remove('no-scroll');
    const rows = $$('#whoList .row.mine');
    const row = rows[rows.length - 1];
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1800);
  });

  // a burst of their hand-drawn sparkles behind the done screen
  function confetti(into = done) {
    if (!motionOK()) return;
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('img');
      p.className = 'confetti';
      p.src = i % 2 ? `img/deco/sparkle-w${i % 3 + 1}.png` : `img/deco/sparkle-${i % 3 + 4}.png`;   // white + green show on the blue
      p.alt = '';
      p.style.width = 18 + Math.random() * 22 + 'px';
      p.style.left = 50 + (Math.random() - .5) * 30 + 'vw';
      into.appendChild(p);
      const dx = (Math.random() - .5) * 90, rise = 30 + Math.random() * 40, spin = (Math.random() - .5) * 1080;
      p.animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx / 2}vw, -${rise}vh) rotate(${spin / 2}deg)`, opacity: 1, offset: .35 },
        { transform: `translate(${dx}vw, 20vh) rotate(${spin}deg)`, opacity: 0 }
      ], { duration: 1600 + Math.random() * 900, easing: 'cubic-bezier(.2, .7, .4, 1)' }).onfinish = () => p.remove();
    }
  }

  /* ---------- everything's covered: thank everyone ---------- */

  // once everything's covered the chef takes turns thanking everyone
  const THANKS = ['تسلم ايدكم!', 'ما قصرتوا!', 'بميزانكم!'];
  let wasAllDone = null, partyWaiting = false, thanksI = 0, thanksTimer = null;
  function allDoneCheck(allDone) {
    bubbleText = allDone ? THANKS[thanksI] : 'شنو بتييب؟';
    if (!cheerTimer) $('#bubble').textContent = bubbleText;
    if (allDone && !thanksTimer) {
      thanksTimer = setInterval(() => {
        thanksI = (thanksI + 1) % THANKS.length;
        bubbleText = THANKS[thanksI];
        if (cheerTimer) return;
        $('#bubble').textContent = bubbleText;
        replay($('#bubble'), 'cheer');
      }, 3200);
    } else if (!allDone && thanksTimer) { clearInterval(thanksTimer); thanksTimer = null; thanksI = 0; }
    if (wasAllDone === false && allDone) {
      if (submitting || !done.hidden) partyWaiting = true;
      else allDoneParty();
    }
    wasAllDone = allDone;
  }

  function allDoneParty() {
    const bubble = $('#bubble');
    bubble.textContent = bubbleText;
    replay(bubble, 'cheer');
    replay($('#holder'), 'cheer');
    peekChef(bubbleText);
    if (!motionOK()) return;
    const layer = document.createElement('div');
    layer.className = 'party-layer';
    document.body.appendChild(layer);
    confetti(layer);
    // the bus drives across the bottom of the screen
    const bus = document.createElement('img');
    bus.className = 'drive-bus';
    bus.src = 'img/logo-sticker.png';
    bus.alt = '';
    layer.appendChild(bus);
    bus.animate([{ left: '100%' }, { left: '-140px' }], { duration: 2600, easing: 'ease-in-out' });
    setTimeout(() => layer.remove(), 3000);
  }

  /* ---------- tap the heart friend: little hearts float up ---------- */

  function floatHearts(from) {
    if (!motionOK()) return;
    const r = from.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const h = document.createElement('img');
      const size = 16 + Math.random() * 14;
      h.className = 'float-heart';
      h.src = 'img/deco/friend-heart.png';
      h.alt = '';
      h.style.width = size + 'px';
      h.style.left = r.left + r.width / 2 - size / 2 + 'px';
      h.style.top = r.top + r.height / 2 - size / 2 + 'px';
      document.body.appendChild(h);
      const dx = (Math.random() - .5) * 90, rise = 90 + Math.random() * 80;
      h.animate([
        { transform: 'translate(0, 0) scale(.3)', opacity: 0 },
        { transform: `translate(${dx * .3}px, -20px) scale(1)`, opacity: 1, offset: .2 },
        { transform: `translate(${dx}px, -${rise}px) scale(.8) rotate(${dx / 4}deg)`, opacity: 0 }
      ], { duration: 1200 + Math.random() * 500, delay: i * 90, easing: 'ease-out', fill: 'backwards' }).onfinish = () => h.remove();
    }
  }
  $('.thanks-friend').addEventListener('click', () => floatHearts($('.thanks-heart')));
  $('.peek').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    floatHearts({ getBoundingClientRect: () => ({ left: r.left, top: r.top + r.height * .6, width: r.width, height: r.height * .3 }) });
  });

  /* ---------- box events: what goes in each box ---------- */

  const introKey = () => 'kbf-box-' + iid;
  let introShown = false;
  function introSeen() {
    if (introShown) return true;
    try { return localStorage.getItem(introKey()) === '1'; } catch (e) { return false; }
  }
  function markIntroSeen() {
    introShown = true;
    try { localStorage.setItem(introKey(), '1'); } catch (e) {}
  }
  const perBox = it => Math.max(1, Math.round((+it.needed || 0) / (+ini.boxes || 1)));
  // what goes in one box, in words: "1 كيس رز", "3 علب فول", "6 علب معجون طماطم"
  const ONE = { 'أكياس': 'كيس', 'علب': 'علبة', 'غراش': 'غرشة', 'حبات': 'حبة' };
  const TWO = { 'أكياس': 'كيسين', 'علب': 'علبتين', 'غراش': 'غرشتين', 'حبات': 'حبتين' };
  function amount(it) {
    const n = perBox(it), unit = String(it.unit || '').trim();
    if (!ONE[unit]) return `${n} ${unit}`.trim();
    if (n === 2) return TWO[unit];
    return `${n} ${n >= 3 && n <= 10 ? unit : ONE[unit]}`;
  }
  const inBox = it => `${amount(it)} ${it.name}`;
  // the white-outlined cutout of a product photo, when there is one
  const sticker = it => (/^img\/items\/box-.*\.jpg$/.test(it.img || '') ? it.img.replace(/\.jpg$/, '-cut.webp') : it.img || 'img/logo-180.png');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let introBusy = false;

  async function openBoxIntro(fromHero) {
    if (!ini || !(+ini.boxes > 0) || introBusy) return;
    introBusy = true;
    const intro = $('#boxIntro'), who = $('#biWho'), holder = $('#holder');
    $('#biCount').textContent = ini.boxes;
    $('#biItems').innerHTML = (ini.items || []).map(it =>
      `<li class="bi-item"><img class="bi-sticker" src="${esc(sticker(it))}" alt=""><b>${esc(inBox(it))}</b></li>`).join('');
    who.src = $('#iniPhoto').getAttribute('src');
    const extras = [$('.bi-title', intro), $('.bi-count', intro), $('#biGo')];
    const tiles = [...intro.querySelectorAll('.bi-item')];
    intro.hidden = false;
    document.body.classList.add('no-scroll');
    holder.style.visibility = 'hidden';
    if (!motionOK()) { introBusy = false; return; }
    [...extras, ...tiles].forEach(el => { el.style.opacity = 0; });
    if (!who.complete) await new Promise(r => { who.onload = r; who.onerror = r; });
    // he comes over from the top of the page (or pops up from below the first time)
    const wb = who.getBoundingClientRect(), hr = holder.getBoundingClientRect();
    const from = fromHero && hr.width
      ? `translate(${hr.left - wb.left}px, ${hr.top - wb.top}px) scale(${hr.width / wb.width})`
      : 'translate(0, 60vh) scale(.6)';
    await who.animate([{ transform: from }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.3, 1.3, .6, 1)' }).finished;
    // everything that goes in a box flies out of his box, one by one
    const c = who.getBoundingClientRect(), cx = c.left + c.width * .52, cy = c.top + c.height * .6;
    tiles.forEach((li, i) => {
      const r = li.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      li.style.opacity = '';
      li.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.1)`, opacity: 0 },
        { transform: `translate(${dx}px, ${dy - 40}px) scale(.45)`, opacity: 1, offset: .3 },
        { transform: 'none', opacity: 1 }
      ], { duration: 650, delay: i * 110, easing: 'cubic-bezier(.3, 1.2, .6, 1)', fill: 'backwards' });
      // his box gives a little bounce as each one comes out
      setTimeout(() => who.animate([{ transform: 'none' }, { transform: 'scale(1.04, .96)' }, { transform: 'none' }], { duration: 220 }), i * 110);
    });
    await wait(tiles.length * 110 + 400);
    extras.forEach((el, i) => {
      el.style.opacity = '';
      el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: i * 120, fill: 'backwards' });
    });
    introBusy = false;
  }

  async function closeBoxIntro() {
    if (introBusy) return;
    introBusy = true;
    const intro = $('#boxIntro'), who = $('#biWho'), holder = $('#holder');
    const done = () => {
      intro.hidden = true;
      document.body.classList.remove('no-scroll');
      holder.style.visibility = '';
      introBusy = false;
    };
    if (!motionOK()) return done();
    // everything drops back into the box, then he goes back to the top of the page
    const c = who.getBoundingClientRect(), cx = c.left + c.width * .52, cy = c.top + c.height * .6;
    const tiles = [...intro.querySelectorAll('.bi-item')];
    tiles.forEach((li, i) => {
      const r = li.getBoundingClientRect();
      li.animate([{ transform: 'none', opacity: 1 },
        { transform: `translate(${cx - (r.left + r.width / 2)}px, ${cy - (r.top + r.height / 2)}px) scale(.15)`, opacity: 0 }],
        { duration: 320, delay: (tiles.length - i) * 35, easing: 'ease-in', fill: 'forwards' });
    });
    [$('.bi-title', intro), $('.bi-count', intro), $('#biGo')].forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
    await wait(tiles.length * 35 + 380);
    const wb = who.getBoundingClientRect(), hr = holder.getBoundingClientRect();
    intro.style.backgroundImage = 'none';
    const bg = intro.animate([{ backgroundColor: 'rgba(28, 176, 246, 1)' }, { backgroundColor: 'rgba(28, 176, 246, 0)' }], { duration: 600, fill: 'forwards' });
    await who.animate([{ transform: 'none' }, { transform: `translate(${hr.left - wb.left}px, ${hr.top - wb.top}px) scale(${hr.width / wb.width})` }],
      { duration: 600, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'forwards' }).finished;
    intro.getAnimations({ subtree: true }).forEach(a => a.cancel());
    bg.cancel();
    intro.style.backgroundImage = '';
    done();
    replay(holder, 'cheer');
  }

  $('#biGo').addEventListener('click', closeBoxIntro);
  $('#holder').addEventListener('click', () => {
    if (!$('#holder').classList.contains('tappable')) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    openBoxIntro(true);
  });
  $('#holder').addEventListener('keydown', e => {
    if ($('#holder').classList.contains('tappable') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openBoxIntro(true); }
  });

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
