// บางแสนโกคาร์ทกรังด์ปรีซ์ — tunables for the kart race round Khao Sam Muk.
export const GP = {
  laps: 1, grid: 6,                         // one lap of the 4.1 km loop is about three minutes; karts on the grid (bots fill the empty places)
  track: { step: 2, smooth: 3, half: 2.7, minHalf: 2.1, maxHalf: 6.5, margin: 0.5 },   // metres between centreline samples, corner-rounding passes; half-width the karts may use (default; in the town it is the real road's, between min and max, less a margin)
  kart: {
    top: 26, accel: 9, brake: 18, drag: 0.1,     // m/s, m/s², m/s², per second
    turn: 1.9, grip: 18,                            // steering: most yaw (rad/s), and the sideways grip that caps it at speed (m/s²)
    scrub: 0.06,                                    // speed lost to hard cornering
    radius: 0.75, wall: 0.55, shove: 0.5,           // kart-to-kart radius; speed kept after a wall; share of overlap pushed out per step
  },
  bot: {
    skill: [0.84, 0.97],                            // share of the cornering limit and top speed a bot uses (slowest → fastest)
    look: [6, 0.45], steer: 3, lane: 1.1,         // look-ahead (m + s × speed), steering gain, how far off the centreline they run
    corner: 36, band: [60, 0.06],                   // metres of road ahead they brake for; rubber band: beyond this gap to the player, ± this share of speed
  },
  start: { back: 9, row: 6, side: 1.25, count: 3 }, // grid behind the line (m), row spacing, lateral offset, countdown seconds
  grace: 25,                                        // seconds the others get after the winner (multiplayer) or the player (solo) finishes
  pay: [220, 170, 130, 100, 80, 60], clean: 20, maxHits: 2,   // ฿ by finishing place; bonus for at most `maxHits` wall hits
  net: { hz: 8, blend: 6 },                         // snapshots a second; how fast a remote kart eases to its reported place
  cam: { back: 5.6, up: 2.5, ahead: 5, fov: [62, 74], ease: 5 },
  walk: [{ x: -745, z: -2444, r: 16 }],            // where the loop leaves the walkable strip for a few metres: made walkable, so no roadblock stands on the track
  colors: ['#d8392f', '#2f6fc4', '#f2c230', '#3a9a6a', '#9a5a8a', '#f08a3a'],
};
