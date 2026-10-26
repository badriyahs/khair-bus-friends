/* Home: each initiative as a square post (name, date, progress), past ones below. */
(function () {
  const { $, esc, tally, enDate, itemsLeft, byDate, SQUARE } = UI;
  const TONES = ['sky', 'green', 'lav'];   // the three poster backgrounds
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
      ? open.map((ini, i) => post(ini, i, false)).join('')
      : '<li class="empty">لا توجد مبادرات حالياً</li>';
    $('#pastWrap').hidden = !past.length;
    $('#pastList').innerHTML = past.map((ini, i) => post(ini, i, true)).join('');
  }

  function post(ini, i, past) {
    const t = tally(ini, pledgesFor[ini.id] || []);
    const progress = past ? '' : `
        <div class="bar"><span class="bar-fill" style="width:${t.pct}%"></span></div>
        <p class="post-left">${t.open ? itemsLeft(t.open) : 'اكتملت كل الأصناف'}</p>`;
    return `<li><a class="post tone-${TONES[i % TONES.length]}" href="initiative.html?id=${encodeURIComponent(ini.id)}">
      ${SQUARE}
      <div class="post-in">
        <h3>${esc(ini.title)}</h3>
        ${ini.date ? `<p class="post-date" dir="ltr">${esc(enDate(ini.date))}</p>` : ''}
        ${progress}
      </div>
    </a></li>`;
  }
})();
