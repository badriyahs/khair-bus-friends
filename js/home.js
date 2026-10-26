/* Home: each initiative as a post in their poster frame (name, date, progress), past ones below. */
(function () {
  const { $, esc, tally, enDate, itemsLeft, twoTone, byDate } = UI;
  const FRAMES = ['frame-a', 'frame-b'];   // their two wavy poster frames; past ones get the star frame
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
    return `<li><a class="post ${past ? 'frame-stars' : FRAMES[i % FRAMES.length]}" href="initiative.html?id=${encodeURIComponent(ini.id)}">
      ${past ? '' : '<img class="post-stars" src="img/deco/stars-blue.png" alt="">'}
      <div class="post-in">
        <h3 class="fun-title">${twoTone(ini.title)}</h3>
        ${ini.date ? `<p class="post-date" dir="ltr">${esc(enDate(ini.date))}</p>` : ''}
        ${progress}
      </div>
    </a></li>`;
  }
})();
