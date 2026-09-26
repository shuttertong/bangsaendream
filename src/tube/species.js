// Data for ห่วงยาง: things floating in the waves off Bang Saen, hazards, and the round.
export const FINDS = [
  { id: 'shell', icon: '🐚', name: { th: 'เปลือกหอยสังข์', en: 'Conch shell' }, price: 4, weight: 34, kind: 'conch', color: '#f2d8c0' },
  { id: 'scallop', icon: '🐚', name: { th: 'เปลือกหอยพัด', en: 'Scallop shell' }, price: 3, weight: 30, kind: 'scallop', color: '#f0a888' },
  { id: 'starfish', icon: '⭐', name: { th: 'ปลาดาว', en: 'Starfish' }, price: 8, weight: 16, kind: 'star', color: '#f08a4a' },
  { id: 'seaglass', icon: '💎', name: { th: 'แก้วทะเล', en: 'Sea glass' }, price: 10, weight: 12, kind: 'glass', color: '#8fd8b8' },
  { id: 'bottle', icon: '🍾', name: { th: 'ขวดจดหมาย', en: 'Message in a bottle' }, price: 30, weight: 4, kind: 'bottle', color: '#6aa87a' },
  { id: 'pearl', icon: '🦪', name: { th: 'หอยมุก', en: 'Pearl oyster' }, price: 45, weight: 2, kind: 'oyster', color: '#c8c0b8' },
];

export const ROUND = {
  time: 150,
  area: { x: 26, z0: -38, z1: -2 },   // swim area inside the buoy line (shore at z = 0)
  finds: 16,                           // floating at once
  jellies: 7,
  // waves (shared by the water shader and the physics): travel toward the shore (+z)
  waves: [
    { amp: 0.42, len: 11, speed: 3.2, dir: [0.12, 1] },
    { amp: 0.22, len: 6.5, speed: 2.4, dir: [-0.3, 1] },
    { amp: 0.1, len: 3.2, speed: 1.8, dir: [0.6, 0.8] },
  ],
  tube: { paddle: 2.2, burst: 4.2, burstCost: 0.34, regen: 0.22, drag: 0.9, slope: 6, current: 0.12, radius: 0.8 },
  sting: 1.4,                         // seconds stunned
  surfSpeed: 2.6,                     // shoreward speed on a crest that counts as surfing
};

export function pickFind(r) {
  const total = FINDS.reduce((s, x) => s + x.weight, 0);
  let k = r() * total;
  for (const f of FINDS) { k -= f.weight; if (k <= 0) return f; }
  return FINDS[0];
}

/** Wave height and slope at (x, z, t) — the same sum the water shader draws. */
export function waveAt(x, z, t) {
  let h = 0, gx = 0, gz = 0;
  for (const w of ROUND.waves) {
    const l = Math.hypot(w.dir[0], w.dir[1]), dx = w.dir[0] / l, dz = w.dir[1] / l;
    const k = (Math.PI * 2) / w.len, ph = (x * dx + z * dz) * k - t * w.speed * k;
    h += w.amp * Math.sin(ph);
    const c = w.amp * k * Math.cos(ph);
    gx += c * dx; gz += c * dz;
  }
  return { h, gx, gz };
}
