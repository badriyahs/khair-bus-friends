/* Home: one card per initiative (picture, name, date, progress), past ones below. */
(function () {
  const { $, esc, tally, enDate, itemsLeft, byDate, icon } = UI;
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

  function render() {
    if (!initiatives) return;
    const open = initiatives.filter(i => i.status === 'open').sort(byDate);
    const past = initiatives.filter(i => i.status !== 'open').sort((a, b) => byDate(b, a));
    $('#openList').innerHTML = open.length
      ? open.map((ini, i) => card(ini, i, false)).join('')
      : '<li class="empty">لا توجد مبادرات حالياً</li>';
    $('#pastWrap').hidden = !past.length;
    $('#pastList').innerHTML = past.map((ini, i) => card(ini, i, true)).join('');
  }

  function card(ini, i, past) {
    const t = tally(ini, pledgesFor[ini.id] || []);
    const progress = past ? '' : `
        <span class="bar"><span class="bar-fill" style="width:${t.pct}%"></span></span>
        <span class="ev-left">${t.open ? itemsLeft(t.open) : 'اكتملت كل الأصناف'}</span>`;
    return `<li style="--i:${i}"><a class="ev-card" href="initiative.html?id=${encodeURIComponent(ini.id)}">
      <span class="ev-icon"><img src="${esc(ini.photo || 'img/logo-180.png')}" alt=""></span>
      <span class="ev-main">
        <b class="ev-title">${esc(ini.title)}</b>
        ${ini.date ? `<span class="ev-date" dir="ltr">${esc(enDate(ini.date))}</span>` : ''}
        ${progress}
      </span>
      <span class="ev-go">${icon(past ? 'check' : 'chev', 22)}</span>
    </a></li>`;
  }
})();
