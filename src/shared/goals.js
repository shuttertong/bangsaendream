// สมุดปิดเทอม — goals that bring a player back and give every round a target: a medal for each
// mini-game (bronze / silver / gold by the baht a round earns), three tasks a day with a streak,
// badges for things done around town, and a title for the badge count. Data only; town/journal.js
// tracks and shows them, shared/gameUI.js shows the medal targets on a game's intro and results.
import { rng } from '../core/rng.js';
import { SPECIES as CRABS } from '../crab/species.js';
import { SPECIES as SQUID } from '../squid/species.js';
import { FINDS } from '../tube/species.js';

// icon + name per mini-game (ids as in games.js)
export const GAMES = {
  crab: { icon: '🦀', name: { th: 'จับปูลม', en: 'Ghost crabs' } },
  squid: { icon: '🦑', name: { th: 'ตกหมึก', en: 'Squid jigging' } },
  monkey: { icon: '🐒', name: { th: 'ลิงเขาสามมุข', en: 'Monkeys' } },
  tube: { icon: '🛟', name: { th: 'ลอยห่วงยาง', en: 'Inner tube' } },
  stall: { icon: '🥗', name: { th: 'ร้านส้มตำ', en: 'Som tam stall' } },
  banana: { icon: '🍌', name: { th: 'บานาน่าโบ๊ท', en: 'Banana boat' } },
  sofa: { icon: '🛋️', name: { th: 'โซฟาโบ๊ท', en: 'Sofa boat' } },
  jetski: { icon: '🌊', name: { th: 'เจ็ทสกี', en: 'Jet ski' } },
  khaolam: { icon: '🎋', name: { th: 'ข้าวหลาม', en: 'Khao lam' } },
  go: { icon: '⚫', name: { th: 'หมากล้อม', en: 'Go' } },
  football: { icon: '⚽', name: { th: 'ฟุตบอลชายหาด', en: 'Beach football' } },
  volley: { icon: '🏐', name: { th: 'วอลเลย์บอลชายหาด', en: 'Beach volleyball' } },
  takraw: { icon: '🥎', name: { th: 'ตะกร้อวง', en: 'Takraw circle' } },
  gp: { icon: '🏎️', name: { th: 'โกคาร์ทกรังด์ปรีซ์', en: 'Kart Grand Prix' } },
};

// medals: the baht a single round must earn; `pay` is given once per tier per game
export const MEDALS = {
  tiers: [
    { icon: '🥉', name: { th: 'เหรียญทองแดง', en: 'Bronze' }, pay: 20 },
    { icon: '🥈', name: { th: 'เหรียญเงิน', en: 'Silver' }, pay: 40 },
    { icon: '🥇', name: { th: 'เหรียญทอง', en: 'Gold' }, pay: 80 },
  ],
  at: { default: [80, 150, 220], stall: [80, 160, 230], jetski: [70, 140, 200], khaolam: [100, 170, 240], go: [50, 150, 190], football: [60, 150, 220], volley: [60, 150, 200], takraw: [30, 60, 100], gp: [80, 130, 220] },
};
export const medalAt = game => MEDALS.at[game] || MEDALS.at.default;
/** 0 (none) … 3 (gold) for a round that earned `baht`. */
export const medalOf = (game, baht) => medalAt(game).filter(x => baht >= x).length;

// the collection book: every species a game can bring back (the journal's `seen` fills it in)
export const COLLECTIONS = {
  crab: { icon: '🦀', name: { th: 'สมุดปูลม', en: 'Crab book' }, list: CRABS, cm: true },
  squid: { icon: '🦑', name: { th: 'สมุดหมึก', en: 'Squid book' }, list: SQUID, cm: true },
  tube: { icon: '🐚', name: { th: 'ของจากทะเล', en: 'Beach finds' }, list: FINDS, cm: false },
};
export const bookDone = (game, j) => COLLECTIONS[game].list.every(sp => j.stats.seen[`${game}_${sp.id}`]);

export const DAILY = { bonus: 30, streakBonus: 10, streakCap: 5, visitWithin: 25 };   // ฿ for all three tasks, + per streak day (capped); metres that count as a visit
export const PLACES_TO_VISIT = ['walking', 'navyPier', 'viewpoint', 'laemThaen', 'welcome', 'goHouse', 'speedboat', 'crabBeach'];

const TASK = {
  play: g => ({ kind: 'play', game: g, n: 1, reward: 30, icon: GAMES[g].icon, text: { th: `เล่น${GAMES[g].name.th} 1 รอบ`, en: `Play ${GAMES[g].name.en} once` } }),
  earn: a => ({ kind: 'earn', amount: a, n: 1, reward: 40, icon: '💰', text: { th: `ได้ ฿${a} ขึ้นไปในรอบเดียว`, en: `Earn ฿${a} or more in one round` } }),
  medal: () => ({ kind: 'medal', n: 1, reward: 40, icon: '🏅', text: { th: 'จบเกมให้ถึงเกณฑ์เหรียญทองแดงขึ้นไป', en: 'Finish a round at bronze or better' } }),
  chat: n => ({ kind: 'chat', n, reward: 25, icon: '💬', text: { th: `ทักทายคนแถวหาด ${n} คน`, en: `Say hello to ${n} people` } }),
  ride: () => ({ kind: 'ride', n: 1, reward: 20, icon: '🚐', text: { th: 'นั่งรถแดง 1 เที่ยว', en: 'Ride the red truck' } }),
  walk: m => ({ kind: 'walk', n: m, reward: 25, icon: '👟', text: { th: `เดินเล่น ${m} เมตร`, en: `Walk ${m} m` } }),
  visit: p => ({ kind: 'visit', place: p, n: 1, reward: 25, icon: '📍', text: null }),   // (the place's name is filled in by the journal)
  photo: () => ({ kind: 'photo', n: 1, reward: 20, icon: '📷', text: { th: 'ถ่ายโปสการ์ด 1 ใบ', en: 'Take a postcard photo' } }),
};
/** The three tasks for a day (a yyyy-mm-dd key): the same on every device, different every day. */
export function dailyTasks(day) {
  let h = 7; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = rng(h), ids = Object.keys(GAMES);
  const list = [TASK.play(r.pick(ids)), r() < 0.5 ? TASK.earn(r.pick([120, 150, 180])) : TASK.medal(),
    r.pick([TASK.chat(3), TASK.ride(), TASK.walk(r.pick([300, 500, 800])), TASK.visit(r.pick(PLACES_TO_VISIT)), TASK.photo()])];
  return list.map((x, i) => ({ ...x, id: `${day}:${i}` }));
}

// badges: check(save, journal) → earned; each pays once
export const BADGES = [
  { id: 'firstGame', icon: '🎮', name: { th: 'เกมแรก', en: 'First game' }, hint: { th: 'เล่นมินิเกม 1 รอบ', en: 'Play one round' }, pay: 20, check: (s, j) => j.stats.games >= 1 },
  { id: 'tenGames', icon: '🕹️', name: { th: 'ติดใจแล้ว', en: 'Hooked' }, hint: { th: 'เล่นมินิเกม 10 รอบ', en: 'Play 10 rounds' }, pay: 40, check: (s, j) => j.stats.games >= 10 },
  { id: 'allGames', icon: '🗺️', name: { th: 'ลองครบทุกอย่าง', en: 'Tried it all' }, hint: { th: 'เล่นครบทั้ง 14 เกม', en: 'Play all 14 games' }, pay: 100, check: s => Object.keys(GAMES).every(g => s.best[g]) },
  { id: 'firstMedal', icon: '🥉', name: { th: 'เหรียญแรก', en: 'First medal' }, hint: { th: 'ได้เหรียญจากเกมไหนก็ได้', en: 'Win any medal' }, pay: 20, check: (s, j) => j.stats.medals >= 1 },
  { id: 'gold', icon: '🥇', name: { th: 'ทองแรก', en: 'First gold' }, hint: { th: 'ได้เหรียญทอง 1 เหรียญ', en: 'Win a gold medal' }, pay: 50, check: (s, j) => j.stats.golds >= 1 },
  { id: 'golds', icon: '🏆', name: { th: 'นักกีฬาตัวจริง', en: 'Real athlete' }, hint: { th: 'ได้เหรียญทอง 5 เกม', en: 'Gold in 5 games' }, pay: 150, check: (s, j) => j.stats.golds >= 5 },
  { id: 'saver', icon: '💰', name: { th: 'นักออม', en: 'Saver' }, hint: { th: 'มีเงินในกระเป๋า ฿1,000', en: 'Hold ฿1,000 at once' }, pay: 50, check: s => s.baht >= 1000 },
  { id: 'earner', icon: '🪙', name: { th: 'หาเงินเก่ง', en: 'Earner' }, hint: { th: 'หาเงินรวม ฿5,000', en: 'Earn ฿5,000 in all' }, pay: 100, check: (s, j) => j.stats.earned >= 5000 },
  { id: 'chatter', icon: '💬', name: { th: 'ช่างคุย', en: 'Chatty' }, hint: { th: 'ทักทายคน 10 ครั้ง', en: 'Say hello 10 times' }, pay: 30, check: (s, j) => j.stats.chats >= 10 },
  { id: 'talker', icon: '🗣️', name: { th: 'รู้จักคนทั้งหาด', en: 'Knows the whole beach' }, hint: { th: 'ทักทายคน 50 ครั้ง', en: 'Say hello 50 times' }, pay: 60, check: (s, j) => j.stats.chats >= 50 },
  { id: 'rider', icon: '🚐', name: { th: 'ขาประจำรถแดง', en: 'Red-truck regular' }, hint: { th: 'นั่งรถแดง 5 เที่ยว', en: 'Ride the red truck 5 times' }, pay: 30, check: (s, j) => j.stats.rides >= 5 },
  { id: 'walker', icon: '👟', name: { th: 'นักเดิน', en: 'Walker' }, hint: { th: 'เดินรวม 5 กิโลเมตร', en: 'Walk 5 km in all' }, pay: 40, check: (s, j) => j.stats.m >= 5000 },
  { id: 'explorer', icon: '🧭', name: { th: 'ไปมาทั่วบางแสน', en: 'Explorer' }, hint: { th: 'ไปให้ถึงที่เที่ยว 8 แห่ง', en: 'Reach 8 places' }, pay: 60, check: (s, j) => Object.keys(j.stats.visits).length >= 8 },
  { id: 'fashion', icon: '👗', name: { th: 'สายแฟชั่น', en: 'Dressed up' }, hint: { th: 'ซื้อของในตู้เสื้อผ้า 3 ชิ้น', en: 'Own 3 wardrobe items' }, pay: 40, check: s => Object.keys(s.wardrobe?.owned || {}).length >= 3 },
  { id: 'friend', icon: '🤝', name: { th: 'มีเพื่อนแล้ว', en: 'Made a friend' }, hint: { th: 'เป็นเพื่อนกับผู้เล่นอีกคน', en: 'Become friends with another player' }, pay: 40, check: (s, j) => j.stats.friends >= 1 },
  { id: 'streak3', icon: '🔥', name: { th: 'มาติดกัน 3 วัน', en: '3-day streak' }, hint: { th: 'ทำภารกิจครบ 3 วันติดกัน', en: 'Finish the tasks 3 days running' }, pay: 60, check: (s, j) => j.streak >= 3 },
  { id: 'streak7', icon: '🌟', name: { th: 'มาติดกัน 7 วัน', en: '7-day streak' }, hint: { th: 'ทำภารกิจครบ 7 วันติดกัน', en: 'Finish the tasks 7 days running' }, pay: 150, check: (s, j) => j.streak >= 7 },
  { id: 'crabBook', icon: '🦀', name: { th: 'สมุดปูครบ', en: 'Crab book complete' }, hint: { th: 'จับปูลมให้ครบทุกชนิด', en: 'Catch every kind of crab' }, pay: 60, check: (s, j) => bookDone('crab', j) },
  { id: 'squidBook', icon: '🦑', name: { th: 'สมุดหมึกครบ', en: 'Squid book complete' }, hint: { th: 'ตกหมึกให้ครบทุกชนิด', en: 'Catch every kind of squid' }, pay: 60, check: (s, j) => bookDone('squid', j) },
  { id: 'tubeBook', icon: '🐚', name: { th: 'ของจากทะเลครบ', en: 'All the beach finds' }, hint: { th: 'เก็บของจากทะเลให้ครบทุกอย่าง', en: 'Find everything the waves bring' }, pay: 60, check: (s, j) => bookDone('tube', j) },
  { id: 'photographer', icon: '📷', name: { th: 'ช่างภาพประจำหาด', en: 'Beach photographer' }, hint: { th: 'ถ่ายโปสการ์ด 5 ใบ', en: 'Take 5 postcard photos' }, pay: 40, check: (s, j) => j.stats.photos >= 5 },
  { id: 'hatTrick', icon: '⚽', name: { th: 'แฮตทริก', en: 'Hat-trick' }, hint: { th: 'ยิงเอง 3 ประตูในแมตช์เดียว', en: 'Score 3 goals yourself in one match' }, pay: 60, check: (s, j) => !!j.stats.hatTrick },
  { id: 'fireballs', icon: '🏐', name: { th: 'ราชาลูกตบไฟ', en: 'Fireball king' }, hint: { th: 'ตบไฟ 3 ลูกในเกมเดียว', en: 'Three fireball spikes in one game' }, pay: 60, check: (s, j) => j.stats.fireballs >= 3 },
];
export const TITLES = [
  [0, { th: 'เด็กมาเที่ยว', en: 'Visitor' }], [3, { th: 'ขาประจำหาดบางแสน', en: 'Beach regular' }], [7, { th: 'เพื่อนทั้งหาด', en: 'Friend of the beach' }],
  [12, { th: 'เจ้าถิ่นบางแสน', en: 'Bang Saen local' }], [17, { th: 'ตำนานปิดเทอม', en: 'Legend of the summer' }],
];
export const titleFor = badges => TITLES.filter(([n]) => badges >= n).pop()[1];
