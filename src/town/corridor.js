// The ground beside roads, drawn where the kid walks.
// map.heightAt gives every road a corridor — the surface itself, a level shoulder, then an ease back to the
// terrain (grading.js) — but the terrain mesh is an 8 m grid, which cannot hold that shape on a slope: on the
// downhill side the walk surface hung in the air above the drawn ground (the kid, posts and trees floated beside
// hill roads), on the uphill side the drawn ground rose through it. roadPatches() finds the terrain cells where
// the two differ and gives each a fine patch of heights taken from map.heightAt; terrain.js draws those patches in
// place of the cells' two coarse triangles. Where a 2 m patch is still too coarse for the shape (the edge of a road
// across a steep slope) the cell gets a 1 m patch. An edge that meets an untouched cell keeps the grid's own
// heights, and a 1 m edge that meets a 2 m one keeps to its line, so the mesh stays watertight.
export const CORRIDOR = {
  n: [4, 8],       // a patch is n × n squares: 2 m, or 1 m where 2 m misses the shape by more than `fine`
  fine: 0.07,
  tol: 0.06,       // a cell is patched when the walk surface and the grid differ by more than this beside a road…
  beside: 0.3,     // …measured from this far outside the road's edge (under the road the grid is kept low on purpose)
  under: 0.05,     // under the road itself the patch stays this far below the walk surface (the road ribbon lies on top)
  reach: 7,        // metres beyond a road's edge that are looked at (grading's verge is 5.5)
};

/** → { cells: Map(cell index → Float32Array((n+1)²) of heights, rows north to south; n from its length), count, fine }.
 *  Cell index = j * (nx − 1) + i. fineToo: false = 2 m patches only (the low picture level: fewer triangles). */
export function roadPatches(map, fineToo = true) {
  const C = CORRIDOR, [n4, n8] = C.n, { x0, z0, step, nx, nz } = map.core, cx = nx - 1, cz = nz - 1;
  const cells = new Map();
  if (!map.roadSamples || !map.groundAt || !map.roadSurface) return { cells, count: 0, fine: 0 };
  // candidate cells: within reach of a graded road
  const cand = new Uint8Array(cx * cz);
  for (const s of map.roadSamples) {
    const r = s.hw + C.reach, i0 = Math.max(0, Math.floor((s.x - r - x0) / step)), i1 = Math.min(cx - 1, Math.floor((s.x + r - x0) / step));
    const j0 = Math.max(0, Math.floor((s.z - r - z0) / step)), j1 = Math.min(cz - 1, Math.floor((s.z + r - z0) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cand[j * cx + i] = 1;
  }
  /** The height a patch has at (x, z): the walk surface, a little lower under the road itself. */
  const patchAt = (x, z) => { const sf = map.roadSurface(x, z), h = map.heightAt(x, z); return sf && sf.e <= 0 ? h - C.under : h; };
  const sample = (i, j, n) => {
    const m = n + 1, f = step / n, h = new Float32Array(m * m);
    for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) h[b * m + a] = patchAt(x0 + i * step + a * f, z0 + j * step + b * f);
    return h;
  };
  // which of them differ from the grid, and how fine each must be
  const res = new Uint8Array(cx * cz);                                // 0 = untouched, else the patch's n
  for (let k = 0; k < cand.length; k++) {
    if (!cand[k]) continue;
    const i = k % cx, j = (k - i) / cx, m = n4 + 1, f = step / n4;
    let differs = false;
    for (let b = 0; b < m && !differs; b++) for (let a = 0; a < m; a++) {
      const x = x0 + i * step + a * f, z = z0 + j * step + b * f, sf = map.roadSurface(x, z);
      if (sf && sf.e > C.beside && Math.abs(map.heightAt(x, z) - map.groundAt(x, z)) > C.tol) { differs = true; break; }
    }
    if (!differs) continue;
    const h = sample(i, j, n4);
    let rough = false;                                               // does a 2 m square miss the surface at its middle (on its diagonal)?
    for (let b = 0; b < n4 && !rough; b++) for (let a = 0; a < n4; a++) {
      if (Math.abs((h[(b + 1) * m + a] + h[b * m + a + 1]) / 2 - patchAt(x0 + i * step + (a + 0.5) * f, z0 + j * step + (b + 0.5) * f)) > C.fine) { rough = true; break; }
    }
    res[k] = rough && fineToo ? n8 : n4;
    cells.set(k, rough && fineToo ? sample(i, j, n8) : h);
  }
  // edges: against an untouched cell, the grid's own heights; a fine edge against a coarser one keeps to its line
  const at = (i, j) => (i >= 0 && j >= 0 && i < cx && j < cz ? res[j * cx + i] : 0);
  let fine = 0;
  for (const [k, h] of cells) {
    const i = k % cx, j = (k - i) / cx, n = res[k], m = n + 1, f = step / n;
    if (n === n8) fine++;
    const side = { w: at(i - 1, j), e: at(i + 1, j), n: at(i, j - 1), s: at(i, j + 1) };
    const corner = (di, dj) => !at(i + di, j + dj) || !at(i + di, j) || !at(i, j + dj);   // any of the corner's other three cells untouched
    const grid = (a, b) => map.groundAt(x0 + i * step + a * f, z0 + j * step + b * f);
    for (const [a, b] of [[0, 0], [n, 0], [0, n], [n, n]]) if (corner(a === 0 ? -1 : 1, b === 0 ? -1 : 1)) h[b * m + a] = grid(a, b);
    for (let t = 1; t < n; t++) for (const [a, b, nb, da, db] of [[0, t, side.w, 0, 1], [n, t, side.e, 0, 1], [t, 0, side.n, 1, 0], [t, n, side.s, 1, 0]]) {
      if (!nb) h[b * m + a] = grid(a, b);
      else if (nb < n && t % 2) h[b * m + a] = NaN;                  // (an odd point of a 1 m edge beside a 2 m cell: set below, from its two neighbours)
    }
    for (let t = 1; t < n; t += 2) for (const [a, b, da, db] of [[0, t, 0, 1], [n, t, 0, 1], [t, 0, 1, 0], [t, n, 1, 0]]) {
      if (Number.isNaN(h[b * m + a])) h[b * m + a] = (h[(b - db) * m + a - da] + h[(b + db) * m + a + da]) / 2;
    }
  }
  return { cells, count: cells.size, fine };
}
