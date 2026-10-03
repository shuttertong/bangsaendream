# CLAUDE.md — "ปิดเทอมที่บางแสน" (Summer Break at Bang Saen)

A 3D browser game set on a real-world map of Bang Saen Beach, Chonburi, Thailand.
The player explores the town as a hub world and plays 5 mini-games based on local life.
Architecture follows the Yoshimi game (cda-social.github.io/moritsuki): **vanilla JS + Three.js, no build step, procedural assets, real map data.**

Read this whole file before writing code. Follow the rules in **§8 Working Rules** at all times.

---

## 1. Game Concept

| Item | Decision |
|---|---|
| Title | ปิดเทอมที่บางแสน (Summer Break at Bang Saen) |
| Player | A kid on school break visiting grandma's house near the beach |
| Tone | Warm, nostalgic, slow; late-afternoon sun, sea breeze, cicadas |
| Look | Low-poly diorama: tilt-shift blur, soft ambient occlusion, warm fog, stylized water |
| Core loop | Explore hub → talk to NPCs / accept a request → travel to a spot → play mini-game → earn items + baht (฿) → unlock story |
| Session | Every mini-game is playable from the start and finishes in 3–5 minutes |
| Language | Thai UI first (English secondary), fonts **Kanit** (headings) + **Sarabun** (body) from Google Fonts |

### Hub landmarks (real places in the map area; check each position against OSM before placing)
- Bang Saen beach road with beach umbrellas, deck chairs and inner-tube (ห่วงยาง) rental stalls
- Khao Sam Muk (เขาสามมุข) hill at the north end: macaques, shrine (clearing ≈ `x -652, z -1942`), viewpoint terrace (จุดชมวิว, from Street View 13.30950, 100.90484 ≈ `x -559, z -1603`)
- Laem Thaen (แหลมแท่น) rocky point between the beach and Khao Sam Muk, at the north-west (tip ≈ `x -1356, z -758`). OSM places it here, not at the south end
- Seafood stalls and a small market
- Grandma's house (fictional, placed in a residential block)

### The 5 mini-games
| Folder | Thai | Game | Core mechanic |
|---|---|---|---|
| `src/crab/` | จับปูลม | Catch ghost crabs on the beach at dusk | Flashlight aim + timing dash; crabs flee into holes |
| `src/squid/` | ตกหมึก | Night squid jigging from a boat | Lure depth control + rhythm reeling (tension meter) |
| `src/monkey/` | ลิงเขาสามมุข | Protect your snacks from monkeys | Top-down dodge/defend, waves of monkeys |
| `src/tube/` | ห่วงยาง | Inner-tube float race / collect shells in the waves | Wave-physics steering, collect items |
| `src/stall/` | ร้านส้มตำ | Run a som tam / seafood stall rush | Order-matching + timing, customer patience bars |

Each mini-game has a `species.js` / `items.js` data table (name TH/EN, size range, rarity, price ฿). Results return to the hub through `shared/progress.js`.

---

## 2. Tech Stack (fixed; do not change without asking)

| Layer | Choice |
|---|---|
| Engine | **Three.js r170** via `importmap` from `cdn.jsdelivr.net` |
| Language | Vanilla JavaScript ES modules. **No bundler, no framework, no TypeScript** |
| Post-FX | `EffectComposer` (HalfFloat, MSAA 4) → `RenderPass` → `GTAOPass` → `OutputPass` → color-grade `ShaderPass`. Details in §5 |
| Shaders | Patch built-in materials with `onBeforeCompile` in `src/core/shaderPatch.js` (wind, water, fog) |
| Assets | **Procedural only**: build meshes from primitives in code and merge them. No .glb/.fbx unless approved |
| Audio | Web Audio API playing **CC0** files from Freesound.org / Pixabay; every file listed in `CREDITS.md` |
| UI | HTML/CSS overlay on top of the canvas |
| Save | `localStorage`, key prefix `bangsaen.`; always wrap reads and writes in try/catch |
| Hosting | GitHub Pages (static) |
| Dev server | `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000` |

---

## 3. Map Data

- **Center:** `lat 13.2950, lon 100.9100` (moved north from 13.2835, 100.9151 so Khao Sam Muk and Laem Thaen are inside the map)
- **Core area:** ±2400 m (4.8 km square), terrain grid step 8 m (601 × 601)
- **Playable strip:** only the land within **100 m of the coastline** (`inland` in the JSON). The bake keeps only buildings, roads and areas in this strip. Terrain and sea still cover the whole square as a backdrop. The player cannot walk further inland
- **Corridors:** `CORRIDORS` in `tools/bake_map.py` reach beyond the strip: road **3137** (ถนนลงหาดบางแสน + บางแสนสาย 2, walkable ±22 m) and every road on **Khao Sam Muk** (±14 m). They are baked as `corridors[{n,w,p}]`. In the game, `layout.strip(x, z)` (metres outside strip + corridors, ≤ 0 inside) drives collision, frontage buildings and trees. Road 3137 is **closed** (`town/roadblock.js`, `ROADBLOCK.closed`): dressed and visible but not walkable (`layout.walkStrip`); a barrier stands wherever **any** road runs on out of the walkable area (3137 at the roundabout and at บางแสนสาย 2, and roads at the map edge), spanning every lane and pavement kerb to kerb. Each barrier has red-and-white barriers, a steel fence, a no-entry sign, and kid-friendly dressing (`assets/roadblockprops.js`: flag-waving road-work dolls with a shader-animated arm, teddies and ducks, bunting, balloons, cones, and a painted board drawn on a canvas through i18n). The kid gets a friendly toast on approach. The map edge itself is never walkable (`inMap`), and truck routes stay inside the walkable area (`collision.inArea`)
- **Outer area (optional):** ±5000 m, step 40 m, for distant hills
- **Coordinates:** local metres, `x = (lon - lon0) * 111320 * cos(lat0)`, `z = -(lat - lat0) * 110540` (north = −z)
- **Height scale:** `HSCALE = 1.5`. Sea level is `y = 0.4`

### Sources
| Data | Source | Notes |
|---|---|---|
| Roads, buildings, land use, coastline | OpenStreetMap via the Overpass API | Credit "© OpenStreetMap contributors" (ODbL) |
| Elevation | Copernicus DEM GLO-30 or Mapzen Terrarium tiles (z14) | The DEM is noisy at the shore, so **always apply the coastline mask** |

### Pipeline (bake offline; the game never calls Overpass at runtime)
1. `tools/bake_map.py` (or the Export button in `tools/bangsaen-map.html`) writes:
   - `src/town/data/bangsaen.json`, containing `origin`, `core`, `buildings[{p,lv,n,b}]`, `roads[{k,p}]`, `areas[{k,p}]`, `streams`, `coast`
   - `src/town/data/bangsaen-core.bin`, Int16 heights in decimetres, row-major, rows run from north to south
2. Coastline mask: OSM coastline ways have **land on the left**. For every grid point, find the nearest coastline segment. If the point is on the sea side, push the height below sea level; if it is on the land side, keep it at least `SEA + 0.4`.
3. Simplify polygons (Douglas–Peucker, 0.5 m tolerance) and round coordinates to 0.1 m.
4. Commit the baked files. Re-bake only when the map area changes.

### Building the world from the data
- Terrain: `PlaneGeometry` with heights from the `.bin`, colored by vertices (sand, lowland, hill)
- Buildings: `ExtrudeGeometry` with height = levels × 3.2 m (1–2 levels when untagged; 6 for hotels and apartments). Merge them per material
- Roads: ribbon strips 0.3 m above the terrain, width by `highway` type
- Areas: flat shapes lifted 0.15 m. `beach` → sand + coconut palms, `wood`/`park` → instanced trees
- Sea: large plane at `SEA` with an animated water shader; foam where the coastline meets it

---

## 4. Project Structure

```
/
├── CLAUDE.md
├── CREDITS.md               # every sound, font and data source
├── index.html               # importmap, canvas, HUD root → src/town/main.js
├── tools/
│   ├── bake_map.py          # OSM + DEM → json/bin
│   └── bangsaen-map.html    # standalone map viewer + exporter
└── src/
    ├── core/      input.js (keys, mouse, touch, pinch), touch.js (on-screen joystick + jump), shaderPatch.js, audio.js, loop.js (tick() for tests), rng.js, quality.js (dynamic resolution)
    ├── shared/    progress.js, items.js, i18n.js (TH/EN strings), palette.js
    ├── world/     render.js, postfx.js, haze.js, sky.js, water.js, materials.js, textures.js, foliage.js (leaf atlas + billboard cards)
    ├── town/      main.js, data.js, terrain.js, freecam.js (M1 orbit camera + ?view= presets), roads.js, buildings.js, nature.js,
    │              grass.js, player.js, camera.js (third person), collision.js, layout.js (placement helpers),
    │              beach.js (umbrellas, stalls, power poles), hub.js (M3 wiring), hud.js, travel.js (+ bag panel), quests.js,
    │              kid/ (model.js, index.js), people/ (body.js person builder, roster.js cast + scripts, places.js,
    │              npc.js, talk.js, index.js), assets/ (kit.js, trees.js, shophouse.js, house.js, stall.js, props.js),
    │              data/ (bangsaen.json, bangsaen-core.bin)
    ├── crab/  squid/  monkey/  tube/  stall/     # one folder per mini-game
    └── ...
```

Each mini-game folder exports **`start(ctx)`** and **`stop()`**. `ctx` holds `{ renderer, input, audio, progress, onExit(result) }`. A mini-game creates its own scene and never touches the town scene.

---

## 5. 3D Visual Style (match the Yoshimi game)

The target look: **soft, sunny, "painted" realism**, like a summer-vacation memory. It is not flat low-poly.
Everything is procedural, but with real detail: tiles you can count, grass blades, a water surface you can see into.
The values below come from the Yoshimi game's source (`render.js`, `materials.js`, `haze.js`, `water.js`, `grass.js`, `trees.js`, `textures.js`, `kid/`, `npc.js`). Start from them, then tune for Thailand.

### 5.1 Renderer — `src/world/render.js`
```js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```
Anti-aliasing comes from the composer's MSAA render target, not from the canvas.

### 5.2 Lighting
| Light | Setting |
|---|---|
| Sun | `DirectionalLight('#fff4e2', 3.4)`, direction `(0.42, 0.78, 0.46)` normalized |
| Sun shadow | map 4096, **range ±55 m around the player** (widen when the camera is high), `bias -0.0003`, `normalBias 0.035`, `radius 2` |
| Shadow follow | Move the shadow camera with the player and **snap it to whole shadow-map texels** to stop shadow shimmer |
| Sky fill | `HemisphereLight('#c4dcf5', '#8f8a6a', 1.0)` |
| Environment | Render the sky dome + a ground disc into a `PMREMGenerator` → `scene.environment` (intensity 1.0). This gives shadows their blue tint and soft reflections |

### 5.3 Post-processing — `src/world/postfx.js`
1. Render target: `WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 })` with a `DepthTexture`
2. `RenderPass`
3. `GTAOPass` at reduced resolution:
   - GTAO material: `{ radius: 0.9, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 }`
   - Denoise material: `{ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 }`
   - `blendIntensity = 0.85`. This gives the soft darkening where objects meet the ground.
4. `OutputPass`
5. **Color grade** `ShaderPass` (after sRGB): lower saturation slightly and lift the dark tones, for a soft summer-daytime picture.
6. Optional: `HorizontalTiltShiftShader` only for the overhead/map view (the miniature look).

### 5.4 Atmosphere — `src/world/haze.js`, `sky.js`
- **Height haze (aerial perspective):** replace the three.js fog shader chunks so haze is **thicker near the ground**, integrated along the view ray. From the ground, far objects fade to white; from above, the view stays clear. The fade is squared (clear nearby, white quickly in the distance). The haze color is slightly warmer and brighter toward the sun. It works on every material with `fog: true` (`scene.fog = FogExp2`).
- **Sky dome:** a zenith-to-horizon gradient (Yoshimi: zenith `#2f6fc4`, horizon `#c4e2f2`, haze `#c4dce9`), a soft glow around the sun, and procedural clouds.

### 5.5 Materials — `src/world/materials.js`
- Base material is **`MeshLambertMaterial` + vertex colors**, patched with `onBeforeCompile`:
  - **world-space noise** (`diffuseColor.rgb *= 1.0 + (noise(worldPos) - 0.5) * amp`), which gives a hand-painted, uneven color across large surfaces;
  - a **triplanar detail texture** for meshes without UVs, faded out between 60 and 200 m from the camera.
- Use `MeshStandardMaterial` only where shine matters: metal roofs, glass, wet sand, lamps (`emissive`), vending machines.
- **Procedural textures** (`src/world/textures.js`): paint them on a canvas with a recipe `(u, v) → {r, g, b, height, roughness}`, make them tileable with periodic value noise, and output color + normal + roughness maps. **UVs are in metres**, so `repeat = 1 / tileSizeInMetres`.
- Geometry kit (`assets/kit.js`): helpers to add polygons, walls, boxes, rods and existing geometry into **per-material vertex buffers**, split into **map chunks** so chunks that are off screen are not drawn.

### 5.6 Vegetation
- **Trees** (`assets/trees.js`):
  - trunks and branches are tubes that branch out;
  - leaves are **camera-facing billboard cards** grouped into clumps, each clump shaded round, which gives full, puffy crowns;
  - widen the bounding sphere to cover the cards;
  - distant forest edges use fewer, larger cards.
  - Bang Saen species:
    - **coconut palm** (curved trunk + strips of leaves)
    - **casuarina / สนทะเล** (horizontal layers of needles, like Yoshimi's black pine; a few behind the beach)
    - **rain tree / จามจุรี** (wide, round canopy)
    - **frangipani / ลีลาวดี** (low tree with flowers)
- **Grass** (`grass.js`, the Breath-of-the-Wild approach):
  - Bake a **1 m grass-map texture**: R = coverage, G = height, B = clumping, A = special ground (paddy / sand).
  - Draw **2 × 2 m grass tiles of 324 blades**. The vertex shader stands each blade on the ground and bends it.
  - Thin blades out with distance and make the remaining ones thicker. Beyond the grass range, paint the ground grass-colored so it still reads as grass.
  - **Wind gust waves** roll across the field, and bent blades catch the light. **Blades part around the player** as they walk.
  - Bang Saen ground types: beach-grass tufts on the dunes, lawn in parks, weeds by the roadside, **no grass on sand**.

### 5.7 Water — `src/world/water.js`
- **Sea:**
  - a fine wave grid near the camera that **moves with the camera**, plus a flat ring for the distance;
  - **Fresnel** sky reflection;
  - **3-step depth color** that blends smoothly (shallow blue-green → mid → deep). Keep the steps close so it doesn't look like cloud blotches from above;
  - **foam where the water meets the shore**;
  - reduce the small waves as the camera rises, to avoid grid stripes.
  - Bang Saen water is warmer and more green-turquoise than Japan. Start around shallow `#4fb3a8`, mid `#2a8f9a`, deep `#1d5f7a`.
- Rivers and ponds: flat at their own water level, no waves.
- **Underwater** (squid mini-game), from Yoshimi `shaderPatch.js`:
  - light is absorbed by depth (red fades first, then green, then blue);
  - **caustics** projected from the sun direction (Voronoi light web);
  - separate underwater and above-water fog: underwater density `0.034`, air `0.0014`, shallow `#2aa6b0`, deep `#06324a`;
  - vertex animation for swimming fish and swaying seaweed.

### 5.8 Buildings (Thai adaptation)
- Walls, roofs and windows get real procedural detail. The windows show a room behind the glass.
- Bang Saen building types:
  - **shophouses (ตึกแถว)**: 2–4 floors, roll-up shutters, balcony railings, signboards (generic text, **no real brands**)
  - **metal-sheet roofs** (standing seam, `MeshStandardMaterial`, slight shine)
  - **Thai clay tile roofs** for houses and temples
  - beach hotels / condos: 6–12 floors, balconies
  - a spirit house (ศาลพระภูมิ) at many lots
- Beach props:
  - rows of **blue/red beach umbrellas + deck chairs**
  - inner-tube rental stacks
  - plastic tables and stools
  - food carts
  - songthaew trucks
  - motorbikes
  - power poles with tangled cables (a strong visual signature of Thai streets)

### 5.9 Characters — `src/town/kid/`, `people/`
- The player is a kid with a hat and moves in third person:
  - walk, run, idle and jump states blended smoothly;
  - **2-joint IK legs** so the feet stay planted on the ground;
  - lean forward when accelerating and sideways into turns;
  - hat or hair on a **spring** so it bounces;
  - animation speed comes from the distance actually travelled (no running in place against a wall).
- NPCs have:
  - standing poses with **2-joint IK arms** and hand shapes;
  - head, neck and eye look-at: they watch the player when close and **wave the first time you arrive**;
  - blinking, facial expressions and gestures;
  - **mouth shapes driven by the text as it appears**, adapted to Thai vowels (open / wide / round / smile).
- Build meshes in a Worker (async), because procedural characters are heavy to generate.
- **Camera:** third person looking at head height, controlled by `(yaw, pitch, distance)`. It pulls in so it never goes inside buildings and never drops below the ground.

### 5.10 Bang Saen palette (starting values; tune in `shared/palette.js`)
| Use | Color |
|---|---|
| Sun | `#fff1d6` (slightly warmer than Yoshimi) |
| Sky zenith / horizon | `#2f78c8` / `#cfe6f2` |
| Haze | `#d2e2ea` |
| Beach sand | `#e8d8a8` |
| Shallow / mid / deep sea | `#4fb3a8` / `#2a8f9a` / `#1d5f7a` |
| Casuarina / palm green | `#4d6e3c` / `#4f8a3a` |
| Metal roof | `#8d9aa3` (plus rust tones) |
| Thai tile roof | `#b8583a` |
| Shophouse walls | cream `#eee3cc`, pastel mint, pastel pink |

### 5.11 Style rules
- **Do:** real detail up close (tiles, blades, planks), soft light, gentle haze, calm colors.
- **Don't:** flat unlit colors, pure black shadows, saturated neon, cartoon outlines, real logos, likenesses of real people.
- Before and after every visual change, take a screenshot from the **same 3 fixed camera views** (`?view=beach`, `?view=town`, `?view=air`) and compare them.

## 6. Performance Budget

- Target 60 fps on a mid-range laptop GPU; must stay above 30 fps
- Fewer than 300 draw calls in the hub: merge static geometry, use `InstancedMesh` for trees, palms, grass, umbrellas and people
- Shadow map 2048–4096, following the player instead of covering the whole map
- Total download under 15 MB (sounds compressed as .ogg/.mp3, 96–128 kbps)
- Show the FPS counter only in debug mode (`?debug=1`)

---

## 7. Milestones

| # | Goal | Done when |
|---|---|---|
| M1 | Map bake + terrain + sea + sky + post-FX | The Bang Saen coastline is recognizable from above |
| M2 | Buildings, roads, palms and trees; player walks around; camera controls | You can walk the beach road end to end at 60 fps |
| M3 | NPCs, dialogue, travel menu, save system | You can talk, travel, and the progress survives a reload |
| M4 | Mini-game 1 (crab) complete, with its species table and results screen | Fully playable start to finish |
| M5 | Mini-games 2–5 | All five playable start to finish |
| M6 | Story/quests, audio, credits screen, polish, GitHub Pages deploy | The public URL works in a fresh browser |

Finish and test one milestone before starting the next.

**Status (2026-09-26):** M1 done. M2 done except grass (§5.6 grass tiles) and Worker-built characters, which are deferred.
M3 done: 7 NPCs (roster.js), dialogue with Thai grapheme typing and mouth shapes, travel menu (M), bag (B), quests, and a save that survives reloads (`?reset=1` starts a new game).
M4 done: จับปูลม (`src/crab/`: species.js table, scene.js dusk beach, crabs.js AI, ui.js reusable round UI, index.js start/stop).
Games are registered in `src/games.js` (lazy import, catch tables become bag items). While a game runs, main.js pauses the hub and renders the game's own scene; `hub.finishGame()` pays out baht, fills the bag and saves the best result.
Jump into a game from the console: `__game.startGame('crab')`.
M5 done: ตกหมึก (`src/squid/`, uses `world/underwater.js`), ลิงเขาสามมุข (`src/monkey/`), ห่วงยาง (`src/tube/`), ร้านส้มตำ (`src/stall/`). All five share `shared/gameUI.js`.
Balance testing: `__game.tick(1/60)` advances the game logic without rendering, so a scripted bot can play a whole round in one call. Each game returns a `debug` handle from `start()`.
Payout targets for a good round: about ฿100–250.
M6 (2026-09-26): audio is procedural Web Audio (`core/audio.js`: ambient beds + effect recipes) instead of CC0 files, so there is nothing to download or license. Also added: the credits screen (`shared/credits.js`), the quest chain through to the ending (`quests.js`, grandma's script), and the title and ending cards (`town/title.js`). Deployed 2026-10-01 (user's OK): public repo https://github.com/shuttertong/bangsaendream, live at https://shuttertong.github.io/bangsaendream/ (GitHub Pages from `main` /, `.nojekyll`). On https hosts `core/net.js` skips the relay, so it is single-player. Code is MIT (`LICENSE`); the baked map data stays ODbL. Commits use the GitHub noreply email (`94951934+shuttertong@users.noreply.github.com`) — keep it that way. A custom domain (planned: bangsaendream.com) needs a `CNAME` file + the registrar's DNS (CNAME → shuttertong.github.io).
Red songthaews (รถแดง, `town/songthaew.js` + `assets/songthaew.js`): trucks drive the long main roads on the left (OSM ways chained into whole roads, dual carriageways de-duplicated, max 5 routes × 2), stop now and then, and yield to the kid. The F key or the prompt button boards (฿10 fare, `flags.rodDaeng` on the first ride) and hops off. Painted livery only (route text); no banners showing real people.
Towed-inflatable games (2026-09-26): two extra mini-games, played through Tom (พี่ต้อม) at the speedboat landing (`places.speedboat`).
They share `src/boats/` (`scene.js` open sea + speedboat + wake, `tow.js` tow path and hook turns, `riders.js`, `models.js`).
- `src/banana/`: keep the banana boat upright by leaning (roll physics). 3 capsizes allowed.
- `src/sofa/`: press as the sofa lands off the wake. The combo multiplier is capped at ×3; a miss throws off a friend.
Tunables live in each game's `rules.js`. The `playAll` quest counts 7 games. Hub draw calls peak at about 275 at the landing, after merging umbrella poles into canopies, merging the songthaew decals and hiding trucks beyond 260 m.
Jet ski (2026-09-26, `src/jetski/`, also through Tom): the kid drives through a buoy slalom (`course.js` lays gates, net-float lines, moored longtails and bottles out ahead; `rules.js` RIDE / COURSE / SCORE). `boats/scene.js` takes `{ tow: false }` and a `wakeFrom` source for self-driven craft. Bot balance: sharp ≈ ฿200, sloppy ≈ ฿70–120. `playAll` now counts 8 games.
Seats (`town/seats.js`): every deck chair under the umbrellas is a vendor's chair, rented for ฿5 (it stays yours until you rent another one). Concrete public benches (`beach.js` buildBenches, static kit geometry, so they add no draw calls) are free. `player.sit(seat, yaw, 'bench' | 'lounge')`; `hub.seated` covers both the songthaew and the seats.
Khao lam (2026-09-26, `src/khaolam/`, offered by Grandma): pick the kind customers want, then pound the charred bamboo off each strip with a hammer (กะเทาะ = ทุบ): three blows per go, timed on a power meter (too light → the char stays; too hard → the rice cracks, lower price). Grandma serves orders from the tray automatically. The customer queue now lives in `shared/customers.js` (used by the som tam stall too). A khao lam stand sits beside Grandma's house (`assets/stall.js` khaoLamStand). Bot balance: ฿100–240. `playAll` counts 9 games.
Beach layout (2026-09-26, from the user's photos + satellite view), back from the waterline: open pale sand (0–13 m) → three rows of blue-and-white umbrella sets (`beach.js` rows 14/17.5/21; umbrella + chairs or table baked into one instance) → a dense palm band leaning seaward (rows 25/29/33; instance shear adds lean) with benches and tall floodlights → the brick promenade (the OSM `pedestrian` way; `roads.js` PROMENADE, and a generated one on the sea side of beachfront roads) lined with palms and stalls (`promenade.js`). Casuarinas and rain trees now start further back.
Welcome sign roundabout (วงเวียนบางแสน / วงเวียนโลมา): `town/landmarks.js` + `assets/landmark.js`, centre fitted to the OSM ring ways (615.9, 1236.5). The island has a striped lawn, terraced sandstone-slab walls with hedges and flowering shrubs, topiaries, a Thai flag and a yellow flag, and tall palms behind the sign; around the ring: palms, street lamps, a floodlight tower and zebra crossings on every exit (`dressRoundabout`). The bake clips the ring's inland arc; `completeRoundabout()` restores it. Travel stop `welcome`. A floating pontoon sits at Tom's landing.
Laem Thaen (`town/laemthaen.js`, tip from the OSM coastline) is a landscaped seaside park (terrain.js `PARKS`: lawn, only a thin strip of sand): palms along the OSM footpaths, shade trees, benches, lamps and bougainvillea planters; a paved plaza with steps, tiled compass, lawn, flags, planters and lamps behind a curved white seawall; the lattice lookout pier (square walkway frames on posts, far bar with two tiered platforms); lumpy granite boulders at the waterline; a name stone at the entrance. Umbrellas/palm rows stay outside the park. Plaza and pier are **walkable decks** (`collision.deck/deckAt`; `lift` in main.js uses them), which also lets you stand over deep water.
Khao Sam Muk (`town/khaosammuk.js`, box = `terrain.js` ROCKY_SHORE): forest over the whole hill (beyond the strip too), pale granite where `rockMask()` says (terrain colour + angular crags), a seawall walkway with white railings and steel "tree" shade canopies along the coast road, the viewpoint clearing (paving draped on the slope, railing, a red shrine, macaques from the monkey game models), mussel-farm poles in Ang Sila bay. No beach furniture on that shore (`layout.noBeach`), only a thin strip of sand.
Fishing village (`town/fishingvillage.js`, OSM has no buildings/piers there): stilt houses fronting the shore road on the Ang Sila side of Khao Sam Muk (bright metal roofs, back decks, longtails tied up), wooden jetties between the clusters with Thai fishing boats (`fishingBoatGeometry`) and longtails, and the long concrete pier off the hill's north tip with lamps, a shelter and moored boats. Houses have lap-siding plank walls (bare weathered timber or painted planks, dark gaps, corner posts, framed windows). Moored boats bob: `town/boats.js` instances them per design and heaves/rolls/pitches them in the vertex shader (shadows too). Jetties and pier are walkable decks. No beach promenade or seawall along the village (roads.js / khaosammuk.js skip ROCKY_SHORE / VILLAGE.shore).
Walking street (`town/walkingstreet.js`, ถนนคนเดินบางแสน, north of Laem Thaen; no OSM data, laid out along the roads inside WALK.box): market stalls under pop-up gazebo tents on both sides of the road, strings of bulbs across it, and the paved seafront lot with parking lines between the road and the sea. สะพานราชนาวี (`town/navypier.js`): a wide concrete pier from the small point north-east of Laem Thaen (northernmost coast point in NAVY.find) with a ramp, railings, lamps, bollards, benches, an anchor monument and flags at the root, a Thai sala at the end and grey boats moored alongside (bobbing). Both are travel stops (`walking`, `navyPier`).
Junctions: pavements, kerbs and the promenade skip quads that lie on another road (`roadIdx.clearance`), and edge lines / centre dashes stop where another road crosses (`roadIdx.onOtherRoad`). Walk zones (`collision.walkZones`) make places walkable beyond the 100 m strip — the whole roundabout is one (its inland arc is ~110 m from the sea).
Distance culling (`town/chunkcull.js`): static town/beach chunks beyond ~1.3 km (more when the camera is high) are hidden; it keeps long views along the coast under the draw-call budget.
Occupancy boxes along the shore must be rotated to the shore direction (`occ.mark/test(..., ry)`), otherwise diagonal coast spots block each other.
Multiplayer (2026-09-26, the user's choice: **local Wi-Fi only**, shared hub, preset-phrase chat): `tools/serve.py` relays WebSocket messages on `/mp` (stdlib only; whitelisted, type-checked fields). `core/net.js` connects only when served by it (static hosts stay single-player). `town/multiplayer.js` shows other players as kids with name tags, speech bubbles and emotes, interpolated 150 ms behind; the 💬 button / T opens phrases, emotes and the profile (name + look re-rolls). Names, looks and phrases are preset lists sent as indices (`shared/avatar.js`, `shared/phrases.js`), so no free text reaches other players. Mini-games stay single-player; players in one show 🎮. **Online (2026-10-01, the user's choice):** on https hosts (the live site) `core/net.js` uses `core/realtime.js`: Supabase Realtime (project `rlkmjujiidvtjmvfrrfw`, public channel `realtime:bangsaendream-hub`, publishable key; Phoenix protocol by hand, no library). It stands in for the relay in each browser: presence = who's here; every receiver applies the relay's whitelist (`core/mpcheck.js`, a port of serve.py's checks), so only preset indices are ever shown; the truck host is the earliest-arrived visible real player, skipped after 3 s of silence. Online rates are lower for the free-plan quota (`REALTIME.rates` in `shared/config.js`: state 4 Hz / keep-alive 3 s / trucks 3 Hz / interpolation 0.35 s). `?online=test` forces Realtime anywhere on a separate test channel — use it for testing, never the real hub. **One shared world:** every address except localhost (the live site and LAN addresses like http://192.168.x.x:8000) joins the same Realtime hub; localhost and `?lan=1` use the Wi-Fi relay (serve.py). Toasts show the status (🌐 online · N friends / 📴 offline), and the title card shows `GAME_VERSION` (bump it on each deploy) so a phone's version can be checked.
Shared red trucks: the relay elects a host (a visible, real player that keeps sending snapshots; hidden tabs, bots and silent/old clients are skipped, a silent host is replaced after 3 s). The host's `songthaew.js` simulates (mode 'host', 10 snapshots/s of [s, dir, v]); others follow (mode 'follow', falling back to local after 3 s without data). Pull-over goes through `trucks.setHold()` → `hold` messages to the host; trucks brake for every player in the road. Riders are drawn on each viewer's own truck copy in seat slot `id % 6`.
Co-op mini-games (`town/coop.js` lobby, `co` relay messages): Tom's "🍌👫 banana boat with friends" opens a lobby (offline it starts solo); everyone online gets an invite banner, up to 4 join, the leader sets off (or a 25 s countdown). In the ride the leader's game runs the tow + balance with the **average of everyone's lean** (`banana/net.js`: snapshots 15×/s, events spill/up/hook/saved/team/end; members send their lean); riders show each player's look and lean; hearts, score and payout are shared; a teamwork bonus pays when everyone leans together through a hook. `co` payloads may only hold numbers, lists and short lowercase words (server-validated).
Friends (2026-10-03, the user's request: add friends by meeting face to face, both sides press; a map to look at friends): `shared/friends.js` keeps a random two-number id per browser (no accounts, nothing personal) and the friends list in localStorage key `bangsaen.friends.v1` (survives `?reset=1`). `town/friends.js`: within 3.5 m of another player a 🤝 button shows; when both have pressed within 60 s they are friends (toast, heart). It rides the co-op channel, so the relay whitelists need no change: `{ k: 'fid', n, i }` announces our id to newcomers, `{ k: 'friend', n, i }` is the 🤝. The 👫 panel (button or G) has `town/friendmap.js` (canvas map of coast + roads; me, online friends by name, other players as grey dots; drag / pinch / wheel), the list with where each friend is (nearest travel stop + metres, 🎮 in a mini-game, or not playing), 🚁 fly the drone over a friend, and remove. Bots 🤝 back after 1.5 s for testing. Debug: `__game.friends`.
หมากล้อม / Go (2026-10-03, the user's request: a Go house with a 9×9 mini-game, playable against other people from an open table): `src/go/` — `board.js` (pure rules: capture, simple ko, no suicide, two passes end it, **area scoring** so kids never mark dead stones; komi 5.5), `ai.js` (the teacher: one-move look-ahead with weights in `rules.js` `AI`; beats random play 100/100, a self-play game is ~80 moves), `scene.js` (tatami room, goban, instanced stones, ghost stone, territory squares), `net.js`, `index.js`. Tap a point to choose it, tap again or ✔ to place; 45 s per move (time out = pass). Pay (`PAY`): teacher win ฿150 / lose ฿50, online win ฿180 / lose ฿80, +฿5 per captured stone (cap ฿60), scaled down before move 16. Online: the teacher's "open a table" option opens a `coop.js` lobby (`COOP.games.go`: 2 seats, waits 180 s, sets off as soon as someone sits down, or the leader presses "play the teacher now"); the table's owner is Black. Both games run the same rules, so the co-op channel only carries `{ k: 'mv', i, n }` (index, move number; −1 = pass) and `{ k: 'ev', e: 'resign' | 'bye' }`. The Go house (`town/gohouse.js`) dresses the small shophouse row (≤ 3 units) nearest `GO_HOUSE.near` (by the welcome roundabout) (sign through i18n, stone emblems, lanterns, an outdoor goban); teacher `kru` in `roster.js`, travel stop `goHouse`. `playAll` still needs 9 games (Go counts as one of them).
Test bots: `?bots=N` (≤ 8, `town/mpbots.js`) adds fake players on their own connections that wander, wait at the roadside, ride the red trucks, pull over, and chat.
Characters (2026-09-27, the user asked for a smooth chibi-toon look like the Yoshimi game and a chibi illustration — style only: no likeness of a real person, no brand logos): `people/toon.js` builds every person. Kids have a big round toon head; adults pass `headScale` ≈ 0.86. Faces have layered anime eyes on the eyes bone (eye white → iris → pupil → highlights → lash line, so blinking still works), arched brows, blush, a soft skin-coloured nose (shading shows it) and a D-shaped smile on the mouth bone (talk shapes scale it open). Clothes have detail (2026-10-03): domed sleeves with hem trim, cuffs on long sleeves, a collar and shirt hem, a small generic chest print (fish / crab / sun, picked from the shirt colour; `look.print = 'none'` for plain, hidden under aprons and vests), waistband, socks (`look.sock`), toe caps, hands with thumbs, pleated skirts, a wrapped apron (bib + skirt panel + ties), a crown shine on the hair and a band on buns. `lathe()` turns any profile to face outward (an inside-out skirt was the old bug). Dev lineup of every look: `tools/lineup.html?zoom=4&from=0&face=1`. Hair is a smooth shell with tapered bangs, side locks, and a long back piece or a bun. Bodies have a lathe torso and shorts, capsule limbs that are full-width at the joints (no pinched elbows or knees), mitten hands and rounded shoes. Proportions follow the Yoshimi kid (the user's pick after trying full chibi): kids' head `headScale` 1.2 (≈ 1/5 of their height), full-length legs (`KID_LEGS` 1; `look.legScale` 0.66 gives chibi legs), and arms that reach mid-thigh. Limbs are tapered lathes (`TOON.limb`: thigh → knee, calf → ankle, upper arm → wrist) with round ends tucked into the joints. Short sleeves and shorts legs are open tubes (shorts to just above the knee). `bodyFor(look)` sizes the skeleton per person, `buildPerson()` returns `body`, and the kid's walking IK reads it. Long hair is full and wavy, with locks in front of the shoulders. `body.js` keeps the same skeleton; its material uses soft wrapped (half-Lambert) light.
Roads (2026-09-27, the user asked for realistic, connected coastal roads that the kid never sinks into; no new buildings):
- `town/roadjoin.js` extends dangling ends to a nearby road (≤ 12 m, ahead or < 4 m, not through buildings).
- `town/grading.js` grades the terrain grid to smooth road profiles *before anything is built*: Gaussian-smoothed along each road, lesser roads pinned to the road they join, grade-limited (town 0.08, hill 0.25 scene units per metre), never below sea + 0.35, grid pulled flat under the road ±5 m and blended back over 12 m. Under-sea nodes are raised only within one cell of a road edge.
- Bake corridor `coastlink` (`bare`: road only, no buildings — `layout.buildStrip`) restores links the 100 m cut broke: ถนนบางแสนสาย 1 (Laem Thaen → Khao Sam Muk) and ถนนรอบเขาสามมุข ซอย 1 → ถนนอ่างศิลา 3134.
- `__game.auditRoads()` (debug) reports metres of road that dip below the sea, sink, tilt, bump or climb steeply, plus dangling ends and connected pieces. After the fix: below 0, sink 0, tilt 1 %, and the coast from Bang Saen to Ang Sila is one connected 17.4 km network.
Lanes (2026-10-03, the user asked for the beach road to match the real map): roads carry OSM `lanes` / `oneway` as `l` / `o` in `bangsaen.json` (`bake_map.py` writes them; the committed file was patched from the cached OSM download without a full re-bake). `roads.js` `roadWidth(road)` now takes the **road object** (a kind string still works): secondary / tertiary roads with 3+ lanes are `lanes × 3.25 + 1` m wide, capped at 4 lanes (`LANES`), so ถนนบางแสนสาย 1 along the beach (4 lanes in OSM for 2.15 km) is 14 m instead of 8 m, with white lane dashes and a double solid yellow centre line (one-way roads get dashes only). Red trucks keep to the left-hand lane on wide roads (`songthaew.js` per-point `lane`). Everything that offsets from a road edge reads `roadWidth(road)` / `roadIdx`, so frontage buildings, pavements and the promenade moved out with the road — the generated town layout changed with it. Stretches OSM has no `lanes` tag for (the beach road south of the roundabout) keep their old width.
Drone view (`town/drone.js`, 🚁 button or V; Esc leaves): fly up and overlook an area top-down. Area chips come from `DRONE_AREAS`; the ⬚ tool frames a dragged box; double-tap flies down to a spot; drag pans, wheel/pinch zooms, Q/E turn, and the angle button switches top ↔ tilted (tilt-shift above 150 m). Above 1200 m, `chunkcull.js` hides the metal, glass and lit detail chunks to keep the overview under 300 draw calls.
The coarse outer terrain mesh (80 m grid) lies under the core square: each of its corners there takes the lowest fine height within one coarse cell, minus `OUTER_UNDER` (it used to be "height − 6", and on steep Khao Sam Muk its big triangles rose above the real ground as a sand-coloured shelf that covered the hill roads). Terrain beyond the core square (`terrain.js` `outerHeights`) takes the lowest edge height over a widening window, so land that touches the edge tapers off instead of stretching into fake spits. The water shader deepens past the grid for the same reason.
The Khao Sam Muk viewpoint (`town/viewpoint.js`, from the user's Street View) is a level terrace built out from the hill road over the south-west slope. It has retaining walls, grey paving with lighter zigzag borders, a concrete balustrade (lathe balusters, square posts, an entrance gap on the road side), a metal-roofed shelter at the north-west end, coin binocular viewers and macaques on the rail. It is a walkable deck, built before the hill forest so trees and crags keep off it and its view. Travel stop `viewpoint` (Chai, the monkey game) and the drone's viewpoint chip point here. The coin binoculars work (`town/binoculars.js`): F at a viewer (฿5, free when short) looks through a double-lens mask. Drag grabs the view, wheel/pinch/+− zoom, F/Esc steps back. The near plane is 10 m (like real binoculars), and name tags with distances come from `DRONE_AREAS`. A fan of slope below the terrace is kept free of trees so the view is open.
Hill roads on Khao Sam Muk (2026-10-03, realistic, no new buildings): all three modules read the same one-metre samples from `town/hillgeom.js` (heading, bend, cut bank / drop side, bank height; left-hand traffic, `(nx,nz)` = right of travel, `outside(p)` = the bend's outer side). `hillroad.js`: plain concrete kerb on the drop side, red-and-white paint only on bend outsides, white guardrail on drops, lamps, kerbside macaques. `hillmarks.js`: edge lines, dashed centre line that turns solid yellow through bends, concrete drain gutter and a stone retaining wall (height follows the smoothed bank) on the bank side; paint sits `ROAD_LIFT + 0.09` (lower z-fights with the ribbon). `hillsigns.js`: ระวังลิง every ~190 m (alternating directions), curve arrows, chevron runs and convex mirrors on hairpins, 30 km/h at the hill entry; faces share one canvas atlas mesh. Debug handles: `__game.hillRoads / hillMarks / hillSigns` (`counts`). Forest and crags keep clear of the hill roads (crags 5 m; trees by crown reach, below): crowns are ~5 m wide and used to cover the roads when seen from above or the drone. Since 2026-10-03 the gap is per tree: a trunk in the hill box stands at least its crown reach from the road edge (`CROWN_REACH` in `nature.js` × the tree's scale; rain tree 9.5 m), and the hill forest swaps a wide tree for a narrower kind beside a road (`KSM.forest.narrow`) — hill-road samples under a crown: 1,590 → 0 of 5,439. A crown may hang `HILL.over` (1.2 m) over the road edge and trunks stand ≥ 2.6 m off it, so the forest hugs the road while the lanes stay open from above (centre covered: 0). Generated frontage lots avoid the hill (`FRONTAGE.hill` in `buildings.js`: low ground only, gentle slope across the footprint and behind it) — they used to stand half-buried in the slope (81 rows on the hill before, 1 after). Roads that climb above 18 scene units are sampled every metre (`roads.js` `STEP_HILL`; 2 m elsewhere): on a steep, curving hill road a 2 m chord cut through the 8 m terrain triangles and the ground poked up through the ribbon's edge (chords with ground above the ribbon: 132 → 52 of ~42,000, worst 0.30 → 0.21 m). Terrain never buries the road ribbon (checked: ground pokes through only on ~0.5 % of ribbon chords, ≤ 0.3 m).
Feedback (2026-10-01): the 💌 HUD button (`shared/feedback.js`, settings in `shared/config.js`) lets players send requests/feedback (idea / problem / like / mini-game wish, ≤ 500 chars, 60 s cooldown, no personal fields). They go to table `game_feedback` in the game's own Supabase project `rlkmjujiidvtjmvfrrfw` through the publishable key. RLS is insert-only (`supabase/game_feedback.sql`, applied by the user in the dashboard): the key can add but never read. The user reads messages in the dashboard (Table Editor). Never insert test rows; test with a fetch stub or an invalid-kind probe (rejected by the check constraint). Memory: the geometry kit builds into typed buffers (16-bit normals/colours) and frees JS copies after GPU upload — the JS heap went from 2.3 GB to ≈ 450 MB, which phones need.
ร้านพันธมิตร / partner shops (2026-10-03, the user's business model — see the plan at claude.ai/artifact/UxNwkQBpVNa7wbt4J1o6m6): players always play free; real Bang Saen shops pay (Pin ฿300 · Shop ฿900 · Game sponsor ฿2,500 · Event ฿3,000 per month, coupons ฿15 per redeemed; `PARTNERS.prices` in `shared/config.js`). Phase 1 is built:
- `supabase/partners.sql` (user runs it in the dashboard; the admin email goes in `app_admins`): tables partners / placements / coupons / visits / invoices / audit, RLS admin-only, a `public_placements` view (approved + in dates, safe columns) for the game, RPCs `issue_coupon` (anon; one per player per shop per day, daily cap, 7-day expiry, server-made 6-digit code), `redeem_coupon` (admin or shop owner), `log_visit` (daily totals, no identity); a public `logos` bucket.
- `town/partners.js`: loads the view at start, builds one kiosk per shop (second Kit, one draw call batch) with a sign atlas (name + logo + "ร้านพันธมิตร" + hours; one mesh), collision, a travel pin (icon `partner`), a visit ping once per session within 12 m, and the F prompt within 3.2 m → coupon panel (`.cp-panel`, code also kept in localStorage; bag item `coupon`). `?partners=demo` shows a fictional demo kiosk without the database.
- `admin.html` + `src/admin/` (api.js magic-link login via GoTrue REST, map.js canvas picker over the baked roads, main.js): shop list, add/edit with the map picker and logo upload, approval queue with the kid-safety checklist, coupon confirmation, visits/coupons per shop, invoices (package + ฿15 × redeemed this month) and paid marks. `?demo=1` previews it without a login. Needs the admin URL in Supabase Auth → Redirect URLs.
- Phase 2 (not built): partner self-serve page, the café mini-game, sponsored skins for the som tam / khao lam games, NPC lines, automated billing.
Fantasy wardrobe (2026-10-03, the user's retention idea: earn baht in mini-games, spend it on fantasy dress-up; players never pay real money): `shared/wardrobe.js` is the catalogue (34 items in 6 slots: head, wings, back, in hand, tail, aura; rarities common ฿40–180 → legendary ฿1,200–1,500; `featuredToday()` picks 3 items a day at 20 % off from the date; `DAILY.gift` ฿30 once a day). Geometry in `people/fantasy.js` (hats/ears on the hat bone so they bounce, wings/capes/packs on the spine, held items on the left forearm — shield on the right —, tails on the hips), merged into the person mesh by `toon.js` (a fantasy head item replaces the hat); shared primitives in `people/geo.js`. Auras in `town/aura.js` (Points sprites following a person). The 👗 panel (`town/wardrobe.js`, button or K) is a bottom sheet (side panel on desktop) with a mirror camera, try-on before buying, buy-and-wear, take off, the daily gift and the featured deals; the kid is frozen while it is open (`hub.wardrobe`). Save: `wardrobe { owned, worn, gift }` in progress.js. Worn items reach every mini-game through KID_LOOK (`fxLook`) and other players as 1-based indices per slot (`fxOf`/`wornOf`; `fx` in hello, whitelisted in serve.py and mpcheck.js; remotes get their aura too). Items are purely cosmetic.
Performance check: `__game.bench()` in the console (with `?debug=1`) advances the game and times full frames synchronously.
Use it instead of the FPS counter when the browser tab is not focused, because the browser then throttles `requestAnimationFrame`.

---

## 8. Working Rules for Claude

1. **Small modules.** Keep each file to about 400 lines or less and one responsibility. Change one module at a time.
2. **Data-driven.** Put tunable values (species, prices, colors, spawn rates, dialogue) in data files, not in logic.
3. **Test in the browser after every change.** Run the dev server, open the page, check the console for errors, and take a screenshot when changing visuals. Never report something as done without running it.
4. **No runtime calls to Overpass or the DEM servers.** The game only loads baked files from `src/town/data/`.
5. **Licensing.** Use only CC0 or properly licensed assets, and add every one to `CREDITS.md` and the in-game credits screen. Keep "© OpenStreetMap contributors" visible on screen. No copyrighted characters. Real brand names/logos appear **only** for approved ร้านพันธมิตร (partner shops) whose owner uploaded the logo and confirmed ownership; everything the game generates itself stays fictional.
6. **No new dependencies** beyond Three.js and its `examples/jsm` add-ons without asking first.
7. **Coordinates:** always use the local-metre conversion in §3. Never mix latitude/longitude into scene code.
8. **Thai text:** all player-facing strings go through `shared/i18n.js` (TH + EN). Never hard-code Thai text in the logic.
9. **Performance:** check the draw-call count (`renderer.info.render.calls`) after adding content to the hub.
10. **Git:** make small commits with messages like `feat(crab): add flee behavior` or `fix(terrain): coastline mask sign`.

---

## 9. Quick Start for a New Session

```bash
python3 tools/serve.py 8000      # no-cache dev server + local Wi-Fi multiplayer relay (/mp); open http://localhost:8000
# phone / iPad on the same Wi-Fi: http://<this Mac's IP>:8000 (ipconfig getifaddr en0)
#   touch: left thumb = floating joystick (push to the rim to run), right side drag = camera,
#   pinch = zoom, round button = jump. Desktop: WASD / arrows, Shift run, Space jump, drag, wheel, Q/E
# debug overlay:        http://localhost:8000/?debug=1
# jump to a mini-game:  http://localhost:8000/?game=crab
```

When the map area changes: `python3 tools/bake_map.py --lat 13.2950 --lon 100.9100 --half 2400 --step 8 --inland 100` (raw downloads are cached in `tools/.cache/`; add `--refresh` to download again)
