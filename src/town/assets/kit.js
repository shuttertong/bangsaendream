// Geometry kit: collects static geometry into per-material vertex buffers, split into
// map chunks so chunks that are off screen are culled. One draw call per
// (chunk, material). Colour is baked into vertices.
import * as THREE from 'three';
import { getMaterial } from '../../world/materials.js';

const CHUNK = 384;

/** Growable typed buffer: the kit holds millions of vertices, so it never uses plain JS arrays
 *  (64-bit numbers, and a second copy when the mesh is made). Normals and colours are stored
 *  as normalized 16-bit integers: 24 bytes a vertex instead of 36 on the GPU (and 72 while building). */
class Buf {
  constructor(Type, scale = 1) { this.Type = Type; this.scale = scale; this.a = new Type(3 * 2048); this.n = 0; }
  push3(x, y, z) {
    if (this.n + 3 > this.a.length) { const b = new this.Type(this.a.length * 2); b.set(this.a); this.a = b; }
    const k = this.scale;
    this.a[this.n] = x * k; this.a[this.n + 1] = y * k; this.a[this.n + 2] = z * k;
    this.n += 3;
  }
  /** A BufferAttribute over exactly the used part (copied once, so the spare capacity is freed). */
  attribute() { return new THREE.BufferAttribute(this.a.slice(0, this.n), 3, this.scale !== 1); }
}
/** Once a static attribute is on the GPU, drop its JS copy (nothing reads the town geometry back). */
function freeAfterUpload() { this.array = new this.array.constructor(0); }
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// shared unit primitives (non-indexed so they append directly)
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8, 1).toNonIndexed();
const CYL_OPEN = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).toNonIndexed();

export class Kit {
  constructor() { this.buckets = new Map(); this.tris = 0; }

  _bucket(mat, x, z) {
    const key = `${mat}|${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, b = { mat, pos: new Buf(Float32Array), nrm: new Buf(Int16Array, 32767), col: new Buf(Uint16Array, 65535) });
    return b;
  }

  /**
   * Append a geometry transformed by `matrix`. `color` is a THREE.Color / hex, or a
   * function (x, y, z, nx, ny, nz) → Color for per-vertex colour. The chunk is chosen
   * from `at` (default: the matrix translation) so an object is never split.
   */
  add(mat, geo, matrix, color, at) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    const tx = at ? at.x : matrix.elements[12], tz = at ? at.z : matrix.elements[14];
    const b = this._bucket(mat, tx, tz);
    _n.getNormalMatrix(matrix);
    const fn = typeof color === 'function' ? color : null;
    if (!fn) _c.set(color);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      b.pos.push3(_v.x, _v.y, _v.z);
      const x = _v.x, y = _v.y, z = _v.z;
      _v.fromBufferAttribute(n, i).applyMatrix3(_n).normalize();
      b.nrm.push3(_v.x, _v.y, _v.z);
      const c = fn ? fn(x, y, z, _v.x, _v.y, _v.z) : _c;
      b.col.push3(Math.min(1, Math.max(0, c.r)), Math.min(1, Math.max(0, c.g)), Math.min(1, Math.max(0, c.b)));
    }
    this.tris += p.count / 3;
  }

  /** Axis box centred at (x, y, z) with size (sx, sy, sz), rotated `ry` about Y. */
  box(mat, x, y, z, sx, sy, sz, ry, color) {
    _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(_up, ry || 0), _s.set(sx, sy, sz));
    this.add(mat, BOX, _m, color);
  }

  /** Cylinder rod from point a to point b with radius r. */
  rod(mat, a, b, r, color, open = false) {
    const d = _s.subVectors(b, a), len = d.length();
    _q.setFromUnitVectors(_up, d.normalize());
    _m.compose(_v.addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(r, len, r));
    this.add(mat, open ? CYL_OPEN : CYL, _m, color);
  }

  /** Raw triangles: flat array of [x,y,z]*3 per triangle; normals are computed. */
  tris3(mat, verts, color, at) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    this.add(mat, g, _m.identity(), color, at || { x: verts[0], z: verts[2] });
  }

  /**
   * Local frame at (x, y, z) turned `ry` about Y: u = right, v = up, w = front.
   * Lets building parts be written in facade coordinates.
   */
  frame(x, y, z, ry) {
    const c = Math.cos(ry), s = Math.sin(ry), kit = this;
    const P = (u, v, w) => new THREE.Vector3(x + u * c + w * s, y + v, z - u * s + w * c);
    return {
      P,
      box(mat, u, v, w, sx, sy, sz, color, rot = 0) { const p = P(u, v, w); kit.box(mat, p.x, p.y, p.z, sx, sy, sz, ry + rot, color); },
      rod(mat, a, b, r, color) { kit.rod(mat, P(...a), P(...b), r, color); },
      tris(mat, local, color) {
        const out = [];
        for (let i = 0; i < local.length; i += 3) { const p = P(local[i], local[i + 1], local[i + 2]); out.push(p.x, p.y, p.z); }
        kit.tris3(mat, out, color, { x, z });
      },
      /** Two-sided: adds each triangle again with reversed winding (thin awnings). */
      tris2(mat, local, color) {
        const back = [];
        for (let i = 0; i < local.length; i += 9) back.push(...local.slice(i, i + 3), ...local.slice(i + 6, i + 9), ...local.slice(i + 3, i + 6));
        this.tris(mat, local.concat(back), color);
      },
    };
  }

  /** Build meshes: one per (chunk, material). */
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const b of this.buckets.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', b.pos.attribute());
      g.setAttribute('normal', b.nrm.attribute());
      g.setAttribute('color', b.col.attribute());
      g.computeBoundingSphere();                                   // (needs the positions: before they are freed)
      for (const a of Object.values(g.attributes)) a.onUpload(freeAfterUpload);
      const mesh = new THREE.Mesh(g, getMaterial(b.mat));
      mesh.castShadow = castShadow && b.mat !== 'road' && b.mat !== 'lit';
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.buckets.clear();                                          // the build buffers are no longer needed
    return group;
  }
}
