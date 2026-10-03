// Closed roads. A corridor listed in ROADBLOCK.closed (road 3137) is baked and dressed like any
// other (shophouses, trees, visible from the drone) but the kid may not walk in. Wherever ANY road
// runs on out of the walkable area, a road-closed barrier stands across it, kerb to kerb over every
// lane and pavement found there: red-and-white water-filled barriers, a steel grille fence behind,
// a no-entry sign, and kid-friendly dressing (a flag-waving road-work doll, teddies and ducks on
// the barriers, bunting, balloons, cones and a painted "closed — back to the beach" board).
import * as THREE from 'three';
import { roadWidth, SIDEWALK } from './roads.js';
import { rng } from './layout.js';
import { t, onLang } from '../shared/i18n.js';
import { flagDoll, createWavingArms, teddy, duck, bunting, balloons, cone, createSignFaces, PROPS } from './assets/roadblockprops.js';

export const ROADBLOCK = {
  closed: ['road3137'],
  beyond: 15,                        // a road must run on this far past the edge to get a barrier
  inset: 1.2,                        // metres inside the walkable edge: the fence (w 1.1) sits right on it, no gap behind
  dedupe: 14,                        // crossings closer than this share one barrier
  span: { max: 45, gap: 2.5, pave: SIDEWALK.w + 0.6, probe: 3 },   // kerb-to-kerb search across the road
  barrier: { len: 1.2, h: 0.9, base: 0.55, top: 0.3, colors: ['#d8443a', '#f4f2ec'] },
  fence: { back: 1.1, h: 2.0, post: 2.5, bar: 0.18, color: '#a9b1b6', postColor: '#7d868c' },
  sign: { h: 2.3, r: 0.45, red: '#c8322a', white: '#f4f2ec', pole: '#8d9aa3' },
  dress: { dollIn: 1.6, dollW: -1.3, plushEvery: 3, duckChance: 0.35, balloonEvery: 3, cones: 2.8, coneW: -3.2 },
  notice: { dist: 6, again: 12, cooldown: 25 },   // toast when the kid comes this close; again after walking away (not within `cooldown` s)
};

const col = h => new THREE.Color(h);

/** walkable(x, z): the collision's area rule (strip + open corridors + walk zones). */
export function buildRoadblocks(kit, scene, map, layout, walkable) {
  const R = ROADBLOCK, r = rng(3137), solids = [], spots = [], { roadIdx } = layout;
  const ground = (x, z) => Math.max(map.heightAt(x, z), map.sea);

  // ---- crossings: a road leaves the walkable area and carries on ----
  for (const road of map.roads) {
    if (!roadWidth(road)) continue;
    const pts = [];
    for (let k = 1; k < road.p.length; k++) {
      const [ax, az] = road.p[k - 1], [bx, bz] = road.p[k], L = Math.hypot(bx - ax, bz - az);
      if (!L) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let d = 0; d < L; d += 1) { const x = ax + dx * d, z = az + dz * d; pts.push({ x, z, dx, dz, w: walkable(x, z) }); }
    }
    const out = (from, step) => { for (let i = 1; i <= R.beyond; i++) { const q = pts[from + i * step]; if (!q || q.w) return false; } return true; };
    for (let i = 0; i < pts.length - 1; i++) {
      for (const [a, b, step] of [[i, i + 1, 1], [i + 1, i, -1]]) {
        if (!pts[a].w || pts[b].w || !out(a, step)) continue;
        const p = pts[a], ox = p.dx * step, oz = p.dz * step, x = p.x - ox * R.inset, z = p.z - oz * R.inset;
        if (!spots.some(q => Math.hypot(q.x - x, q.z - z) < R.dedupe)) spots.push({ x, z, ox, oz, road });
      }
    }
  }

  const B = R.barrier, F = R.fence, S = R.sign, Dr = R.dress, arms = [], boards = [];
  for (const p of spots) {
    const ry = Math.atan2(p.ox, p.oz), f = kit.frame(p.x, 0, p.z, ry);  // +w points out along the closed road; u across it
    const y = (u, w) => { const q = f.P(u, 0, w); return ground(q.x, q.z); };
    // kerb to kerb: widen each side while the line (or just past it) is on a road or its pavement
    const covered = u => [0, R.span.probe].some(w => { const q = f.P(u, 0, w); return roadIdx.clearance(q.x, q.z, 12) < R.span.pave; });
    const minHalf = roadWidth(p.road) / 2 + 1;
    const reach = s => { let last = 0; for (let d = 0; d <= R.span.max; d += 0.5) { if (covered(s * d)) last = d; else if (d - last > R.span.gap) break; } return Math.max(minHalf, last + 0.6); };
    const u0 = -reach(-1), u1 = reach(1);

    // plastic barriers, alternating colours; a plush toy on some
    let i = 0;
    for (let u = u0 + B.len / 2; u <= u1 - B.len / 2 + 0.01; u += B.len + 0.05, i++) {
      const g = y(u, 0), c = col(B.colors[i % 2]);
      f.box('wall', u, g + B.h * 0.3, 0, B.len, B.h * 0.6, B.base, c);
      f.box('wall', u, g + B.h * 0.8, 0, B.len * 0.96, B.h * 0.4, B.top, c);
      f.box('wall', u, g + B.h * 0.55, 0, B.len * 0.2, 0.08, B.base + 0.02, col('#3a3a3a'));
      if (i % Dr.plushEvery === 1) {
        const at = f.P(u, g + B.h, 0), face = ry + Math.PI + (r() - 0.5) * 0.6;
        if (r() < Dr.duckChance) duck(kit, at, face, 1.2); else teddy(kit, at, face, r.pick(PROPS.teddy), 0.9 + r() * 0.3);
      }
    }
    // steel grille fence behind, with bunting along the top and balloons on some posts
    const post = col(F.postColor), bar = col(F.color);
    const posts = [];
    for (let u = u0; u <= u1 + 0.01; u += F.post) posts.push(u);
    if (posts[posts.length - 1] < u1 - 0.3) posts.push(u1);
    posts.forEach((u, k) => {
      const g = y(u, F.back);
      f.rod('metal', [u, g - 0.2, F.back], [u, g + F.h, F.back], 0.05, post);
      if (k > 0) bunting(kit, f.P(posts[k - 1], y(posts[k - 1], F.back) + F.h - 0.05, F.back - 0.05), f.P(u, g + F.h - 0.05, F.back - 0.05), 0.3);
      if (k % Dr.balloonEvery === 0) balloons(kit, f.P(u, g + F.h, F.back - 0.08), k + spots.indexOf(p));
    });
    for (const h of [0.15, F.h - 0.05]) kit.rod('metal', f.P(u0, y(u0, F.back) + h, F.back), f.P(u1, y(u1, F.back) + h, F.back), 0.03, post);
    for (let u = u0; u <= u1; u += F.bar) f.rod('metal', [u, y(u, F.back) + 0.15, F.back], [u, y(u, F.back) + F.h - 0.05, F.back], 0.012, bar);
    // no-entry sign in the middle, facing the walkable side
    const sg = y(0, 0.5);
    f.rod('metal', [0, sg, 0.5], [0, sg + S.h, 0.5], 0.04, col(S.pole));
    const disc = new THREE.CylinderGeometry(S.r, S.r, 0.04, 24).rotateX(Math.PI / 2);
    kit.add('wall', disc, new THREE.Matrix4().makeRotationY(ry).setPosition(f.P(0, sg + S.h, 0.45)), col(S.red));
    f.box('wall', 0, sg + S.h, 0.42, S.r * 1.3, S.r * 0.3, 0.02, col(S.white));
    // the painted board: framed on the fence beside the no-entry sign
    const SB = PROPS.sign, bu = Math.min(u1 - SB.w / 2 - 0.3, 3.2), bg = y(bu, F.back) + 1.0 + SB.h / 2;
    f.box('wall', bu, bg, F.back - 0.06, SB.w + 0.12, SB.h + 0.12, 0.05, col(SB.edge));
    boards.push(new THREE.Matrix4().makeRotationY(ry + Math.PI).setPosition(f.P(bu, bg, F.back - 0.1)));
    // a flag-waving doll at each end, cones in front
    for (const s of [-1, 1]) {
      const du = s < 0 ? u0 + Dr.dollIn : u1 - Dr.dollIn, g = y(du, Dr.dollW);
      arms.push(flagDoll(kit, f, du, g, Dr.dollW, ry));
      const q = f.P(du, 0, Dr.dollW); solids.push({ x: q.x, z: q.z, r: 0.4, top: g + 1.8 });
    }
    for (let u = u0 + Dr.cones; u < u1 - Dr.cones + 0.01; u += Dr.cones) {
      const q = f.P(u, 0, Dr.coneW); q.y = ground(q.x, q.z); cone(kit, q);
      solids.push({ x: q.x, z: q.z, r: 0.25, top: q.y + 0.65 });
    }
    // collision along the barrier line
    for (let u = u0; u <= u1; u += 0.4) { const q = f.P(u, 0, 0.5); solids.push({ x: q.x, z: q.z, r: 0.45, top: ground(q.x, q.z) + F.h }); }
    Object.assign(p, { u0, u1, ry });
  }
  createWavingArms(scene, arms);
  const signs = createSignFaces(scene, boards, drawBoard);
  if (signs) onLang(signs.redraw);
  return { solids, count: spots.length, spots };
}

/** The painted board: a cartoon beach, the "closed" line and a turn-back arrow. */
function drawBoard(c, w, h) {
  const SB = PROPS.sign, pad = w * 0.03;
  c.fillStyle = SB.board; c.fillRect(0, 0, w, h);
  // little beach scene on the left: sun, sea, sand, an umbrella
  const bw = h * 0.72, bx = pad, by = (h - bw) / 2;
  c.save(); c.beginPath(); if (c.roundRect) c.roundRect(bx, by, bw, bw, 28); else c.rect(bx, by, bw, bw); c.clip();   // (roundRect: iOS 16+)
  c.fillStyle = '#bfe6f4'; c.fillRect(bx, by, bw, bw);
  c.fillStyle = '#f4c43c'; c.beginPath(); c.arc(bx + bw * 0.72, by + bw * 0.26, bw * 0.13, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#4fb3a8'; c.fillRect(bx, by + bw * 0.55, bw, bw * 0.2);
  c.fillStyle = '#e8d8a8'; c.fillRect(bx, by + bw * 0.75, bw, bw * 0.25);
  c.strokeStyle = '#8a6a4a'; c.lineWidth = 8; c.beginPath(); c.moveTo(bx + bw * 0.3, by + bw * 0.4); c.lineTo(bx + bw * 0.3, by + bw * 0.9); c.stroke();
  c.fillStyle = '#e2453a'; c.beginPath(); c.moveTo(bx + bw * 0.08, by + bw * 0.44); c.quadraticCurveTo(bx + bw * 0.3, by + bw * 0.16, bx + bw * 0.52, by + bw * 0.44); c.fill();
  c.restore();
  // text
  const tx = bx + bw + pad * 1.6, tw = w - tx - pad;
  c.fillStyle = '#c8322a'; c.textBaseline = 'top';
  const fit = (text, weight, size) => { let s = size; do { c.font = `${weight} ${s}px Kanit, sans-serif`; s -= 2; } while (c.measureText(text).width > tw && s > 20); };
  fit(t('roadClosedTitle'), 600, Math.round(h * 0.26)); c.fillText(t('roadClosedTitle'), tx, h * 0.12);
  c.fillStyle = '#3a3228';
  fit(t('roadClosedLine'), 500, Math.round(h * 0.16)); c.fillText(t('roadClosedLine'), tx, h * 0.44);
  c.fillStyle = '#d8743a';
  fit(`↩ ${t('roadClosedBack')}`, 600, Math.round(h * 0.17)); c.fillText(`↩ ${t('roadClosedBack')}`, tx, h * 0.68);
  c.strokeStyle = PROPS.sign.edge; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
}

/** A friendly toast the first time the kid walks up to a barrier (and again after leaving). */
export function createRoadblockNotice(spots, player, toast) {
  const N = ROADBLOCK.notice, armed = spots.map(() => true);
  let wait = 0;
  return dt => {
    const { x, z } = player.state;
    wait -= dt;
    spots.forEach((p, i) => {
      const d = Math.hypot(x - p.x, z - p.z);
      if (armed[i] && d < N.dist) { armed[i] = false; if (wait <= 0) { toast(t('roadClosedToast')); wait = N.cooldown; } }
      else if (!armed[i] && d > N.again) armed[i] = true;
    });
  };
}
