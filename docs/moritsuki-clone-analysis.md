# Clone Blueprint: "なちゃっとの夏休み" (Nachat's Summer Vacation)

Source: https://cda-social.github.io/moritsuki/ (built with Claude Opus 5.5 in ~2 days)
Analysis date: 2026-09-26 — based on the files the live page loads.

---

## 1. Game Concept

| Item | Details |
|---|---|
| Genre | Nostalgic slice-of-life 3D exploration + 5 mini-games |
| Theme | A kid's Japanese summer vacation in a rural town (Yoshimi, Shimonoseki, Yamaguchi) — rice paddies, river, forest, shops |
| Core loop | Explore the town hub → talk to NPCs / take quests → travel to a spot → play a mini-game → earn items / money → story progresses |
| Story hooks | "Go to the diner (定食屋) and the laboratory (研究所)" to advance the story; "recovering Nachat's memories" framing |
| Access | All mini-games are unlocked from the start; each is fully playable start to finish |
| Visual style | Warm, low-poly, diorama look (tilt-shift blur), soft ambient occlusion, haze, stylized water |
| Controls | Drag / WASD move · mouse wheel = height · Q/E rotate · F / right-click back |

### The 5 mini-games (folder → theme)

| Folder | Japanese | Mini-game |
|---|---|---|
| `fish/` | 魚 | Underwater spearfishing (seen in the video: "イシダイだ！" + tap-to-reel meter). Includes octopus, lobster, turtle |
| `hamaguri/` | はまぐり | Clam digging |
| `gazami/` | ガザミ | Crab catching |
| `kusafugu/` | クサフグ | Pufferfish fishing |
| `unagi/` | うなぎ | Eel catching |

Each has a `species.js` (catch table: names, size, rarity, price) — the video shows size ("デカい！") and a money counter (¥8,740).

---

## 2. Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| 3D engine | **Three.js r170** | Loaded from `cdn.jsdelivr.net` through an `importmap` |
| Graphics API | WebGL 2 | "Needs a PC with a GPU" |
| Language | Vanilla JavaScript (ES modules) | ~225 files, no bundler, no framework |
| Post-FX | `EffectComposer`, `RenderPass`, **`GTAOPass`**, **`HorizontalTiltShiftShader`**, `ShaderPass`, `OutputPass` | Gives the miniature/diorama look |
| Custom shaders | `core/shaderPatch.js` | Patches built-in Three.js materials (`onBeforeCompile`) for water, grass, fog, wind |
| Map data | **OpenStreetMap** (`osmBlocks`) + custom JSON/binary files | `yoshimi.json`, `yoshimi-core.bin`, `yoshimi-outer.bin` (likely terrain height / road / building data) |
| Layout data | `paddy-plan.json`, `planted-trees.json` | Hand-placed or generated placements |
| 3D assets | **Procedural (built in code)** | No .glb/.fbx files and no image textures load — houses, trees, people, fish are all built in JS |
| Audio | Web Audio API (`ambience.js`) playing **real CC0 sound files** | Confirmed by the in-game credits screen: 効果音ラボ (soundeffect-lab.info) for cicadas, frogs, birds, waves, waterway, wind chime, footsteps and notification sounds; Freesound.org (CC0) for wind ambience ("Soft Wind Ambience" by cribbler, "Strong wind blowing in the plain in Anatolia" by felix.blume) |
| UI | HTML/CSS overlay (`town.css`, `hud.js`) + Google Fonts | Japanese text popups, meters, menus |
| Save | `shared/progress.js` | Probably localStorage |
| Hosting | GitHub Pages | Free static hosting, no server |

---

## 3. Project Structure (reconstructed)

```
moritsuki/
├── index.html              # importmap + <canvas> + HUD HTML
└── src/
    ├── core/               # engine-level helpers
    │   ├── input.js        # keyboard/mouse/drag
    │   └── shaderPatch.js  # shared shader uniforms & material patches
    ├── shared/
    │   ├── progress.js     # save/load, unlocks
    │   └── items.js        # item definitions
    ├── world/
    │   ├── sky.js
    │   └── water.js
    ├── town/               # hub world
    │   ├── main.js         # boot + per-frame update loop
    │   ├── data.js layout.js terrain.js water.js render.js
    │   ├── roads.js buildings.js lots.js blocks.js fence.js props.js landmarks.js
    │   ├── nature.js grass.js plant.js mesher.js materials.js ambience.js
    │   ├── player.js  kid/index.js         # player character
    │   ├── people/ (npc.js, talk.js, town.js)
    │   ├── quests.js bag.js travel.js stagePick.js hud.js
    │   ├── assets/ (kit.js, house.js, props.js, trees.js, trees2.js, textures.js)
    │   ├── scenery/ (paddies, river, forest, haze, hamlets, landscape, frontage, planted, oikawa, plan)
    │   └── data/ (yoshimi.json, *.bin, paddy-plan.json, planted-trees.json)
    ├── fish/      (fish.js, models.js, species.js, octopus.js, lobster.js, turtle.js, thumbs.js)
    ├── hamaguri/  gazami/  kusafugu/  unagi/   (each: species.js + game logic)
```

---

## 4. Key Techniques to Reproduce

1. **Build every asset in code.** Combine `BoxGeometry`, `CylinderGeometry`, `LatheGeometry` and similar shapes, then merge them (`BufferGeometryUtils.mergeGeometries`) to keep draw calls low. `mesher.js` / `kit.js` are the reusable toolkit.
2. **Use real-world map data.** Export an area from OpenStreetMap (roads, buildings, water), convert it to compact JSON/binary offline, and extrude building footprints in the game.
3. **Heightmap terrain.** Load binary height data into a `PlaneGeometry`, then cut out riverbeds (`carveWater`).
4. **Instancing for scale.** Use `InstancedMesh` for grass, trees, rice plants and fences, and add wind sway in the vertex shader.
5. **Diorama look.** GTAO + tilt-shift + warm fog + soft shadows that follow the player (`followShadow`).
6. **Stylized water.** Animated scrolling normals and caustics in a patched material; underwater, add fog and god-rays.
7. **One scene per mini-game.** The hub sends you to a game with `travel.js` / `stagePick.js`, and each game returns its results (catch, money) to `progress.js`.
8. **Data-driven catches.** `species.js` tables list name, size range, rarity, price and behavior, so you can add content without changing code.

---

## 5. Mini-game Design Template (from the spearfishing game)

```
SEARCH → AIM → HIT → STRUGGLE (tap rapidly to fill the meter) → CATCH popup → reward
```
- Fish AI: wander/flee steering behaviors plus species speed.
- Tension meter: a bar that drains over time, and each tap adds to it.
- Popups: big species name + comment ("Huge! It's getting away!").
- Show depth, time and money in the HUD.

Reuse this template for the other 4 games by changing the input (dig, net, rod, trap).

---

## 6. Build Plan to Clone (AI-assisted, ~2–5 days)

| Day | Goal |
|---|---|
| 1 | `index.html` + importmap, render loop, camera controls, terrain from a heightmap, sky, fog, post-FX |
| 2 | Town: roads and buildings from OSM, trees/grass instancing, water, player + NPC dialogue |
| 3 | Mini-game #1 (fishing) fully working, plus the species table and save system |
| 4 | Mini-games #2–5 using the same template |
| 5 | Quests/story, audio (Web Audio), polish, deploy to GitHub Pages |

### Starter `index.html`
```html
<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
<link rel="stylesheet" href="src/town/town.css">
</head><body><div id="hud"></div>
<script type="module" src="src/town/main.js"></script></body></html>
```

### Tips for working with the AI
- Keep each file small and focused on one feature, so the AI edits one module at a time.
- Put everything you want to tune (colors, sizes, species) in data files.
- Ask for "procedural low-poly X in Three.js, merged geometry, one material" instead of trying to import models.
- Test in the browser after every step, and paste console errors back to the AI.

---

## 7. How the Realistic Map Is Made (checked by opening the map files)

The map is a **real place**. `yoshimi.json` gives the map's origin as `lat 34.0694, lon 130.8981`, which is **Yoshimi, Shimonoseki (Yamaguchi)**, a seaside town on the JR San'in Line. It is not Saitama, as I said earlier.

**Step 1: elevation (heightmaps).**

| File | Grid | Spacing | Covers |
|---|---|---|---|
| `yoshimi-core.bin` (405,002 bytes) | 481 × 421 | 2.5 m | Detailed town area, about 1.2 × 1.05 km |
| `yoshimi-outer.bin` | 321 × 321 | 12.5 m | Surrounding hills, about 4 × 4 km |

- The core file is exactly 481 × 421 × 2 bytes, so each grid point stores one 16-bit height value.
- The source is **国土地理院 (GSI, Japan's Geospatial Information Authority)** elevation data, as confirmed by the credits screen (標高: 国土地理院).
- The heights are exaggerated slightly (`hscale: 0.6` combined with `scale: 0.5`) so the hills read well on screen.
- Using two layers keeps it fast: a dense mesh where you walk and a coarse mesh for the distant hills.

**Step 2: vector data from OpenStreetMap, converted to local meters.**

| Key | Count | Used for |
|---|---|---|
| `buildings` | 623 | Footprint polygon plus `lv` (number of floors) and a name. Extruded into houses (for example "吉見支所", the town hall) |
| `roads` | 464 | Road type (trunk, residential, track, path and so on) sets the road width and material |
| `areas` | 45 | Land-use areas (wood, farm, beach, park, school, cemetery, industrial) decide which ground texture and props go there |
| `streams`, `water`, `coast` | 13 / 9 / 10 | Rivers, ponds and the shoreline. `carveWater` lowers the terrain along them |
| `rails`, `platforms` | 12 / 2 | The railway line and the station |
| `breakwaters` | 5 | Harbor walls |

**Step 3: hand-made detail in code.** Rice paddies (`paddy-plan.json`), planted trees, fences, poles, NPCs and the stylized shaders are layered on top of the real data. So it is real geography plus a hand-made art style.

### How to do the same for any place

1. Pick a center latitude and longitude.
2. Download OSM data for about a 1–2 km box, either from the Overpass API or by exporting it from openstreetmap.org.
3. Download elevation: GSI DEM tiles for Japan, or SRTM, Copernicus DEM or Mapzen Terrarium tiles for anywhere else.
4. Write an **offline Python or Node script** that:
   - converts each latitude/longitude point to local meters: `x = (lon - lon0) * 111320 * cos(lat0)` and `z = (lat - lat0) * 110540`
   - simplifies the shapes and keeps only the tags you need, then writes one compact JSON file
   - resamples the elevation onto a regular grid and saves it as Int16 values in a `.bin` file
5. In the game:
   - load the `.bin` into a `PlaneGeometry` and use it as the terrain height
   - turn the building shapes into `ExtrudeGeometry` with height = floors × 3 m
   - draw roads as strips that follow the ground
   - scatter trees and grass inside the matching land-use areas

Credit OpenStreetMap as required: "© OpenStreetMap contributors" (ODbL license).

## 8. Credits Screen (confirmed sources)

| Category | Source | Used for |
|---|---|---|
| Sound | 効果音ラボ soundeffect-lab.info | Cicadas, frogs, birds, waves, waterway, wind chime (風鈴), footsteps, notification sounds |
| Sound | Freesound.org (CC0) | Wind ambience (cribbler, felix.blume) |
| Map data | © OpenStreetMap contributors | Roads, buildings, land use, coast |
| Elevation | 国土地理院 (GSI Japan) | Terrain heights |

The game stays free to use because every asset is CC0 or freely licensed, and it credits each source on a credits screen and in a small line at the bottom of the screen.

### Equivalents for a Thailand (Bang Saen) version
| Need | Free source |
|---|---|
| Elevation | GSI covers Japan only. Use Copernicus DEM GLO-30, SRTM, or Mapzen Terrarium tiles (what `bangsaen-map.html` uses) |
| Map data | OpenStreetMap (same as the game) |
| Beach, sea and market sounds | Freesound.org (filter by CC0 license), Pixabay Sound Effects |
| Credits | Add a credits screen like the game's, listing every source |

## 9. Unverified Assumptions
- None remain for the data sources. The code structure is reconstructed from file names.
- That saving uses localStorage.
