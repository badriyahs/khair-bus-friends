/* Home: one card per initiative (picture, name, date, progress), past ones below. */
(function () {
  const { $, esc, tally, arDate, itemsLeft, byDate, icon } = UI;
  let initiatives = null;
  const pledgesFor = {};
  const subs = new Map();

  Store.watchInitiatives(list => {
    initiatives = list;
    // keep a live pledge count for every open initiative
    const open = new Set(list.filter(i => i.status === 'open').map(i => i.id));
    for (const id of open) {
      if (!subs.has(id)) subs.set(id, Store.watchPledges(id, p => { pledgesFor[id] = p; render(); }));
    }
    for (const [id, off] of subs) if (!open.has(id)) { off(); subs.delete(id); }
    render();
  }, () => {
    $('#openList').innerHTML = '<li class="empty">تعذّر التحميل، حدّث الصفحة</li>';
  });

  // tap the big bus: it hops and honks
  const bus = $('.welcome .hero-logo');
  function honk() {
    bus.classList.remove('hop');
    void bus.offsetWidth;   // restart the hop
    bus.classList.add('hop');
    const b = document.createElement('span');
    b.className = 'honk';
    b.textContent = 'بيب بيب!';
    bus.appendChild(b);
    setTimeout(() => b.remove(), 1300);
  }
  bus.addEventListener('click', honk);
  bus.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); honk(); } });
  bus.addEventListener('animationend', e => { if (e.animationName === 'hop') bus.classList.remove('hop'); });

  function render() {
    if (!initiatives) return;
    const open = initiatives.filter(i => i.status === 'open').sort(byDate);
    const past = initiatives.filter(i => i.status !== 'open').sort((a, b) => byDate(b, a));
    paint($('#openList'), open, false, '<li class="empty">لا توجد مبادرات حالياً</li>');
    $('#pastWrap').hidden = !past.length;
    paint($('#pastList'), past, true, '');
  }

  // Same cards as before? Just move the buses along. Otherwise rebuild the list.
  const sig = (ini, past) => JSON.stringify([ini.id, ini.title, ini.date, ini.time, ini.photo, past, countdown(ini.date)]);
  function paint(list, arr, past, empty) {
    const lis = [...list.children];
    const same = arr.length && lis.length === arr.length && arr.every((ini, i) => lis[i].dataset.sig === sig(ini, past));
    if (!same) {
      list.innerHTML = arr.length ? arr.map((ini, i) => card(ini, i, past)).join('') : empty;
      void list.offsetWidth;   // start the bars empty so the buses drive in
    }
    if (!past) arr.forEach((ini, i) => progress(list.children[i], ini));
  }

  function progress(li, ini) {
    const t = tally(ini, pledgesFor[ini.id] || []);
    UI.ride(li.querySelector('.bar-ride'), t.pct);
    const left = li.querySelector('.ev-left'), text = t.open ? itemsLeft(t.open) : 'اكتملت كل الأصناف';
    if (left.textContent !== text) {
      if (left.textContent) { left.classList.remove('tick'); void left.offsetWidth; left.classList.add('tick'); }
      left.textContent = text;
    }
  }

  // "اليوم!", "باجر!", "باقي يومين"… for the sticker on each open event
  function countdown(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(y, m - 1, d) - today) / 864e5);
    if (days < 0) return '';
    if (days === 0) return 'اليوم!';
    if (days === 1) return 'باجر!';
    if (days === 2) return 'باقي يومين';
    return days <= 10 ? `باقي ${days} أيام` : `باقي ${days} يوم`;
  }

  function card(ini, i, past) {
    const soon = past ? '' : countdown(ini.date);
    // same details as the event page: date and time chips
    const chips = [
      ini.date ? `<span class="info-chip">${icon('cal', 16)}${esc(arDate(ini.date))}</span>` : '',
      ini.time ? `<span class="info-chip">${icon('clock', 16)}${esc(ini.time)}</span>` : ''
    ].join('');
    const progress = past ? '' : `
        <span class="bar-ride" style="--p:0">
          <span class="bar"><span class="bar-fill" style="width:0"></span>${UI.GOAL}</span>
          <img class="ride-bus" src="img/logo-sticker.png" alt="">
        </span>
        <span class="ev-foot">
          <span class="ev-left"></span>
          <span class="btn btn-primary btn-sm ev-btn">يلا!</span>
        </span>`;
    return `<li style="--i:${i}" data-sig="${esc(sig(ini, past))}"><a class="ev-card" href="initiative.html?id=${encodeURIComponent(ini.id)}">
      ${soon ? `<span class="sticker">${soon}</span>` : ''}
      <span class="ev-icon"><img src="${esc(ini.photo || 'img/logo-180.png')}" alt=""></span>
      <span class="ev-main">
        <b class="ev-title">${esc(ini.title)}</b>
        ${chips ? `<span class="ev-chips">${chips}</span>` : ''}
        ${progress}
      </span>
      ${past ? `<span class="ev-go">${icon('check', 22)}</span>` : ''}
    </a></li>`;
  }

})();
