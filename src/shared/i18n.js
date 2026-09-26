// Player-facing strings (TH first, EN secondary). Never hard-code Thai text in logic.
const STRINGS = {
  th: {
    loading: 'กำลังโหลดแผนที่…',
    loadError: 'โหลดแผนที่ไม่สำเร็จ',
    credit: 'ข้อมูลแผนที่ © OpenStreetMap contributors · ความสูง: Mapzen Terrarium',
  },
  en: {
    loading: 'Loading map…',
    loadError: 'Could not load the map',
    credit: 'Map data © OpenStreetMap contributors · Elevation: Mapzen Terrarium',
  },
};

let lang = 'th';
try { lang = localStorage.getItem('bangsaen.lang') || 'th'; } catch { /* storage blocked */ }
if (!STRINGS[lang]) lang = 'th';

export const t = key => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
export const getLang = () => lang;
export function setLang(l) {
  if (!STRINGS[l]) return;
  lang = l;
  try { localStorage.setItem('bangsaen.lang', l); } catch { /* storage blocked */ }
}
