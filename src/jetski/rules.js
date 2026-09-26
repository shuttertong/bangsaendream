// Tunables for เจ็ทสกี (buoy slalom). Yaw 0 = +z; positive yaw turns toward +x, which is
// screen-LEFT for the chase camera, so steering right lowers the yaw.
export const RIDE = {
  time: 100,
  cruise: 9, top: 17, boostTop: 24,   // m/s: no throttle, full throttle, boosting
  accel: 6, brake: 9, boostAccel: 14,
  turn: 1.7,                          // rad/s at full lock (a little less at top speed)
  grip: 2.6,                          // how quickly the velocity swings round to the heading (lower = more drift)
  boost: { time: 1.5, refill: 0.34 }, // seconds of turbo; charge refilled per clean gate
  radius: 0.9,                        // hit circle around the ski
  crash: { speed: 6, recover: 2.2 },  // hit something head-on faster than this (m/s) and you fly off
  air: 0.65,                          // seconds in the air before it counts as a jump (only the big ones)
};

export const COURSE = {
  spacing: [38, 55],                  // metres between gates
  width: 8,                           // gap between the two buoys
  swing: 0.55,                        // max heading change from one gate to the next (rad)
  drift: 160,                         // |x| beyond this the course bends back (keep off the coast)
  ahead: 8,                           // gates laid out ahead of the next one
  obstacle: 0.55,                     // chance of floats or a moored boat between two gates
  trash: [1, 3],                      // floating bottles between two gates
};

export const SCORE = {
  gate: 20, combo: 0.15, maxMult: 3,  // per gate; +15% per gate in a row, up to ×3
  trash: 15,                          // per bottle picked up (keep the sea clean!)
  air: 25,                            // per jump
  bahtPer: 12,
};
