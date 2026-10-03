// ตู้เสื้อผ้าแฟนตาซี — the fantasy wardrobe: things kids buy with the baht they earned (never real
// money) and wear in the hub, every mini-game and online. Data only; geometry is in
// town/people/fantasy.js, the aura effect in town/aura.js, the shop panel in town/wardrobe.js.
// Items travel online as 1-based indices into this list per slot (0 = nothing), so no free text.
export const SLOTS = ['hat', 'wings', 'back', 'hand', 'tail', 'aura'];
export const SLOT_NAME = {
  hat: { th: 'หัว', en: 'Head' }, wings: { th: 'ปีก', en: 'Wings' }, back: { th: 'หลัง', en: 'Back' },
  hand: { th: 'ของในมือ', en: 'In hand' }, tail: { th: 'หาง', en: 'Tail' }, aura: { th: 'ออร่า', en: 'Aura' },
};
export const RARITY = {
  common: { th: 'ธรรมดา', en: 'Common', color: '#8a9a6a' }, rare: { th: 'หายาก', en: 'Rare', color: '#2f6fc4' },
  epic: { th: 'สุดพิเศษ', en: 'Epic', color: '#9a5a8a' }, legendary: { th: 'ตำนาน', en: 'Legendary', color: '#d8a020' },
};
export const DAILY = { gift: 30, featured: 3, discount: 0.2 };    // baht gift per day; featured items per day at 20 % off

const I = (id, slot, icon, th, en, price, rarity, c = []) => ({ id, slot, icon, name: { th, en }, price, rarity, c });
export const WARDROBE = [
  // head
  I('wizard', 'hat', '🧙', 'หมวกพ่อมด', 'Wizard hat', 120, 'common', ['#4a3f9a', '#f4d03c']),
  I('flowers', 'hat', '🌸', 'มงกุฎดอกไม้', 'Flower crown', 90, 'common', ['#5a9a4a', '#f4a0c0', '#fff4d0', '#f4d03c']),
  I('bunny', 'hat', '🐰', 'หูกระต่าย', 'Bunny ears', 80, 'common', ['#f4f1e8', '#f4a0c0']),
  I('cat', 'hat', '🐱', 'หูแมว', 'Cat ears', 80, 'common', ['#3a3230', '#f4a0c0']),
  I('pirate', 'hat', '🏴‍☠️', 'หมวกโจรสลัด', 'Pirate hat', 150, 'common', ['#2a2522', '#f4f1e8', '#d8a020']),
  I('dino', 'hat', '🦖', 'ฮู้ดไดโนเสาร์', 'Dino hood', 200, 'rare', ['#5fae5a', '#f4d03c', '#ffffff']),
  I('tiara', 'hat', '👸', 'มงกุฎเจ้าหญิง', 'Princess tiara', 250, 'rare', ['#e8e8f0', '#7fc4e8', '#f4a0c0']),
  I('halo', 'hat', '😇', 'วงแหวนนางฟ้า', 'Halo', 300, 'rare', ['#f4d03c']),
  I('crown', 'hat', '👑', 'มงกุฎทองคำ', 'Golden crown', 800, 'epic', ['#f0c23a', '#e2453a', '#2f6fc4']),
  // wings
  I('fairy', 'wings', '🧚', 'ปีกนางฟ้า', 'Fairy wings', 200, 'rare', ['#9fe3e8', '#e8fbfc']),
  I('butterfly', 'wings', '🦋', 'ปีกผีเสื้อ', 'Butterfly wings', 220, 'rare', ['#f08a3a', '#2a2522', '#f4d03c']),
  I('bat', 'wings', '🦇', 'ปีกค้างคาว', 'Bat wings', 180, 'common', ['#4a3560', '#2a2030']),
  I('angel', 'wings', '🕊️', 'ปีกเทวดา', 'Angel wings', 600, 'epic', ['#fbf8f2', '#e8e4da']),
  I('dragon', 'wings', '🐉', 'ปีกมังกร', 'Dragon wings', 1200, 'legendary', ['#c8322a', '#6a1a14', '#f4d03c']),
  // back
  I('backpack', 'back', '🎒', 'เป้นักเรียน', 'School backpack', 60, 'common', ['#e2453a', '#2a2522']),
  I('shell', 'back', '🐢', 'กระดองเต่า', 'Turtle shell', 120, 'common', ['#4a8a4a', '#2f6a3a']),
  I('cape', 'back', '🦸', 'ผ้าคลุมฮีโร่', 'Hero cape', 150, 'common', ['#e2453a']),
  I('rainbow', 'back', '🌈', 'ผ้าคลุมสายรุ้ง', 'Rainbow cape', 400, 'epic', ['#e2453a', '#f08a3a', '#f4d03c', '#5fb85a', '#4f9ad8', '#9a6ad0']),
  I('rocket', 'back', '🚀', 'เจ็ตแพ็ก', 'Jet pack', 500, 'epic', ['#c9cdd0', '#e2453a', '#f08a3a']),
  // in hand
  I('icecream', 'hand', '🍦', 'ไอศกรีม', 'Ice cream', 40, 'common', ['#e8c89a', '#f4a0c0', '#fff4d0']),
  I('balloon', 'hand', '🎈', 'ลูกโป่ง', 'Balloon', 60, 'common', ['#e2453a']),
  I('umbrella', 'hand', '🌂', 'ร่มลายดอก', 'Flower umbrella', 70, 'common', ['#f4a0c0', '#f4f1e8']),
  I('wand', 'hand', '🪄', 'ไม้กายสิทธิ์', 'Magic wand', 150, 'common', ['#f4f1e8', '#f4d03c']),
  I('shield', 'hand', '🛡️', 'โล่อัศวิน', 'Knight shield', 160, 'common', ['#2f6fc4', '#f4d03c']),
  I('sword', 'hand', '⚔️', 'ดาบของเล่น', 'Toy sword', 180, 'rare', ['#c9cdd0', '#8a5a3a', '#f4d03c']),
  I('staff', 'hand', '🔮', 'คทาเวทมนตร์', 'Magic staff', 900, 'epic', ['#5a3a26', '#7fe0ff']),
  // tails
  I('cattail', 'tail', '🐈', 'หางแมว', 'Cat tail', 120, 'common', ['#3a3230']),
  I('dinotail', 'tail', '🦕', 'หางไดโนเสาร์', 'Dino tail', 150, 'common', ['#5fae5a', '#f4d03c']),
  I('foxtail', 'tail', '🦊', 'หางจิ้งจอก', 'Fox tail', 200, 'rare', ['#f08a3a', '#fff4d0']),
  I('dragontail', 'tail', '🐲', 'หางมังกร', 'Dragon tail', 400, 'epic', ['#c8322a', '#f4d03c']),
  // auras (town/aura.js)
  I('bubbles', 'aura', '🫧', 'ฟองสบู่', 'Bubbles', 200, 'common', ['#bfe6f4']),
  I('hearts', 'aura', '💗', 'หัวใจลอย', 'Floating hearts', 250, 'rare', ['#f06a9a']),
  I('sparkle', 'aura', '✨', 'ประกายดาว', 'Sparkles', 250, 'rare', ['#fff4c4']),
  I('legend', 'aura', '🌟', 'ออร่าตำนาน', 'Legendary aura', 1500, 'legendary', ['#ffd24a']),
];
export const byId = Object.fromEntries(WARDROBE.map(w => [w.id, w]));
export const bySlot = slot => WARDROBE.filter(w => w.slot === slot);

/** Today's featured items (deterministic from the date, so every player sees the same shop). */
export function featuredToday(date = new Date()) {
  const key = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
  let s = key * 2654435761 % 4294967296;
  const pool = [...WARDROBE], out = [];
  while (out.length < DAILY.featured && pool.length) { s = (s * 1664525 + 1013904223) % 4294967296; out.push(pool.splice(s % pool.length, 1)[0].id); }
  return out;
}
export const priceToday = (item, featured = featuredToday()) => (featured.includes(item.id) ? Math.round(item.price * (1 - DAILY.discount) / 10) * 10 : item.price);
export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

/** worn {slot: id} → online indices {slot: 1-based index | 0}, and back. */
export const fxOf = worn => Object.fromEntries(SLOTS.map(s => [s, worn?.[s] ? WARDROBE.indexOf(byId[worn[s]]) + 1 : 0]));
export const wornOf = fx => Object.fromEntries(SLOTS.map(s => [s, fx?.[s] > 0 && WARDROBE[fx[s] - 1]?.slot === s ? WARDROBE[fx[s] - 1].id : null]));
/** The look fields buildPerson() reads for a worn set. A fantasy head item replaces the normal hat. */
export const fxLook = worn => ({
  fxHat: worn?.hat || null, fxWings: worn?.wings || null, fxBack: worn?.back || null, fxHand: worn?.hand || null, fxTail: worn?.tail || null, fxAura: worn?.aura || null,
});
