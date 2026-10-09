// ฟุตบอลชายหาด — every number the match runs on (sim.js, ai.js, index.js, scene.js).
// Three a side on the sand: the kid, a friend and a keeper against three kids from the next beach.
export const PITCH = {
  L: 13, W: 8,                         // half length (to each goal line) and half width, metres; the boards stand on these lines
  goal: { half: 1.7, h: 1.7, depth: 1.2 },
  keep: 0.35,                          // players stay this far inside the boards
};
export const MATCH = {
  time: 150,                           // seconds of play
  kickoff: 1.3, afterGoal: 2.6,        // the wait before a kickoff / the celebration after a goal (s)
  outfield: 2,                         // outfield players per side (plus a keeper)
};
export const BALL = {
  r: 0.16, gravity: 14,
  drag: 0.5, sand: 3.0,                // drag (1/s), and the sand's steady braking on a rolling ball (m/s²)
  bounce: 0.3, skid: 0.74,             // sand kills the bounce; share of the horizontal speed kept on landing
  board: 0.6, body: 0.38,              // speed kept off the boards / off a player's body
  lead: 0.55, follow: 16,              // dribbling: the ball runs this far ahead of the feet, easing there at this rate
};
export const PLAYER = {
  r: 0.33, ease: 9, turn: 12,          // body radius; how fast speed and heading follow what the player wants (1/s)
  dribble: 0.9, charging: 0.78, stunned: 0.3,   // speed factors: with the ball, winding up a kick, after losing a tackle
  reach: 0.62, trap: 11,               // a loose ball this close to the feet and slower than this (m/s) is brought under control
  low: 0.75, high: 1.2,                // the ball can be trapped below `low`; above `high` it flies over a player
  kickRest: 0.35,                      // seconds before the kicker may touch the ball again
};
export const HUMAN = {
  speed: 5.0, reach: 0.8, trap: 15,
  charge: 0.65,                        // seconds of holding the button to full power
  pass: [7, 14.5], shot: [14, 21], lift: [0.9, 4.4],     // ball speed (m/s) and lift, from a tap to full power
  spread: [0.03, 0.085],               // how far a shot strays (rad, one sigma), from a tap to full power: hard shots are wilder
  shotFrom: 17, shotNear: 9,           // metres: the goal draws the kick from this close; nearer than `shotNear` even a tap is a shot unless the kid faces a team-mate more squarely
  cone: { pass: 0.42, goal: 0.62 },    // aim assist (rad): a team-mate / the goal this close to where the kid faces
  past: { near: 0.8, shift: 1.0 },     // a shot aimed within `near` m of the keeper goes `shift` m to the side instead
  lunge: { time: 0.2, speed: 8.6, range: 3.4, cool: 0.9, reach: 0.95 },   // the button without the ball: a lunge at it
};
export const TACKLE = {
  reach: 0.62, every: 0.7,             // a challenger this close to the ball tries for it, at most this often (s)
  front: 0.68, behind: 0.22,           // chance from straight in front of the carrier / from behind (their body shields it)
  lunge: 0.12, lungeMiss: 0.75,        // added to a lunge's chance; a lunge that misses leaves the kid on the sand this long
  lost: 0.42, missed: 0.5, keep: 0.7,  // stun for the one who lost the ball / missed the tackle; the loser cannot touch the ball this long
  vsHuman: 0.72, byHuman: 1.1,         // the kid keeps the ball more easily and wins it more easily
};
// The two sides: [the kid's team-mates, the rivals]. The rivals are a little slower and less sure.
// shootFrom: they shoot from here when a rival is closing in; from `close` they shoot anyway.
export const SIDE = [
  { speed: 4.5, shootFrom: 7.5, close: 4.8, shot: [13.5, 16.5], shotError: 0.75, think: [0.25, 0.5], feed: 0.8,
    keeper: { speed: 4.5, react: 0.16, reach: 0.95, save: 0.8, hold: [0.9, 1.4] } },
  { speed: 4.2, shootFrom: 7.5, close: 4.8, shot: [13, 16], shotError: 0.9, think: [0.3, 0.6], feed: 0,
    keeper: { speed: 4.1, react: 0.22, reach: 0.9, save: 0.66, hold: [0.9, 1.4] } },
];
export const AI = {
  every: 0.15,                         // seconds between an AI player's decisions on the ball
  press: 2.0,                          // a rival this close ahead puts the carrier under pressure
  lane: 1.1, marked: 1.6,              // a pass needs this much room along its line / around the receiver
  better: 3.5,                         // …or goes to a team-mate this much closer to the goal
  support: { ahead: 5, wide: 5.5 },    // off the ball: this far up the pitch from the carrier, this far across
  box: 4.2,                            // the keeper comes for a slow loose ball this close to the goal
  arc: 1.5,                            // how far off the line the keeper stands
  throw: { min: 4, room: 2.2, hand: 1.3, lift: 3 },   // the keeper throws to a team-mate at least `min` m away with `room` around them (else long up the pitch), from hand height
  idle: 1.5,                           // the kid standing still this long: the friend goes for the ball instead
};
export const PAY = { win: 100, draw: 55, lose: 25, goal: 18, mine: 12, cleanSheet: 20, goals: 5 };   // ฿; goals counted up to `goals`

// Looks (people/body.js). The kid plays in their own clothes; the friend wears the kid's shirt colour;
// the rivals wear whichever of `shirts` is furthest from it. Keepers wear `keeper`. Everyone plays barefoot.
export const KIT = {
  shirts: ['#e2553f', '#f0c23a', '#7a4fb8', '#2f4f9a', '#3aa56a'],
  keeper: ['#b8d84a', '#3a3f4a'],
  mates: [
    { skin: '#c68f66', hair: '#2a2320', hairStyle: 'short', hat: 'none', bottomColor: '#3a4a5a' },
    { skin: '#b8835c', hair: '#3a2a20', hairStyle: 'long', hat: 'none', bottomColor: '#4a3a5a', sleeves: 'long' },
  ],
  rivals: [
    { skin: '#c99a74', hair: '#2a2320', hairStyle: 'short', hat: 'none', bottomColor: '#f4f1e8' },
    { skin: '#a8764f', hair: '#1f1a18', hairStyle: 'bun', hat: 'none', bottomColor: '#f4f1e8' },
    { skin: '#d9a57c', hair: '#3a2a20', hairStyle: 'short', hat: 'none', bottomColor: '#f4f1e8', sleeves: 'long' },
  ],
};
