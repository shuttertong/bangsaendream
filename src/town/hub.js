// Hub gameplay wiring (M3): places, NPCs, dialogue, HUD, travel, quests and saving.
// main.js builds the world; this module makes it a place you can live in.
import * as P from '../shared/progress.js';
import { t } from '../shared/i18n.js';
import { resolvePlaces } from './people/places.js';
import { createPeople } from './people/index.js';
import { createTalk } from './people/talk.js';
import { createHUD } from './hud.js';
import { createTravel } from './travel.js';
import { updateQuests, questText } from './quests.js';
import { Kit } from './assets/kit.js';
import { somTamCart } from './assets/stall.js';
import { showEnding } from './title.js';

const SAVE_POS_EVERY = 1.0;   // seconds

export function createHub({ scene, map, collision, seaDist, start, buildings, beach, player, camera, root, startGame, audio }) {
  const places = resolvePlaces({
    map, collision, seaDist, start,
    grandma: buildings.grandma,
    rentals: beach.rentals,
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
  scene.add(kit.build());
  const people = createPeople(scene, map, places, collision);

  let hud = null;
  const toast = (msg, sound = 'coin') => { hud?.toast(msg); audio?.play(sound); };
  const talk = createTalk(root, {
    audio,
    onToast: toast,
    onEnding: () => showEnding(root, audio),
    onGame: id => { if (!startGame(id)) { toast(t('comingSoon')); P.setFlag(`asked_${id}`); } },
  });
  const travel = createTravel(root, { places, player, camera, npcAt: id => people.at(id) });

  let near = null, talkingTo = null;
  const startTalk = () => {
    if (!near || talk.active || travel.open) return;
    talkingTo = near;
    talk.open(near, P.get());
    hud.hideDuringTalk(true);
    document.body.classList.add('talking');
  };
  talk.onEnd = () => { talkingTo = null; hud.hideDuringTalk(false); document.body.classList.remove('talking'); };

  hud = createHUD(root, { audio, onTravel: () => { audio?.play('click'); travel.openTravel(); }, onBag: () => { audio?.play('click'); travel.openBag(); }, onTalk: startTalk });
  let quest = updateQuests(toast);
  hud.setGoal(() => questText(quest));
  P.onChange(what => { if (what !== 'baht') { quest = updateQuests(toast); hud.refresh(); } });
  addEventListener('keydown', e => { if (e.code === 'KeyF' && !talk.active) startTalk(); });

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
    audio?.ambience({ surf: clamp01(1.1 - d / 90), breeze: 0.5 + clamp01(h / 60) * 0.5, cicadas: clamp01((d - 20) / 50) + clamp01(h / 30) });
  }
  return {
    places, people, talk, travel, hud,
    /** A mini-game finished: pay out, put catches in the bag, keep the best result. */
    finishGame(id, res) {
      if (res.baht) { P.addBaht(res.baht); toast(t('gotBaht', { n: res.baht })); }
      for (const c of res.catches || []) P.addItem(`${id}_${c.id}`);
      const prev = P.get().best[id];
      P.setBest(id, { baht: Math.max(prev?.baht || 0, res.baht), biggest: Math.max(prev?.biggest || 0, res.biggest?.size || 0), plays: (prev?.plays || 0) + 1 });
    },
    /** True while the player shouldn't move (dialogue, menus). */
    get frozen() { return talk.active || travel.open; },
    update(dt) {
      const p = player.state;
      people.update(dt, p);
      talk.update(dt);
      if (talkingTo) player.faceTo(talkingTo.state.x, talkingTo.state.z, dt);
      near = talk.active ? null : people.nearest(p);
      hud.setPrompt(near ? near.def.name : null);
      ambTimer -= dt;
      if (ambTimer <= 0) { ambTimer = 0.5; ambience(); }
      posTimer += dt;
      if (posTimer > SAVE_POS_EVERY) { posTimer = 0; P.setPos(p.x, p.z, p.yaw); }
    },
  };
}
