// กระดานคะแนน — the leaderboard panel for one mini-game, opened from a medal tile in the journal:
// the top ten of everyone, and the player's friends with the player's own row, from shared/scores.js.
import { t, tr } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import * as F from '../shared/friends.js';
import { fetchTop, fetchPlayers, me } from '../shared/scores.js';
import { GAMES } from '../shared/goals.js';

export function createLeaderboard({ root, audio }) {
  const modal = document.createElement('div');
  modal.className = 'modal lb-panel';
  modal.innerHTML = `<div class="panel"><h2></h2><div class="lb-body"></div><button class="close"></button></div>`;
  root.appendChild(modal);
  const $ = q => modal.querySelector(q), stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  let open = false, game = null;
  $('.close').addEventListener('pointerdown', stop(() => toggle(false)));
  modal.addEventListener('pointerdown', e => { if (e.target === modal) toggle(false); });
  addEventListener('keydown', e => { if (e.code === 'Escape' && open) toggle(false); });
  function toggle(on) { open = on; modal.classList.toggle('on', on); }

  const row = (r, i, mine) => `<div class="lb-row${mine ? ' me' : ''}"><span class="lb-rank">${i + 1}</span><span class="lb-name">${r.name}</span><span class="lb-val">${game === 'takraw' ? t('lbStreak', { n: r.streak }) : `฿${r.baht}`}</span></div>`;
  async function show(id) {
    game = id;
    audio?.play('click');
    $('h2').textContent = `🏆 ${tr(GAMES[id].name)}`;
    $('.close').textContent = t('close');
    $('.lb-body').innerHTML = `<p class="lb-note">${t('lbLoading')}</p>`;
    toggle(true);
    const friends = F.list().map(f => F.keyOf(f.u)), mine = me();
    const [top, mates] = await Promise.all([fetchTop(id), fetchPlayers(id, [...friends, ...(mine ? [mine] : [])])]);
    if (game !== id || !open) return;
    if (!top) { $('.lb-body').innerHTML = `<p class="lb-note">${t('lbOffline')}</p>`; return; }
    const best = P.get().best[id], own = best ? { uid: mine, name: t('tkYou'), baht: best.baht, streak: best.biggest || 0 } : null;
    const list = (mates || []).filter(r => r.uid !== mine);
    if (own) list.push(own);
    list.sort((a, b) => b.baht - a.baht || b.streak - a.streak);
    $('.lb-body').innerHTML = `<h3>${t('lbEveryone')}</h3>${top.length ? top.map((r, i) => row(r, i, r.uid === mine)).join('') : `<p class="lb-note">${t('lbEmpty')}</p>`}`
      + `<h3>${t('lbFriends')}</h3>${list.length ? list.map((r, i) => row(r, i, r.uid === mine)).join('') : `<p class="lb-note">${t('lbNoFriends')}</p>`}`;
  }
  return { show, get open() { return open; } };
}
