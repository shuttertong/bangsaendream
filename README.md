# ปิดเทอมที่บางแสน · Summer Break at Bang Saen

A small 3D browser game set on a real map of Bang Saen Beach, Chonburi, Thailand.
You spend a school break at Grandma's house, meet the people along the beach, and try
five mini-games from local life. Thai first, English too.

**Play online:** https://shuttertong.github.io/bangsaendream/ (online multiplayer via Supabase Realtime). Or open `index.html`
from any static web server (see below). Works on desktop, phones and iPad (touch joystick).
Local Wi-Fi multiplayer needs `python3 tools/serve.py 8000`.

## The five mini-games
| | | |
|---|---|---|
| 🦀 จับปูลม | Ghost-crab catching at dusk | flashlight + dash |
| 🦑 ตกหมึก | Night squid jigging from a boat | lure depth + tension reeling |
| 🐒 ลิงเขาสามมุข | Guard snacks from the Khao Sam Muk monkeys | waves, shoo with a dash |
| 🛟 ห่วงยาง | Inner-tube shell collecting | wave physics, stamina |
| 🥗 ร้านส้มตำ | Aunt Nuan's som tam stall rush | order building + rhythm pounding |

## Controls
- **Desktop:** WASD / arrows move, Shift runs, Space jumps (or acts in a mini-game), drag or Q/E turns the camera, wheel zooms, F talks, M travel, B bag
- **Touch:** left thumb = joystick (push to the rim to run), drag on the right = camera, pinch = zoom, round button = jump / action, tap the "talk" button

## Run locally
```bash
python3 tools/serve.py 8000     # then open http://localhost:8000
```
Useful URL flags: `?debug=1` (stats, `__game` in the console), `?view=beach|town|air`
(fixed camera shots), `?reset=1` (new game), `?notitle=1` (skip the title card).

## How it's made
Vanilla JavaScript + three.js r170 (no build step). Everything is procedural: the town,
trees, people, crabs, squid and monkeys are built in code, and all sound is synthesised
with the Web Audio API. The map is baked offline from OpenStreetMap and Mapzen Terrarium
elevation by `tools/bake_map.py`. Developer notes are in `CLAUDE.md`.

## Credits
Map data © OpenStreetMap contributors (ODbL). Elevation: Mapzen Terrarium (AWS Open Data).
Fonts: Kanit and Sarabun (SIL OFL). three.js (MIT). See `CREDITS.md`.
All characters and shops are fictional.

## Licence
Source code: MIT (see `LICENSE`). The baked map data in `src/town/data/` is derived from
OpenStreetMap and stays under the ODbL 1.0, © OpenStreetMap contributors.
