// What a game pays (฿) and the rows for the results screen.
import { PAY } from './rules.js';

/**
 * s: the game state (score [ours, theirs], supers: fireball spikes the kid hit).
 * full: played to the end; walking off early pays for the points and fireballs only.
 */
export function payout(s, full = true) {
  const [a, b] = s.score, kind = a > b ? 'win' : 'lose', supers = Math.min(s.supers, PAY.supers);
  const rows = [
    ...(full ? [{ key: kind, count: 1, baht: PAY[kind] }] : []),
    ...(a ? [{ key: 'point', count: a, baht: a * PAY.point }] : []),
    ...(supers ? [{ key: 'super', count: supers, baht: supers * PAY.super }] : []),
    ...(full && kind === 'win' && b === 0 ? [{ key: 'shutout', count: 1, baht: PAY.shutout }] : []),
  ];
  return { kind, rows, baht: rows.reduce((t, r) => t + r.baht, 0) };
}
