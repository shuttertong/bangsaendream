// What a match pays (฿) and the rows for the results screen.
import { PAY } from './rules.js';

/**
 * s: the match state (score [ours, theirs], mine: goals the kid scored).
 * full: the match was played to the whistle; walking off early pays for the goals only.
 */
export function payout(s, full = true) {
  const [a, b] = s.score, kind = a > b ? 'win' : a < b ? 'lose' : 'draw';
  const goals = Math.min(a, PAY.goals), mine = Math.min(s.mine, PAY.goals), clean = full && b === 0;
  const rows = [
    ...(full ? [{ key: kind, count: 1, baht: PAY[kind] }] : []),
    ...(goals ? [{ key: 'goal', count: goals, baht: goals * PAY.goal }] : []),
    ...(mine ? [{ key: 'mine', count: mine, baht: mine * PAY.mine }] : []),
    ...(clean ? [{ key: 'cleanSheet', count: 1, baht: PAY.cleanSheet }] : []),
  ];
  return { kind, rows, baht: rows.reduce((t, r) => t + r.baht, 0) };
}
