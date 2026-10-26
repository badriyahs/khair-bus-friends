/* Home: open initiatives with how much is covered, and past ones below. */
(function () {
  const { $, esc, tally, shortDate, byDate, icon } = UI;
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
      ? open.map(openCard).join('')
      : '<li class="empty">لا توجد مبادرات حالياً</li>';
    $('#pastWrap').hidden = !past.length;
    $('#pastList').innerHTML = past.map(pastCard).join('');
  }

  function top(ini) {
    const d = shortDate(ini.date);
    const meta = [ini.time, ini.place].filter(Boolean).join(' · ');
    return `<div class="ini-card-top">
        <div class="date-badge"><b>${esc(d.day)}</b><span>${esc(d.mon)}</span></div>
        <div><h3>${esc(ini.title)}</h3>${meta ? `<p class="meta">${esc(meta)}</p>` : ''}</div>
      </div>`;
  }

  function openCard(ini) {
    const t = tally(ini, pledgesFor[ini.id] || []);
    const left = t.open ? UI.itemsLeft(t.open) : 'اكتملت كل الأصناف';
    return `<li><a class="ini-card" href="initiative.html?id=${encodeURIComponent(ini.id)}">
      ${top(ini)}
      <div>
        <div class="bar"><span class="bar-fill" style="width:${t.pct}%"></span></div>
        <p class="bar-label"><span>${left}</span>${icon('arrow', 18)}</p>
      </div>
    </a></li>`;
  }

  function pastCard(ini) {
    return `<li><a class="ini-card" href="initiative.html?id=${encodeURIComponent(ini.id)}">${top(ini)}</a></li>`;
  }
})();
