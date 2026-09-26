// Tunables for ข้าวหลามยาย (help Grandma crack the burnt bamboo off khao lam by pounding it
// with a hammer, กะเทาะ = ทุบ, and sell it).
// Data only.

/** Kinds of khao lam on Grandma's stall. `rice` is the colour you see at the open end. */
export const KINDS = [
  { id: 'plain', icon: '⚪', name: { th: 'ข้าวหลามธรรมดา', en: 'Plain khao lam' }, short: { th: 'ธรรมดา', en: 'Plain' }, rice: '#f1ead6', price: 30, weight: 40 },
  { id: 'bean', icon: '⚫', name: { th: 'ข้าวหลามถั่วดำ', en: 'Black bean khao lam' }, short: { th: 'ถั่วดำ', en: 'Black bean' }, rice: '#b89aa6', price: 35, weight: 35 },
  { id: 'taro', icon: '🟣', name: { th: 'ข้าวหลามเผือก', en: 'Taro khao lam' }, short: { th: 'เผือก', en: 'Taro' }, rice: '#c3aed6', price: 40, weight: 25 },
];

export const ROUND = {
  time: 120,
  strips: 6,                     // strips of charred skin around each tube
  meterSpeed: [0.85, 1.35],      // meter sweeps per second (start → end of the round)
  zone: [0.2, 0.13],             // width of the "just right" band (start → end)
  thick: [0.62, 0.8],            // centre of the band for thick (black) char
  thin: [0.4, 0.55],             // … and for thin (brown) char
  thickChance: 0.45,
  shallowDrop: 0.18,             // a too-light chop thins the char: the band moves down this much
  chop: 0.5,                     // seconds per go (three hammer blows along the strip)
  slots: 3,                      // customers at the counter
  arriveEvery: [4, 7],
  patience: [30, 21],            // seconds (start → end)
  qty: [1, 2],                   // tubes per order
  share: 0.3,                    // Grandma gives the kid this share of each sale
  crackPrice: [1, 0.7, 0.5, 0.3],  // price factor by cracked strips (0, 1, 2, 3+)
  tipPerfect: 3,                 // ฿ tip for a tube with no cracks and no second chops
  giftAfter: 3,                  // sell this many and Grandma gives you one to keep
};

/** Random order: one kind, 1–2 tubes. */
export function makeOrder(r) {
  const total = KINDS.reduce((s, k) => s + k.weight, 0);
  let x = r() * total, kind = KINDS[0];
  for (const k of KINDS) { x -= k.weight; if (x <= 0) { kind = k; break; } }
  return { kind, qty: ROUND.qty[0] + Math.floor(r() * (ROUND.qty[1] - ROUND.qty[0] + 1)), got: 0 };
}
