// Crab table for จับปูลม. Tunable data only: names (TH/EN), size range (cm across the
// shell), rarity weight, price (฿ at average size), and behaviour.
//   speed: flee speed (m/s)   wander: wander speed   scare: flees when the kid is this close (m)
//   dazzle: seconds frozen once lit by the flashlight   grip: chance a dash catches it while fleeing
//   holes: false → never dives into a hole (hermit crabs just keep walking)
export const SPECIES = [
  {
    id: 'ghost', icon: '🦀', weight: 60,
    name: { th: 'ปูลม', en: 'Ghost crab' },
    size: [3, 6], price: 12,
    speed: 4.2, wander: 0.7, scare: 3.4, dazzle: 1.6, grip: 0.75,
    body: '#e8dcc0', legs: '#d9c9a4', eyes: '#2a2420', stalks: 1,
  },
  {
    id: 'bigGhost', icon: '🦀', weight: 18,
    name: { th: 'ปูลมยักษ์', en: 'Big ghost crab' },
    size: [6, 9], price: 30,
    speed: 3.6, wander: 0.6, scare: 4.2, dazzle: 1.2, grip: 0.6,
    body: '#e4d2ae', legs: '#cdb88f', eyes: '#2a2420', stalks: 1.2,
  },
  {
    id: 'hermit', icon: '🐚', weight: 16, holes: false,
    name: { th: 'ปูเสฉวน', en: 'Hermit crab' },
    size: [2, 4], price: 6,
    speed: 0.9, wander: 0.35, scare: 1.8, dazzle: 2.5, grip: 1,
    body: '#b86a4a', legs: '#c98a5a', eyes: '#2a2420', shell: '#d8c7a8',
  },
  {
    id: 'golden', icon: '✨', weight: 6,
    name: { th: 'ปูลมทอง', en: 'Golden ghost crab' },
    size: [4, 7], price: 80,
    speed: 5.4, wander: 1.0, scare: 5.0, dazzle: 0.9, grip: 0.45,
    body: '#f0c450', legs: '#e0a830', eyes: '#2a2420', stalks: 1.1,
  },
];

// Round rules
export const ROUND = {
  time: 180,               // seconds of dusk → night
  maxCrabs: [6, 11],       // active crabs at the start → at the end (darker = more crabs)
  holes: 14,
  emergeEvery: [1.2, 3.0], // seconds between a hole releasing a crab
  bigComment: 0.8,         // size fraction of the range that counts as "big!"
};

/** Pick a species by rarity weight. */
export function pickSpecies(r) {
  const total = SPECIES.reduce((s, x) => s + x.weight, 0);
  let k = r() * total;
  for (const s of SPECIES) { k -= s.weight; if (k <= 0) return s; }
  return SPECIES[0];
}

/** Random size in the species' range, biased toward the middle. */
export const rollSize = (s, r) => +(s.size[0] + (s.size[1] - s.size[0]) * ((r() + r()) / 2)).toFixed(1);

/** Price for a catch: bigger crabs are worth more than linearly. */
export function priceOf(s, size) {
  const mid = (s.size[0] + s.size[1]) / 2;
  return Math.max(1, Math.round(s.price * (size / mid) ** 1.5));
}
