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
    if (a.error) loginError('تعذّر الاتصال، حدّث الصفحة');
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
    btn.textContent = 'جارٍ الدخول…';
    $('#loginErr').hidden = true;
    try {
      await Store.signIn($('#email').value.trim(), $('#password').value);
    } catch (err) {
      loginError('البريد أو كلمة المرور غير صحيحة');
    } finally {
      btn.disabled = false;
      btn.textContent = 'دخول';
    }
  });

  $('#forgot').addEventListener('click', async () => {
    const email = $('#email').value.trim();
    if (!email) { $('#email').focus(); return; }
    try { await Store.resetPassword(email); toast(`أرسلنا رابط تغيير كلمة المرور إلى ${email}`); }
    catch (err) { toast('تعذّر الإرسال، تأكد من البريد'); }
  });

  for (const id of ['#signOut', '#signOut2']) {
    $(id).addEventListener('click', async () => { await Store.signOut(); location.reload(); });
  }

  $('#resetPreview').addEventListener('click', async () => {
    if (!confirm('إرجاع البيانات التجريبية؟')) return;
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
      const d = i.date ? new Date(i.date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const open = i.status === 'open';
      return `<li><button type="button" data-id="${esc(i.id)}" aria-current="${i.id === sel}">
        <b>${esc(i.title || 'بدون اسم')}</b>
        ${d ? `<span class="muted small" dir="ltr">${esc(d)}</span>` : ''}
        <span class="pill ${open ? '' : 'closed'}">${open ? 'مفتوحة' : 'مغلقة'}</span>
      </button></li>`;
    }).join('') : '';
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
    if (dirty && !confirm('الخروج بدون حفظ؟')) return;
    stopWatching();
    sel = id; current = null; draft = null; dirty = false; pledges = []; people = []; tab = 'details';
    renderList();
    panel.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
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
    if (dirty && !confirm('الخروج بدون حفظ؟')) return;
    stopWatching();
    sel = null; current = null; pledges = []; people = []; tab = 'details';
    draft = { title: '', date: '', photo: '', status: 'open', items: [blankItem(), blankItem(), blankItem()] };
    dirty = true;
    renderList();
    renderPanel();
    $('#fTitle').focus();
  }

  const blankItem = () => ({ id: 'i' + Math.random().toString(36).slice(2, 9), name: '', unit: '', needed: '' });

  function toDraft(d) {
    return {
      title: d.title || '', date: d.date || '', photo: d.photo || '',
      status: d.status === 'closed' ? 'closed' : 'open',
      items: (d.items || []).map(it => ({ id: it.id, name: it.name || '', unit: it.unit || '', needed: String(it.needed || '') }))
    };
  }

  /* ---------- editor ---------- */

  function renderPanel() {
    if (!draft) {
      panel.innerHTML = '<div class="empty"><button class="btn btn-primary" type="button" data-act="new">+ مبادرة جديدة</button></div>';
      return;
    }
    const link = sel ? `initiative.html?id=${encodeURIComponent(sel)}` : '';
    panel.innerHTML = `
      <div class="panel-head">
        <h2 id="pTitle">${esc(draft.title || 'مبادرة جديدة')}</h2>
        ${sel ? `<div class="head-actions">
          <a class="btn btn-ghost btn-sm" href="${link}" target="_blank" rel="noopener">${icon('open', 16)} عرض</a>
          <button class="btn btn-ghost btn-sm" type="button" data-act="copy">${icon('link', 16)} نسخ الرابط</button>
        </div>` : ''}
      </div>
      ${sel ? `<div class="tabs" role="tablist">
        <button class="tab" type="button" role="tab" data-tab="details" aria-selected="${tab === 'details'}">الأصناف</button>
        <button class="tab" type="button" role="tab" data-tab="people" aria-selected="${tab === 'people'}">الأسماء <span class="count-pill" id="peopleCount">0</span></button>
      </div>` : ''}
      <div id="tabDetails" ${tab === 'details' ? '' : 'hidden'}>${formHTML()}</div>
      <div id="tabPeople" ${tab === 'people' ? '' : 'hidden'}></div>
      <div class="savebar" id="savebar" ${dirty ? '' : 'hidden'}>
        <span>${sel ? 'تغييرات غير محفوظة' : 'لم تُحفظ بعد'}</span>
        <div>
          <button class="btn btn-on-dark btn-sm" type="button" data-act="discard">تراجع</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="save" id="saveBtn">حفظ</button>
        </div>
      </div>`;
    renderStats();
  }

  function formHTML() {
    const d = draft;
    return `
      <div class="form-grid">
        <div class="field full"><label for="fTitle">اسم المبادرة</label>
          <input class="input" id="fTitle" data-f="title" value="${esc(d.title)}" maxlength="100"></div>
        <div class="field"><label for="fDate">التاريخ</label>
          <input class="input" id="fDate" data-f="date" type="date" value="${esc(d.date)}"></div>
        <div class="field"><span class="label">الصورة</span>
          <div class="photo-field">
            <img class="photo-preview" id="photoPreview" src="${esc(d.photo)}" alt="" ${d.photo ? '' : 'hidden'}>
            <label class="btn btn-ghost btn-sm"><span id="photoBtnText">${d.photo ? 'تغيير' : 'اختر صورة'}</span><input class="file-input" type="file" accept="image/*" id="photoInput"></label>
            <button class="btn-link" type="button" data-act="photo-remove" ${d.photo ? '' : 'hidden'}>إزالة</button>
          </div>
        </div>
        <div class="field full">
          <div class="seg" role="radiogroup" aria-label="الحالة">
            <label><input type="radio" name="status" value="open" ${d.status === 'open' ? 'checked' : ''}>مفتوحة</label>
            <label><input type="radio" name="status" value="closed" ${d.status === 'closed' ? 'checked' : ''}>مغلقة</label>
          </div>
        </div>
      </div>
      <div class="edit-items" id="editItems">
        <div class="edit-head"><span>الصنف</span><span>الوحدة</span><span>المطلوب</span><span>مسجّل</span><span>الباقي</span><span></span></div>
        ${d.items.map(rowHTML).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-act="add">${icon('plus', 16)} إضافة صنف</button>
      ${sel ? `<div class="danger-zone"><button class="btn btn-danger btn-sm" type="button" data-act="delete">${icon('trash', 16)} حذف المبادرة</button></div>` : ''}`;
  }

  function rowHTML(it) {
    return `<div class="edit-row" data-id="${esc(it.id)}">
      <input class="input c-name" data-k="name" value="${esc(it.name)}" maxlength="80" placeholder="مثلاً: خبز" aria-label="الصنف">
      <input class="input c-unit" data-k="unit" value="${esc(it.unit)}" maxlength="40" placeholder="مثلاً: أكياس" aria-label="الوحدة">
      <input class="input c-need" data-k="needed" value="${esc(it.needed)}" type="number" min="1" inputmode="numeric" placeholder="0" aria-label="العدد المطلوب">
      <span class="num c-coming" data-label="مسجّل"></span>
      <span class="num c-left" data-label="الباقي"></span>
      <button class="icon-btn c-del" type="button" data-act="del-item" aria-label="حذف الصنف">${icon('trash')}</button>
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
      if (t.dataset.f === 'title') $('#pTitle').textContent = t.value || 'مبادرة جديدة';
    } else if (t.dataset.k) {
      const it = draft.items.find(x => x.id === t.closest('.edit-row').dataset.id);
      if (!it) return;
      it[t.dataset.k] = t.value;
      renderStats();
    } else return;
    markDirty();
  });

  panel.addEventListener('change', e => {
    if (e.target.id === 'photoInput') {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) setPhoto(file);
      return;
    }
    if (e.target.name !== 'status') return;
    draft.status = e.target.value;
    markDirty();
  });

  /* ---------- photo ---------- */

  // Shrunk on this device to a small JPEG, so it fits inside the initiative's record
  function shrink(file, max = 480) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        let q = .82, url = c.toDataURL('image/jpeg', q);
        while (url.length > 250000 && q > .4) { q -= .12; url = c.toDataURL('image/jpeg', q); }
        resolve(url);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function setPhoto(file) {
    try {
      draft.photo = await shrink(file);
    } catch (err) {
      toast('تعذّر قراءة الصورة، جرّب صورة أخرى');
      return;
    }
    showPhoto();
    markDirty();
  }

  function showPhoto() {
    const has = !!draft.photo;
    const img = $('#photoPreview');
    img.hidden = !has;
    if (has) img.src = draft.photo;
    $('#photoBtnText').textContent = has ? 'تغيير' : 'اختر صورة';
    $('[data-act="photo-remove"]', panel).hidden = !has;
  }

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
    else if (act === 'photo-remove') { draft.photo = ''; showPhoto(); markDirty(); }
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
    if (promised && !confirm(`مسجّل ${promised} من «${it.name}». حذفه؟`)) return;
    draft.items = draft.items.filter(x => x !== it);
    row.remove();
    markDirty();
  }

  async function save() {
    const title = draft.title.trim();
    if (!title) { showTab('details'); toast('أضف اسم المبادرة'); $('#fTitle').focus(); return; }
    const rows = draft.items.filter(it => String(it.name).trim());
    const bad = rows.find(it => !(parseInt(it.needed, 10) > 0));
    if (bad) {
      showTab('details');
      toast(`كم المطلوب من ${bad.name.trim()}؟`);
      $(`.edit-row[data-id="${bad.id}"] .c-need`).focus();
      return;
    }
    const data = {
      title, date: draft.date, photo: draft.photo || '', status: draft.status,
      items: rows.map(it => ({ id: it.id, name: it.name.trim(), unit: String(it.unit).trim(), needed: parseInt(it.needed, 10) }))
    };
    const btn = $('#saveBtn');
    btn.disabled = true;
    btn.textContent = 'جارٍ الحفظ…';
    try {
      const id = await Store.saveInitiative(sel, data);
      dirty = false;
      if (!sel) { toast('تم الإنشاء'); select(id); }
      else { toast('تم الحفظ'); current = { ...current, ...data }; draft = toDraft(current); renderPanel(); }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'حفظ';
      toast('تعذّر الحفظ، حاول مرة أخرى');
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
      .then(() => toast('تم نسخ الرابط'))
      .catch(() => window.prompt('انسخ الرابط:', url));
  }

  async function deleteInitiative() {
    const name = (current && current.title) || 'هذه المبادرة';
    if (!confirm(`حذف «${name}» وكل الأسماء؟ لا يمكن التراجع.`)) return;
    const id = sel;
    stopWatching();
    sel = null; current = null; draft = null; dirty = false;
    try {
      await Store.deleteInitiative(id);
      toast('تم الحذف');
    } catch (err) {
      toast('تعذّر الحذف، حاول مرة أخرى');
      select(id);
      return;
    }
    const next = (list || []).find(i => i.id !== id);
    if (next) select(next.id); else { renderList(); renderPanel(); }
  }

  async function removePledge(pid) {
    const who = (people.find(p => p.id === pid) || {}).name || 'هذا الاسم';
    if (!confirm(`إزالة ${who}؟ ترجع أصنافه للقائمة.`)) return;
    try { await Store.deletePledge(sel, pid); toast('تمت الإزالة'); }
    catch (err) { toast('تعذّرت الإزالة، حاول مرة أخرى'); }
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
      cell.textContent = need ? (left || 'اكتمل') : '–';
      cell.classList.toggle('ok', need > 0 && !left);
    });
    const count = $('#peopleCount');
    if (count) count.textContent = pledges.length;
    renderPeople();
  }

  // Names: every sign-up, newest first, then the totals per item
  function renderPeople() {
    const box = $('#tabPeople');
    if (!box || !sel) return;
    const names = Object.fromEntries(people.map(p => [p.id, p.name]));
    const nameOf = p => names[p.id] || '…';
    const items = (current && current.items) || [];
    const byId = Object.fromEntries(items.map(it => [it.id, it]));
    const rows = pledges.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (!rows.length) {
      box.innerHTML = '<div class="empty">لا توجد أسماء بعد</div>';
      return;
    }

    const what = p => [
      ...(p.items || []).map(x => `${esc(byId[x.id] ? byId[x.id].name : 'صنف محذوف')} × ${x.qty}`),
      ...(p.extras || []).map(x => `${esc(x.name)} × ${x.qty} <span class="pill extra">إضافي</span>`)
    ].join('<br>');

    const perItem = items.map(it => {
      const who = [];
      for (const p of rows) for (const x of p.items || []) if (x.id === it.id) who.push({ name: nameOf(p), qty: x.qty });
      const total = who.reduce((n, w) => n + w.qty, 0);
      return `<div class="by-item-row">
        <div class="by-item-top"><b>${esc(it.name)}</b><span class="by-item-n ${total >= it.needed ? 'ok' : ''}">${total} / ${it.needed}</span></div>
        ${who.length ? `<div class="names">${who.map(w => `<span class="name-chip">${esc(w.name)} · ${w.qty}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');

    box.innerHTML = `
      <div class="people-head">
        <button class="btn btn-ghost btn-sm" type="button" data-act="csv">${icon('download', 16)} تحميل</button>
      </div>
      <table class="people">
        <tbody>${rows.map(p => `<tr>
          <td><b>${esc(nameOf(p))}</b><div class="muted small"><bdi dir="ltr">${esc(when(p.createdAt))}</bdi></div></td>
          <td>${what(p)}</td>
          <td><button class="icon-btn" type="button" data-act="unpledge" data-pid="${esc(p.id)}" aria-label="إزالة ${esc(nameOf(p))}">${icon('trash')}</button></td>
        </tr>`).join('')}</tbody>
      </table>
      <h3 class="mt">حسب الصنف</h3>
      <div class="by-item">${perItem}</div>`;
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
    const lines = [['الاسم', 'الصنف', 'الوحدة', 'العدد', 'وقت التسجيل']];
    for (const p of pledges.slice().sort((a, b) => a.createdAt - b.createdAt)) {
      const name = names[p.id] || '', at = when(p.createdAt);
      for (const x of p.items || []) {
        const it = byId[x.id];
        lines.push([name, it ? it.name : 'صنف محذوف', it ? it.unit : '', x.qty, at]);
      }
      for (const x of p.extras || []) lines.push([name, `${x.name} (إضافي)`, '', x.qty, at]);
    }
    const csv = '﻿' + lines.map(r => r.map(cell).join(',')).join('\r\n');
    const slug = ((current && current.title) || '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'initiative';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${slug}-names.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function loadErr() {
    toast('تعذّر التحميل، حدّث الصفحة');
  }
})();
