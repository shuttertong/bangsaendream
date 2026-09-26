// Tunables for บานาน่าโบ๊ท (banana-boat balance). Roll is in radians, positive = toward
// the tow's local +x (screen-left from the chase camera).
export const ROUND = {
  time: 120,
  hearts: 3,               // capsizes allowed
  capsize: 0.95,           // |roll| that tips everyone in
  lean: 3.2,               // roll accel from leaning (full stick)
  sway: 0.36,              // roll accel per m/s² of sideways pull on the turns
  wave: 1.0,               // roll accel from the swell slope
  spring: 1.0, damping: 1.3,
  tipping: 2.2,            // past `tipAt` the banana wants to keep rolling (unstable)
  tipAt: 0.3,
  recover: 2.8,            // seconds to climb back on
  points: { upright: 10, hook: 60, wild: 25 },   // per second upright; surviving a hook turn; riding a big tilt out
  bahtPer: 20,             // points per baht
};
