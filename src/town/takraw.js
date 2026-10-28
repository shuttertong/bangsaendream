// ตะกร้อวง — a takraw keep-up circle on the sand that anyone online can walk up to and join (F),
// with no lobby: the people in the circle keep the ball in the air together, and the streak pays
// everyone in it when the ball drops. Alone it is juggling (เดาะตะกร้อ). Each player judges their
// own touches on their own device and tells the others what the ball does next (co-op channel:
// { k: 'tk', e: 'join' | 'leave' | 'kick' | 'drop', i: to whom, t: flight ms, n: streak }), so
// the ball never waits for a server; spots round the circle come from the member ids, the same
// on every device. One button: the jump button kicks when the ball comes down to you (push the
// stick toward someone to send it to them); moving away or F leaves the circle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedMaterial } from '../world/materials.js';
import { paint } from '../shared/beachset.js';
import { t, tr } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import { payNow } from '../shared/events.js';

export const TK = {
  radius: 2.6, joinRange: 4.6, spots: 8,            // the circle (m), how close the F prompt shows, most players
  ballR: 0.11, kickH: 0.75, g: 9.81,                // ball radius, the height a kick meets it, gravity for the arcs
  flight: [1.5, 1.75], speedUp: 0.012, minFlight: 0.85,   // seconds in the air (good → perfect kick); shorter per touch down to minFlight
  window: 0.26, perfect: 0.08,                      // seconds either side of the ball's arrival that count (and count as perfect)
  pay: { perTouch: 0.8, together: 0.2, cap: 120, min: 3 },   // ฿ per touch for everyone in the circle, +20 % with 3 or more; capped; streaks under `min` pay nothing
  kickPose: 0.38, leaveMove: 0.5,                   // seconds the leg swings; stick push that walks out of the circle
  colors: { rope: '#2f6fc4', ball: '#d9a74a', weave: '#a8782c', ring: '#ffffff', go: '#7dff6a' },
};
const ME = 0;                                        // our id while offline

/** Where a member stands: ids sorted, evenly round the circle; facing the centre. */
export function spotOf(ids, id, c) {
  const list = [...ids].sort((a, b) => a - b), n = list.length, k = Math.max(0, list.indexOf(id)), a = (k / Math.max(1, n)) * Math.PI * 2 + 0.4;
  const r = n > 1 ? TK.radius : 0.9;
  return { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r, yaw: a + Math.PI };
}

export function createTakraw({ scene, root, hub, mp, player, audio, map, lift, collision, spot }) {
  if (!spot) return { near: false, playing: false, join() {}, leave() {}, update() {}, press() {} };
  const C = { x: spot.x, z: spot.z }, ground = (x, z) => Math.max(map.heightAt(x, z) + lift(x, z), map.sea);
  C.y = ground(C.x, C.z);
  const myId = () => mp?.id ?? ME, now = () => performance.now() / 1000;
  const members = new Set(), ball = { state: 'rest', x: C.x, y: C.y + TK.ballR, z: C.z, from: null, to: null, toId: null, t0: 0, T: 1, apex: 1 };
  const s = { playing: false, near: false, streak: 0, best: () => P.get().best.takraw?.biggest || 0, kick: 0, wasAct: false, joinT: 0, members: 1 };
  const toast = (m, snd = 'coin') => { hub.hud?.toast(m); audio?.play(snd); };

  // ---------- the circle on the sand and the ball ----------
  const rope = paint(new THREE.TorusGeometry(TK.radius + 0.35, 0.025, 6, 48).rotateX(Math.PI / 2), TK.colors.rope);
  const rp = rope.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setY(i, rp.getY(i) + ground(C.x + rp.getX(i), C.z + rp.getZ(i)) - C.y + 0.02);
  const deco = new THREE.Mesh(rope, paintedMaterial({ amp: 0.05, scale: 1 }));
  deco.position.set(C.x, C.y, C.z);
  deco.receiveShadow = true;
  const bg = [paint(new THREE.SphereGeometry(TK.ballR, 18, 12), TK.colors.ball)];
  for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2], [Math.PI / 4, Math.PI / 4], [-Math.PI / 4, Math.PI / 4]]) bg.push(paint(new THREE.TorusGeometry(TK.ballR + 0.004, 0.011, 5, 28).rotateX(rx).rotateZ(rz), TK.colors.weave));   // the weave
  const ballMesh = new THREE.Mesh(mergeGeometries(bg), paintedMaterial({ amp: 0.08, scale: 1 }));
  ballMesh.castShadow = true;
  const blob = new THREE.Mesh(new THREE.CircleGeometry(TK.ballR * 1.3, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3a2f20', transparent: true, opacity: 0.3, depthWrite: false }));
  const ringMat = () => new THREE.MeshBasicMaterial({ color: TK.colors.ring, transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 40).rotateX(-Math.PI / 2), ringMat());
  const timer = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 40).rotateX(-Math.PI / 2), ringMat());
  for (const m of [blob, ring, timer]) m.renderOrder = 2;
  ring.visible = timer.visible = false;
  scene.add(deco, ballMesh, blob, ring, timer);
  collision?.circle(C.x, C.z, 0.01, 0);                                 // (nothing solid: the circle is open sand)

  // ---------- HUD chip ----------
  const chip = document.createElement('div');
  chip.className = 'tk-chip';
  root.querySelector('#ui .head')?.appendChild(chip);
  function drawChip() {
    const on = s.playing || s.near;
    chip.classList.toggle('on', on);
    if (!on) return;
    chip.innerHTML = `<b>🥎 ${t('tkName')}</b> · ${t('tkChip', { n: s.streak, p: members.size })} · ${t('tkBest', { n: s.best() })}`
      + (s.playing && ball.state === 'rest' ? `<br><small>${t('tkServe')}</small>` : '');
  }

  // ---------- the net: who is in, where the ball goes ----------
  const send = d => { if (mp?.online) mp.co.send(null, { k: 'tk', ...d }); };
  const name = id => (id === myId() ? t('tkYou') : mp?.info(id)?.name || '…');
  mp?.co.on((from, d) => {
    if (d?.k === 'gone') { if (members.delete(from)) { reseat(); } return; }
    if (d?.k !== 'tk') return;
    if (d.e === 'join') {
      if (!members.has(from)) { members.add(from); reseat(); if (s.playing) { toast(t('tkJoined', { name: name(from) }), 'coin'); send({ e: 'join', to: [from] }); } }
      else if (s.playing) mp.co.send([from], { k: 'tk', e: 'join' });   // (tell the newcomer we are here)
    } else if (d.e === 'leave') { if (members.delete(from)) reseat(); }
    else if (d.e === 'kick') { if (members.has(from)) fly(from, d.i, d.t / 1000, d.n); }
    else if (d.e === 'drop') dropped(d.n, false);
  });

  // ---------- joining and leaving ----------
  function reseat() {
    s.members = members.size;
    if (s.playing && members.has(myId())) { const q = spotOf(members, myId(), C); player.place(q.x, q.z, q.yaw); }
    if (members.size === 0 && ball.state === 'air') rest();
    drawChip();
  }
  function join() {
    if (s.playing) return;
    s.playing = true; s.joinT = now();
    members.add(myId());
    if (mp?.online) mp.co.send(null, { k: 'tk', e: 'join' });
    reseat();
    if (ball.state === 'rest') toast(t('tkServe'), 'click');
    audio?.play('thud');
  }
  function leave() {
    if (!s.playing) return;
    s.playing = false;
    members.delete(myId());
    if (mp?.online) mp.co.send(null, { k: 'tk', e: 'leave' });
    if (ball.toId === myId() && ball.state === 'air') dropped(s.streak, true);
    reseat();
    ring.visible = timer.visible = false;
  }

  // ---------- the ball ----------
  function rest() { Object.assign(ball, { state: 'rest', x: C.x, z: C.z, y: C.y + TK.ballR, toId: null }); }
  /** The ball leaves `from` for `toId`, `T` seconds in the air; n = the streak once it gets there. */
  function fly(from, toId, T, n) {
    const a = spotOf(members, from, C), b = members.has(toId) ? spotOf(members, toId, C) : a;
    Object.assign(ball, { state: 'air', from: { x: a.x, z: a.z }, to: { x: b.x, z: b.z }, toId, t0: now(), T, apex: (TK.g * T * T) / 8 });
    s.streak = n;
    if (from !== myId()) audio?.play('kick');
    drawChip();
  }
  /** Our own kick: pick who gets it (the stick points at them, else anyone but us), and how long it flies. */
  function kick(quality) {
    const ids = [...members], others = ids.filter(id => id !== myId());
    let to = myId();
    if (others.length) {
      const { f, r, mag } = player.input?.axis?.() || { f: 0, r: 0, mag: 0 };
      if (mag > 0.4 && hub.camYaw !== undefined) {                      // aim: the member nearest the direction the stick points (camera-relative)
        const cy = hub.camYaw, dx = -Math.sin(cy) * f - Math.cos(cy) * r, dz = -Math.cos(cy) * f + Math.sin(cy) * r;
        to = others.reduce((best, id) => { const q = spotOf(members, id, C), d = (q.x - player.state.x) * dx + (q.z - player.state.z) * dz; return d > best.d ? { id, d } : best; }, { id: others[0], d: -Infinity }).id;
      } else to = others[Math.floor(Math.random() * others.length)];
    }
    const base = TK.flight[0] + (TK.flight[1] - TK.flight[0]) * quality, T = Math.max(TK.minFlight, base * (1 - TK.speedUp * s.streak));
    const n = s.streak + 1;
    fly(myId(), to, T, n);
    send({ e: 'kick', i: to, t: Math.round(T * 1000), n });
    s.kick = TK.kickPose;
    audio?.play('kick');
    hub.hud?.toast?.(quality > 0.75 ? t('tkPerfect') : t('tkGood'));
  }
  /** The streak is over (mine: I missed it; theirs: someone else did). Everyone in the circle is paid. */
  function dropped(n, mine) {
    if (ball.state !== 'air') return;
    const streak = Math.max(n || 0, s.streak);
    rest();
    if (mine) send({ e: 'drop', n: streak });
    if (s.playing && streak >= TK.pay.min) {
      const baht = Math.min(TK.pay.cap, Math.round(streak * TK.pay.perTouch * (members.size >= 3 ? 1 + TK.pay.together : 1) * payNow()));
      hub.finishGame('takraw', { game: 'takraw', baht, catches: [], biggest: { size: streak }, streak });   // (biggest keeps the longest streak as the record)
      toast(t('tkDrop', { n: streak }), streak >= 10 ? 'catch' : 'fail');
    } else if (s.playing) audio?.play('fail');
    s.streak = 0;
    drawChip();
  }
  /** The jump button, while in the circle: serve a resting ball, or kick one arriving at us. */
  function press() {
    if (!s.playing) return;
    if (ball.state === 'rest') { kick(0.5); return; }
    if (ball.toId !== myId()) return;
    const dt = now() - (ball.t0 + ball.T);                             // + late, − early
    if (Math.abs(dt) > TK.window) return;                              // too early: nothing happens yet
    kick(Math.max(0, 1 - Math.abs(dt) / TK.window));
  }

  // ---------- every frame ----------
  const idleState = () => { const p = player.state; return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, speed: 0, dist: 0, accel: 0, turn: 0, grounded: true, vy: 0, groundAt: ground }; };
  function update(dt, active) {
    const p = player.state, d = Math.hypot(p.x - C.x, p.z - C.z);
    const near = active && !s.playing && d < TK.joinRange;
    if (near !== s.near) { s.near = near; drawChip(); }
    // the ball in the air (everyone's copy flies the same arc from the same message)
    if (ball.state === 'air') {
      const k = Math.min(1.2, (now() - ball.t0) / ball.T);
      ball.x = ball.from.x + (ball.to.x - ball.from.x) * Math.min(1, k); ball.z = ball.from.z + (ball.to.z - ball.from.z) * Math.min(1, k);
      ball.y = C.y + TK.kickH + 4 * ball.apex * k * (1 - k);
      if (ball.toId === myId()) {
        if (!s.playing) rest();
        else if (k > 1 + TK.window / ball.T) dropped(s.streak, true);   // it got past us
      } else if (k >= 1.2) rest();                                       // someone else's ball with no word from them: let it be
    }
    ballMesh.position.set(ball.x, Math.max(C.y + TK.ballR, ball.y), ball.z);
    ballMesh.rotation.x += dt * 4; ballMesh.rotation.z += dt * 2.5;
    blob.position.set(ball.x, ground(ball.x, ball.z) + 0.03, ball.z);
    blob.scale.setScalar(1 / (1 + Math.max(0, ball.y - C.y) * 0.3));
    // the rings under us: where the ball comes down, closing in as it arrives
    const mine = s.playing && ball.state === 'air' && ball.toId === myId();
    ring.visible = timer.visible = mine;
    if (mine) {
      const left = ball.t0 + ball.T - now(), g = Math.abs(left) < TK.perfect + 0.04;
      ring.position.set(p.x, ground(p.x, p.z) + 0.03, p.z); timer.position.copy(ring.position);
      timer.scale.setScalar(1 + Math.max(0, Math.min(1, left / 0.9)) * 1.8);
      ring.material.color.set(g ? TK.colors.go : TK.colors.ring); timer.material.color.copy(ring.material.color);
    }
    if (!s.playing) return;
    // in the circle: stand at our spot, kick when pressed, walk out to leave
    const input = player.input, act = !!(input?.jump || input?.down?.('Space'));
    if (act && !s.wasAct) press();
    s.wasAct = act;
    const { mag } = input?.axis?.() || { mag: 0 };
    if (mag > TK.leaveMove && now() - s.joinT > 0.6) { leave(); return; }
    player.kid.update(dt, idleState());
    if (s.kick > 0) {                                                  // the kick: the right leg swings up and across, the body leans back
      s.kick -= dt;
      const e = Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - s.kick / TK.kickPose))), B = player.kid.bones;
      B.legR.rotation.set(-1.25 * e, 0, 0.55 * e); B.shinR.rotation.x = 0.7 * e; B.footR.rotation.x = 0.4 * e;
      B.hips.rotation.x -= 0.12 * e; B.spine.rotation.x -= 0.15 * e; B.armL.rotation.z += 0.9 * e; B.armR.rotation.z -= 0.5 * e;
    }
  }

  return { get near() { return s.near; }, get playing() { return s.playing; }, join, leave, press, update, members, ball, state: s, centre: C };
}
