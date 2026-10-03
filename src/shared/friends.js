// Friends list. The game has no accounts: a player is a browser, known by a random two-number id
// kept in localStorage (nothing personal in it). Friends are saved on this device as that id plus
// the preset name indices and look they had when you became friends — never any typed text.
// Kept under its own key, so starting a new game (?reset=1) does not lose your friends.
const KEY = 'bangsaen.friends.v1';
export const FRIENDS = {
  max: 60,            // friends kept on this device
  range: 3.5,         // metres: you must be face to face to press 🤝
  askTtl: 60,         // seconds a 🤝 stays valid while waiting for the other side
  idMax: 1e6,         // each half of the id is an integer below this (the co-op channel carries numbers up to 1e6)
};

const half = () => Math.floor(Math.random() * FRIENDS.idMax);
const okHalf = v => Number.isInteger(v) && v >= 0 && v < FRIENDS.idMax;
export const okUid = u => Array.isArray(u) && u.length === 2 && okHalf(u[0]) && okHalf(u[1]);
export const keyOf = u => `${u[0]}-${u[1]}`;

let data = null;
function read() {
  if (data) return data;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage blocked */ }
  data = { uid: okUid(d?.uid) ? d.uid : [half(), half()], list: Array.isArray(d?.list) ? d.list.filter(f => okUid(f?.u)).slice(0, FRIENDS.max) : [] };
  if (!okUid(d?.uid)) write();
  return data;
}
function write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ } }

export const myUid = () => read().uid;
export const list = () => read().list;
export const isFriend = u => read().list.some(f => keyOf(f.u) === keyOf(u));

/** Add (or refresh the name / look of) a friend. Returns true when it is a new friend. */
export function add(u, { n1, n2, look }) {
  const d = read(), old = d.list.find(f => keyOf(f.u) === keyOf(u));
  if (old) { Object.assign(old, { n1, n2, look }); write(); return false; }
  if (d.list.length >= FRIENDS.max) return false;
  d.list.push({ u, n1, n2, look, since: new Date().toISOString().slice(0, 10) });
  write();
  return true;
}
export function remove(u) { const d = read(); d.list = d.list.filter(f => keyOf(f.u) !== keyOf(u)); write(); }
