// กระดานคะแนน — bests posted to the game's Supabase table game_scores (supabase/scores.sql) through the
// publishable key, and read back for the leaderboard (town/leaderboard.js): the top of everyone, and
// the player's friends. Nothing personal goes up: the per-device friend id, the preset name, numbers.
// Every call fails quietly (no table yet, offline): the game never waits for it.
import { PARTNERS } from './config.js';

export const SCORES = { table: 'game_scores', top: 10, timeout: 6000 };
const headers = { apikey: PARTNERS.key, 'Content-Type': 'application/json' };
const url = q => `${PARTNERS.rest}/${SCORES.table}?${q}`;
let who = { uid: null, name: () => '…' }, posted = {};

/** main.js: who we are on the board. */
export function configure({ uid, name }) { who = { uid, name }; }

/** Post a game's best (only when it beat what was posted this session). */
export function postBest(game, { baht = 0, streak = 0 }) {
  if (!who.uid || !PARTNERS.key) return;
  const prev = posted[game];
  if (prev && prev.baht >= baht && prev.streak >= streak) return;
  posted[game] = { baht, streak };
  const body = JSON.stringify({ uid: who.uid, game, name: String(who.name()).slice(0, 40), baht: Math.round(baht), streak: Math.round(streak) });
  fetch(url('on_conflict=uid,game'), { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates' }, body }).catch(() => {});
}

const get = q => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), SCORES.timeout);
  return fetch(url(q), { headers, signal: ctl.signal }).then(r => (r.ok ? r.json() : null)).catch(() => null).finally(() => clearTimeout(t));
};
/** The best `n` rows of a game (null when the board is not reachable). */
export const fetchTop = (game, n = SCORES.top) => get(`select=uid,name,baht,streak&game=eq.${game}&order=baht.desc,streak.desc&limit=${n}`);
/** The rows of the given players (friend ids and our own) for a game. */
export const fetchPlayers = (game, uids) => (uids.length ? get(`select=uid,name,baht,streak&game=eq.${game}&uid=in.(${uids.map(encodeURIComponent).join(',')})&order=baht.desc`) : Promise.resolve([]));
export const me = () => who.uid;
