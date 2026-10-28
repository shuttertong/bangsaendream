// Save data in localStorage (key prefix `bangsaen.`). Every read/write is wrapped in
// try/catch: storage can be blocked (private mode) and the game must still run.
const KEY = 'bangsaen.save.v1';
const AUTOSAVE_MS = 4000;

const fresh = () => ({
  v: 1,
  baht: 0,
  bag: {},            // itemId → count
  pos: null,          // { x, z, yaw } last position in the hub
  met: {},            // npcId → true once talked to
  flags: {},          // story flags
  quests: {},         // questId → 'active' | 'done'
  best: {},           // mini-game id → best result
  lang: null,
  wardrobe: { owned: {}, worn: {}, gift: null },   // fantasy wardrobe: itemId → 1, slot → itemId, last daily-gift day
  // สมุดปิดเทอม (shared/goals.js, town/journal.js): today's tasks (id → count), streak, badges (id → day), medal tiers paid per game, numbers
  journal: { day: null, tasks: {}, streak: 0, lastFull: null, badges: {}, paid: {},
    stats: { games: 0, earned: 0, chats: 0, rides: 0, m: 0, medals: 0, golds: 0, friends: 0, hatTrick: false, fireballs: 0, visits: {}, seen: {}, photos: 0 } },   // seen: `${game}_${species}` → biggest size caught
});

let data = fresh(), dirty = false, timer = 0;
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw);
    const f = fresh();
    return { ...f, ...d, wardrobe: { ...f.wardrobe, ...(d.wardrobe || {}) },
      journal: { ...f.journal, ...(d.journal || {}), stats: { ...f.journal.stats, ...(d.journal?.stats || {}) } } };
  } catch { return fresh(); }
}

export function save() {
  if (!dirty) return;
  try { localStorage.setItem(KEY, JSON.stringify(data)); dirty = false; } catch { /* storage full or blocked */ }
}

export function load() {
  data = read();
  clearInterval(timer);
  timer = setInterval(save, AUTOSAVE_MS);
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  return data;
}

/** Read-only view of the save. Change it through the helpers below. */
export const get = () => data;

function changed(what) { dirty = true; for (const fn of listeners) fn(what, data); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function addBaht(n) { data.baht = Math.max(0, data.baht + n); changed('baht'); }
export function addItem(id, n = 1) { data.bag[id] = (data.bag[id] || 0) + n; if (data.bag[id] <= 0) delete data.bag[id]; changed('bag'); }
export function setFlag(k, v = true) { data.flags[k] = v; changed('flags'); }
export function meet(id) { if (!data.met[id]) { data.met[id] = true; changed('met'); } }
export function setQuest(id, state) { data.quests[id] = state; changed('quests'); }
export function setBest(game, result) { data.best[game] = result; changed('best'); }
export function buyWardrobe(id, price) { if (data.baht < price || data.wardrobe.owned[id]) return false; data.baht -= price; data.wardrobe.owned[id] = 1; changed('wardrobe'); changed('baht'); return true; }
export function wearWardrobe(slot, id) { if (id) data.wardrobe.worn[slot] = id; else delete data.wardrobe.worn[slot]; changed('wardrobe'); }
export function takeGift(n) { const d = new Date(); data.wardrobe.gift = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); data.baht += n; changed('baht'); }   // (local day, as wardrobe.js dayKey)
/** Change the journal in place (fn(journal)) and tell listeners. */
export function updateJournal(fn, notify = true) { fn(data.journal); if (notify) changed('journal'); else dirty = true; }
/** Position changes a lot; mark dirty without notifying listeners. */
export function setPos(x, z, yaw) { data.pos = { x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3) }; dirty = true; }

/** Wipe the save (debug / "new game"). */
export function reset() {
  data = fresh(); dirty = true; save();
  changed('reset');
}
