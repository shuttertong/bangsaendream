// Data for ลิงเขาสามมุข: the monkeys, the snacks on the picnic mat, and the waves.
//   speed (m/s), hp (dashes to shoo), grab (seconds to snatch a snack), size (scale),
//   sneaky: circles to the side away from the kid before going for the mat
export const MONKEYS = [
  { id: 'macaque', name: { th: 'ลิงแสม', en: 'Macaque' }, speed: 2.5, hp: 1, grab: 1.2, size: 1, fur: '#8a7458', face: '#e0a898', weight: 60 },
  { id: 'baby', name: { th: 'ลิงเด็ก', en: 'Baby monkey' }, speed: 3.3, hp: 1, grab: 0.9, size: 0.65, fur: '#9a8466', face: '#f0b8a8', weight: 20 },
  { id: 'sneaky', name: { th: 'ลิงจอมแอบ', en: 'Sneaky monkey' }, speed: 2.7, hp: 1, grab: 1.1, size: 0.9, fur: '#7a6650', face: '#d89888', weight: 15, sneaky: true },
  { id: 'alpha', name: { th: 'ลิงจ่าฝูง', en: 'Alpha male' }, speed: 2.1, hp: 2, grab: 1.5, size: 1.35, fur: '#6a5a44', face: '#c88878', weight: 8 },
];

// snacks start on the mat; each one still there at the end pays its price
export const SNACKS = [
  { id: 'banana', icon: '🍌', name: { th: 'กล้วย', en: 'Bananas' }, price: 10, color: '#f2cf4a', count: 3 },
  { id: 'chips', icon: '🥔', name: { th: 'ขนมถุง', en: 'Crisps' }, price: 12, color: '#d8443a', count: 2 },
  { id: 'mango', icon: '🥭', name: { th: 'มะม่วง', en: 'Mango' }, price: 14, color: '#f0a030', count: 2 },
  { id: 'soda', icon: '🥤', name: { th: 'น้ำหวาน', en: 'Sweet drink' }, price: 8, color: '#e8587a', count: 1 },
];

export const ROUND = {
  waves: [
    { count: 3, every: 2.2 },
    { count: 4, every: 1.8 },
    { count: 6, every: 1.5 },
    { count: 8, every: 1.25 },
    { count: 10, every: 1.0 },
    { count: 13, every: 0.85 },
  ],
  breakTime: 5,          // seconds between waves
  arena: 11,             // metres radius of the plaza
  mat: 1.3,              // picnic mat half size
  shooBonus: 1,          // baht per monkey shooed
  carrySlow: 0.75,       // monkeys carrying a snack run this much slower
  fright: 2,             // a dash also scares smaller monkeys within this many metres
  kid: { walk: 4.2, dash: 10, dashTime: 0.2, cool: 0.35, reach: 1.25 },
};

export function pickMonkey(r, wave) {
  // stronger / sneakier monkeys show up in later waves
  const pool = MONKEYS.filter(m => wave >= 1 || (m.id !== 'alpha' && m.id !== 'sneaky'));
  const total = pool.reduce((s, m) => s + m.weight, 0);
  let k = r() * total;
  for (const m of pool) { k -= m.weight; if (k <= 0) return m; }
  return pool[0];
}
