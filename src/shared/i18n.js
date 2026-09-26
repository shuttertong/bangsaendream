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
