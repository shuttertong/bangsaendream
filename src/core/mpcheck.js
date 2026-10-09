// Multiplayer message checks — the same whitelist tools/serve.py applies on the Wi-Fi relay,
// for the online relay (core/realtime.js), where every receiver checks what it gets. Only
// numbers, booleans, short lowercase words and preset-list indices pass; no free text ever
// reaches another player (it's a kids' game: names, looks and phrases are preset lists).
export const LIMITS = {
  players: 32, trucks: 64, phrases: 64,
  emotes: ['wave', 'dance', 'cheer', 'heart'],
  poses: [null, 'bench', 'lounge'],
  games: [null, 'crab', 'squid', 'monkey', 'tube', 'stall', 'banana', 'sofa', 'jetski', 'khaolam', 'go', 'football'],
  look: ['shirt', 'skin', 'hat', 'hatColor', 'hair', 'bottom'],
  fx: ['hat', 'wings', 'back', 'hand', 'tail', 'aura'], fxMax: 64,   // wardrobe item indices (0 = none)
  coKeys: ['k', 'room', 'game', 'seats', 't', 'seed', 'lean', 's', 'e', 'ev', 'phase', 'n', 'i', 'side', 'team', 'r'],
};
const L = LIMITS, WORD = /^[a-z]{1,12}$/;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v < hi;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;

/** Name = two preset indices; look = small palette indices. */
export function cleanHello(m) {
  const look = m?.look || {};
  if (!int(m?.n1, 0, 64) || !int(m?.n2, 0, 100) || !L.look.every(k => int(look[k], 0, 32))) return null;
  const fxIn = m.fx || {}, fx = Object.fromEntries(L.fx.map(k => [k, int(fxIn[k], 0, L.fxMax + 1) ? fxIn[k] : 0]));
  return { n1: m.n1, n2: m.n2, look: Object.fromEntries(L.look.map(k => [k, look[k]])), fx };
}

export function cleanState(m) {
  if (!['x', 'y', 'z', 'yaw'].every(k => num(m?.[k], -1e5, 1e5))) return null;
  const pose = m.pose ?? null, busy = m.busy ?? null, ride = m.ride ?? null;
  if (!L.poses.includes(pose) || !L.games.includes(busy)) return null;
  if (ride !== null && !int(ride, 0, L.trucks)) return null;
  return { x: r2(m.x), y: r2(m.y), z: r2(m.z), yaw: r3(m.yaw), pose, busy, air: !!m.air, ride };
}

export function cleanTrucks(lst) {
  if (!Array.isArray(lst) || lst.length > L.trucks) return null;
  for (const e of lst) if (!(Array.isArray(e) && e.length === 3 && num(e[0], 0, 1e5) && (e[1] === -1 || e[1] === 1) && num(e[2], 0, 50))) return null;
  return lst;
}

/** Co-op payloads: numbers, booleans, short lowercase words, lists, objects with known keys. Throws if not. */
export function cleanCo(v, depth = 0) {
  if (depth > 4) throw new Error('deep');
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > 1e6) throw new Error('num'); return v; }
  if (typeof v === 'string') { if (!WORD.test(v)) throw new Error('word'); return v; }
  if (Array.isArray(v)) { if (v.length > 64) throw new Error('len'); return v.map(x => cleanCo(x, depth + 1)); }
  if (typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) { if (!L.coKeys.includes(k)) throw new Error('key'); out[k] = cleanCo(x, depth + 1); }
    return out;
  }
  throw new Error('type');
}

export const cleanTo = to => (to === null || to === undefined ? null
  : Array.isArray(to) && to.length <= 8 && to.every(i => Number.isInteger(i)) ? to : undefined);   // undefined = reject
export const okPhrase = p => int(p, 0, L.phrases);
export const okEmote = e => L.emotes.includes(e);
export const okTruck = i => int(i, 0, L.trucks);
