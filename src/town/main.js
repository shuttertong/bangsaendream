// Hub boot + per-frame update: builds the world, then hands gameplay to hub.js.
import * as THREE from 'three';
import { createRenderer, createLights } from '../world/render.js';
import { createSky, buildEnvironment } from '../world/sky.js';
import { createFog } from '../world/haze.js';
import { createSea } from '../world/water.js';
import { createPostFX } from '../world/postfx.js';
import { createInput } from '../core/input.js';
import { createTouchControls } from '../core/touch.js';
import { addSystem, startLoop, tick, setFrameRate, frameInfo } from '../core/loop.js';
import { U } from '../core/shaderPatch.js';
import { createQuality } from '../core/quality.js';
import { createAudio } from '../core/audio.js';
import { t, tr } from '../shared/i18n.js';
import { loadMap } from './data.js';
import { buildTerrain } from './terrain.js';
import { createFreeCam } from './freecam.js';
import { createDrone } from './drone.js';
import { buildRoadblocks, createRoadblockNotice, ROADBLOCK } from './roadblock.js';
import { joinRoadEnds } from './roadjoin.js';
import { gradeRoads } from './grading.js';
import { flattenLowland } from './flatland.js';
import { auditRoads } from './roadaudit.js';
import { Kit } from './assets/kit.js';
import { RoadIndex, Occupancy, seaDistSampler, stripSampler, inMap } from './layout.js';
import { buildRoads, roadWidth, surfaceLift } from './roads.js';
import { buildBuildings } from './buildings.js';
import { buildNature } from './nature.js';
import { dressPromenades } from './promenade.js';
import { buildLandmarks, completeRoundabout } from './landmarks.js';
import { buildLaemThaen } from './laemthaen.js';
import { buildKhaoSamMuk } from './khaosammuk.js';
import { buildHillRoads } from './hillroad.js';
import { hillSamples } from './hillgeom.js';
import { buildHillMarks } from './hillmarks.js';
import { buildHillSigns } from './hillsigns.js';
import { buildViewpoint } from './viewpoint.js';
import { createBinoculars } from './binoculars.js';
import { createFeedback } from '../shared/feedback.js';
import { createPartners } from './partners.js';
import { createWardrobe } from './wardrobe.js';
import { createAuras } from './aura.js';
import { buildFishingVillage } from './fishingvillage.js';
import { createChunkCuller } from './chunkcull.js';
import { buildWalkingStreet } from './walkingstreet.js';
import { buildNavyPier } from './navypier.js';
import { createBobbingBoats } from './boats.js';
import { buildBeach } from './beach.js';
import { buildCollision } from './collision.js';
import { buildCrowd } from './crowd.js';
import { createStrollers } from './strollers.js';
import { buildKickabout } from './kickabout.js';
import { createPlayer } from './player.js';
import { createThirdPersonCamera } from './camera.js';
import { createHub } from './hub.js';
import { createMultiplayer } from './multiplayer.js';
import { createCoop } from './coop.js';
import { createFriends } from './friends.js';
import { createJournal } from './journal.js';
import { createPostcard } from './postcard.js';
import { createTakraw } from './takraw.js';
import { createBikes } from './bike.js';
import { buildSkatePark, createSkating } from './skatepark.js';
import { KID_LOOK } from './kid/model.js';
import { GP } from '../gp/rules.js';
import { LOOP } from '../gp/loop.js';
import { createSponsor } from './sponsor.js';
import { createLeaderboard } from './leaderboard.js';
import * as scores from '../shared/scores.js';
import * as F from '../shared/friends.js';
import { nameOf } from '../shared/avatar.js';
import { activeEvent } from '../shared/events.js';
import { buildGoHouse } from './gohouse.js';
import { loadProfile, wearLook } from '../shared/avatar.js';
import { showTitle } from './title.js';
import { createTutorial } from './tutorial.js';
import * as P from '../shared/progress.js';
import { GAMES } from '../games.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const $ = id => document.getElementById(id);
// where the kid starts: on the sand mid-beach, looking up the coast to Khao Sam Muk
const START = { x: 318, z: 985, yaw: Math.atan2(-0.318, -0.948) };

async function boot() {
  if (params.has('reset')) P.reset();                  // ?reset=1 → new game
  P.load();
  $('loading').textContent = t('loading');
  $('credit').textContent = t('credit');

  const map = await loadMap();
  completeRoundabout(map);                                            // the bake clips the ring's far side
  const joins = joinRoadEnds(map);                                    // close small gaps between roads
  const flat = flattenLowland(map);                                   // the beach and town are flat in reality: press the DEM's mounds down
  const graded = gradeRoads(map);                                     // smooth, level roads that never dip under the sea
  const renderer = createRenderer($('c'));
  const scene = new THREE.Scene();
  scene.fog = createFog();
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 1.0;
  scene.add(createSky());

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 32000);
  const lights = createLights(scene);
  const terrain = buildTerrain(map);
  scene.add(terrain.group);
  const sea = createSea(map);
  scene.add(sea.group);

  // static town geometry, merged per (chunk, material)
  const t0 = performance.now();
  const kit = new Kit();
  const layout = { occ: new Occupancy(), roadIdx: new RoadIndex(map.roads, roadWidth), seaDist: seaDistSampler(map, terrain.seaDist) };
  layout.strip = stripSampler(map, layout.seaDist);                  // coastal strip + inland corridors (road 3137, Khao Sam Muk): dressed
  layout.walkStrip = stripSampler(map, layout.seaDist, c => ROADBLOCK.closed.includes(c.n));   // …minus the closed ones: walkable
  layout.buildStrip = stripSampler(map, layout.seaDist, c => c.bare);   // …minus road-only links: where buildings may go
  const promenades = buildRoads(kit, map, layout.seaDist, layout.roadIdx);
  const landmarks = buildLandmarks(kit, scene, map, layout);         // first, so the island stays clear
  const laem = buildLaemThaen(kit, map, layout, scene);                // park, plaza, lattice pier, boulders
  const viewpoint = buildViewpoint(kit, map, layout);                   // จุดชมวิว terrace (before the hill forest, so trees keep off the view)
  const ksm = buildKhaoSamMuk(kit, scene, map, layout);                // seawall, rocks, hill forest, monkeys, mussel poles
  const hillSamp = hillSamples(map);                                   // the hill roads, sampled every metre (heading, bends, bank / drop sides)
  const hillRoads = buildHillRoads(kit, map, layout, hillSamp);         // kerbs (red-white at bends), guardrails, lamps, monkeys
  const hillMarks = buildHillMarks(kit, map, layout, hillSamp);         // edge + centre lines, drain gutters, retaining walls
  const hillSigns = buildHillSigns(kit, scene, map, layout, hillSamp);  // ระวังลิง, curve and speed signs, chevrons, mirrors
  const village = buildFishingVillage(kit, map, layout, scene);               // stilt houses, jetties, boats, the long pier
  const walking = buildWalkingStreet(kit, map, layout);                // market stalls, bulbs, the paved seafront lot
  const navyFleet = [], navy = buildNavyPier(kit, map, layout, navyFleet);   // สะพานราชนาวี
  createBobbingBoats(scene, navyFleet);
  const skatePark = buildSkatePark(kit, scene, map, layout, START);   // 🛼 the inline-skating rink and its school, on the beach by the promenade (first, so umbrellas, palms and stalls keep off the plot)
  const promenade = dressPromenades(kit, map, layout, promenades);   // before buildings/beach so they keep off it
  const counts = buildBuildings(kit, map, layout, START);
  const goHouse = buildGoHouse(kit, scene, counts.rows);   // บ้านหมากล้อม: one shophouse row dressed as the Go club
  counts.goHouse = goHouse?.place || null;
  const beach = buildBeach(map, layout, kit);          // before trees so trees avoid the umbrellas
  scene.add(beach.group);
  const walkZones = [...landmarks.walkZones, ...GP.walk];           // the roundabout; the kart loop's short stretch outside the strip
  const inZone = (x, z) => walkZones.some(w => (x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r);
  const walkable = (x, z) => inMap(map, x, z) && (layout.walkStrip(x, z) <= 4 || inZone(x, z));
  // the kart circuit leaves the map for a stretch round the hill's north tip: the two barriers that close it to walkers
  // are built apart from the rest, so they can be taken away for a race
  const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(a[0] + dx * u - x, a[1] + dz * u - z); };
  const onCircuit = p => LOOP.some((a, i) => segDist(p.x, p.z, a, LOOP[(i + 1) % LOOP.length]) < 14);
  const roadblocks = buildRoadblocks(kit, scene, map, layout, walkable, p => !onCircuit(p));   // fence off road 3137 (and every road out)
  const raceKit = new Kit(), raceBlocks = buildRoadblocks(raceKit, scene, map, layout, walkable, onCircuit);
  roadblocks.solids.push(...raceBlocks.solids); roadblocks.spots.push(...raceBlocks.spots);
  const raceGates = raceKit.build();
  scene.add(raceGates);
  const town = kit.build();
  scene.add(town);
  const planted = { palm: [...promenade.palms, ...beach.palms] };      // trees other modules planted, by species
  for (const set of [ksm.trees, laem.trees, landmarks.trees]) for (const [sp, list] of Object.entries(set)) (planted[sp] ||= []).push(...list);
  const nature = buildNature(map, layout, planted);
  scene.add(nature.group);
  const crowd = buildCrowd([...walking.people, ...promenade.people]);   // sellers, shoppers and people at the tables (one mesh per map chunk)
  scene.add(crowd.group);
  if (DEBUG) console.log('town', counts, 'beach', beach.counts, 'promenade', { runs: promenades.length, palms: promenade.palms.length, stalls: promenade.stalls.length }, 'trees', nature.counts, 'crowd', crowd.counts, `${town.children.length} meshes, ${(kit.tris / 1e3).toFixed(0)}k tris, ${(performance.now() - t0).toFixed(0)} ms`);

  const collision = buildCollision(map, layout.seaDist, { buildings: counts, nature, poles: beach.poles, solids: [...laem.solids, ...ksm.solids, ...hillRoads.solids, ...hillMarks.solids, ...hillSigns.solids, ...viewpoint.solids, ...village.solids, ...walking.solids, ...navy.solids, ...roadblocks.solids, ...(goHouse?.solids || []), ...(skatePark?.solids || [])], decks: [...laem.decks, ...village.decks, ...navy.decks, ...viewpoint.decks, ...(skatePark?.decks || [])], strip: layout.walkStrip });
  for (const s of [...landmarks.solids, ...beach.solids]) collision.circle(s.x, s.z, s.r, s.top);
  collision.walkZones.push(...walkZones);                  // the whole roundabout is walkable, even its inland side
  const input = createInput($('c'));
  const touch = createTouchControls($('hud'), input);
  // audio can only start after a user gesture (iOS / Chrome autoplay rules)
  const audio = createAudio();
  const unlock = () => audio.unlock();
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  // how high the walkable surface is above the terrain: piers/plazas (decks), roads, pavements
  const lift = (x, z) => { const d = collision.deckAt(x, z); return d > -Infinity ? Math.max(0, d - map.heightAt(x, z)) : surfaceLift(layout.roadIdx, x, z); };
  const profile = loadProfile();
  wearLook(profile.look);                                            // the kid (and mini-game kids) wear the chosen look
  const player = createPlayer(scene, map, collision, input, lift);
  player.place(START.x, START.z, START.yaw);
  const strollers = createStrollers(scene, map, lift, walking.street);   // people walking the market road (one skinned mesh)
  const tpc = createThirdPersonCamera(camera, input, map, collision);
  tpc.setYaw(START.yaw + Math.PI);
  // ?view=beach|town|air → fixed free-camera shots for before/after screenshots
  const cam = createFreeCam(camera, input, map);
  let free = params.has('view');
  if (free) cam.setView(params.get('view'));
  if (DEBUG) addEventListener('keydown', e => { if (e.code === 'KeyC') free = !free; });
  // mini-games: while one runs, the hub pauses and the game renders its own scene
  // (a game that returns `town: true` is played in the hub's scene: the world keeps running round its `focus`)
  const townCtx = {
    scene, camera, map,
    ground: (x, z) => Math.max(map.heightAt(x, z) + lift(x, z), map.sea),
    roadEdge: (x, z) => { const n = layout.roadIdx.nearest(x, z, 12); return n ? -n.d : 0; },   // metres inside the nearest road's edge
    setRace(on) { for (const tk of hub.trucks.trucks) tk.g.visible = !on; player.kid.mesh.visible = !on; for (const m of [raceGates, ...raceBlocks.meshes]) m.visible = !on; if (!on) resize(); },
  };
  let game = null, gameMod = null, gameId = null, loading = false;
  /** opts.coop: co-op session (see coop.js) for games that support it. */
  const startGame = (id, opts = {}) => {
    const def = GAMES[id];
    if (!def || game || loading) return false;     // one game at a time (double taps)
    loading = true;
    document.body.classList.add('in-game', 'fading');
    def.load().then(mod => {
      loading = false;
      gameMod = mod; gameId = id;
      game = mod.start({
        renderer, input, touch, audio, progress: P, root: $('hud'), coop: opts.coop || null,
        town: townCtx,                                 // for a game played in the town itself (the kart race)
        onExit: res => {
          document.body.classList.add('fading');
          setTimeout(() => {
            gameMod.stop(); game = null;
            audio.play('coin');
            hub.finishGame(gameId, res);
            document.body.classList.remove('in-game');
            setTimeout(() => document.body.classList.remove('fading'), 60);
          }, 350);
        },
      });
      setTimeout(() => document.body.classList.remove('fading'), 120);
    }).catch(e => { loading = false; console.error(e); document.body.classList.remove('in-game', 'fading'); });
    return true;
  };
  const binos = createBinoculars({ spots: viewpoint.scopes, camera, input, map, root: $('hud'), audio, player, toast: m => { hub.hud.toast(m); audio.play('coin'); } });   // look through the viewpoint's coin binoculars
  const hub = createHub({ scene, map, collision, seaDist: layout.seaDist, start: START, buildings: counts, beach, player, camera: tpc, root: $('hud'), startGame, audio, lift, input, welcome: landmarks.welcome, viewpoint: viewpoint.place, spots: { walking: walking.place, navyPier: navy.place, ...(skatePark ? { skate: skatePark.place } : {}) }, scopes: binos, ambient: [crowd, strollers] });

  const kickabout = buildKickabout({ scene, map, lift, seaDist: layout.seaDist, collision, at: hub.places.beach });   // goals on the sand in front of Tonkla (ฟุตบอลชายหาด)
  const sponsor = createSponsor({ scene, map, hub, root: $('hud'), audio, rows: counts.rows, osm: map.buildings, lift });   // 🏬 sponsor a building / ❤️ donate
  hub.sponsor = sponsor;
  hub.hud.support = { donate: () => sponsor.openDonate(), pick: () => sponsor.startPicking() };
  const partners = createPartners({ scene, map, collision, hub, root: $('hud'), audio });   // ร้านพันธมิตร
  hub.partners = partners;
  partners.onLoaded = list => sponsor.dress(list);                                        // building sponsors are dressed once the list is in from Supabase (none until the admin adds some)
  const culler = createChunkCuller([town, beach.group, crowd.group]);   // hide map chunks far behind the haze
  const fx = createPostFX(renderer, scene, camera);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 64 : 50;          // portrait phones: see more around the kid
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();
  const quality = createQuality(renderer, resize);

  // local Wi-Fi multiplayer (only when served by tools/serve.py)
  const auras = createAuras(scene);                                   // wardrobe auras (the kid's and other players')
  const mp = createMultiplayer({ scene, root: $('hud'), camera, player, hub, map, lift, collision, audio, profile, busy: () => (game ? gameId : null), auras });
  const wardrobe = createWardrobe({ root: $('hud'), player, tpc, hub, auras, audio, onWorn: () => mp.rehello() });   // 👗 fantasy wardrobe (K)
  hub.wardrobe = wardrobe;
  const journal = createJournal({ root: $('hud'), hub, player, audio });   // 📔 สมุดปิดเทอม: daily tasks, medals, badges (J)
  hub.journal = journal;
  const postcard = createPostcard({ root: $('hud'), renderer, render: () => (game ? game.render(1 / 60) : fx.render(1 / 60)), hub, audio, journal });   // 📷 postcards to save or share
  postcard.kid = player.state;
  hub.postcard = postcard;
  const roadNotice = createRoadblockNotice(roadblocks.spots, player, msg => hub.hud.toast(msg));
  const tutorial = createTutorial({ root: $('hud'), player, input });   // first-time controls card
  // 💌 requests & feedback for the developer (Supabase, insert-only); sends the nearest travel stop as context
  const nearestPlace = () => {
    const p = player.state; let best = '', bd = 250;
    for (const pl of Object.values(hub.places)) { const d = Math.hypot(pl.x - p.x, pl.z - p.z); if (d < bd) { bd = d; best = pl.id; } }
    return best;
  };
  const feedback = createFeedback({ root: $('hud'), audio, place: nearestPlace });
  const drone = createDrone({ camera, input, map, root: $('hud'), canvas: $('c'), player, tpc, audio });   // 🚁 overlook any area from above
  const coop = createCoop({ root: $('hud'), mp, hub, startGame, audio });   // co-op lobbies (banana boat with friends)
  const friends = createFriends({ root: $('hud'), mp, player, hub, drone, map, audio });   // 👫 add friends face to face + the friends map (G)
  const takraw = createTakraw({ scene, root: $('hud'), hub, mp, player, audio, map, lift, collision, spot: kickabout?.takraw });   // 🥎 ตะกร้อวง: a keep-up circle anyone online can join
  hub.takraw = takraw;
  const bikes = createBikes({ scene, hub, mp, player, map, lift, collision, audio, seaDist: layout.seaDist, at: hub.places.beach });   // 🚲 three-seat bicycles for rent
  hub.bike = bikes; mp.bikes = bikes;
  const skating = createSkating({ scene, park: skatePark, hub, player, audio, setLook: l => player.setLook(l), baseLook: () => ({ ...KID_LOOK }) });   // 🛼 skates for the kid, skaters on the oval
  hub.skate = skating; townCtx.skate = skatePark?.rink || null;
  player.input = input;
  // 🏆 the online leaderboard: bests go up after a round; a medal tile in the journal opens a game's board
  scores.configure({ uid: F.keyOf(F.myUid()), name: () => nameOf(profile.n1, profile.n2) });
  hub.scores = { post: (id, best) => scores.postBest(id, { baht: best?.baht || 0, streak: best?.biggest || 0 }) };
  const board = createLeaderboard({ root: $('hud'), audio });
  journal.onBoard = id => board.show(id);
  journal.onTitle = () => mp.rehello();
  if (activeEvent()) setTimeout(() => hub.hud.toast(`${activeEvent().icon} ${tr(activeEvent().name)} · ${tr(activeEvent().line)}`), 4000);

  // ?bots=N: fake players (own relay connections) that roam and ride the red trucks — for testing
  let bots = null;
  if (params.has('bots')) import('./mpbots.js').then(m => { bots = m.createBots(+params.get('bots') || 3, { map, lift, collision, trucks: hub.trucks, player, takraw }); });

  addSystem((dt, time) => {
    U.time.value = time;
    auras.update(time);
    mp.update(dt, !game && !free);
    coop.update(dt, !!game || loading);
    friends.update(dt, !game && !free);
    takraw.update(dt, !game && !free && !hub.frozen);
    journal.update(dt, !game && !free && !hub.frozen);
    bots?.update(dt);
    if (game) { game.update(dt, time); if (!game.town) { input.endFrame(); return; } }
    let focus;
    if (game) focus = game.focus;
    else if (free) { cam.update(dt); focus = cam.target; }
    else if (drone.active) { drone.update(dt); focus = drone.target; hub.update(dt); }
    else if (binos.active) { binos.update(dt); focus = binos.focus; hub.update(dt); }
    else {
      if (!hub.seated && !takraw.playing && !bikes.aboard) player.update(dt, tpc.state.yaw, hub.frozen);
      bikes.update(dt, !hub.frozen && !hub.seated && !takraw.playing);
      skating.update(dt, !hub.frozen && !hub.seated && !takraw.playing && !bikes.busy);
      roadNotice(dt);
      tutorial.update(dt);
      hub.update(dt);                                    // trucks, NPCs; seats the kid when riding
      tpc.update(dt, player.state); focus = tpc.target;
    }
    if (free) hub.update(dt);
    // near plane grows with height: keeps depth precision for the sea/shore from the air
    const above = camera.position.y - Math.max(map.heightAt(camera.position.x, camera.position.z), map.sea);
    const near = binos.active ? binos.near : Math.min(40, Math.max(0.3, above * 0.02));
    if (Math.abs(near - camera.near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }
    lights.follow(focus, camera.position.y - focus.y);
    fx.setFocus(focus, camera.position.y - focus.y);
    sea.update(camera);
    nature.update(camera.position);
    strollers.update(dt, player.state, focus);
    crowd.update(dt, player.state);
    culler.update(dt, camera.position, map.heightAt(camera.position.x, camera.position.z));
    fx.setTiltShift((free && cam.state.tilt && cam.state.pitch > 0.7) || drone.tiltShift, 0.5);
    input.endFrame();
  });

  if (params.has('fps')) setFrameRate(params.get('fps'));   // ?fps=0 lifts the 60 fps cap (120 Hz screens), ?fps=30 saves battery
  const dbg = DEBUG ? debugOverlay(renderer, camera) : null;
  startLoop(dt => {
    renderer.info.reset();
    if (game && !game.town) game.render(dt); else fx.render(dt);
    quality.update(dt);
    dbg?.(dt, quality.ratio);
  });
  $('loading').textContent = '';
  if (params.has('notitle')) tutorial.start();
  else if (!params.has('view')) showTitle($('hud'), {
    status: () => ({ online: mp.online ? mp.remotes.size : -1, friends: friends.online() }),   // who is on the beach, which friends
    onStart: goTo => {
      audio.unlock(); tutorial.start();
      if (goTo) {                                                        // straight to a friend: a free spot beside them
        let x = goTo.x + 1.4, z = goTo.z;
        for (let r = 1.4; r < 8 && !collision.free(x, z, 0.3); r += 0.7) { x = goTo.x + Math.cos(r * 2.4) * r; z = goTo.z + Math.sin(r * 2.4) * r; }
        const yaw = Math.atan2(goTo.x - x, goTo.z - z);
        player.place(x, z, yaw); tpc.setYaw(yaw + Math.PI); tpc.snap(); P.setPos(x, z, yaw);
        hub.hud.toast(t('titleWentTo', { name: goTo.name }));
      }
    },
  });

  // bench(n): median GPU+CPU ms per full frame, measured synchronously (not limited by rAF throttling)
  const bench = (n = 20, warm = 30) => {
    const gl = renderer.getContext(), px = new Uint8Array(4), ms = [];
    for (let i = 0; i < warm; i++) tick(1 / 60);          // let camera/LOD settle at the new spot
    for (let i = 0; i < n; i++) {
      tick(1 / 60);
      const t = performance.now();
      renderer.info.reset();
      fx.render(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      ms.push(performance.now() - t);
    }
    ms.sort((a, b) => a - b);
    return { ms: +ms[n >> 1].toFixed(1), calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  window.__game = { THREE, renderer, scene, camera, map, cam, tpc, player, collision, fx, sea, lights, layout, town, nature, hillRoads, hillMarks, hillSigns, friends, goHouse, tutorial, crowd, strollers, kickabout, journal, takraw, bikes, skating, sponsor, flat, viewpoint, binos, feedback, roadblocks, drone, joins, graded, auditRoads: () => auditRoads({ map, collision, layout, lift }), hub, P, bench, tick, startGame, audio, counts, mp, coop, input, get bots() { return bots; }, get game() { return game; } };
}

function debugOverlay(renderer, camera) {
  const el = $('debug');
  el.hidden = false;
  renderer.info.autoReset = false;
  let acc = 0, frames = 0;
  return (dt, ratio) => {
    acc += dt; frames++;
    if (acc < 0.5) return;
    const i = renderer.info.render, p = camera.position;
    const hz = frameInfo.refresh ? ` (${frameInfo.refresh} Hz${frameInfo.every > 1 ? ` ÷${frameInfo.every}` : ''})` : '';
    el.textContent = `${(frames / acc).toFixed(0)} fps${hz}\ncalls ${i.calls}  tris ${(i.triangles / 1e6).toFixed(2)}M\n`
      + `cam ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}  res ×${ratio.toFixed(2)}`;
    acc = frames = 0;
  };
}

boot().catch(e => {
  console.error(e);
  $('loading').textContent = `${t('loadError')}: ${e.message}`;
});
