// Balance check for the kart race (node tools/test_gp.mjs [races]): whole races with five bots and
// a scripted player of some skill (a bot's brain at that share of the limit), no rendering.
import { LOOP } from '../src/gp/loop.js';
import { buildTrack } from '../src/gp/track.js';
import { createRace, payFor } from '../src/gp/sim.js';
import { GP } from '../src/gp/rules.js';

const N = +process.argv[2] || 20, track = buildTrack(LOOP, GP.track);
let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
console.log(`track ${Math.round(track.length)} m, ${track.n} samples, tightest bend r = ${(1 / Math.max(...track.k.map(Math.abs))).toFixed(1)} m`);
for (const [name, skill] of [['beginner', 0.8], ['steady', 0.9], ['sharp', 1.0], ['ace', 1.06]]) {
  let places = 0, wins = 0, time = 0, pay = 0, hits = 0, dnf = 0;
  for (let r = 0; r < N; r++) {
    const entries = [];
    for (let i = 0; i < GP.grid - 1; i++) entries.push({ id: -1 - i, kind: 'bot', skill: GP.bot.skill[0] + (GP.bot.skill[1] - GP.bot.skill[0]) * (i / (GP.grid - 2)) });
    entries.push({ id: 1, kind: 'bot', skill });                       // the "player" starts last
    const race = createRace(track, entries, rand), me = race.karts[GP.grid - 1];
    for (let t = 0; t < 600 && me.fin == null; t += 1 / 60) race.step(1 / 60);
    if (me.fin == null) { dnf++; continue; }
    const p = race.place(1);
    places += p; wins += p === 1; time += me.fin; pay += payFor(p, me.hits); hits += me.hits;
  }
  const n = N - dnf || 1;
  console.log(`${name.padEnd(9)} skill ${skill}: place ${(places / n).toFixed(1)}, wins ${Math.round(100 * wins / n)} %, lap ${(time / n).toFixed(0)} s, ฿${Math.round(pay / n)}, wall hits ${(hits / n).toFixed(1)}, unfinished ${dnf}`);
}
