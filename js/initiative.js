/* One initiative: tap + on what you'll bring, add your name, confirm. */
(function () {
  const { $, esc, tally, enDate, itemsLeft, icon, toast } = UI;
  const iid = new URLSearchParams(location.search).get('id');
  const thanks = $('#thanks');
  const cards = new Map();
  const pick = {};          // item id -> how many I'll bring
  let extras = [];          // my own extra items [{name, qty}]
  let ini = null, iniLoaded = false, pledges = [], people = [], got = {}, submitting = false;
  // sign-ups made on this phone, so the list can mark them "أنت"
  let mine = new Set();
  try { mine = new Set(JSON.parse(localStorage.getItem('kbf-mine') || '[]')); } catch (e) {}

  if (!iid) return notFound();
  Store.watchInitiative(iid, d => { ini = d; iniLoaded = true; render(); }, loadFailed);
  Store.watchPledges(iid, p => { pledges = p; render(); }, loadFailed);
  Store.watchPeople(iid, p => { people = p; render(); });
  try { $('#name').value = localStorage.getItem('kbf-name') || ''; } catch (e) {}

  const isOpen = () => !!ini && ini.status === 'open';
  const remaining = it => Math.max(0, (+it.needed || 0) - (got[it.id] || 0));
  const pct = (a, b) => (b ? Math.min(100, a / b * 100) : 0).toFixed(2) + '%';

  function render() {
    if (!iniLoaded) return;
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

  // Top: small photo, name, English date, overall progress
  function renderHead(t) {
    document.title = `${ini.title} · أصدقاء باص الخير`;
    $('#iniTitle').textContent = ini.title;
    $('#iniDate').textContent = enDate(ini.date);
    $('#iniDate').hidden = !ini.date;
    const photo = $('#iniPhoto');
    if (ini.photo && photo.getAttribute('src') !== ini.photo) photo.src = ini.photo;
    photo.hidden = !ini.photo;
    const any = (ini.items || []).length > 0;
    $('#ovBarWrap').hidden = !any;
    $('#ovBar').style.width = t.pct + '%';
    $('#ovLeft').textContent = !any ? '' : t.open ? itemsLeft(t.open) : 'اكتملت كل الأصناف';
    $('#content').hidden = false;
    $('#closedNote').hidden = isOpen();
  }

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
      if (!card) { card = makeCard(it.id); cards.set(it.id, card); }
      updateCard(card, it);
      if (list.children[i] !== card) list.insertBefore(card, list.children[i] || null);
      seen.add(it.id);
    });
    for (const [id, card] of cards) if (!seen.has(id)) { card.remove(); cards.delete(id); }
  }

  function makeCard(id) {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = id;
    li.innerHTML = `
      <div class="item-top">
        <div><h3 class="item-name"></h3><p class="item-unit"></p></div>
        <span class="badge"></span>
      </div>
      <div class="bar"><span class="bar-fill"></span><span class="bar-mine"></span></div>
      <div class="stepper">
        <button type="button" class="step-btn minus">−</button>
        <input class="qty" type="number" inputmode="numeric" min="0" value="0">
        <button type="button" class="step-btn plus">+</button>
      </div>`;
    return li;
  }

  function updateCard(li, it) {
    const need = +it.needed || 0, g = got[it.id] || 0, left = remaining(it);
    const mine = Math.min(pick[it.id] || 0, left);
    const full = left === 0;
    li.classList.toggle('is-full', full);
    li.classList.toggle('is-picked', mine > 0);
    li.querySelector('.item-name').textContent = it.name;
    li.querySelector('.item-unit').textContent = it.unit || '';
    const badge = li.querySelector('.badge');
    badge.classList.toggle('done', full);
    badge.innerHTML = full ? `${icon('check', 14)} اكتمل` : `باقي ${left}`;
    li.querySelector('.bar-fill').style.width = pct(Math.min(g, need), need);
    li.querySelector('.bar-mine').style.width = pct(mine, need);
    li.querySelector('.stepper').hidden = !isOpen() || full;
    const q = li.querySelector('.qty'), minus = li.querySelector('.minus'), plus = li.querySelector('.plus');
    if (document.activeElement !== q) q.value = mine;
    q.max = left;
    q.setAttribute('aria-label', `عدد ${it.name}`);
    minus.setAttribute('aria-label', `إنقاص ${it.name}`);
    plus.setAttribute('aria-label', `زيادة ${it.name}`);
    minus.disabled = mine <= 0;
    plus.disabled = mine >= left;
  }

  function setPick(id, n, typed) {
    const it = (ini.items || []).find(x => x.id === id);
    if (!it || !isOpen()) return;
    const max = remaining(it);
    if (typed && n > max) toast(`المطلوب ${max} فقط`);
    n = Math.max(0, Math.min(n, max));
    if (n) pick[id] = n; else delete pick[id];
    renderItems();
    renderBasket();
  }

  $('#items').addEventListener('click', e => {
    const b = e.target.closest('.step-btn');
    if (!b) return;
    const id = b.closest('.item').dataset.id;
    setPick(id, (pick[id] || 0) + (b.classList.contains('plus') ? 1 : -1));
  });
  $('#items').addEventListener('change', e => {
    if (!e.target.classList.contains('qty')) return;
    const id = e.target.closest('.item').dataset.id;
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
    $('#myExtras').innerHTML = extras.map((x, i) =>
      `<li class="tag mine">${esc(x.name)} × ${x.qty}<button type="button" data-i="${i}" aria-label="إزالة ${esc(x.name)}">×</button></li>`).join('');
    $('#others').innerHTML = others.map(x => `<li class="tag">${esc(x.name)} × ${x.qty}</li>`).join('');
    $('#extraForm').hidden = !isOpen();
    $('#extraCard').hidden = !isOpen() && !others.length;
  }

  /* ---------- the list at the end: who's bringing what, and what's still needed ---------- */

  function renderList() {
    const items = ini.items || [];
    const names = Object.fromEntries(people.map(p => [p.id, p.name]));
    const byId = Object.fromEntries(items.map(it => [it.id, it]));
    const rows = pledges.filter(p => names[p.id]).sort((a, b) => a.createdAt - b.createdAt);
    $('#whoWrap').hidden = !rows.length;
    $('#whoList').innerHTML = rows.map(p => {
      const what = [
        ...(p.items || []).filter(x => byId[x.id]).map(x => `${esc(byId[x.id].name)} × ${x.qty}`),
        ...(p.extras || []).map(x => `${esc(x.name)} × ${x.qty}`)
      ].join('، ');
      const me = mine.has(p.id);
      return `<li class="${me ? 'mine' : ''}" data-pid="${esc(p.id)}">
        <b>${esc(names[p.id])}</b>${me ? ' <span class="pill">أنت</span>' : ''}
        <span class="who-what">${what}</span>
      </li>`;
    }).join('');
    const left = items.filter(it => remaining(it) > 0);
    $('#leftList').innerHTML = left.length
      ? left.map(it => `<li><span>${esc(it.name)}${it.unit ? ` <span class="muted small">${esc(it.unit)}</span>` : ''}</span><b>${remaining(it)}</b></li>`).join('')
      : '<li class="all-done">اكتملت كل الأصناف</li>';
    $('#listCard').hidden = !items.length && !rows.length;
  }

  /* ---------- name & confirm ---------- */

  function chosen() {
    const items = Object.entries(pick).map(([id, qty]) => ({ id, qty }));
    return { items, extras, count: items.length + extras.length };
  }

  function renderBasket() {
    const show = isOpen() && chosen().count > 0;
    $('#basket').classList.toggle('show', show);
    $('#basket').inert = !show;
    document.body.classList.toggle('has-basket', show);
  }

  $('#sendForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#name').value.trim();
    if (!name) { $('#name').focus(); return; }
    const { items, count } = chosen();
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
      $('#thanksTitle').textContent = `شكراً يا ${name}!`;
      thanks.showModal();
    } catch (err) {
      toast(isOpen() ? 'لم يتم الحفظ، حاول مرة أخرى' : 'أُغلقت هذه المبادرة');
    } finally {
      submitting = false;
      send.disabled = false;
      render();
    }
  });

  // Done: show where you are in the list
  $('#doneBtn').addEventListener('click', () => {
    thanks.close();
    const rows = document.querySelectorAll('#whoList li.mine');
    const row = rows[rows.length - 1];
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1800);
  });
  thanks.addEventListener('click', e => { if (e.target === thanks) thanks.close(); });

  function notFound() {
    document.title = 'غير موجودة · أصدقاء باص الخير';
    $('#iniTitle').textContent = 'المبادرة غير موجودة';
    $('#ovLeft').innerHTML = '<a class="btn btn-primary" href="index.html">رجوع</a>';
    $('#content').hidden = true;
  }

  function loadFailed() {
    $('#iniTitle').textContent = 'تعذّر التحميل، حدّث الصفحة';
  }
})();
