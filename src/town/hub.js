import * as THREE from 'three';
// Hub gameplay wiring (M3): places, NPCs, dialogue, HUD, travel, quests and saving.
// main.js builds the world; this module makes it a place you can live in.
import * as P from '../shared/progress.js';
import { t } from '../shared/i18n.js';
import { resolvePlaces } from './people/places.js';
import { createPeople } from './people/index.js';
import { createTalk } from './people/talk.js';
import { createHUD } from './hud.js';
import { createTravel } from './travel.js';
import { updateQuests, questText, walkOnly } from './quests.js';
import { createGuide } from './guide.js';
import { Kit } from './assets/kit.js';
import { somTamCart, khaoLamStand } from './assets/stall.js';
import { speedboatGeometry, bananaGeometry, sofaGeometry, jetskiGeometry } from '../boats/models.js';
import { paintedMaterial } from '../world/materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { showEnding } from './title.js';
import { createSongthaews } from './songthaew.js';
import { createSeats } from './seats.js';

const SAVE_POS_EVERY = 1.0;   // seconds
const FARE = 10;             // ฿ per songthaew ride

export function createHub({ scene, map, collision, seaDist, start, buildings, beach, player, camera, root, startGame, audio, lift, input, welcome, viewpoint, spots = {}, scopes = null, ambient = [] }) {
  const places = resolvePlaces({
    map, collision, seaDist, start, spots,
    grandma: buildings.grandma,
    goHouse: buildings.goHouse,
    rentals: beach.rentals,
    welcome, viewpoint,
    shops: buildings.rows.filter(r => r.kind === 'shop' && (r.road === 'tertiary' || r.road === 'secondary')),
  });
  // props that belong to people (built after the places are known)
  const kit = new Kit();
  const shop = places.shop;
  if (shop) {
    const ax = Math.cos(shop.yaw), az = -Math.sin(shop.yaw);   // along the shop front
    const cx = shop.x + ax * 1.3 - Math.sin(shop.yaw) * 0.4, cz = shop.z + az * 1.3 - Math.cos(shop.yaw) * 0.4;
    somTamCart(kit, { x: cx, y: map.heightAt(cx, cz), z: cz, ry: shop.yaw });
    collision.rect(cx, cz, 1.7, 0.9, shop.yaw, map.heightAt(cx, cz) + 2.5);
  }
  // Grandma's khao lam stand next to where she stands outside her house
  const gm = places.grandma;
  if (gm) {
    const rx = Math.cos(gm.yaw), rz = -Math.sin(gm.yaw), sx = gm.x + rx * 2.2, sz = gm.z + rz * 2.2;
    khaoLamStand(kit, { x: sx, y: map.heightAt(sx, sz), z: sz, ry: gm.yaw });
    collision.rect(sx + rx * 0.6, sz + rz * 0.6, 3.2, 0.9, gm.yaw, map.heightAt(sx, sz) + 1.3);
  }
  scene.add(kit.build());
  // Tom's speedboat landing: the boat in the shallows, a banana and a sofa on the sand
  const sb = places.speedboat;
  if (sb) {
    const fx = Math.sin(sb.yaw), fz = Math.cos(sb.yaw), ax = Math.cos(sb.yaw), az = -Math.sin(sb.yaw);
    // merged into one mesh (one draw call + one shadow call)
    const parts = [];
    const put = (geo, x, z, yaw, y) => {
      const yy = y ?? map.heightAt(x, z) + 0.02;
      parts.push(geo.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(x, yy, z)));
      collision.circle(x, z, 1.2, yy + 1);
    };
    put(speedboatGeometry(), sb.x + fx * 9, sb.z + fz * 9, sb.yaw + Math.PI / 2, map.sea - 0.25);
    put(bananaGeometry(), sb.x + fx * 3 + ax * 3.2, sb.z + fz * 3 + az * 3.2, sb.yaw + 0.3);
    put(sofaGeometry(), sb.x + fx * 2.5 - ax * 3.4, sb.z + fz * 2.5 - az * 3.4, sb.yaw + Math.PI);
    put(jetskiGeometry(), sb.x + fx * 6 - ax * 6.5, sb.z + fz * 6 - az * 6.5, sb.yaw + 0.4, map.sea - 0.1);   // in the shallows
    // floating pontoon walkway out into the sea: orange and white float blocks
    const pontoon = [], seg = 1.0;
    const float = (x, z, i) => pontoon.push(new THREE.BoxGeometry(seg * 0.96, 0.35, 2.2).toNonIndexed().rotateY(sb.yaw).translate(x, map.sea + 0.05, z));
    const px0 = sb.x + ax * 14, pz0 = sb.z + az * 14;
    for (let i = 0; i < 34; i++) float(px0 + fx * (6 + i * seg), pz0 + fz * (6 + i * seg), i);
    for (let i = -10; i <= 10; i++) { const g = new THREE.BoxGeometry(2.2, 0.35, seg * 0.96).toNonIndexed().rotateY(sb.yaw); pontoon.push(g.translate(px0 + fx * 41 + ax * i * seg, map.sea + 0.05, pz0 + fz * 41 + az * i * seg)); }
    pontoon.forEach((g, i) => {
      const c = new THREE.Color(i % 2 ? '#f4f2ec' : '#f08a2a'), a = new Float32Array(g.attributes.position.count * 3);
      for (let k = 0; k < a.length; k += 3) c.toArray(a, k);
      g.deleteAttribute('uv');
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      parts.push(g);
    });
    const landing = new THREE.Mesh(mergeGeometries(parts), paintedMaterial({ amp: 0.05, scale: 1 }));
    landing.castShadow = landing.receiveShadow = true;
    scene.add(landing);
  }
  const people = createPeople(scene, map, places, collision, lift);

  let hud = null, coopHandler = null;
  const toast = (msg, sound = 'coin') => { hud?.toast(msg); audio?.play(sound); };
  const talk = createTalk(root, {
    audio,
    onToast: toast,
    onEnding: () => showEnding(root, audio),
    onGame: id => { if (!startGame(id)) { toast(t('comingSoon')); P.setFlag(`asked_${id}`); } },
    onCoop: id => (coopHandler ? coopHandler(id) : startGame(id)),   // co-op lobby when multiplayer is on
  });
  let guide = null;
  // a place is closed to fast travel while a quest wants the player to walk to whoever stands there
  const walkThere = place => { const n = people.at(place.id); return !!n && walkOnly().includes(n.id); };
  const travel = createTravel(root, { places, player, camera, npcAt: id => people.at(id), collision, locked: walkThere, onLocked: () => guide?.point() });

  // red songthaews on the beach road
  const trucks = createSongthaews(scene, map, collision);             // routes stay inside the walkable area
  let riding = null, nearTruck = null, alighting = 0, seatSlot = 0;
  const seatPos = new THREE.Vector3();
  function board(tk) {
    riding = tk;
    const s = P.get();
    if (s.baht >= FARE) { P.addBaht(-FARE); toast(t('fare', { n: FARE }), 'click'); }
    else toast(t('freeRide'), 'coin');
    if (!s.flags.rodDaeng) { P.setFlag('rodDaeng'); setTimeout(() => toast(t('firstRide'), 'catch'), 900); }
    audio?.play('thud');
  }
  function hopOff() {
    if (!riding) return;
    trucks.setHold(riding, true);             // the driver pulls over; we step off once it has stopped
    alighting = 1;
  }
  function finishHopOff() {
    const tk = riding, d = trucks.dropSpot(tk);
    let x = d.x, z = d.z;
    for (let r = 0; r < 6 && !collision.free(x, z, 0.3); r += 0.5) { x = d.x + Math.cos(r * 3) * r; z = d.z + Math.sin(r * 3) * r; }
    player.place(x, z, tk.yaw + Math.PI / 2);
    riding = null; alighting = 0;
    setTimeout(() => trucks.setHold(tk, false), 1200);
  }

  // deck chairs (rented) and public benches (free)
  const seats = createSeats({ list: beach.seats, player, collision, toast });
  let nearSeat = null, seatT = 0, nearScope = null, nearShop = null, partners = null, wardrobe = null;   // binocular viewer (binoculars.js) / partner shop (partners.js) in reach

  let near = null, talkingTo = null, nearChat = null;                // nearChat: someone in the background crowd (ambient) to chat with
  const chatNear = p => ambient.reduce((best, src) => { const n = src.nearest(p); return n && (!best || n.reach < best.reach) ? n : best; }, null);
  const act = () => {
    if (talk.active || travel.open) return;
    if (riding) hopOff();
    else if (seats.seated) seats.stand();
    else if (near) startTalk();
    else if (nearTruck) board(nearTruck);
    else if (nearChat) startTalk(nearChat);
    else if (nearSeat && seats.sit(nearSeat)) audio?.play('thud');
    else if (nearScope) scopes.use(nearScope);
    else if (nearShop) partners.use(nearShop);
  };
  const startTalk = (who = near) => {
    if (!who || talk.active || travel.open) return;
    talkingTo = who;
    talk.open(who, P.get());
    hud.hideDuringTalk(true);
    document.body.classList.add('talking');
  };
  talk.onEnd = () => { talkingTo = null; hud.hideDuringTalk(false); document.body.classList.remove('talking'); };

  hud = createHUD(root, { audio, onTravel: () => { audio?.play('click'); if (riding) { trucks.setHold(riding, false); riding = null; alighting = 0; } seats.leave(); travel.openTravel(); }, onBag: () => { audio?.play('click'); travel.openBag(); }, onTalk: act, onGoal: () => guide?.point() });
  let quest = updateQuests(toast);
  guide = createGuide({ scene, root, tpc: camera, player, people, input, quest: () => quest, toast });   // marker + arrow to the active goal
  hud.setGoal(() => questText(quest));
  P.onChange(what => { if (what !== 'baht') { quest = updateQuests(toast); hud.refresh(); } });
  addEventListener('keydown', e => { if (e.code === 'KeyF' && !talk.active) act(); });

  // restore the last position (if it's still a valid spot)
  const saved = P.get().pos;
  if (saved && collision.free(saved.x, saved.z, 0.3)) {
    player.place(saved.x, saved.z, saved.yaw);
    camera.setYaw(saved.yaw + Math.PI);
  }

  // ambience follows where you are: surf by the water, cicadas inland and on the hill
  let posTimer = 0, ambTimer = 0;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function ambience() {
    const p = player.state, d = seaDist(p.x, p.z), h = map.heightAt(p.x, p.z);
    const truckD = Math.min(...trucks.trucks.map(tk => Math.hypot(tk.x - p.x, tk.z - p.z)));
    audio?.ambience({ surf: clamp01(1.1 - d / 90), breeze: 0.5 + clamp01(h / 60) * 0.5, cicadas: clamp01((d - 20) / 50) + clamp01(h / 30),
      engine: riding ? 1 : clamp01(1 - truckD / 30) });
  }
  return {
    places, people, talk, travel, hud, trucks, seats, guide,
    get riding() { return riding; },
    /** coop.js sets this: (gameId) → open a co-op lobby. */
    set coopHandler(fn) { coopHandler = fn; },
    /** Which truck we ride (index, for other players) and which bench seat we take. */
    get ride() { return riding ? riding.i : null; },
    set seatSlot(v) { seatSlot = v; },
    /** Riding a truck or sitting down: the hub poses the kid, player.update() is skipped. */
    get seated() { return !!(riding || seats.seated); },
    /** Sitting pose for other players to see: null, 'bench' or 'lounge'. */
    get pose() { return riding ? 'bench' : seats.seated ? (seats.seated.kind === 'chair' ? 'lounge' : 'bench') : null; },
    /** A mini-game finished: pay out, put catches in the bag, keep the best result. */
    finishGame(id, res) {
      if (res.baht) { P.addBaht(res.baht); toast(t('gotBaht', { n: res.baht })); }
      for (const c of res.catches || []) P.addItem(`${id}_${c.id}`);
      const prev = P.get().best[id];
      P.setBest(id, { baht: Math.max(prev?.baht || 0, res.baht), biggest: Math.max(prev?.biggest || 0, res.biggest?.size || 0), plays: (prev?.plays || 0) + 1 });
    },
    /** True while the player shouldn't move (dialogue, menus). */
    get frozen() { return talk.active || travel.open || !!wardrobe?.open; },
    /** main.js sets this: ร้านพันธมิตร (partners.js) — created after the hub because it adds travel places. */
    set partners(p) { partners = p; },
    /** main.js sets this: the wardrobe panel (wardrobe.js) freezes the kid while it is open. */
    set wardrobe(w) { wardrobe = w; },
    update(dt) {
      const p = player.state;
      trucks.update(dt, [{ x: p.x, z: p.z, ride: riding }, ...trucks.extra], camera.cam?.position);
      if (riding) {
        // sit on the bench (our own seat when friends ride too); hop off once the truck has pulled over
        player.sit(trucks.seat(riding, seatPos, seatSlot), trucks.seatYaw(riding, seatSlot));
        if (alighting && riding.v < 0.3) finishHopOff();
      } else {
        // trucks are solid: push the kid out of any truck's footprint
        for (const tk of trucks.trucks) {
          const c = Math.cos(tk.yaw), s2 = Math.sin(tk.yaw), dx = p.x - tk.x, dz = p.z - tk.z;
          const u = dx * c - dz * s2, w = dx * s2 + dz * c, hu = 1.2, hw = 2.95;
          if (Math.abs(u) < hu && Math.abs(w) < hw) {
            const pu = hu - Math.abs(u), pw = hw - Math.abs(w);
            if (pu < pw) { const nu = Math.sign(u || 1) * hu; p.x = tk.x + nu * c + w * s2; p.z = tk.z - nu * s2 + w * c; }
            else { const nw = Math.sign(w || 1) * hw; p.x = tk.x + u * c + nw * s2; p.z = tk.z - u * s2 + nw * c; }
            player.kid.mesh.position.x = p.x; player.kid.mesh.position.z = p.z;
          }
        }
      }
      if (seats.seated) {
        seats.update();
        seatT += dt;                                   // a moment's grace, so holding W while pressing F doesn't pop you back up
        const { mag } = input ? input.axis() : { mag: 0 };
        if (seatT > 0.6 && !talk.active && !travel.open && (mag > 0.5 || input?.jump || input?.down('Space'))) seats.stand();
      } else seatT = 0;
      people.update(dt, p);
      talk.update(dt);
      if (talkingTo) player.faceTo(talkingTo.state.x, talkingTo.state.z, dt);
      const busy = talk.active || riding || seats.seated;
      near = busy ? null : people.nearest(p);
      nearTruck = near || busy ? null : trucks.nearest(p);
      nearChat = near || nearTruck || busy || wardrobe?.open ? null : chatNear(p);
      nearSeat = near || nearTruck || nearChat || busy ? null : seats.nearest(p);
      nearScope = near || nearTruck || nearChat || nearSeat || busy || !scopes || scopes.active ? null : scopes.nearest(p);
      nearShop = near || nearTruck || nearChat || nearSeat || nearScope || busy || !partners || partners.active ? null : partners.nearest(p);
      partners?.update(p);
      guide.update(dt);
      const [seatKey, seatVars] = nearSeat ? seats.prompt(nearSeat) : nearScope ? scopes.prompt(nearScope) : nearShop ? partners.prompt(nearShop) : [null, null];
      hud.setPrompt(scopes?.active ? null : riding ? (alighting ? null : 'alight') : seats.seated ? 'standUp' : near ? 'talk' : nearTruck ? 'board' : nearChat ? 'talk' : seatKey,
        near ? near.def.name : nearChat && !nearTruck ? nearChat.def.name : null, seatVars || null);
      ambTimer -= dt;
      if (ambTimer <= 0) { ambTimer = 0.5; ambience(); }
      posTimer += dt;
      if (posTimer > SAVE_POS_EVERY) { posTimer = 0; P.setPos(p.x, p.z, p.yaw); }
    },
  };
}
