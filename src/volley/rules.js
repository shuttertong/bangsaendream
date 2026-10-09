// วอลเลย์บอลชายหาด — every number the game runs on (sim.js, ai.js, index.js, scene.js).
// Two a side, arcade style: dig, set, jump and spike; a perfectly timed spike is a fireball that
// floors whoever tries to dig it. The kid is the spiker, the friend sets.
export const COURT = { half: 6, wide: 3, net: 2.0, run: 2.4, keep: 0.45 };   // each side is `half` long (x) and 2 × `wide` across (z); players may run `run` m past the lines and stay `keep` m off the net
export const MATCH = { to: 7, cap: 9, pause: 2.1, serveIn: 1.0, serveWait: 6 };   // first to `to`, two clear, `cap` ends it; seconds after a point / before an AI serves / before the kid's serve goes by itself
export const BALL = { r: 0.22, g: 8 };                                       // a light beach ball: it hangs in the air
export const BODY = {
  speed: 4.8, r: 0.36, ease: 12, air: 0.3,       // m/s; how fast speed follows the stick (1/s); share of that in the air
  jump: 6, g: 15, hand: 1.7,                     // take-off speed, gravity, how far above the feet the hitting hand is
  reach: 0.95, spikeReach: 1.05,                 // a ball this close can be dug (on the sand, flat distance) / spiked (in the air, from the hand)
  swing: 0.42, slow: 0.45,                       // arms out for a dig this long; speed factor meanwhile
  dive: { to: 2.3, time: 0.3, down: 0.6 },       // a dig further away than `reach` becomes a dive this far; then on the sand this long
};
export const PASS = {
  digH: 1.0, setH: 1.9,                          // contact heights: forearms, hands above the head
  setSpot: 1.7, attackSpot: 0.95,                // metres from the net: where a dig goes for the setter, where a set comes down
  dig: 4.0, set: 4.5, digSet: 5.2, free: 4.8, high: 1.6,   // how high each pass goes (m); `high` more when the spiker is still getting up
  digError: 2.0, setError: 0.5,                  // metres off target at quality 0
};
export const SPIKE = {
  speed: [9, 13, 18], good: 0.45, super: 0.8,    // m/s for a weak / good / fireball spike, and the quality each needs
  depth: [2.2, 5.2], wide: 2.5,                  // where it can land: metres past the net, metres either side of the middle
  error: 1.3, clear: 0.3, net: 0.5,              // metres off target at quality 0; clearance over the net; chance a weak one finds the net
  tap: 0.55,                                     // jumped but did not swing: a ball this close to the hand is tapped over
  knock: 1.2,                                    // a fireball floors whoever digs it for this long
};
export const SERVE = { tossTo: 3.1, hitH: 2.1, auto: 1.35, time: [1.9, 1.3], error: 1.1 };   // toss height; best height to hit it; below `auto` it is hit anyway; flight time weak → perfect
export const TIMING = { dig: 0.2, late: 0.22, jump: 0.3, serve: 0.28, assist: 0.55 };        // seconds of grace; `assist`: standing this close under a ball digs it without a press
// The two sides: [the kid's friend, the rivals].
//   react: seconds before they move for a ball from the other side; mine: the friend leaves the kid a ball this much closer to the kid
//   dig: chance to dig a good spike they reach (digFast: less per m/s over 11; digSuper: a fireball); passQ / setQ: quality of their passes
//   spikeQ: quality range of their spikes; spikeT: flight time of their spikes, slow → fast (they hit softer than the kid: time to get under it)
//   band: the rivals wake up when the kid is ahead and ease off when the kid is behind: at `per` points' difference their
//         spikes fly `spikeT` (share) quicker / slower and their digs are `dig` surer / less sure
export const SIDE = [
  { speed: 1, react: 0.14, mine: 0.4, dig: 0.9, digFast: 0.03, digSuper: 0.5, passQ: [0.6, 1], setQ: 0.9, dive: 1, serveQ: [0.5, 0.8] },
  { speed: 0.92, react: 0.26, dig: 0.92, digFast: 0.045, digSuper: 0.38, passQ: [0.5, 0.95], setQ: 0.8, dive: 0.85, serveQ: [0.3, 0.7],
    spikeQ: [0.3, 0.7], spikeT: [1.05, 0.78], jumpErr: 0.1, tip: 0.12, aim: { kid: 0.32, mate: 0.2, spread: [1.4, 3.0] }, error: 0.45,
    band: { per: 4, spikeT: 0.16, dig: 0.07 } },
];
export const PAY = { win: 100, lose: 30, point: 8, super: 6, supers: 6, shutout: 20 };   // ฿; fireballs counted up to `supers`

// Looks (people/body.js): the friend wears the kid's shirt colour, the rivals the `shirts` colour furthest from it.
export const KIT = {
  shirts: ['#e2553f', '#f0c23a', '#7a4fb8', '#2f4f9a', '#3aa56a'],
  mate: { skin: '#c68f66', hair: '#2a2320', hairStyle: 'long', hat: 'none', bottomColor: '#3a4a5a', sleeves: 'none' },
  rivals: [
    { skin: '#c99a74', hair: '#2a2320', hairStyle: 'short', hat: 'none', bottomColor: '#f4f1e8', sleeves: 'none' },
    { skin: '#a8764f', hair: '#1f1a18', hairStyle: 'bun', hat: 'none', bottomColor: '#f4f1e8', sleeves: 'none' },
  ],
};
