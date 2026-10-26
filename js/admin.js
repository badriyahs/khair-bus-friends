/* Team dashboard: create initiatives, edit item lists, see who's bringing what. */
(function () {
  const { $, $$, esc, tally, when, byDate, icon, toast } = UI;
  const panel = $('#panel');
  let list = null;          // every initiative
  let sel = null;           // selected initiative id (null while a new one is unsaved)
  let current = null;       // saved version of the selected initiative
  let draft = null;         // what's in the form
  let dirty = false;
  let pledges = [], people = [];
  let tab = 'details';
  let offSel = [];
  let started = false;

  /* ---------- sign in ---------- */

  Store.onAuth(a => {
    $('#boot').hidden = true;
    $('#loginView').hidden = a.state !== 'out';
    $('#notAdminView').hidden = a.state !== 'notAdmin';
    $('#dashView').hidden = a.state !== 'in';
    $('#signOut').hidden = Store.demo || a.state === 'out';
    $('#who').textContent = a.state === 'out' ? '' : (a.email || '');
    if (a.state === 'notAdmin') $('#uid').textContent = a.uid;
    if (a.error) loginError("Couldn't connect. Please check your connection and refresh.");
    if (a.state === 'in') start();
  });

  function loginError(msg) {
    $('#loginErr').textContent = msg;
    $('#loginErr').hidden = false;
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#loginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    $('#loginErr').hidden = true;
    try {
      await Store.signIn($('#email').value.trim(), $('#password').value);
    } catch (err) {
      loginError("That email or password didn't work. Please try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  $('#forgot').addEventListener('click', async () => {
    const email = $('#email').value.trim();
    if (!email) { loginError('Type your email above first, then tap “Forgot password?”.'); $('#email').focus(); return; }
    try { await Store.resetPassword(email); toast(`We sent a reset link to ${email}`); }
    catch (err) { toast("Couldn't send the reset email — please check the address."); }
  });

  for (const id of ['#signOut', '#signOut2']) {
    $(id).addEventListener('click', async () => { await Store.signOut(); location.reload(); });
  }

  $('#resetPreview').addEventListener('click', async () => {
    if (!confirm('Put the sample data back? This clears everything added in preview mode.')) return;
    dirty = false;
    await Store.resetPreview();
    location.reload();
  });

  /* ---------- initiative list ---------- */

  const order = (a, b) => {
    const ao = a.status === 'open', bo = b.status === 'open';
    if (ao !== bo) return ao ? -1 : 1;
    return ao ? byDate(a, b) : byDate(b, a);
  };

  function start() {
    if (started) return;
    started = true;
    $('#resetPreview').hidden = !Store.demo;
    Store.watchInitiatives(l => {
      list = l.sort(order);
      renderList();
      if (sel === null && draft === null) {
        if (list.length) select(list[0].id); else renderPanel();
      }
    }, loadErr);
  }

  function renderList() {
    if (!list) return;
    $('#iniList').innerHTML = list.length ? list.map(i => {
      const d = i.date ? new Date(i.date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date yet';
      const open = i.status === 'open';
      return `<li><button type="button" data-id="${esc(i.id)}" aria-current="${i.id === sel}">
        <b>${esc(i.title || 'Untitled')}</b>
        <span class="muted small">${esc(d)}</span>
        <span class="pill ${open ? '' : 'closed'}">${open ? 'Open' : 'Closed'}</span>
      </button></li>`;
    }).join('') : '<li class="muted small">No initiatives yet.</li>';
  }

  $('#iniList').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (b && b.dataset.id !== sel) select(b.dataset.id);
  });
  $('#newBtn').addEventListener('click', newInitiative);
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function stopWatching() {
    offSel.forEach(off => off());
    offSel = [];
  }

  function select(id) {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    stopWatching();
    sel = id; current = null; draft = null; dirty = false; pledges = []; people = []; tab = 'details';
    renderList();
    panel.innerHTML = '<p class="muted">Loading…</p>';
    offSel.push(Store.watchInitiative(id, d => {
      if (!d) {   // deleted, maybe from another device
        stopWatching();
        sel = null; current = null; draft = null; dirty = false;
        renderList(); renderPanel();
        return;
      }
      current = d;
      if (!dirty) { draft = toDraft(d); renderPanel(); } else renderStats();
    }, loadErr));
    offSel.push(Store.watchPledges(id, p => { pledges = p; renderStats(); }, loadErr));
    offSel.push(Store.watchPeople(id, p => { people = p; renderStats(); }, loadErr));
  }

  function newInitiative() {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    stopWatching();
    sel = null; current = null; pledges = []; people = []; tab = 'details';
    draft = { title: '', date: '', time: '', place: '', note: '', status: 'open', items: [blankItem(), blankItem(), blankItem()] };
    dirty = true;
    renderList();
    renderPanel();
    $('#fTitle').focus();
  }

  const blankItem = () => ({ id: 'i' + Math.random().toString(36).slice(2, 9), name: '', unit: '', needed: '' });

  function toDraft(d) {
    return {
      title: d.title || '', date: d.date || '', time: d.time || '', place: d.place || '', note: d.note || '',
      status: d.status === 'closed' ? 'closed' : 'open',
      items: (d.items || []).map(it => ({ id: it.id, name: it.name || '', unit: it.unit || '', needed: String(it.needed || '') }))
    };
  }

  /* ---------- editor ---------- */

  function renderPanel() {
    if (!draft) {
      panel.innerHTML = list && list.length
        ? '<div class="empty">Pick an initiative, or start a new one.</div>'
        : `<div class="empty"><h3>No initiatives yet</h3><p>Create your first one: add what you need, then share the link.</p>
           <button class="btn btn-primary" type="button" data-act="new">+ New initiative</button></div>`;
      return;
    }
    const link = sel ? `initiative.html?id=${encodeURIComponent(sel)}` : '';
    panel.innerHTML = `
      <div class="panel-head">
        <div><p class="eyebrow">${sel ? 'Initiative' : 'New initiative'}</p><h2 id="pTitle">${esc(draft.title || 'Untitled initiative')}</h2></div>
        ${sel ? `<div class="head-actions">
          <a class="btn btn-ghost btn-sm" href="${link}" target="_blank" rel="noopener">${icon('open', 16)} View page</a>
          <button class="btn btn-ghost btn-sm" type="button" data-act="copy">${icon('link', 16)} Copy link</button>
        </div>` : ''}
      </div>
      ${sel ? `<div class="tabs" role="tablist">
        <button class="tab" type="button" role="tab" data-tab="details" aria-selected="${tab === 'details'}">Details</button>
        <button class="tab" type="button" role="tab" data-tab="people" aria-selected="${tab === 'people'}">Who's bringing what <span class="count-pill" id="peopleCount">0</span></button>
      </div>` : ''}
      <div id="tabDetails" ${tab === 'details' ? '' : 'hidden'}>${formHTML()}</div>
      <div id="tabPeople" ${tab === 'people' ? '' : 'hidden'}></div>
      <div class="savebar" id="savebar" ${dirty ? '' : 'hidden'}>
        <span>${sel ? 'You have unsaved changes' : "This initiative isn't saved yet"}</span>
        <div>
          <button class="btn btn-on-dark btn-sm" type="button" data-act="discard">Discard</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="save" id="saveBtn">Save</button>
        </div>
      </div>`;
    renderStats();
  }

  function formHTML() {
    const d = draft;
    return `
      <div class="form-grid">
        <div class="field full"><label for="fTitle">Name of the initiative</label>
          <input class="input" id="fTitle" data-f="title" value="${esc(d.title)}" maxlength="100" placeholder="e.g. Friday Meal Bus"></div>
        <div class="field"><label for="fDate">Date</label>
          <input class="input" id="fDate" data-f="date" type="date" value="${esc(d.date)}"></div>
        <div class="field"><label for="fTime">Time</label>
          <input class="input" id="fTime" data-f="time" value="${esc(d.time)}" maxlength="40" placeholder="e.g. 4:00 PM"></div>
        <div class="field full"><label for="fPlace">Place</label>
          <input class="input" id="fPlace" data-f="place" value="${esc(d.place)}" maxlength="120" placeholder="Where should people bring things?"></div>
        <div class="field full"><label for="fNote">Message for participants</label>
          <textarea class="input" id="fNote" data-f="note" rows="3" maxlength="600" placeholder="Anything people should know">${esc(d.note)}</textarea></div>
        <div class="field full"><span class="label">Status</span>
          <div class="seg" role="radiogroup" aria-label="Status">
            <label><input type="radio" name="status" value="open" ${d.status === 'open' ? 'checked' : ''}>Open — people can sign up</label>
            <label><input type="radio" name="status" value="closed" ${d.status === 'closed' ? 'checked' : ''}>Closed</label>
          </div>
        </div>
      </div>
      <div class="items-head">
        <h3>Items needed</h3>
        <p class="muted">Add each item and how many you need. The public page updates as people sign up.</p>
      </div>
      <div class="edit-items" id="editItems">
        <div class="edit-head"><span>Item</span><span>Unit</span><span>Needed</span><span>Coming</span><span>Still needed</span><span></span></div>
        ${d.items.map(rowHTML).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-act="add">${icon('plus', 16)} Add item</button>
      ${sel ? `<details class="danger-zone">
        <summary>Delete this initiative</summary>
        <p>This removes the initiative and everyone's sign-ups. It can't be undone.</p>
        <button class="btn btn-danger btn-sm" type="button" data-act="delete">${icon('trash', 16)} Delete initiative</button>
      </details>` : ''}`;
  }

  function rowHTML(it) {
    return `<div class="edit-row" data-id="${esc(it.id)}">
      <input class="input c-name" data-k="name" value="${esc(it.name)}" maxlength="80" placeholder="e.g. Bread" aria-label="Item">
      <input class="input c-unit" data-k="unit" value="${esc(it.unit)}" maxlength="40" placeholder="e.g. packs" aria-label="Unit">
      <input class="input c-need" data-k="needed" value="${esc(it.needed)}" type="number" min="1" inputmode="numeric" placeholder="0" aria-label="How many needed">
      <span class="num c-coming" data-label="Coming"></span>
      <span class="num c-left" data-label="Still needed"></span>
      <button class="icon-btn c-del" type="button" data-act="del-item" aria-label="Remove item">${icon('trash')}</button>
    </div>`;
  }

  function markDirty() {
    dirty = true;
    const bar = $('#savebar');
    if (bar) bar.hidden = false;
  }

  function showTab(name) {
    tab = name;
    $$('.tab', panel).forEach(t => t.setAttribute('aria-selected', t.dataset.tab === tab));
    $('#tabDetails').hidden = tab !== 'details';
    $('#tabPeople').hidden = tab !== 'people';
  }

  panel.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f) {
      draft[t.dataset.f] = t.value;
      if (t.dataset.f === 'title') $('#pTitle').textContent = t.value || 'Untitled initiative';
    } else if (t.dataset.k) {
      const it = draft.items.find(x => x.id === t.closest('.edit-row').dataset.id);
      if (!it) return;
      it[t.dataset.k] = t.value;
      renderStats();
    } else return;
    markDirty();
  });

  panel.addEventListener('change', e => {
    if (e.target.name !== 'status') return;
    draft.status = e.target.value;
    markDirty();
  });

  // Enter in an item row jumps to the next row (or adds one)
  panel.addEventListener('keydown', e => {
    const row = e.target.closest('.edit-row');
    if (e.key !== 'Enter' || !row || e.isComposing) return;
    e.preventDefault();
    const next = row.nextElementSibling;
    if (next && next.classList.contains('edit-row')) next.querySelector('.c-name').focus(); else addItem();
  });

  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-act], [data-tab]');
    if (!b) return;
    if (b.dataset.tab) return showTab(b.dataset.tab);
    const act = b.dataset.act;
    if (act === 'new') newInitiative();
    else if (act === 'add') addItem();
    else if (act === 'del-item') removeItem(b.closest('.edit-row'));
    else if (act === 'save') save();
    else if (act === 'discard') discard();
    else if (act === 'copy') copyLink();
    else if (act === 'delete') deleteInitiative();
    else if (act === 'unpledge') removePledge(b.dataset.pid);
    else if (act === 'csv') downloadCSV();
  });

  function addItem() {
    const it = blankItem();
    draft.items.push(it);
    $('#editItems').insertAdjacentHTML('beforeend', rowHTML(it));
    renderStats();
    markDirty();
    $(`.edit-row[data-id="${it.id}"] .c-name`).focus();
  }

  function removeItem(row) {
    const it = draft.items.find(x => x.id === row.dataset.id);
    if (!it) return;
    const promised = tally(null, pledges).got[it.id] || 0;
    if (promised && !confirm(`People have already promised ${promised} of “${it.name}”. Remove it anyway?`)) return;
    draft.items = draft.items.filter(x => x !== it);
    row.remove();
    markDirty();
  }

  async function save() {
    const title = draft.title.trim();
    if (!title) { showTab('details'); toast('Give the initiative a name first.'); $('#fTitle').focus(); return; }
    const rows = draft.items.filter(it => String(it.name).trim());
    const bad = rows.find(it => !(parseInt(it.needed, 10) > 0));
    if (bad) {
      showTab('details');
      toast(`How many ${bad.name.trim()} do you need?`);
      $(`.edit-row[data-id="${bad.id}"] .c-need`).focus();
      return;
    }
    const data = {
      title, date: draft.date, time: draft.time.trim(), place: draft.place.trim(), note: draft.note.trim(), status: draft.status,
      items: rows.map(it => ({ id: it.id, name: it.name.trim(), unit: String(it.unit).trim(), needed: parseInt(it.needed, 10) }))
    };
    const btn = $('#saveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const id = await Store.saveInitiative(sel, data);
      dirty = false;
      if (!sel) { toast("Created — copy the link when you're ready to share."); select(id); }
      else { toast('Saved'); current = { ...current, ...data }; draft = toDraft(current); renderPanel(); }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Save';
      toast("Couldn't save — please check your connection and try again.");
    }
  }

  function discard() {
    dirty = false;
    if (sel && current) { draft = toDraft(current); renderPanel(); return; }
    draft = null;
    if (list && list.length) select(list[0].id); else { renderList(); renderPanel(); }
  }

  function copyLink() {
    const url = new URL(`initiative.html?id=${encodeURIComponent(sel)}`, location.href).href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast('Link copied — paste it in WhatsApp or anywhere.'))
      .catch(() => window.prompt('Copy this link:', url));
  }

  async function deleteInitiative() {
    const name = (current && current.title) || 'this initiative';
    if (!confirm(`Delete “${name}” and everyone's sign-ups? This can't be undone.`)) return;
    const id = sel;
    stopWatching();
    sel = null; current = null; draft = null; dirty = false;
    try {
      await Store.deleteInitiative(id);
      toast('Deleted');
    } catch (err) {
      toast("Couldn't delete — please check your connection.");
      select(id);
      return;
    }
    const next = (list || []).find(i => i.id !== id);
    if (next) select(next.id); else { renderList(); renderPanel(); }
  }

  async function removePledge(pid) {
    const who = (people.find(p => p.id === pid) || {}).name || 'this person';
    if (!confirm(`Remove ${who}'s sign-up? Their items go back on the list.`)) return;
    try { await Store.deletePledge(sel, pid); toast('Removed'); }
    catch (err) { toast("Couldn't remove — please check your connection."); }
  }

  /* ---------- live numbers & who's bringing what ---------- */

  function renderStats() {
    if (!draft) return;
    const { got } = tally(null, pledges);
    $$('#editItems .edit-row').forEach(row => {
      const it = draft.items.find(x => x.id === row.dataset.id);
      if (!it) return;
      const g = got[it.id] || 0, need = parseInt(it.needed, 10) || 0, left = Math.max(0, need - g);
      row.querySelector('.c-coming').textContent = g;
      const cell = row.querySelector('.c-left');
      cell.textContent = need ? (left || 'Covered') : '–';
      cell.classList.toggle('ok', need > 0 && !left);
    });
    const count = $('#peopleCount');
    if (count) count.textContent = pledges.length;
    renderPeople();
  }

  function renderPeople() {
    const box = $('#tabPeople');
    if (!box || !sel) return;
    const names = Object.fromEntries(people.map(p => [p.id, p.name]));
    const nameOf = p => names[p.id] || 'Someone';
    const items = (current && current.items) || [];
    const byId = Object.fromEntries(items.map(it => [it.id, it]));
    const rows = pledges.slice().sort((a, b) => a.createdAt - b.createdAt);
    if (!rows.length) {
      box.innerHTML = '<div class="empty">No one has signed up yet. Copy the link above and share it to get started.</div>';
      return;
    }

    const perItem = items.map(it => {
      const who = [];
      for (const p of rows) for (const x of p.items || []) if (x.id === it.id) who.push({ name: nameOf(p), qty: x.qty });
      const total = who.reduce((n, w) => n + w.qty, 0);
      return `<div class="by-item-row">
        <div class="by-item-top"><b>${esc(it.name)}</b><span class="muted small">${esc(it.unit || '')}</span>
          <span class="by-item-n ${total >= it.needed ? 'ok' : ''}">${total} of ${it.needed}</span></div>
        ${who.length
          ? `<div class="names">${who.map(w => `<span class="name-chip">${esc(w.name)} · ${w.qty}</span>`).join('')}</div>`
          : '<p class="muted small" style="margin:6px 0 0">No one yet</p>'}
      </div>`;
    }).join('');

    const extras = [];
    for (const p of rows) for (const x of p.extras || []) extras.push(`<span class="name-chip green">${esc(x.name)} × ${x.qty} · ${esc(nameOf(p))}</span>`);

    const what = p => [
      ...(p.items || []).map(x => `${esc(byId[x.id] ? byId[x.id].name : 'Removed item')} × ${x.qty}`),
      ...(p.extras || []).map(x => `${esc(x.name)} × ${x.qty} <span class="pill extra">extra</span>`)
    ].join('<br>');

    box.innerHTML = `
      <div class="people-head"><h3>By item</h3>
        <button class="btn btn-ghost btn-sm" type="button" data-act="csv">${icon('download', 16)} Download list</button></div>
      <div class="by-item">${perItem}</div>
      ${extras.length ? `<h3 class="mt">Extra items people are bringing</h3><div class="names">${extras.join('')}</div>` : ''}
      <h3 class="mt">By person</h3>
      <table class="people">
        <thead><tr><th>Name</th><th>Bringing</th><th></th></tr></thead>
        <tbody>${rows.map(p => `<tr>
          <td><b>${esc(nameOf(p))}</b><div class="muted small">${esc(when(p.createdAt))}</div></td>
          <td>${what(p)}</td>
          <td><button class="icon-btn" type="button" data-act="unpledge" data-pid="${esc(p.id)}" aria-label="Remove ${esc(nameOf(p))}'s sign-up">${icon('trash')}</button></td>
        </tr>`).join('')}</tbody>
      </table>`;
  }

  function downloadCSV() {
    const names = Object.fromEntries(people.map(p => [p.id, p.name]));
    const byId = Object.fromEntries(((current && current.items) || []).map(it => [it.id, it]));
    // quote every cell; a leading = + - @ would otherwise run as a spreadsheet formula
    const cell = v => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [['Name', 'Item', 'Unit', 'Quantity', 'Signed up']];
    for (const p of pledges.slice().sort((a, b) => a.createdAt - b.createdAt)) {
      const name = names[p.id] || '', at = when(p.createdAt);
      for (const x of p.items || []) {
        const it = byId[x.id];
        lines.push([name, it ? it.name : 'Removed item', it ? it.unit : '', x.qty, at]);
      }
      for (const x of p.extras || []) lines.push([name, `${x.name} (extra)`, '', x.qty, at]);
    }
    const csv = '﻿' + lines.map(r => r.map(cell).join(',')).join('\r\n');
    const slug = ((current && current.title) || 'initiative').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'initiative';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${slug}-sign-ups.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function loadErr() {
    toast("Couldn't load — please check your connection.");
  }
})();
