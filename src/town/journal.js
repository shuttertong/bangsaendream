// สมุดปิดเทอม — the summer journal (📔 button or J): three tasks a day and a streak, a medal for
// every mini-game, badges for things done around town, a title for the badge count and a few
// numbers (shared/goals.js has the data). The hub tells it what happens — event(): a round
// finished, a hello, a truck ride, a new friend — and it watches walking and arrivals itself,
// pays the rewards, shows toasts, and offers the next task to the HUD goal chip once the story
// has no active quest.
import * as P from '../shared/progress.js';
import { t, tr, onLang } from '../shared/i18n.js';
import { GAMES, MEDALS, medalAt, medalOf, DAILY, PLACES_TO_VISIT, dailyTasks, BADGES, titleFor } from '../shared/goals.js';
import { dayKey } from '../shared/wardrobe.js';
import { HOSTS } from './quests.js';

const UI = { key: 'KeyJ', tick: 0.5, walkStep: 10, jump: 8 };   // seconds between checks; metres of walking counted at a time; a longer move in one frame is a teleport

export function createJournal({ root, hub, player, audio }) {
  const J = () => P.get().journal;
  const toast = (m, snd = 'coin') => { hub.hud?.toast(m); audio?.play(snd); };
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  let open = false, tasks = [], tasksDay = null, tickT = 0, lastX = null, lastZ = null, walked = 0;

  // ---------- UI ----------
  const btn = document.createElement('button');
  btn.className = 'b-journal';
  btn.innerHTML = '📔<span></span><i></i>';
  const btns = root.querySelector('#ui .btns');
  btns?.insertBefore(btn, btns.querySelector('.b-info'));
  const modal = document.createElement('div');
  modal.className = 'modal jn-panel';
  modal.innerHTML = `<div class="panel"><h2></h2><div class="jn-head"></div><h3 class="h-today"></h3><div class="list jn-tasks"></div><p class="jn-hint"></p>
    <h3 class="h-medals"></h3><div class="jn-grid jn-medals"></div><h3 class="h-badges"></h3><div class="jn-grid jn-badges"></div><p class="jn-stats"></p><button class="close"></button></div>`;
  root.appendChild(modal);
  const $ = q => modal.querySelector(q);
  btn.addEventListener('pointerdown', stop(() => { audio?.play('click'); toggle(); }));
  $('.close').addEventListener('pointerdown', stop(() => toggle(false)));
  modal.addEventListener('pointerdown', e => { if (e.target === modal) toggle(false); });
  addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT') return;
    if (e.code === UI.key && !hub.frozen && !document.body.classList.contains('in-game')) toggle();
    else if (e.code === 'Escape' && open) toggle(false);
  });
  function toggle(on = !open) { open = on; modal.classList.toggle('on', on); if (on) { rollDay(); draw(); } }

  // ---------- today ----------
  const today = () => dayKey(), yesterday = () => dayKey(new Date(Date.now() - 864e5));
  function todays() { const j = J(); if (tasksDay !== j.day) { tasksDay = j.day; tasks = j.day ? dailyTasks(j.day) : []; } return tasks; }
  const taskText = x => (x.kind === 'visit' ? t('jnVisit', { place: tr(hub.places[x.place]?.name || { th: x.place, en: x.place }) }) : tr(x.text));
  const count = (j, x) => j.tasks[x.id] || 0, isDone = (j, x) => count(j, x) >= x.n;
  const allDone = j => todays().every(x => isDone(j, x));
  /** A new day: new tasks; a streak lives on only through yesterday. */
  function rollDay() {
    const d = today();
    if (J().day === d) return;
    P.updateJournal(j => { j.day = d; j.tasks = {}; if (j.lastFull && j.lastFull !== d && j.lastFull !== yesterday()) j.streak = 0; });
    refreshBtn();
  }
  /** Count `n` toward today's tasks of `kind` that `fits` and are not done yet (inside updateJournal). */
  function progress(j, kind, fits = null, n = 1) {
    for (const x of todays()) {
      if (x.kind !== kind || isDone(j, x) || (fits && !fits(x))) continue;
      j.tasks[x.id] = Math.min(x.n, count(j, x) + n);
      if (!isDone(j, x)) continue;
      P.addBaht(x.reward);
      toast(t('jnTaskDone', { text: taskText(x), n: x.reward }));
      if (allDone(j)) {                                                // the day is done: bonus, and the streak grows
        j.streak = j.lastFull === yesterday() ? j.streak + 1 : 1;
        j.lastFull = today();
        const bonus = DAILY.bonus + DAILY.streakBonus * Math.min(DAILY.streakCap, j.streak - 1);
        P.addBaht(bonus);
        const streak = j.streak;
        setTimeout(() => toast(t('jnAllDone', { n: bonus }) + (streak > 1 ? ` · ${t('jnStreak', { n: streak })}` : ''), 'fanfare'), 700);
      }
    }
  }

  // ---------- what happened ----------
  /** kind: 'game' { id, res } | 'chat' { id } | 'ride' | 'visit' { place } | 'walk' { m } | 'friend' */
  function event(kind, d = {}) {
    rollDay();
    const before = Object.keys(J().badges).length;
    P.updateJournal(j => {
      const st = j.stats;
      if (kind === 'game') {
        const { id, res } = d, baht = res.baht || 0;
        st.games++; st.earned += baht;
        const tier = medalOf(id, baht), paid = j.paid[id] || 0;
        if (tier > paid) {                                             // a new medal tier (each tier pays once per game)
          let pay = 0;
          for (let k = paid; k < tier; k++) { st.medals++; if (k === 2) st.golds++; pay += MEDALS.tiers[k].pay; }
          j.paid[id] = tier;
          P.addBaht(pay);
          const T = MEDALS.tiers[tier - 1];
          setTimeout(() => toast(t('jnMedal', { icon: T.icon, tier: tr(T.name), game: tr(GAMES[id].name), n: pay }), 'fanfare'), 400);
        }
        if (id === 'football' && (res.mine || 0) >= 3) st.hatTrick = true;
        if (id === 'volley') st.fireballs = Math.max(st.fireballs, res.supers || 0);
        progress(j, 'play', x => x.game === id);
        if (baht > 0) progress(j, 'earn', x => baht >= x.amount);
        if (tier >= 1) progress(j, 'medal');
      } else if (kind === 'chat') { st.chats++; progress(j, 'chat'); }
      else if (kind === 'ride') { st.rides++; progress(j, 'ride'); }
      else if (kind === 'visit') { st.visits[d.place] = 1; progress(j, 'visit', x => x.place === d.place); }
      else if (kind === 'walk') { st.m += d.m; progress(j, 'walk', null, d.m); }
      else if (kind === 'friend') st.friends++;
    }, kind !== 'walk');
    badges(before);
    refreshBtn();
    if (open) draw();
  }
  /** Any badge earned since? Pay it, say so, and a new title if the count reaches one. */
  function badges(before) {
    const s = P.get(), j = J(), won = BADGES.filter(b => !j.badges[b.id] && b.check(s, j));
    if (!won.length) return;
    P.updateJournal(j => { for (const b of won) { j.badges[b.id] = today(); P.addBaht(b.pay); } });
    won.forEach((b, i) => setTimeout(() => toast(t('jnBadge', { name: tr(b.name), n: b.pay }), 'fanfare'), 900 + i * 1200));
    const n = Object.keys(J().badges).length;
    if (titleFor(n) !== titleFor(before)) setTimeout(() => toast(t('jnNewTitle', { name: tr(titleFor(n)) }), 'catch'), 900 + won.length * 1200);
    refreshBtn();
    if (open) draw();
  }

  /** Every frame: metres walked (not teleports, not rides), arrivals at places, badges that depend on money or the wardrobe. */
  function update(dt, active) {
    const p = player.state;
    if (lastX !== null && active) { const d = Math.hypot(p.x - lastX, p.z - lastZ); if (d < UI.jump && !hub.seated) walked += d; }
    lastX = p.x; lastZ = p.z;
    if (walked >= UI.walkStep) { const m = Math.floor(walked); walked -= m; event('walk', { m }); }
    if ((tickT -= dt) > 0) return;
    tickT = UI.tick;
    rollDay();
    if (active) {
      const j = J();
      for (const id of PLACES_TO_VISIT) {
        const pl = hub.places[id];
        if (!pl || (j.stats.visits[id] && !todays().some(x => x.kind === 'visit' && x.place === id && !isDone(j, x)))) continue;
        if (Math.hypot(pl.x - p.x, pl.z - p.z) < DAILY.visitWithin) event('visit', { place: id });
      }
    }
    badges(Object.keys(J().badges).length);
  }

  // ---------- the HUD goal chip, once the story is done ----------
  const next = () => { const j = J(); return todays().find(x => !isDone(j, x)) || null; };
  const goalText = () => { const x = next(); return x ? `${x.icon} ${taskText(x)}` : ''; };
  const goalPeople = () => { const x = next(); return x?.kind === 'play' && HOSTS[x.game] ? [HOSTS[x.game]] : []; };

  // ---------- the panel ----------
  function refreshBtn() {
    const j = J(), n = todays().filter(x => !isDone(j, x)).length, i = btn.querySelector('i');
    btn.querySelector('span').textContent = t('journal');
    btn.setAttribute('aria-label', t('journal'));
    i.textContent = n; i.classList.toggle('on', n > 0);
  }
  function draw() {
    const s = P.get(), j = J(), nb = Object.keys(j.badges).length;
    $('h2').textContent = t('jnTitle');
    $('.jn-head').innerHTML = `<span>👑 ${tr(titleFor(nb))}</span>${j.streak ? `<span>${t('jnStreak', { n: j.streak })}</span>` : ''}`;
    $('.h-today').textContent = t('jnToday');
    $('.jn-tasks').innerHTML = todays().map(x => {
      const c = count(j, x), done = isDone(j, x);
      return `<div class="jn-task${done ? ' done' : ''}"><span class="ic">${x.icon}</span><div class="nm">${taskText(x)}${x.n > 1 ? `<div class="bar"><i style="width:${Math.round((100 * c) / x.n)}%"></i></div>` : ''}</div><span class="rw">${done ? '✓' : `+฿${x.reward}`}</span></div>`;
    }).join('');
    $('.jn-hint').textContent = t('jnBonusHint', { n: DAILY.bonus, s: DAILY.streakBonus });
    $('.h-medals').textContent = t('jnMedals');
    $('.jn-medals').innerHTML = Object.entries(GAMES).map(([id, g]) => {
      const best = s.best[id]?.baht || 0, tier = medalOf(id, best), cls = s.best[id] ? ['', 'bronze', 'silver', 'gold'][tier] : 'off';
      const sub = s.best[id] ? `฿${best}${tier < 3 ? ` · ${t('jnNext', { n: medalAt(id)[tier] - best, icon: MEDALS.tiers[tier].icon })}` : ''}` : t('jnNotPlayed');
      return `<div class="jn-tile ${cls}"><span class="ic">${tier ? MEDALS.tiers[tier - 1].icon : g.icon}</span><span class="nm">${tr(g.name)}</span><span class="sub">${sub}</span></div>`;
    }).join('');
    $('.h-badges').textContent = t('jnBadges', { n: nb, of: BADGES.length });
    $('.jn-badges').innerHTML = BADGES.map(b => `<div class="jn-tile ${j.badges[b.id] ? '' : 'off'}"><span class="ic">${b.icon}</span><span class="nm">${tr(b.name)}</span><span class="sub">${tr(b.hint)}</span></div>`).join('');
    $('.jn-stats').textContent = t('jnStats', { games: j.stats.games, earned: j.stats.earned.toLocaleString(), km: (j.stats.m / 1000).toFixed(1), rides: j.stats.rides, chats: j.stats.chats });
    $('.close').textContent = t('close');
  }
  onLang(() => { refreshBtn(); if (open) draw(); });
  rollDay();
  refreshBtn();

  return { event, update, goalText, goalPeople, next, get open() { return open; }, get tasks() { return todays(); } };
}
