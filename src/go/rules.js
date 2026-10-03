// หมากล้อม 9×9 — tunables. Area scoring (stones + surrounded points), so kids never have to
// mark dead stones: what stands on the board at the end counts.
export const GO = {
  size: 9,
  komi: 5.5,                      // points White gets for playing second
  stars: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]],
  turnTime: 45,                   // seconds per move; time out = pass
  aiThink: [0.7, 1.4],            // seconds the teacher "thinks"
  maxMoves: 160,                  // the game is scored after this many moves at the latest
};
export const PAY = {
  ai: { win: 150, lose: 50 },     // against the teacher
  net: { win: 180, lose: 80 },    // against another player
  perCapture: 5, captureCap: 60,
  fullAfter: 16,                  // moves before the full payout (stops pass-pass farming)
};
// the teacher: weights for the move chooser (ai.js)
export const AI = { capture: 10, save: 8, atari: 3, liberty: 0.6, selfAtari: 7, near: 1.2, line: [-2, -0.5, 0.8, 0.5, 0.2], noise: 2.2, passBelow: 0.5 };
