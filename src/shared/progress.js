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
});

let data = fresh(), dirty = false, timer = 0;
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw);
    return { ...fresh(), ...d };
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
/** Position changes a lot; mark dirty without notifying listeners. */
export function setPos(x, z, yaw) { data.pos = { x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3) }; dirty = true; }

/** Wipe the save (debug / "new game"). */
export function reset() {
  data = fresh(); dirty = true; save();
  changed('reset');
}
