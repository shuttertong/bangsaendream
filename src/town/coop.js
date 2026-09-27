// Co-op lobbies in the hub (multiplayer only). A player asks for a co-op game (e.g. Tom's
// "banana boat with friends"): they become the leader and everyone online gets an invite
// banner. Players who join fill the seats; the leader starts (or the countdown runs out)
// and every seated player's game starts together with a shared seed. Offline, the game
// just starts solo. Messages go over mp.co (see multiplayer.js / tools/serve.py).
import { t } from '../shared/i18n.js';

export const COOP = {
  games: { banana: { max: 4, icon: '🍌', title: 'bananaTitle' } },
  lobbyTime: 25,           // seconds before the boat leaves anyway
  inviteEvery: 2,          // the leader re-announces (so late arrivals see it)
  inviteTTL: 6,            // an invite disappears if not re-announced
};

export function createCoop({ root, mp, hub, startGame, audio }) {
  let lobby = null, announceIn = 0, lastHtml = '';     // lobby: { room, game, seats: [ids], leader, t, pending }
  const invites = new Map();            // room → { game, seats, t, until }
  const now = () => performance.now() / 1000;
  const el = document.createElement('div');
  el.className = 'co-wrap';
  root.appendChild(el);
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };

  hub.coopHandler = id => {
    if (!mp.online || !COOP.games[id]) return startGame(id);      // solo
    host(id);
    return true;
  };

  function host(game) {
    if (lobby) return;
    lobby = { room: mp.id, game, seats: [mp.id], leader: true, t: COOP.lobbyTime };
    announceIn = 0;
    draw();
  }
  function join(room) {
    const inv = invites.get(room);
    if (!inv || lobby) return;
    mp.co.send([room], { k: 'join', room });
    lobby = { room, game: inv.game, seats: inv.seats, leader: false, t: inv.t, pending: true };
    audio?.play('click');
    draw();
  }
  function leave() {
    if (!lobby) return;
    if (lobby.leader) mp.co.send(null, { k: 'cancel', room: lobby.room });
    else mp.co.send([lobby.room], { k: 'leave', room: lobby.room });
    lobby = null;
    draw();
  }
  function go() {
    if (!lobby?.leader) return;
    const seed = Math.floor(Math.random() * 1e6), { room, game, seats } = lobby;
    const others = seats.filter(id => id !== mp.id);
    if (others.length) mp.co.send(others, { k: 'go', room, game, seed, seats });
    mp.co.send(null, { k: 'cancel', room, r: 1 });                  // clear the invite everywhere (quietly)
    lobby = null;
    draw();
    launch(game, 'leader', room, seed, seats);
  }
  function launch(game, role, room, seed, seats) {
    startGame(game, { coop: { role, room, seed, seats, myId: mp.id, co: mp.co, info: id => mp.info(id) } });
  }

  mp.co.on((from, d) => {
    if (!d || typeof d.k !== 'string') return;
    if (d.k === 'invite' && Array.isArray(d.seats) && COOP.games[d.game]) {
      invites.set(d.room, { game: d.game, seats: d.seats, t: d.t, until: now() + COOP.inviteTTL });
      if (lobby && !lobby.leader && lobby.room === d.room) Object.assign(lobby, { seats: d.seats, t: d.t, pending: !d.seats.includes(mp.id) });
    } else if (d.k === 'join' && lobby?.leader && d.room === lobby.room) {
      if (!lobby.seats.includes(from) && lobby.seats.length < COOP.games[lobby.game].max) {
        lobby.seats.push(from);
        announceIn = 0;
        audio?.play('coin');
      }
    } else if (d.k === 'leave' || d.k === 'gone') {
      if (lobby?.leader && lobby.seats.includes(from)) { lobby.seats = lobby.seats.filter(i => i !== from); announceIn = 0; }
      else if (lobby && !lobby.leader && from === lobby.room) { lobby = null; hub.hud?.toast(t('coCancelled')); }
      invites.delete(from);
    } else if (d.k === 'cancel') {
      invites.delete(d.room);
      if (lobby && !lobby.leader && lobby.room === d.room) { lobby = null; if (!d.r) hub.hud?.toast(t('coCancelled')); }
    } else if (d.k === 'go' && lobby && !lobby.leader && lobby.room === d.room && d.seats?.includes(mp.id)) {
      lobby = null;
      draw();
      launch(d.game, 'member', d.room, d.seed, d.seats);
    }
    draw();
  });

  const nameOf = id => mp.info(id)?.name || '…';
  function draw() {
    let html = '';
    if (lobby) {
      const G = COOP.games[lobby.game], seats = [];
      for (let i = 0; i < G.max; i++) seats.push(lobby.seats[i] != null ? `<li>${G.icon} ${nameOf(lobby.seats[i])}${lobby.seats[i] === mp.id ? ` <small>(${t('coYou')})</small>` : ''}</li>` : `<li class="empty">${t('coEmpty')}</li>`);
      html = `<div class="co-lobby"><h3>${G.icon} ${t(G.title)} · ${t('coTeam')}</h3><ul>${seats.join('')}</ul>
        <p>${lobby.pending ? t('coJoinSent') : lobby.leader ? t('coStartsIn', { n: Math.ceil(lobby.t) }) : t('coWaiting', { n: Math.ceil(lobby.t) })}</p>
        <div class="co-btns">${lobby.leader ? `<button class="go">${t('coStart')}</button>` : ''}<button class="out">${lobby.leader ? t('coCancel') : t('coLeave')}</button></div></div>`;
    } else {
      const inv = [...invites.entries()].find(([room]) => room !== mp.id);
      if (inv) {
        const [room, v] = inv, G = COOP.games[v.game];
        html = `<div class="co-invite" data-room="${room}">${G.icon} ${t('coInvite', { name: nameOf(room), game: t(G.title) })} <small>${v.seats.length}/${G.max}</small>
          <button class="join">${t('coJoin')}</button><button class="no">✕</button></div>`;
      }
    }
    if (html === lastHtml) return;
    lastHtml = html;
    el.innerHTML = html;
    el.querySelector('.go')?.addEventListener('pointerdown', stop(go));
    el.querySelector('.out')?.addEventListener('pointerdown', stop(leave));
    el.querySelector('.join')?.addEventListener('pointerdown', stop(() => join(+el.querySelector('.co-invite').dataset.room)));
    el.querySelector('.no')?.addEventListener('pointerdown', stop(() => { invites.delete(+el.querySelector('.co-invite').dataset.room); draw(); }));
  }

  /** busy: in a mini-game (lobbies wait; invites are hidden). */
  function update(dt, busy) {
    el.hidden = busy;
    const tt = now();
    for (const [room, v] of invites) if (v.until < tt) invites.delete(room);
    if (lobby) {
      lobby.t = Math.max(0, lobby.t - dt);
      if (lobby.leader) {
        announceIn -= dt;
        if (announceIn <= 0) { announceIn = COOP.inviteEvery; mp.co.send(null, { k: 'invite', room: lobby.room, game: lobby.game, seats: lobby.seats, t: Math.ceil(lobby.t) }); }
        if (lobby.t <= 0 && !busy) go();
      }
      if (!mp.online) lobby = null;
    }
    draw();
  }

  return { update, get lobby() { return lobby; }, host, join, leave, go, invites };
}
