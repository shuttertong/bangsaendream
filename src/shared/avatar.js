// Multiplayer identity: every name and look is picked from preset lists and sent as small
// indices, so no typed text ever reaches other players (it's a kids' game). The profile
// is saved in localStorage; KID_LOOK is updated in place so the hub kid and the kid in
// every mini-game wear the chosen look.
import { KID_LOOK } from '../town/kid/model.js';
import { tr } from './i18n.js';
import { fxLook, wornOf } from './wardrobe.js';

export const NAMES = [
  { th: 'ปูลม', en: 'Ghost Crab' }, { th: 'โลมา', en: 'Dolphin' }, { th: 'ลิงน้อย', en: 'Little Monkey' },
  { th: 'หมึกยักษ์', en: 'Big Squid' }, { th: 'มะพร้าว', en: 'Coconut' }, { th: 'กล้วยหอม', en: 'Banana' },
  { th: 'ปลาดาว', en: 'Starfish' }, { th: 'เต่าทะเล', en: 'Sea Turtle' }, { th: 'นกนางนวล', en: 'Seagull' },
  { th: 'หอยสังข์', en: 'Conch' }, { th: 'ข้าวหลาม', en: 'Khao Lam' }, { th: 'ห่วงยาง', en: 'Swim Ring' },
];
export const LOOKS = {
  shirt: ['#7fc4e8', '#f0b43a', '#e8958a', '#4fb3a8', '#9a5a8a', '#f4f1e8', '#d8443a', '#3a9a6a', '#2f6fc4', '#f07fa8'],
  skin: ['#d9a57c', '#c68f66', '#b8835c', '#e0b08a', '#a8764f'],
  hat: ['straw', 'cap', 'bucket', 'none'],
  hatColor: ['#e8d49a', '#d8443a', '#2f6fc4', '#f4f1e8', '#3a9a6a', '#f0b43a'],
  hair: ['short', 'long', 'bun'],
  bottom: ['#34507a', '#3a3a3a', '#6a5a4a', '#e8e4d8', '#3a6a4a', '#9a5a8a'],
};
const KEY = 'bangsaen.mp.v1';
const DEFAULT = { shirt: 0, skin: 0, hat: 0, hatColor: 0, hair: 0, bottom: 0 };   // the classic kid
const BASE = { ...KID_LOOK };

const rand = n => Math.floor(Math.random() * n);

export function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage blocked */ }
  if (!p || typeof p.n1 !== 'number' || !p.look) p = { n1: rand(NAMES.length), n2: 1 + rand(99), look: { ...DEFAULT } };
  for (const k of Object.keys(DEFAULT)) if (!(p.look[k] >= 0 && p.look[k] < LOOKS[k].length)) p.look[k] = DEFAULT[k];
  p.n1 %= NAMES.length;
  return p;
}
export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

/** buildPerson() look for look indices (+ optional wardrobe indices fx). */
export function lookOf(l, fx = null) {
  return {
    ...fxLook(wornOf(fx)),
    ...BASE, shirt: LOOKS.shirt[l.shirt] || BASE.shirt, skin: LOOKS.skin[l.skin], hat: LOOKS.hat[l.hat],
    hatColor: LOOKS.hatColor[l.hatColor], hairStyle: LOOKS.hair[l.hair], bottomColor: LOOKS.bottom[l.bottom],
    ...(LOOKS.hat[l.hat] === 'cap' ? { hatBand: '#f4f1e8' } : {}),
  };
}
/** Make the local kid (hub + mini-games) wear this look. */
export function wearLook(l) { const { fxHat, fxWings, fxBack, fxHand, fxTail, fxAura, ...base } = lookOf(l); Object.assign(KID_LOOK, base); }   // (wardrobe fields are the wardrobe's)

export const nameOf = (n1, n2) => `${tr(NAMES[n1 % NAMES.length])} ${n2}`;

/** Re-roll: a new name, or the next option for one look part. */
export function reroll(p, part) {
  if (part === 'name') { p.n1 = rand(NAMES.length); p.n2 = 1 + rand(99); }
  else p.look[part] = (p.look[part] + 1) % LOOKS[part].length;
  return p;
}
