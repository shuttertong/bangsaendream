// Tunables for โซฟาโบ๊ท (sofa-boat bounce timing).
export const ROUND = {
  time: 120,
  gap: [0.9, 1.9],            // seconds on the water between wake jumps
  height: [0.7, 1.7],         // jump height: small at the start → big at the end (m)
  gravity: 9.8,
  perfect: 0.12, good: 0.26,  // timing windows around the landing (s)
  points: { perfect: 20, good: 10 },
  combo: 0.1,                 // extra multiplier per landing in a row…
  maxMult: 3,                 // …up to this
  bahtPer: 20,
};
