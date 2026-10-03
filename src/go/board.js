// Go board logic (pure, no rendering): place a stone, capture, ko, suicide, passes, area score.
// Points are indices 0 … n·n − 1 (x + y·n). Both players' games run this same code, so an
// online game only has to send the index of each move.
export const EMPTY = 0, BLACK = 1, WHITE = 2;
export const other = c => 3 - c;

export function createBoard(n = 9) {
  return { n, cells: new Uint8Array(n * n), ko: -1, caps: [0, 0, 0], passes: 0, turn: BLACK, moves: 0, last: -1 };
}
export const clone = b => ({ ...b, cells: b.cells.slice(), caps: b.caps.slice() });

export function neighbours(n, i) {
  const x = i % n, y = (i - x) / n, out = [];
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  return out;
}

/** The connected group at i: { stones: [idx], libs: Set(idx) }. */
export function group(b, i) {
  const c = b.cells[i], stones = [i], libs = new Set(), seen = new Set([i]);
  for (let k = 0; k < stones.length; k++) for (const j of neighbours(b.n, stones[k])) {
    if (b.cells[j] === EMPTY) libs.add(j);
    else if (b.cells[j] === c && !seen.has(j)) { seen.add(j); stones.push(j); }
  }
  return { stones, libs };
}

/** Try a move on a copy-free basis. Returns { ok, captured: [idx], reason } and changes b only when ok. */
export function play(b, i, color = b.turn) {
  if (!(i >= 0 && i < b.cells.length) || b.cells[i] !== EMPTY) return { ok: false, reason: 'taken' };
  if (i === b.ko) return { ok: false, reason: 'ko' };
  b.cells[i] = color;
  const captured = [];
  for (const j of neighbours(b.n, i)) {
    if (b.cells[j] !== other(color)) continue;
    const g = group(b, j);
    if (!g.libs.size) for (const s of g.stones) { b.cells[s] = EMPTY; captured.push(s); }
  }
  const mine = group(b, i);
  if (!mine.libs.size) { b.cells[i] = EMPTY; return { ok: false, reason: 'suicide' }; }   // nothing was captured, or it would have a liberty
  b.ko = captured.length === 1 && mine.stones.length === 1 && mine.libs.size === 1 ? captured[0] : -1;
  b.caps[color] += captured.length;
  b.passes = 0; b.turn = other(color); b.moves++; b.last = i;
  return { ok: true, captured };
}
export function legal(b, i, color = b.turn) { return play(clone(b), i, color).ok; }
export function pass(b) { b.passes++; b.ko = -1; b.turn = other(b.turn); b.moves++; b.last = -1; }
export const over = b => b.passes >= 2;

/** Area score: stones on the board + empty regions that touch one colour only. owner[i]: 0 nobody, 1 black, 2 white. */
export function score(b, komi) {
  const N = b.cells.length, owner = new Uint8Array(N), seen = new Uint8Array(N);
  let black = 0, white = 0;
  for (let i = 0; i < N; i++) {
    if (b.cells[i] === BLACK) { black++; owner[i] = BLACK; continue; }
    if (b.cells[i] === WHITE) { white++; owner[i] = WHITE; continue; }
    if (seen[i]) continue;
    const region = [i]; seen[i] = 1; let touch = 0;
    for (let k = 0; k < region.length; k++) for (const j of neighbours(b.n, region[k])) {
      if (b.cells[j] === EMPTY) { if (!seen[j]) { seen[j] = 1; region.push(j); } }
      else touch |= b.cells[j];
    }
    const who = touch === BLACK ? BLACK : touch === WHITE ? WHITE : 0;
    for (const j of region) owner[j] = who;
    if (who === BLACK) black += region.length; else if (who === WHITE) white += region.length;
  }
  return { black, white: white + komi, owner, winner: black > white + komi ? BLACK : WHITE };
}
