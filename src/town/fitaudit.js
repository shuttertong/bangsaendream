// How well does everything on the map sit on the ground? (debug: __game.auditFit())
// The map is scanned from straight above in square tiles; three height pictures are taken of each tile
// with the same camera — the ground (terrain + road surfaces), the lowest point of every object and
// the highest point of every object — and compared pixel by pixel. (A wall or a trunk seen from straight
// above is a line: its foot is read from a second, wireframe picture, where the bottom edge of a box or
// a tube shows at its true height; filled triangles alone read the foot of anything steep too high.)
//   • floating   a whole object (a connected patch of object pixels) that touches the ground nowhere;
//   • near miss  an outline that stops a little short of the ground (FIT.near above it): legs in the air on
//                a slope, a wall or a slab whose foot shows daylight. Measured in metres of outline — the
//                underside of something whose sides do reach the ground cannot be seen and is not counted;
//   • wall gap   the foot of something tall (a wall, a building, a pier) that ends well above the ground along
//                its outline (FIT.wall): daylight under a building on a slope. Also in metres of outline;
//   • swallowed  parts of a low object (paving, a slab, a kerb) that the ground rises over;
//   • on air / sunk  bare ground where the surface the kid walks on (opts.walk) is above or below the ground that
//                is drawn by more than FIT.step — feet in the air beside a road, or legs in a bank.
// Things that are meant to clear the ground by more than FIT.near[1] (chair seats, cart bodies, roofs,
// cables) are not counted, and objects over water are measured from the sea's surface.
// It reads pixels back from the GPU, so it is slow (tens of seconds for the whole map) — a tool, not
// something the game runs.
import * as THREE from 'three';

export const FIT = {
  tile: 64, px: 640, margin: 4,           // metres a tile covers, pixels across it, metres of overlap looked at but not reported
  touch: 0.05,                            // an object "touches" where its underside is within this of the ground (or below it)
  near: [0.05, 0.22],                     // a near miss: this far above the ground
  floatMax: 6,                            // a floating patch counts up to this height (higher: kites, cables in the distance …)
  minArea: 0.12,                          // m²: smaller patches are ignored (the few pixels a thin rod, rail or cable leaves)
  minEdge: 0.3,                           // m of outline short of the ground before an object is reported as a near miss
  wall: { gap: [0.22, 1.5], tall: 1.6 },  // a wall gap: the foot this far above the ground, under a body at least this tall there (furniture is lower or thinner)
  swallow: 0.03, low: 0.6,                // swallowed: the ground is this far above the top of an object that stands less than `low` tall
  step: 0.08, every: 4,                   // walk surface vs drawn ground: the difference that counts, and every how many pixels it is sampled
  top: 40,                                // findings kept per kind
};

const VERT = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
varying float vY;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  wp = modelMatrix * wp;
  vY = wp.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = /* glsl */`varying float vY; void main() { gl_FragColor = vec4(vY, 1.0, 0.0, 1.0); }`;

/** kinds: mesh → 'ground' | 'object' | null (left out: the sea, the sky). inArea(x, z, tile): is this spot worth scanning.
 *  always: meshes to scan even when hidden right now (the distance culler hides far map chunks). */
export function createFitAudit({ renderer, scene, map, kinds, inArea, always = new Set(), walk = null }) {
  const N = FIT.px, span = FIT.tile + FIT.margin * 2, cell = span / N;
  const rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const mat = (depthFunc) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, depthFunc, fog: false, toneMapped: false });
  const upper = mat(THREE.LessEqualDepth), lower = mat(THREE.GreaterEqualDepth), wire = mat(THREE.GreaterEqualDepth);
  wire.wireframe = true;
  const cam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 1, 2000);
  cam.up.set(0, 0, -1);
  const buf = [0, 1, 2, 3].map(() => new Float32Array(N * N * 4));
  const NONE = -9000;

  function shoot(out, material, clearDepth) {
    scene.overrideMaterial = material;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.state.buffers.depth.setClear(clearDepth);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, N, N, out);
  }

  /** One tile centred on (cx, cz) → findings. */
  function tile(cx, cz, sets) {
    cam.position.set(cx, 1000, cz); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld();
    const show = on => { for (const m of sets.ground) m.visible = on === 'ground'; for (const m of sets.object) m.visible = on === 'object'; };
    show('ground'); shoot(buf[0], upper, 1);
    show('object'); shoot(buf[1], upper, 1); shoot(buf[2], lower, 0); shoot(buf[3], wire, 0);
    const G = buf[0], HI = buf[1], LO = buf[2], EDGE = buf[3], sea = map.sea, found = [];
    // per pixel: gap under the object (NONE where there is none)
    const gap = new Float32Array(N * N), label = new Int32Array(N * N);
    let nearPx = 0;
    for (let k = 0; k < N * N; k++) {
      const tri = LO[k * 4 + 1] > 0.5, line = EDGE[k * 4 + 1] > 0.5;
      if (!tri && !line) { gap[k] = NONE; continue; }
      const g = Math.max(G[k * 4 + 1] > 0.5 ? G[k * 4] : sea, sea);
      gap[k] = (tri && line ? Math.min(LO[k * 4], EDGE[k * 4]) : tri ? LO[k * 4] : EDGE[k * 4]) - g;
    }
    // connected patches of object pixels (4-neighbours, flood fill)
    const stack = [], core = (i, j) => i >= m0 && i < N - m0 && j >= m0 && j < N - m0, m0 = Math.round(FIT.margin / cell);
    let id = 0;
    const floats = new Set();
    for (let s = 0; s < N * N; s++) {
      if (gap[s] === NONE || label[s]) continue;
      id++; label[s] = id; stack.push(s);
      let n = 0, min = Infinity, sum = 0, sx = 0, sz = 0, edge = false, near = 0, hiMax = -Infinity, swal = 0, tall = 0, wall = 0;
      while (stack.length) {
        const k = stack.pop(), i = k % N, j = (k - i) / N, d = gap[k];
        n++; sx += i; sz += j; sum += d; if (d < min) min = d;
        if (i === 0 || j === 0 || i === N - 1 || j === N - 1) edge = true;
        const outline = d > FIT.near[0] && ((i > 0 && gap[k - 1] === NONE) || (i < N - 1 && gap[k + 1] === NONE) || (j > 0 && gap[k - N] === NONE) || (j < N - 1 && gap[k + N] === NONE));   // next to bare ground: where a gap shows
        if (outline && d < FIT.near[1]) near++;
        const g = Math.max(G[k * 4 + 1] > 0.5 ? G[k * 4] : sea, sea), h = (HI[k * 4 + 1] > 0.5 ? HI[k * 4] : EDGE[k * 4]) - g;
        if (h > hiMax) hiMax = h;
        if (outline && d >= FIT.wall.gap[0] && d < FIT.wall.gap[1] && h - d > FIT.wall.tall) wall++;
        if (h < -FIT.swallow) swal++;
        if (h > FIT.low) tall++;
        if (i > 0 && gap[k - 1] !== NONE && !label[k - 1]) { label[k - 1] = id; stack.push(k - 1); }
        if (i < N - 1 && gap[k + 1] !== NONE && !label[k + 1]) { label[k + 1] = id; stack.push(k + 1); }
        if (j > 0 && gap[k - N] !== NONE && !label[k - N]) { label[k - N] = id; stack.push(k - N); }
        if (j < N - 1 && gap[k + N] !== NONE && !label[k + N]) { label[k + N] = id; stack.push(k + N); }
      }
      const ci = sx / n, cj = sz / n, area = n * cell * cell;
      if (!core(ci, cj) || area < FIT.minArea) continue;
      const x = cx - span / 2 + (ci + 0.5) * cell, z = cz + span / 2 - (cj + 0.5) * cell,   // (pixel rows run from the south edge up)
         at = { x: +x.toFixed(1), z: +z.toFixed(1), area: +area.toFixed(2) };
      nearPx += near;
      if (!edge && min > FIT.touch && min < FIT.floatMax) { floats.add(id); found.push({ kind: 'float', ...at, gap: +min.toFixed(2), top: +hiMax.toFixed(2) }); }
      else if (near * cell >= FIT.minEdge && min <= FIT.touch) found.push({ kind: 'near', ...at, short: +(near * cell).toFixed(1), top: +hiMax.toFixed(2) });
      if (wall * cell >= FIT.minEdge) found.push({ kind: 'wall', ...at, short: +(wall * cell).toFixed(1), top: +hiMax.toFixed(2) });
      if (!edge && tall === 0 && swal * cell * cell >= FIT.minArea && swal < n) found.push({ kind: 'swallowed', ...at, under: +(swal * cell * cell).toFixed(2), top: +hiMax.toFixed(2) });
    }
    // the walk surface against the drawn ground, on bare ground (walk(x, z) → height the kid stands at, or null where it cannot go)
    const w = { n: 0, air: 0, sunk: 0 };
    if (walk) for (let j = 0; j < N; j += FIT.every) for (let i = 0; i < N; i += FIT.every) {
      const k = j * N + i;
      if (gap[k] !== NONE || G[k * 4 + 1] < 0.5 || !core(i, j)) continue;
      const y = walk(cx - span / 2 + (i + 0.5) * cell, cz + span / 2 - (j + 0.5) * cell);
      if (y == null) continue;
      w.n++;
      if (y - G[k * 4] > FIT.step) w.air++; else if (G[k * 4] - y > FIT.step) w.sunk++;
    }
    return { found, near: nearPx * cell, gap, label, floats, walk: w };
  }

  /** Scan the map (or opts.box = [x0, z0, x1, z1]; opts.filter: only its tiles worth scanning). Returns totals and the worst findings of each kind. */
  function run(opts = {}) {
    const sets = { ground: [], object: [] }, vis = new Map();
    scene.traverse(o => {
      if (!o.isMesh && !o.isLine && !o.isPoints) return;
      vis.set(o, o.visible);
      const k = o.visible || always.has(o) ? kinds(o) : null;
      if (k) sets[k].push(o); else o.visible = false;
    });
    const keep = { target: renderer.getRenderTarget(), over: scene.overrideMaterial, fog: scene.fog, bg: scene.background, auto: renderer.shadowMap.autoUpdate };
    scene.fog = null; renderer.shadowMap.autoUpdate = false;
    const { x0, z0 } = map.core, x1 = x0 + map.size.w, z1 = z0 + map.size.d, box = opts.box || [x0, z0, x1, z1];
    const all = [], t0 = performance.now();
    let tiles = 0, nearEdge = 0;
    const wk = { n: 0, air: 0, sunk: 0 };
    for (let cz = box[1] + FIT.tile / 2; cz < box[3] + FIT.tile / 2; cz += FIT.tile) for (let cx = box[0] + FIT.tile / 2; cx < box[2] + FIT.tile / 2; cx += FIT.tile) {
      if ((!opts.box || opts.filter) && !inArea(cx, cz, FIT.tile)) continue;   // (a box is scanned whole unless opts.filter)
      const r = tile(cx, cz, sets);
      tiles++; nearEdge += r.near; all.push(...r.found);
      wk.n += r.walk.n; wk.air += r.walk.air; wk.sunk += r.walk.sunk;
    }
    for (const [o, v] of vis) o.visible = v;
    scene.overrideMaterial = keep.over; scene.fog = keep.fog; renderer.shadowMap.autoUpdate = keep.auto;
    renderer.state.buffers.depth.setClear(1);
    renderer.setRenderTarget(keep.target);
    const by = k => all.filter(f => f.kind === k);
    const worst = (k, key) => by(k).sort((a, b) => b[key] - a[key]).slice(0, opts.top || FIT.top);
    return {
      tiles, secs: +((performance.now() - t0) / 1000).toFixed(1),
      floating: by('float').length, near: by('near').length, nearEdge: +nearEdge.toFixed(1), walls: by('wall').length, wallEdge: +by('wall').reduce((a, f) => a + f.short, 0).toFixed(1), swallowed: by('swallowed').length,
      walk: wk,                                                        // samples of bare walkable ground; of them on air / sunk
      worst: { float: worst('float', 'area'), near: worst('near', 'short'), wall: worst('wall', 'short'), swallowed: worst('swallowed', 'under') },
      all,
    };
  }

  /** A picture of one tile for looking at findings (a canvas, north up): grey = touching, red = near miss, orange = up to 1 m clear,
   *  pale blue = higher, purple = a floating object, green = ground with nothing on it. */
  function picture(cx, cz) {
    const sets = { ground: [], object: [] }, vis = new Map();
    scene.traverse(o => { if (!o.isMesh && !o.isLine && !o.isPoints) return; vis.set(o, o.visible); const k = o.visible || always.has(o) ? kinds(o) : null; if (k) sets[k].push(o); else o.visible = false; });
    const keep = { target: renderer.getRenderTarget(), fog: scene.fog, auto: renderer.shadowMap.autoUpdate };
    scene.fog = null; renderer.shadowMap.autoUpdate = false;
    const r = tile(cx, cz, sets);
    for (const [o, v] of vis) o.visible = v;
    scene.overrideMaterial = null; scene.fog = keep.fog; renderer.shadowMap.autoUpdate = keep.auto;
    renderer.state.buffers.depth.setClear(1); renderer.setRenderTarget(keep.target);
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = (N - 1 - j) * N + i, o = (j * N + i) * 4, g = r.gap[k];
      const c = g === NONE ? [206, 226, 196] : r.floats.has(r.label[k]) ? [150, 40, 200] : g <= FIT.near[0] ? [90, 90, 90] : g < FIT.near[1] ? [230, 30, 30] : g < 1 ? [240, 160, 40] : [170, 200, 235];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /** The raw heights at one spot (debug): the ground, the lowest and highest object surface, and the lowest edge. */
  function probe(x, z) {
    const sets = { ground: [], object: [] }, vis = new Map();
    scene.traverse(o => { if (!o.isMesh && !o.isLine && !o.isPoints) return; vis.set(o, o.visible); const k = o.visible || always.has(o) ? kinds(o) : null; if (k) sets[k].push(o); else o.visible = false; });
    const keep = { target: renderer.getRenderTarget(), fog: scene.fog, auto: renderer.shadowMap.autoUpdate };
    scene.fog = null; renderer.shadowMap.autoUpdate = false;
    tile(x, z, sets);
    for (const [o, v] of vis) o.visible = v;
    scene.overrideMaterial = null; scene.fog = keep.fog; renderer.shadowMap.autoUpdate = keep.auto;
    renderer.state.buffers.depth.setClear(1); renderer.setRenderTarget(keep.target);
    const k = (N >> 1) * N + (N >> 1), v = b => (b[k * 4 + 1] > 0.5 ? +b[k * 4].toFixed(3) : null);
    return { ground: v(buf[0]), high: v(buf[1]), low: v(buf[2]), edge: v(buf[3]) };
  }

  return { run, tile, picture, probe };
}
