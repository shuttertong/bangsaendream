// Player-facing strings (TH first, EN secondary). Never hard-code Thai text in logic.
// UI strings live here; content (dialogue, places, items) lives in data files as
// { th, en } objects and is read with tr().
const STRINGS = {
  th: {
    loading: 'กำลังโหลดแผนที่…',
    loadError: 'โหลดแผนที่ไม่สำเร็จ',
    credit: 'ข้อมูลแผนที่ © OpenStreetMap contributors · ความสูง: Mapzen Terrarium',
    talk: 'คุยกับ{name}',
    talkKey: 'F',
    next: 'ต่อ',
    travel: 'เดินทาง',
    travelTitle: 'ไปที่ไหนดี?',
    bag: 'กระเป๋า',
    bagEmpty: 'กระเป๋ายังว่างอยู่',
    close: 'ปิด',
    baht: '฿{n}',
    objective: 'ภารกิจ',
    gotBaht: 'ได้รับ {n} บาท',
    comingSoon: 'มินิเกมนี้ยังไม่เปิด เร็ว ๆ นี้!',
    play: 'เล่น',
    here: 'คุณอยู่ที่นี่',
    lang: 'EN',
    newGame: 'เริ่มใหม่',
    // mini-games (shared)
    start: 'เริ่มเลย!',
    time: 'เวลา',
    caught: 'จับได้',
    results: 'สรุปผล',
    total: 'รวม',
    back: 'กลับไปที่หาด',
    newRecord: 'สถิติใหม่!',
    quit: 'ออก',
    none: 'ไม่ได้อะไรเลย ลองใหม่นะ!',
    // จับปูลม
    crabTitle: 'จับปูลม',
    crabHow: 'ส่องไฟฉายให้ปูตกใจจนหยุดนิ่ง แล้วพุ่งตัวจับ! ถ้าปูวิ่งลงรูไปได้ก็หลุดมือ',
    crabKeys: 'เดิน: WASD / จอยสติ๊ก · พุ่งจับ: Space / ปุ่มมือ',
    crabGot: 'จับได้! {name} {size} ซม.',
    crabBig: 'ตัวใหญ่มาก!',
    crabSlip: 'หลุดมือ!',
    crabDark: 'ฟ้ามืดแล้ว ปูออกมาเยอะขึ้น!',
    crabEnd: 'หมดเวลา!',
    cm: '{n} ซม.',
    // ตกหมึก
    squidTitle: 'ตกหมึก',
    squidHow: 'ปล่อยเหยื่อตกหมึกลงไปให้ถึงระดับที่หมึกว่าย กดกระตุกเหยื่อแล้วรอ หมึกจะเข้ามากิน! จากนั้นกดค้างม้วนสาย รักษาแรงตึงให้อยู่ในช่องสีเขียว',
    squidKeys: 'ขึ้น/ลง: W/S / จอยสติ๊ก · กระตุก/ม้วนสาย: Space / ปุ่ม',
    depth: 'ลึก {n} ม.',
    tension: 'แรงตึง',
    squidBite: 'หมึกกินเหยื่อ! กดค้างม้วนสาย!',
    squidSnap: 'สายขาด!',
    squidLoose: 'หมึกหลุดไปแล้ว!',
    squidGot: 'ได้! {name} {size} ซม.',
    // ลิงเขาสามมุข
    monkeyTitle: 'ลิงเขาสามมุข',
    monkeyHow: 'ฝูงลิงจะมาขโมยขนมบนเสื่อ! พุ่งไล่ลิงให้หนีไป ถ้าลิงทำขนมตก เดินไปเก็บคืนได้ ลิงจ่าฝูงต้องไล่สองครั้ง',
    monkeyKeys: 'เดิน: WASD / จอยสติ๊ก · พุ่งไล่: Space / ปุ่มมือ',
    wave: 'คลื่น {n}/{of}',
    waveStart: 'ลิงมาแล้ว! คลื่นที่ {n}',
    snacksLeft: 'ขนม {n}',
    monkeyShoo: 'ไล่ไปแล้ว!',
    monkeyStagger: 'จ่าฝูงยังไม่ยอม!',
    monkeyStole: 'ลิงขโมยขนมไป!',
    monkeyBack: 'เก็บขนมคืนมาได้!',
    monkeyAllGone: 'ขนมหมดเสื่อแล้ว!',
    monkeyWin: 'ป้องกันขนมได้สำเร็จ!',
    shooed: 'ไล่ลิง',
    saved: 'เหลือ {n} ชิ้น',
    times: '{n} ตัว',
  },
  en: {
    loading: 'Loading map…',
    loadError: 'Could not load the map',
    credit: 'Map data © OpenStreetMap contributors · Elevation: Mapzen Terrarium',
    talk: 'Talk to {name}',
    talkKey: 'F',
    next: 'Next',
    travel: 'Travel',
    travelTitle: 'Where to?',
    bag: 'Bag',
    bagEmpty: 'Your bag is empty',
    close: 'Close',
    baht: '฿{n}',
    objective: 'Goal',
    gotBaht: 'Got {n} baht',
    comingSoon: 'This mini-game opens soon!',
    play: 'Play',
    here: 'You are here',
    lang: 'ไทย',
    newGame: 'New game',
    start: 'Start!',
    time: 'Time',
    caught: 'Caught',
    results: 'Results',
    total: 'Total',
    back: 'Back to the beach',
    newRecord: 'New record!',
    quit: 'Quit',
    none: 'Nothing this time. Try again!',
    crabTitle: 'Ghost-crab catching',
    crabHow: 'Shine the flashlight to freeze a crab, then dash to grab it! If it reaches its hole, it\'s gone.',
    crabKeys: 'Move: WASD / joystick · Dash: Space / hand button',
    crabGot: 'Caught! {name} {size} cm',
    crabBig: 'A big one!',
    crabSlip: 'It slipped away!',
    crabDark: "It's dark now: more crabs are coming out!",
    crabEnd: "Time's up!",
    cm: '{n} cm',
    squidTitle: 'Squid jigging',
    squidHow: 'Lower the jig to where the squid swim. Tap to jig, then wait: a squid will grab it! Then hold to reel in, keeping the tension in the green band.',
    squidKeys: 'Up/down: W/S / joystick · Jig/reel: Space / button',
    depth: '{n} m deep',
    tension: 'Tension',
    squidBite: 'A squid took the jig! Hold to reel!',
    squidSnap: 'The line snapped!',
    squidLoose: 'It got away!',
    squidGot: 'Got it! {name} {size} cm',
    monkeyTitle: 'Monkeys of Khao Sam Muk',
    monkeyHow: 'The troop is after the snacks on your mat! Dash at monkeys to shoo them. If one drops a snack, walk over it to put it back. The alpha needs two hits.',
    monkeyKeys: 'Move: WASD / joystick · Shoo: Space / hand button',
    wave: 'Wave {n}/{of}',
    waveStart: 'Here they come! Wave {n}',
    snacksLeft: 'Snacks {n}',
    monkeyShoo: 'Shoo!',
    monkeyStagger: "The alpha isn't giving up!",
    monkeyStole: 'A monkey stole a snack!',
    monkeyBack: 'Snack saved!',
    monkeyAllGone: 'The mat is empty!',
    monkeyWin: 'You guarded the snacks!',
    shooed: 'Monkeys shooed',
    saved: '{n} left',
    times: '{n}',
  },
};

let lang = 'th';
try { lang = localStorage.getItem('bangsaen.lang') || 'th'; } catch { /* storage blocked */ }
if (!STRINGS[lang]) lang = 'th';
const listeners = new Set();

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s);

/** UI string by key, with optional {placeholders}. */
export const t = (key, vars) => fill(STRINGS[lang][key] ?? STRINGS.en[key] ?? key, vars);
/** Content text: { th, en } object (or a plain string) in the current language. */
export const tr = (obj, vars) => fill(typeof obj === 'string' ? obj : (obj?.[lang] ?? obj?.th ?? ''), vars);
export const getLang = () => lang;
export const onLang = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function setLang(l) {
  if (!STRINGS[l] || l === lang) return;
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('bangsaen.lang', l); } catch { /* storage blocked */ }
  for (const fn of listeners) fn(l);
}
