/* One initiative: choose items and amounts, add your own, confirm with your name. */
(function () {
  const { $, esc, tally, longDate, icon, toast } = UI;
  const iid = new URLSearchParams(location.search).get('id');
  const dlg = $('#confirm');
  const cards = new Map();
  const pick = {};          // item id -> how many I'll bring
  let extras = [];          // my own extra items [{name, qty}]
  let ini = null, iniLoaded = false, pledges = [], got = {}, submitting = false;

  if (!iid) return notFound();
  Store.watchInitiative(iid, d => { ini = d; iniLoaded = true; render(); }, loadFailed);
  Store.watchPledges(iid, p => { pledges = p; render(); }, loadFailed);

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
    renderOthers(t.extras);
    renderMine();
    renderBasket();
    if (dlg.open && !$('#confirmStep').hidden && !submitting) {
      const rows = chosen();
      if (rows.length) $('#summary').innerHTML = summaryHTML(rows); else dlg.close();
    }
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
    if (changed.length) toast(`Someone just signed up for ${changed.join(', ')} — we updated your amount.`);
  }

  function renderHead(t) {
    document.title = `${ini.title} · Khair Bus Friends`;
    $('#iniTitle').textContent = ini.title;
    const chips = [];
    if (ini.date) chips.push(`<span class="chip">${icon('cal', 16)}${esc(longDate(ini.date))}</span>`);
    if (ini.time) chips.push(`<span class="chip">${icon('clock', 16)}${esc(ini.time)}</span>`);
    if (ini.place) chips.push(`<span class="chip">${icon('pin', 16)}${esc(ini.place)}</span>`);
    $('#iniChips').innerHTML = chips.join('');
    $('#iniNote').textContent = ini.note || '';
    $('#iniNote').hidden = !ini.note;
    $('#overall').hidden = !(ini.items || []).length;
    $('#ovPct').textContent = t.pct + '%';
    $('#ovBar').style.width = t.pct + '%';
    $('#ovLeft').textContent = t.open ? `${t.open} ${t.open === 1 ? 'item' : 'items'} still needed` : 'Everything is covered!';
    $('#content').hidden = false;
    $('#closedNote').hidden = isOpen();
    $('#extraCard').hidden = !isOpen();
    $('#itemsHead p').hidden = !isOpen();
  }

  function renderItems() {
    const list = $('#items');
    const items = ini.items || [];
    if (!items.length) {
      list.innerHTML = '<li class="empty">The team is still preparing this list — check back soon.</li>';
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
      <div>
        <div class="bar"><span class="bar-fill"></span><span class="bar-mine"></span></div>
        <p class="bar-label"><span class="count"></span><span class="mine-label"></span></p>
      </div>
      <div class="stepper">
        <span class="stepper-label">I'll bring</span>
        <button type="button" class="step-btn minus">−</button>
        <input class="qty" type="number" inputmode="numeric" min="0" value="0">
        <button type="button" class="step-btn plus">+</button>
      </div>
      <p class="full-note" hidden>Covered — thank you, everyone!</p>`;
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
    badge.innerHTML = full ? `${icon('check', 14)} Covered` : `${left} still needed`;
    li.querySelector('.bar-fill').style.width = pct(Math.min(g, need), need);
    li.querySelector('.bar-mine').style.width = pct(mine, need);
    li.querySelector('.count').textContent = `${Math.min(g, need)} of ${need} coming`;
    li.querySelector('.mine-label').textContent = mine ? `+${mine} from you` : '';
    li.querySelector('.stepper').hidden = !isOpen() || full;
    li.querySelector('.full-note').hidden = !full;
    const q = li.querySelector('.qty'), minus = li.querySelector('.minus'), plus = li.querySelector('.plus');
    if (document.activeElement !== q) q.value = mine;
    q.max = left;
    q.setAttribute('aria-label', `How many ${it.name} you'll bring`);
    minus.setAttribute('aria-label', `One less ${it.name}`);
    plus.setAttribute('aria-label', `One more ${it.name}`);
    minus.disabled = mine <= 0;
    plus.disabled = mine >= left;
  }

  function setPick(id, n, typed) {
    const it = (ini.items || []).find(x => x.id === id);
    if (!it || !isOpen()) return;
    const max = remaining(it);
    if (typed && n > max) toast(`Only ${max} still needed — we set it to ${max}.`);
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

  /* ---------- your own extra items ---------- */

  $('#extraForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#exName').value.trim();
    const qty = Math.max(1, parseInt($('#exQty').value, 10) || 1);
    if (!name) return $('#exName').focus();
    const listed = (ini.items || []).find(it => it.name.trim().toLowerCase() === name.toLowerCase());
    if (listed) {
      toast(`${listed.name} is already on the list — use the + button there.`);
      return;
    }
    const same = extras.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (same) same.qty += qty; else extras.push({ name, qty });
    $('#exName').value = '';
    $('#exQty').value = 1;
    renderMine();
    renderBasket();
    $('#exName').focus();
  });

  $('#myExtras').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    extras.splice(+b.dataset.i, 1);
    renderMine();
    renderBasket();
  });

  function renderMine() {
    $('#myExtras').innerHTML = extras.map((x, i) =>
      `<li class="tag mine">${esc(x.name)} × ${x.qty}<button type="button" data-i="${i}" aria-label="Remove ${esc(x.name)}">×</button></li>`).join('');
  }

  function renderOthers(list) {
    $('#othersCard').hidden = !list.length;
    $('#others').innerHTML = list.map(x => `<li class="tag">${esc(x.name)} × ${x.qty}</li>`).join('');
  }

  /* ---------- basket & confirm ---------- */

  function chosen() {
    const rows = (ini.items || []).filter(it => pick[it.id]).map(it => ({ name: it.name, unit: it.unit, qty: pick[it.id] }));
    return rows.concat(extras.map(x => ({ name: x.name, unit: '', qty: x.qty, extra: true })));
  }

  function summaryHTML(rows) {
    return rows.map(r => `<li><span>${esc(r.name)}${r.unit ? ` <span class="muted small">${esc(r.unit)}</span>` : ''}${r.extra ? ' <span class="pill extra">extra</span>' : ''}</span><b>× ${r.qty}</b></li>`).join('');
  }

  function renderBasket() {
    const rows = isOpen() ? chosen() : [];
    const show = rows.length > 0;
    $('#basket').classList.toggle('show', show);
    $('#basket').inert = !show;
    document.body.classList.toggle('has-basket', show);
    $('#basketCount').textContent = `${rows.length} ${rows.length === 1 ? 'item' : 'items'} chosen`;
    $('#basketSub').textContent = rows.map(r => `${r.name} × ${r.qty}`).join(', ');
  }

  $('#reviewBtn').addEventListener('click', () => {
    $('#summary').innerHTML = summaryHTML(chosen());
    $('#confirmStep').hidden = false;
    $('#thanksStep').hidden = true;
    $('#confirmErr').hidden = true;
    if (!$('#name').value) { try { $('#name').value = localStorage.getItem('kbf-name') || ''; } catch (e) {} }
    dlg.showModal();
    $('#name').focus();
  });
  $('#backBtn').addEventListener('click', () => dlg.close());
  $('#doneBtn').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  $('#confirmForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#name').value.trim();
    if (!name) { showErr("Please add your name so the team knows who's bringing what."); $('#name').focus(); return; }
    const rows = chosen();
    if (!rows.length) { dlg.close(); return; }
    const items = Object.entries(pick).map(([id, qty]) => ({ id, qty }));
    const send = $('#sendBtn');
    submitting = true;
    send.disabled = true;
    send.textContent = 'Saving…';
    $('#confirmErr').hidden = true;
    try {
      await Store.pledge(iid, { name, items, extras });
      try { localStorage.setItem('kbf-name', name); } catch (_) {}
      for (const id of Object.keys(pick)) delete pick[id];
      extras = [];
      $('#thanksTitle').textContent = `Thank you, ${name}!`;
      $('#thanksList').innerHTML = summaryHTML(rows);
      $('#confirmStep').hidden = true;
      $('#thanksStep').hidden = false;
      $('#doneBtn').focus();
    } catch (err) {
      showErr(isOpen() ? "Sorry, that didn't save. Please check your connection and try again." : 'Sorry — this initiative has just closed.');
    } finally {
      submitting = false;
      send.disabled = false;
      send.textContent = 'Confirm';
      render();
    }
  });

  function showErr(msg) {
    const el = $('#confirmErr');
    el.textContent = msg;
    el.hidden = false;
  }

  function notFound() {
    document.title = 'Not found · Khair Bus Friends';
    $('#iniTitle').textContent = "We couldn't find this initiative";
    $('#iniChips').innerHTML = '<a class="btn btn-primary" href="index.html#initiatives">See all initiatives</a>';
    $('#iniNote').hidden = true;
    $('#overall').hidden = true;
    $('#content').hidden = true;
  }

  function loadFailed() {
    $('#iniTitle').textContent = "We couldn't load this page";
    $('#iniNote').textContent = 'Please check your connection and refresh.';
    $('#iniNote').hidden = false;
  }
})();
