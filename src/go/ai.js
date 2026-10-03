// The Go teacher: a gentle one-move-ahead player for children. It captures when it can, saves
// its own stones in atari, avoids throwing stones away and filling its own eyes, likes the
// third line and playing near other stones, and adds some randomness so every game differs.
import { EMPTY, other, clone, play, group, neighbours } from './board.js';
import { AI } from './rules.js';

/** A point that only its own colour surrounds (filling it would be a wasted, harmful move). */
function ownEye(b, i, color) {
  const nb = neighbours(b.n, i);
  if (!nb.every(j => b.cells[j] === color)) return false;
  const n = b.n, x = i % n, y = (i - x) / n;
  let bad = 0, cnt = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
    cnt++;
    if (b.cells[xx + yy * n] === other(color)) bad++;
  }
  return cnt < 4 ? bad === 0 : bad <= 1;
}

/** Returns the index to play, or -1 to pass. rand: () → 0…1. */
export function chooseMove(b, color, rand = Math.random) {
  const n = b.n;
  // my groups in atari before the move
  const danger = new Map();
  for (let i = 0; i < b.cells.length; i++) if (b.cells[i] === color && !danger.has(i)) {
    const g = group(b, i);
    for (const s of g.stones) danger.set(s, g.libs.size === 1 ? g : null);
  }
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < b.cells.length; i++) {
    if (b.cells[i] !== EMPTY || ownEye(b, i, color)) continue;
    const c = clone(b), res = play(c, i, color);
    if (!res.ok) continue;
    const g = group(c, i);
    let s = res.captured.length * AI.capture + Math.min(g.libs.size, 5) * AI.liberty;
    if (g.libs.size === 1) s -= AI.selfAtari * g.stones.length;
    for (const j of neighbours(n, i)) {
      if (b.cells[j] === color && danger.get(j) && g.libs.size > 1) s += AI.save * danger.get(j).stones.length;
      if (c.cells[j] === other(color) && group(c, j).libs.size === 1) s += AI.atari;
    }
    const x = i % n, y = (i - x) / n, edge = Math.min(x, y, n - 1 - x, n - 1 - y);
    s += AI.line[Math.min(edge, AI.line.length - 1)];
    let near = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const xx = x + dx, yy = y + dy;
      if ((dx || dy) && xx >= 0 && yy >= 0 && xx < n && yy < n && b.cells[xx + yy * n] !== EMPTY) near++;
    }
    s += Math.min(near, 3) * AI.near * (b.moves > 4 ? 1 : 0.3) + rand() * AI.noise;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  // nothing useful left (or the other side passed and there is little to gain): pass
  if (best < 0 || (b.passes > 0 && bestScore < AI.line[2] + AI.near + AI.passBelow + AI.noise)) return -1;
  return best;
}
