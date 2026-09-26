// Menu and rules for ร้านส้มตำ (Aunt Nuan's som tam cart). Data only.
//   base: 'papaya' | 'corn'   crab: has salted crab   chilli: [min, max] chillies asked for
export const DISHES = [
  { id: 'thai', icon: '🥗', name: { th: 'ส้มตำไทย', en: 'Som tam Thai' }, base: 'papaya', crab: false, chilli: [0, 3], price: 40, weight: 45 },
  { id: 'poo', icon: '🦀', name: { th: 'ส้มตำปู', en: 'Som tam with crab' }, base: 'papaya', crab: true, chilli: [1, 4], price: 50, weight: 30 },
  { id: 'corn', icon: '🌽', name: { th: 'ตำข้าวโพด', en: 'Corn salad' }, base: 'corn', crab: false, chilli: [0, 2], price: 45, weight: 25 },
];
export const SIDES = [
  { id: 'chicken', icon: '🍗', name: { th: 'ไก่ย่าง', en: 'Grilled chicken' }, price: 60, chance: 0.35 },
  { id: 'rice', icon: '🍚', name: { th: 'ข้าวเหนียว', en: 'Sticky rice' }, price: 10, chance: 0.5 },
];

export const ROUND = {
  time: 150,
  slots: 3,                     // customers at the counter at once
  arriveEvery: [3, 6],          // seconds between new customers
  patience: [28, 20],           // seconds a customer waits (start of round → end)
  pounds: 3,                    // pestle hits per dish
  zone: [0.38, 0.62],           // timing window on the pound meter (0..1)
  meterSpeed: 1.6,              // sweeps per second
  share: 0.08,                  // the kid's share of each sale (it's Aunt Nuan's stall)
  tipGood: 1,                   // baht per well-timed pound
  tipFast: 2,                   // bonus if served with over half the patience left
  wrongPay: 0.3,                // a wrong order still pays this much of the usual share
};

/** Random order: a dish, a chilli count and maybe sides. */
export function makeOrder(r) {
  const total = DISHES.reduce((s, d) => s + d.weight, 0);
  let k = r() * total, dish = DISHES[0];
  for (const d of DISHES) { k -= d.weight; if (k <= 0) { dish = d; break; } }
  const chilli = dish.chilli[0] + Math.floor(r() * (dish.chilli[1] - dish.chilli[0] + 1));
  const sides = SIDES.filter(s => r() < s.chance).map(s => s.id);
  const price = dish.price + sides.reduce((a, id) => a + SIDES.find(s => s.id === id).price, 0);
  return { dish, chilli, sides, price };
}

/** Does the plate match the order? */
export function matches(order, plate) {
  return plate.base === order.dish.base && plate.crab === order.dish.crab && plate.chilli === order.chilli
    && plate.pounded >= ROUND.pounds
    && SIDES.every(s => plate.sides.includes(s.id) === order.sides.includes(s.id));
}
