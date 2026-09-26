// Squid table for ตกหมึก (night jigging off Laem Thaen). Tunable data only.
//   depth: [min, max] metres where it swims      size: cm (mantle / arm span)
//   strength: how hard it pulls when hooked      bite: how keen it is on the jig (0..1)
//   speed: swim speed (m/s)                      kind: model shape
export const SPECIES = [
  {
    id: 'splendid', icon: '🦑', weight: 55, kind: 'squid',
    name: { th: 'หมึกกล้วย', en: 'Splendid squid' },
    depth: [1.5, 7], size: [12, 26], price: 12, strength: 0.5, bite: 0.85, speed: 1.6,
    color: '#f0d8d0', spots: '#c86a5a',
  },
  {
    id: 'bigfin', icon: '🦑', weight: 25, kind: 'squid', fins: 'wide',
    name: { th: 'หมึกหอม', en: 'Bigfin reef squid' },
    depth: [3.5, 10], size: [20, 36], price: 28, strength: 0.8, bite: 0.65, speed: 1.3,
    color: '#e8e0d8', spots: '#8a6a9a',
  },
  {
    id: 'cuttle', icon: '🦑', weight: 14, kind: 'cuttle',
    name: { th: 'หมึกกระดอง', en: 'Cuttlefish' },
    depth: [8, 14], size: [15, 30], price: 24, strength: 1.0, bite: 0.55, speed: 0.8,
    color: '#b8a088', spots: '#6a5040',
  },
  {
    id: 'octopus', icon: '🐙', weight: 6, kind: 'octopus',
    name: { th: 'หมึกสาย', en: 'Octopus' },
    depth: [12, 15.5], size: [25, 50], price: 50, strength: 1.3, bite: 0.45, speed: 0.6,
    color: '#c87a5a', spots: '#8a4a3a',
  },
];

export const ROUND = {
  time: 180,
  bottom: 16,              // sea floor depth (m)
  maxSquid: [6, 9],        // active squid at the start → end
  spawnEvery: [1.5, 3.5],  // seconds
  lureSpeed: 2.6,          // m/s up/down
  jigLift: 0.7,            // metres a jig jerks the lure up
  biteAfter: [0.4, 1.8],   // after a jig, squid strike during this pause window (s)
  attract: 6,              // metres: squid notice a jig this close
  keen: 4,                 // strike rate multiplier (× species bite) during the pause after a jig
  // reeling
  reelSpeed: 2.3,          // m/s toward the surface while holding
  drift: 0.2,              // m/s the squid drags the jig down when you ease off (× strength)
  surgeDrag: 0.25,         // metres a surge pulls it back down (× strength)
  tensionUp: 0.9, tensionDown: 0.7, surge: 0.42,   // per second / per pull
  surgeWarn: 0.4,          // seconds of warning (bar shakes, rod jitters) before a surge
  eased: 0.3,              // share of a surge's tension you take if you're not reeling
  looseTime: 1.3,          // seconds of slack before it lets go
  zone: [0.3, 0.82],       // the safe (green) tension band
};

export function pickSpecies(r) {
  const total = SPECIES.reduce((s, x) => s + x.weight, 0);
  let k = r() * total;
  for (const s of SPECIES) { k -= s.weight; if (k <= 0) return s; }
  return SPECIES[0];
}
export const rollSize = (s, r) => +(s.size[0] + (s.size[1] - s.size[0]) * ((r() + r()) / 2)).toFixed(1);
export function priceOf(s, size) {
  const mid = (s.size[0] + s.size[1]) / 2;
  return Math.max(1, Math.round(s.price * (size / mid) ** 1.4));
}
