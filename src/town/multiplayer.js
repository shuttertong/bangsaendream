// Multiplayer in the hub (local Wi-Fi via tools/serve.py, or online via Supabase Realtime on https): other players on the same network appear as kids
// in their chosen looks, with name tags, preset-phrase speech bubbles and emotes. The red
// trucks are shared: the host player's game drives them (snapshots 10×/s), everyone else
// follows, riders are drawn on each viewer's own copy of the truck. Needs
// the relay in tools/serve.py; without it the game stays single-player and none of this
// UI shows. Names, looks and phrases travel as indices (see shared/avatar.js).
import * as THREE from 'three';
import { connect } from '../core/net.js';
import { createKid } from './kid/index.js';
import { seatPose, SEAT_HIP } from './player.js';
import { lookOf, nameOf, wearLook, saveProfile, reroll } from '../shared/avatar.js';
import { fxOf, wornOf } from '../shared/wardrobe.js';
import * as P from '../shared/progress.js';
import { PHRASES, EMOTES } from '../shared/phrases.js';
import { t, tr, onLang } from '../shared/i18n.js';

const MP = {
  sendHz: 10, keepAlive: 2,          // state updates per second; resend when idle
  truckHz: 10,                       // host: truck snapshots per second
  delay: 0.15,                       // interpolation delay (s) — smooths out network jitter
  tagRange: 40, maxTags: 16,         // name tags for the nearest players within this range
  bubble: 4,                         // seconds a phrase bubble stays up
  emote: { wave: 2.2, dance: 3.5, cheer: 1.6, heart: 2 },
};

export function createMultiplayer({ scene, root, camera, player, hub, map, lift, collision, audio, profile, busy, auras = null }) {
  const hello = () => ({ t: 'hello', ...profile, fx: fxOf(P.get().wardrobe?.worn) });   // name + look + wardrobe (all indices)
  const remotes = new Map(), coFns = new Set();
  let myId = null, hostId = null, sendT = 0, keepT = 0, truckT = 0, last = '';
  const trucks = hub.trucks, slotOf = id => id % trucks.seats;
  trucks.onHoldRequest = (i, on) => net?.send({ t: 'hold', i, on });
  document.addEventListener('visibilitychange', () => net?.send({ t: 'vis', on: document.visibilityState === 'visible' }));
  function setHost(id) {
    hostId = id;
    trucks.setMode(id == null || !myId ? 'local' : id === myId ? 'host' : 'follow');
  }
  const ground = (x, z) => Math.max(map.heightAt(x, z) + lift(x, z), map.sea - collision.wade);
  const now = () => performance.now() / 1000;

  // ---------- UI: chat button, phrase / emote / profile panel, tags, bubbles ----------
  const layer = document.createElement('div');
  layer.className = 'mp-layer';
  root.appendChild(layer);
  const btn = document.createElement('button');
  btn.className = 'b-chat';
  btn.innerHTML = '💬<i></i>';
  const btns = root.querySelector('#ui .btns');
  btns?.insertBefore(btn, btns.querySelector('.b-info'));
  const panel = document.createElement('div');
  panel.className = 'modal mp-panel';
  root.appendChild(panel);
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(e); };
  btn.addEventListener('pointerdown', stop(() => { audio?.play('click'); toggle(); }));
  panel.addEventListener('pointerdown', e => { if (e.target === panel) toggle(false); });
  addEventListener('keydown', e => {
    if (e.code === 'KeyT' && net?.online && !hub.frozen) toggle();
    else if (e.code === 'Escape') toggle(false);
  });

  function drawPanel() {
    const looks = [['shirt', '👕'], ['bottom', '🩳'], ['hat', '👒'], ['hatColor', '🎨'], ['hair', '💇'], ['skin', '🧒']];
    panel.innerHTML = `<div class="panel">
      <h2>${t('mpTitle')} <small>${t('mpOnline', { n: remotes.size + 1 })}</small></h2>
      <div class="mp-me"><b>${nameOf(profile.n1, profile.n2)}</b><button data-r="name">🎲 ${t('mpNewName')}</button>
        ${looks.map(([k, ic]) => `<button data-r="${k}" title="${k}">${ic}</button>`).join('')}</div>
      <div class="mp-phrases">${PHRASES.map((p, i) => `<button data-p="${i}">${p.icon} ${tr(p)}</button>`).join('')}</div>
      <div class="mp-emotes">${EMOTES.map(e => `<button data-e="${e.id}">${e.icon}</button>`).join('')}</div>
      <button class="close">${t('close')}</button></div>`;
    panel.querySelector('.close').addEventListener('pointerdown', stop(() => toggle(false)));
    for (const b of panel.querySelectorAll('[data-p]')) b.addEventListener('pointerdown', stop(() => { say(+b.dataset.p); toggle(false); }));
    for (const b of panel.querySelectorAll('[data-e]')) b.addEventListener('pointerdown', stop(() => { emote(b.dataset.e); toggle(false); }));
    for (const b of panel.querySelectorAll('[data-r]')) b.addEventListener('pointerdown', stop(() => {
      reroll(profile, b.dataset.r);
      saveProfile(profile);
      if (b.dataset.r !== 'name') { wearLook(profile.look); player.setLook(lookOf(profile.look)); }
      net?.send(hello());
      audio?.play('click');
      drawPanel();
    }));
  }
  function toggle(on = !panel.classList.contains('on')) {
    if (on) drawPanel();
    panel.classList.toggle('on', on);
  }
  const refreshCount = () => { btn.querySelector('i').textContent = remotes.size ? remotes.size + 1 : ''; };
  onLang(() => { for (const r of remotes.values()) r.tag.firstChild.textContent = nameOf(r.n1, r.n2); if (panel.classList.contains('on')) drawPanel(); });

  function bubbleFor(owner, text) {
    owner.bubble.textContent = text;
    owner.bubble.classList.add('on');
    owner.bubbleT = MP.bubble;
  }

  // ---------- local player ----------
  const me = { bubble: Object.assign(document.createElement('div'), { className: 'mp-bubble' }), bubbleT: 0, emote: null, emoteT: 0 };
  layer.appendChild(me.bubble);
  function say(i) {
    net?.send({ t: 'say', p: i });
    bubbleFor(me, `${PHRASES[i].icon} ${tr(PHRASES[i])}`);
    audio?.play('click');
  }
  function emote(e) {
    net?.send({ t: 'emote', e });
    Object.assign(me, { emote: e, emoteT: MP.emote[e] });
    if (e === 'heart') bubbleFor(me, '❤️');
  }

  // ---------- remote players ----------
  function add(p) {
    remove(p.id);
    const kid = createKid(scene, lookOf(p.look, p.fx));
    const aura = wornOf(p.fx).aura;
    if (aura) auras?.set(`p${p.id}`, aura, v => (remotes.get(p.id)?.kid.mesh.visible ? v.copy(remotes.get(p.id).kid.mesh.position).setY(remotes.get(p.id).kid.mesh.position.y + 0.9) : null)); else auras?.remove(`p${p.id}`);
    const tag = document.createElement('div');
    tag.className = 'mp-tag';
    tag.innerHTML = `<span></span><i></i>`;
    tag.firstChild.textContent = nameOf(p.n1, p.n2);
    const bubble = document.createElement('div');
    bubble.className = 'mp-bubble';
    layer.append(tag, bubble);
    const r = { id: p.id, n1: p.n1, n2: p.n2, look: p.look, kid, tag, bubble, bubbleT: 0, emote: null, emoteT: 0, buf: [], shown: null, prev: null };
    remotes.set(p.id, r);
    if (p.state) push(r, p.state);
    kid.mesh.visible = !!p.state;
    refreshCount();
    return r;
  }
  function remove(id) {
    auras?.remove(`p${id}`);
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.kid.mesh);
    r.kid.mesh.traverse(o => o.geometry?.dispose?.());
    r.tag.remove(); r.bubble.remove();
    remotes.delete(id);
    refreshCount();
  }
  function push(r, s) {
    r.buf.push({ ...s, t: now() });
    r.last = r.buf[r.buf.length - 1];
    if (r.buf.length > 30) r.buf.shift();
  }

  const net = connect({
    onOpen: () => net.send(hello()),
    onClose: () => { for (const id of [...remotes.keys()]) remove(id); myId = null; hub.seatSlot = 0; setHost(null); btn.classList.remove('on'); },
    onFail: () => { if (net?.rates) hub.hud?.toast(t('mpOffline')); },   // online hub unreachable (Wi-Fi relay failing is normal on static hosts)
    onMessage: m => {
      if (m.t === 'welcome') {
        myId = m.id; btn.classList.add('on');
        hub.seatSlot = slotOf(myId);
        net.send({ t: 'vis', on: document.visibilityState === 'visible' });   // hidden tabs can't host the trucks
        setHost(m.host);
        for (const p of m.players) add(p);
        hub.hud?.toast(t('mpOnline', { n: m.players.length }));
        last = '';                                            // send our state right away
      } else if (m.t === 'join') {
        const r = remotes.get(m.id);
        if (r && r.n1 === m.n1 && r.n2 === m.n2) { add(m); return; }   // look changed
        add(m);
        hub.hud?.toast(t('mpJoined', { name: nameOf(m.n1, m.n2) }));
        audio?.play('coin');
      } else if (m.t === 'leave') {
        const r = remotes.get(m.id);
        if (r) hub.hud?.toast(t('mpLeft', { name: nameOf(r.n1, r.n2) }));
        remove(m.id);
        for (const tk of trucks.trucks) tk.holds.delete(m.id);           // their pull-over requests go with them
        for (const fn of coFns) fn(m.id, { k: 'gone' });
      } else if (m.t === 'co') {
        for (const fn of coFns) fn(m.from, m.d);
      } else if (m.t === 'host') {
        setHost(m.id);
      } else if (m.t === 'trucks') {
        if (trucks.mode === 'follow') trucks.sync(m.s);
      } else if (m.t === 'hold') {
        const tk = trucks.trucks[m.i];
        if (tk && trucks.mode === 'host') trucks.setHold(tk, m.on, m.id);
      } else if (m.t === 'state') {
        const r = remotes.get(m.id);
        if (r) { push(r, m); r.kid.mesh.visible = true; }
      } else if (m.t === 'say') {
        const r = remotes.get(m.id), p = PHRASES[m.p];
        if (r && p) { bubbleFor(r, `${p.icon} ${tr(p)}`); audio?.play('click'); }
      } else if (m.t === 'emote') {
        const r = remotes.get(m.id);
        if (r && MP.emote[m.e]) { Object.assign(r, { emote: m.e, emoteT: MP.emote[m.e] }); if (m.e === 'heart') bubbleFor(r, '❤️'); }
      }
    },
  });

  /** Interpolated state `delay` seconds in the past. */
  function sample(r) {
    const rt = now() - (net?.rates?.delay ?? MP.delay), b = r.buf;
    if (!b.length) return null;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > rt) i--;
    const B = b[i], A = b[Math.max(0, i - 1)];
    if (A === B || B.t <= A.t || rt >= B.t) return B;
    const k = Math.max(0, Math.min(1, (rt - A.t) / (B.t - A.t)));
    let dy = B.yaw - A.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return { ...B, x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k, z: A.z + (B.z - A.z) * k, yaw: A.yaw + dy * k };
  }

  /** Emote bones on top of the walk/idle pose. */
  function applyEmote(o, bones, dt, t) {
    if (!o.emote) return;
    o.emoteT -= dt;
    if (o.emoteT <= 0) { o.emote = null; return; }
    const B = bones, k = Math.min(1, o.emoteT * 3);
    if (o.emote === 'wave') { B.armR.rotation.set(-2.6 * k, 0, -0.4 + Math.sin(t * 14) * 0.45); B.foreR.rotation.x = -0.5; }
    else if (o.emote === 'dance') {
      B.hips.rotation.z = Math.sin(t * 8) * 0.18; B.spine.rotation.z = -Math.sin(t * 8) * 0.25;
      B.armL.rotation.set(-2.4 + Math.sin(t * 8) * 0.5, 0, 0.5); B.armR.rotation.set(-2.4 - Math.sin(t * 8) * 0.5, 0, -0.5);
    } else if (o.emote === 'cheer') { B.armL.rotation.set(-2.9 * k, 0, 0.3); B.armR.rotation.set(-2.9 * k, 0, -0.3); B.foreL.rotation.x = B.foreR.rotation.x = 0; }
  }

  const v = new THREE.Vector3();
  function place(el, obj, lift2) {
    obj.mesh.updateMatrixWorld();
    obj.bones.head.getWorldPosition(v);
    v.y += lift2;
    const d = v.distanceTo(camera.position);
    v.project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    if (vis) { el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`; }
    return vis ? d : Infinity;
  }

  /** active = the hub is on screen (not in a mini-game). */
  function update(dt, active) {
    const tt = now();
    // send our state (also while in a mini-game, so others see the 🎮 badge)
    sendT -= dt; keepT -= dt;
    if (net?.online && myId && sendT <= 0) {
      sendT = 1 / (net.rates?.sendHz ?? MP.sendHz);
      const p = player.state, s = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), pose: hub.pose, busy: busy() || null, air: !p.grounded, ride: hub.ride };
      const key = JSON.stringify(s);
      if (key !== last || keepT <= 0) { net.send({ t: 'state', ...s }); last = key; keepT = net.rates?.keepAlive ?? MP.keepAlive; }
    }
    // host: keep the shared trucks running (also while we're in a mini-game) and broadcast them
    if (trucks.mode === 'host') {
      if (!active) trucks.update(dt, trucks.extra);
      truckT -= dt;
      if (truckT <= 0) { truckT = 1 / (net?.rates?.truckHz ?? MP.truckHz); net?.send({ t: 'trucks', s: trucks.snapshot() }); }
    }
    // the trucks brake for other players in the road too
    trucks.extra = [...remotes.values()].filter(r => r.last && !r.last.busy).map(r => ({ x: r.last.x, z: r.last.z, ride: r.last.ride != null ? trucks.trucks[r.last.ride] : null }));
    layer.hidden = !active;
    if (!active) return;

    for (const r of remotes.values()) {
      const s = sample(r);
      if (!s) continue;
      const B = r.kid.bones, tk = s.ride != null ? trucks.trucks[s.ride] : null;
      if (tk) {
        // riding: sit in their seat on OUR copy of the truck (no lag behind it)
        trucks.seat(tk, v, slotOf(r.id));
        r.kid.mesh.position.set(v.x, v.y - SEAT_HIP, v.z); r.kid.mesh.rotation.y = trucks.seatYaw(tk, slotOf(r.id));
        seatPose(B, 'bench');
        r.prev = null;
      } else if (s.pose) {
        r.kid.mesh.position.set(s.x, s.y, s.z); r.kid.mesh.rotation.y = s.yaw;
        seatPose(B, s.pose);
        r.prev = null;
      } else {
        const moved = r.prev ? Math.hypot(s.x - r.prev.x, s.z - r.prev.z) : 0;
        let turn = r.prev ? s.yaw - r.prev.yaw : 0; turn = Math.atan2(Math.sin(turn), Math.cos(turn)) / (dt || 1);
        const speed = dt > 0 ? Math.min(8, moved / dt) : 0;
        r.kid.update(dt, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, speed, dist: moved, accel: 0, turn, grounded: !s.air, vy: 0, groundAt: ground });
        r.prev = { x: s.x, z: s.z, yaw: s.yaw };
      }
      applyEmote(r, B, dt, tt);
      r.busy = s.busy;
    }
    applyEmote(me, player.kid.bones, dt, tt);

    // name tags for the nearest players; bubbles
    const tagged = [...remotes.values()].map(r => ({ r, d: r.kid.mesh.visible ? place(r.tag, r.kid, 0.55) : Infinity }))
      .sort((a, b) => a.d - b.d);
    tagged.forEach(({ r, d }, i) => {
      const on = d < MP.tagRange && i < MP.maxTags;
      r.tag.classList.toggle('on', on);
      r.tag.lastChild.textContent = r.busy ? '🎮' : '';
      r.bubbleT -= dt;
      const bOn = r.bubbleT > 0 && d < MP.tagRange * 1.5;
      if (bOn) place(r.bubble, r.kid, 0.95);
      r.bubble.classList.toggle('on', bOn);
    });
    me.bubbleT -= dt;
    if (me.bubbleT > 0) place(me.bubble, player.kid, 0.95);
    me.bubble.classList.toggle('on', me.bubbleT > 0);
  }

  /** Name + look indices of a player (us or someone else), for co-op games. */
  function info(id) {
    if (id === myId) return { id, name: nameOf(profile.n1, profile.n2), look: profile.look };
    const r = remotes.get(id);
    return r ? { id, name: nameOf(r.n1, r.n2), look: r.look } : null;
  }
  // co-op mini-game channel: to = [ids] or null for everyone; d = small numeric payload
  const co = { send: (to, d) => net?.send({ t: 'co', to, d }), on: fn => coFns.add(fn), off: fn => coFns.delete(fn) };

  return { update, remotes, info, co, rehello: () => net?.send(hello()), get online() { return !!(net?.online && myId); }, get host() { return hostId; }, get id() { return myId; }, say, emote, debug: { net, sample } };
}
