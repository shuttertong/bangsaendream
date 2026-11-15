// โรงเรียนสอนสเก็ต — tunables for the skating lessons on the rink's oval.
export const SK = {
  laps: 4, lane: 2.1,                         // laps of the oval per lesson; half-width the skater may use
  steer: 3.4, steerEase: 9, accel: 2.2, brake: 0.5,   // sideways speed (m/s) and how fast it answers; pick-up (m/s²); share of speed while braking
  jump: 4.3, gravity: 12.5,                   // take-off speed and gravity (about 0.7 s in the air, 0.74 m high)
  pad: 0.85, cone: 0.34, clear: 0.26,         // how near a pad's middle counts; how near a cone is a hit; height that clears a bar
  stumble: { time: 0.8, keep: 0.4 },          // seconds of wobble after a hit, share of speed kept
  combo: { step: 0.1, max: 10 },              // each clean pass in a row adds 10 % (up to +100 %)
  points: { pass: 10, star: 6 },
  pass: 0.6,                                  // share of the pads needed to pass a lesson
  pay: { per: 0.3, cap: 240, passed: 30 },    // ฿ per point, the most a lesson pays, bonus for passing
  // lessons: speed (m/s), metres between tasks, what is laid out — gate (two cones to pass between), cone (weave: pass on the pad's side), bar (jump), star
  lessons: [
    { id: 'balance', speed: 5.0, gap: 9, mix: { gate: 1 }, swing: 1.1, stars: 0.3 },
    { id: 'slalom', speed: 5.8, gap: 6.2, mix: { cone: 1 }, swing: 1.35, stars: 0.25 },
    { id: 'jump', speed: 6.4, gap: 7.5, mix: { bar: 0.42, cone: 0.33, gate: 0.25 }, swing: 1.3, stars: 0.4 },
  ],
};
