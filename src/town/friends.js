// 👫 Friends. Two players who meet face to face each press 🤝 — when both have, they are friends
// (saved on each device, shared/friends.js). The friends panel (button or G) shows a map of the
// coast with a dot for every friend who is online, and a list; picking a friend shows where they
// are and can send the drone over to look at them. Everything travels on the co-op channel as
// numbers and short words: { k: 'fid', n, i } tells others our random id, { k: 'friend', n, i }
// is the 🤝. No typed text, no personal data.
import * as F from '../shared/friends.js';
import { FRIENDS } from '../shared/friends.js';
import { nameOf } from '../shared/avatar.js';
import { createFriendMap } from './friendmap.js';
import { t, tr, onLang } from '../shared/i18n.js';

const UI = { tick: 0.25, mapTick: 1, droneDist: 90, dronePitch: 0.8, key: 'KeyG' };

export function createFriends({ root, mp, player, hub, drone, map, audio }) {
  const uids = new Map();          // session id → friend key ("a-b") of players who told us their id
  const uidOf = new Map();         // session id → [a, b]
  const asked = new Map(), got = new Map();   // session id → time (s) we pressed 🤝 / they did
  const told = new Set();          // session ids we have sent our id to
  let tickT = 0, mapT = 0, cand = null, selected = null, open = false, wasOnline = false;
  const now = () => performance.now() / 1000;
  const fresh = (m, id) => m.has(id) && now() - m.get(id) < FRIENDS.askTtl;
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(e); };
  const me = () => F.myUid();

  // ---------- UI ----------
  const btn = document.createElement('button');
  btn.className = 'b-friends';
  btn.innerHTML = '👫<span></span><i></i>';
  const btns = root.querySelector('#ui .btns');
  btns?.insertBefore(btn, btns.querySelector('.b-info'));
  const ask = document.createElement('button');
  ask.className = 'fr-ask';
  root.appendChild(ask);
  const modal = document.createElement('div');
  modal.className = 'modal fr-panel';
  modal.innerHTML = `<div class="panel"><h2></h2><canvas class="fr-map"></canvas><div class="fr-card"></div><div class="list"></div><p class="fr-how"></p><button class="close"></button></div>`;
  root.appendChild(modal);
  const $ = q => modal.querySelector(q);
  const fmap = createFriendMap($('.fr-map'), map, { onPick: key => { selected = key; draw(); } });

  btn.addEventListener('pointerdown', stop(() => { audio?.play('click'); toggle(); }));
  ask.addEventListener('pointerdown', stop(() => { if (cand) press(cand.id); }));
  $('.close').addEventListener('pointerdown', stop(() => toggle(false)));
  modal.addEventListener('pointerdown', e => { if (e.target === modal) toggle(false); });
  addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT') return;
    if (e.code === UI.key && !hub.frozen && !document.body.classList.contains('in-game')) toggle();
    else if (e.code === 'Escape' && open) toggle(false);
  });

  // ---------- who is where ----------
  /** The remote player (if online now) for a saved friend. */
  const remoteOf = f => { for (const [id, key] of uids) if (key === F.keyOf(f.u) && mp.remotes.has(id)) return mp.remotes.get(id); return null; };
  function placeNear(x, z) {
    let best = null, bd = Infinity;
    for (const p of Object.values(hub.places)) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best ? tr(best.name) : '';
  }
  function status(f) {
    const r = remoteOf(f);
    if (!r) return t('frOffline');
    if (r.last?.busy) return t('frPlaying');
    if (!r.last) return t('frOnline');
    const p = player.state;
    return t('frAt', { place: placeNear(r.last.x, r.last.z), m: Math.round(Math.hypot(r.last.x - p.x, r.last.z - p.z)) });
  }

  function draw() {
    const friends = F.list(), online = friends.filter(remoteOf);
    btn.querySelector('span').textContent = t('friends'); btn.setAttribute('aria-label', t('friends'));
    btn.querySelector('i').textContent = online.length || '';
    if (!open) return;
    $('h2').textContent = t('frTitle', { n: friends.length, on: online.length });
    $('.close').textContent = t('close');
    $('.fr-how').textContent = t(mp.online ? 'frHow' : 'frHowOffline');
    if (selected && !friends.some(f => F.keyOf(f.u) === selected)) selected = null;
    const sorted = [...friends].sort((a, b) => !!remoteOf(b) - !!remoteOf(a));
    $('.list').innerHTML = sorted.length ? sorted.map(f => {
      const key = F.keyOf(f.u), on = !!remoteOf(f);
      return `<button class="dest ${on ? 'on' : 'off'} ${key === selected ? 'sel' : ''}" data-k="${key}"><span class="ic">${on ? '🟢' : '⚪'}</span><span class="nm">${nameOf(f.n1, f.n2)}</span><span class="here">${status(f)}</span></button>`;
    }).join('') : `<p class="empty">${t('frNone')}</p>`;
    for (const b of modal.querySelectorAll('[data-k]')) b.addEventListener('pointerdown', stop(() => { selected = b.dataset.k; focusSelected(); draw(); }));
    const f = friends.find(x => F.keyOf(x.u) === selected), card = $('.fr-card');
    card.hidden = !f;
    if (f) {
      const r = remoteOf(f);
      card.innerHTML = `<b>${nameOf(f.n1, f.n2)}</b><span>${status(f)}</span>
        ${r?.last ? `<button class="fr-see">🚁 ${t('frSee')}</button>` : ''}<button class="fr-del">${t('frRemove')}</button>`;
      card.querySelector('.fr-see')?.addEventListener('pointerdown', stop(() => see(f)));
      card.querySelector('.fr-del').addEventListener('pointerdown', stop(e => {
        if (e.currentTarget.dataset.sure) { F.remove(f.u); selected = null; audio?.play('click'); draw(); }
        else { e.currentTarget.dataset.sure = 1; e.currentTarget.textContent = t('frRemoveSure'); }
      }));
    }
    drawMap();
  }
  function drawMap() {
    const p = player.state, dots = [{ key: 'me', kind: 'me', x: p.x, z: p.z, name: t('frMe') }];
    const friendKeys = new Set(F.list().map(f => F.keyOf(f.u)));
    for (const [id, r] of mp.remotes) {
      if (!r.last) continue;
      const key = uids.get(id), isF = key && friendKeys.has(key);
      dots.push({ key: isF ? key : `p${id}`, kind: isF ? 'friend' : 'other', x: r.last.x, z: r.last.z, name: nameOf(r.n1, r.n2) });
    }
    fmap.set(dots, selected);
  }
  function focusSelected() {
    const f = F.list().find(x => F.keyOf(x.u) === selected), r = f && remoteOf(f);
    if (r?.last) fmap.center(r.last.x, r.last.z);
  }
  function toggle(on = !open) {
    open = on;
    modal.classList.toggle('on', on);
    if (on) { draw(); fmap.open(); drawMap(); }
  }
  /** Send the drone over a friend. */
  function see(f) {
    const r = remoteOf(f);
    if (!r?.last) return;
    toggle(false);
    drone.enter();
    drone.flyTo({ x: r.last.x, z: r.last.z, dist: UI.droneDist, pitch: UI.dronePitch });
  }

  // ---------- the 🤝 ----------
  function press(id) {
    const r = mp.remotes.get(id);
    if (!r?.last || !mp.online) return;
    const p = player.state;
    if (Math.hypot(r.last.x - p.x, r.last.z - p.z) > FRIENDS.range) return;
    asked.set(id, now());
    mp.co.send([id], { k: 'friend', n: me()[0], i: me()[1] });
    audio?.play('click');
    if (!check(id)) hub.hud?.toast(t('frAsked', { name: nameOf(r.n1, r.n2) }));
  }
  /** Both pressed → friends. */
  function check(id) {
    const r = mp.remotes.get(id), u = uidOf.get(id);
    if (!r || !u || !fresh(asked, id) || !fresh(got, id)) return false;
    asked.delete(id); got.delete(id);
    const isNew = F.add(u, { n1: r.n1, n2: r.n2, look: r.look });
    if (isNew) { hub.hud?.toast(t('frNow', { name: nameOf(r.n1, r.n2) })); audio?.play('coin'); mp.emote('heart'); }
    draw();
    return true;
  }
  mp.co.on((from, d) => {
    if (!d || (d.k !== 'fid' && d.k !== 'friend') || !F.okUid([d.n, d.i])) return;
    const u = [d.n, d.i], r = mp.remotes.get(from);
    uids.set(from, F.keyOf(u)); uidOf.set(from, u);
    if (r && F.isFriend(u)) F.add(u, { n1: r.n1, n2: r.n2, look: r.look });     // keep a friend's name and look up to date
    if (d.k === 'friend' && r) {
      got.set(from, now());
      if (!check(from) && !F.isFriend(u)) { hub.hud?.toast(t('frWants', { name: nameOf(r.n1, r.n2) })); audio?.play('click'); }
    }
    draw();
  });

  function update(dt, active) {
    tickT -= dt;
    if (tickT > 0) return;
    tickT = UI.tick;
    const online = mp.online;
    if (!online) { told.clear(); uids.clear(); uidOf.clear(); }
    if (online !== wasOnline) { wasOnline = online; draw(); }
    // tell newcomers our id (so a friend sees us on their map) and forget those who left
    if (online) {
      const fresh2 = [...mp.remotes.keys()].filter(id => !told.has(id));
      if (fresh2.length) { for (const id of fresh2) told.add(id); for (let i = 0; i < fresh2.length; i += 8) mp.co.send(fresh2.slice(i, i + 8), { k: 'fid', n: me()[0], i: me()[1] }); }
      for (const id of [...told]) if (!mp.remotes.has(id)) { told.delete(id); uids.delete(id); uidOf.delete(id); asked.delete(id); got.delete(id); draw(); }
    }
    // the 🤝 button: the nearest player in reach who is not a friend yet
    cand = null;
    if (online && active && !hub.frozen && !open && !document.body.classList.contains('drone')) {
      const p = player.state;
      let bd = FRIENDS.range;
      for (const r of mp.remotes.values()) {
        if (!r.last || r.last.busy || r.last.ride != null) continue;
        const u = uidOf.get(r.id);
        if (u && F.isFriend(u)) continue;
        const d = Math.hypot(r.last.x - p.x, r.last.z - p.z);
        if (d < bd) { bd = d; cand = r; }
      }
    }
    ask.classList.toggle('on', !!cand);
    if (cand) {
      const name = nameOf(cand.n1, cand.n2), theirs = fresh(got, cand.id), mine = fresh(asked, cand.id);
      ask.textContent = mine ? t('frWaiting', { name }) : theirs ? t('frAccept', { name }) : t('frAsk', { name });
      ask.classList.toggle('pulse', theirs && !mine);
      ask.disabled = mine;
    }
    if (open) { mapT -= UI.tick; if (mapT <= 0) { mapT = UI.mapTick; draw(); } }
  }
  onLang(draw);
  draw();

  return { update, toggle, press, get open() { return open; }, debug: { uids, asked, got, get cand() { return cand; } } };
}
