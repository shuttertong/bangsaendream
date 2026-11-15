// แรมป์สเก็ต — tunables for the half-pipe trick game on the skating rink.
export const RAMP = {
  time: 60,                                        // seconds a run lasts
  pipe: { flat: 4, r: 2.6, width: 6, deck: 1.3, base: 0.45 },   // flat bottom (m), transition radius (= height of the lip), width, standing deck each side
  ride: 1.45,                                      // seconds lip to lip
  g: 9.8,
  air: { start: 0.35, min: 0.25, max: 3.2, loss: 0.12 },   // height of the jump above the lip (m): the first, the least, the most; lost each pass without a pump
  pump: { zone: 0.3, perfect: 0.1, good: 0.55, ok: 0.28 },   // press jump on the flat: how far from the middle still counts (share of the half-crossing), what counts as perfect; height gained
  spin: 500, flip: 400,                            // degrees per second while the stick is held sideways / up
  land: { spin: 42, flip: 55 },                    // how far off a clean half-turn / full flip may still be landed (degrees)
  crash: { keep: 0.4, stun: 1.0 },                 // share of the air height kept after a fall; seconds shaken
  points: { spin: [0, 40, 110, 200, 320, 460, 620], flip: 150, grab: 110, height: 12 },   // by half-turns; per flip; per second of grab; per metre of air
  combo: { step: 0.25, max: 3 },                   // each clean landing in a row adds 25 % (up to ×3)
  cam: { dist: [6.2, 9.5], height: 2.0, look: 1.5, rise: 0.6, follow: 0.75, aim: 1.1 },   // side camera: metres off (wide / tall screen), its height and aim height, how much it rises with the kid, how far it follows across the pipe
  pay: { per: 0.0125, trick: 3, cap: 240 },        // ฿ per point, per trick landed, and the most a run pays
};
