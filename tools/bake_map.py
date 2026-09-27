#!/usr/bin/env python3
"""Bake OpenStreetMap + Terrarium elevation into the game's map files.

Writes src/town/data/bangsaen.json and src/town/data/bangsaen-core.bin
(Int16 heights in decimetres of real metres, row-major, rows north -> south).
Standard library only. Raw downloads are cached in tools/.cache/.

    python3 tools/bake_map.py --lat 13.2950 --lon 100.9100 --half 2400 --step 8 --inland 100
"""
import argparse, hashlib, json, math, struct, sys, time, urllib.parse, urllib.request, zlib
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'tools' / '.cache'
OUT = ROOT / 'src' / 'town' / 'data'
OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]
TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
UA = {'User-Agent': 'bangsaen-game-bake/1.0'}

ROAD_KINDS = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified',
              'service', 'living_street', 'pedestrian', 'track', 'footway', 'path', 'cycleway', 'steps'}
AREA_KINDS = {'beach', 'sand', 'wood', 'scrub', 'grassland', 'park', 'pitch', 'garden', 'water', 'parking',
              'residential', 'commercial', 'retail', 'farmland', 'cemetery', 'school', 'university'}
TALL = {'hotel', 'apartments', 'condominium'}
SEA = 0.4          # sea level in scene units
# Corridors reach beyond the coastal strip: every highway matching `ref` / `name` / `box` (local x0, x1,
# z0, z1) becomes walkable `walk` m either side, and features within `keep` m of it are baked too.
CORRIDORS = [
    {'n': 'road3137', 'ref': '3137', 'walk': 22, 'keep': 40},                          # ถนนลงหาดบางแสน + บางแสนสาย 2
    {'n': 'khaosammuk', 'box': [-1100, -100, -2480, -1250], 'walk': 14, 'keep': 30,   # the roads round and up the hill
     'kinds': ['secondary', 'tertiary', 'residential', 'unclassified', 'service', 'living_street', 'footway', 'path', 'steps']},
    # coastal links the 100 m cut breaks: ถนนบางแสนสาย 1 (Laem Thaen → Khao Sam Muk) dips to 106 m from the sea;
    # ถนนรอบเขาสามมุข ซอย 1 → ถนนอ่างศิลา (3134) runs up to 160 m inland. Roads only ('bare': no buildings).
    {'n': 'coastlink', 'ways': [1211716733, 154842388, 193124279, 472797692], 'walk': 12, 'keep': 12, 'bare': True},
]
SIMPLIFY = 0.5     # Douglas-Peucker tolerance (m)


# ---------- download helpers ----------
def fetch(url, data=None, timeout=120):
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def cached(name, producer, refresh):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / name
    if f.exists() and not refresh:
        return f.read_bytes()
    blob = producer()
    f.write_bytes(blob)
    return blob


def load_osm(bb, refresh):
    b = f"{bb['s']},{bb['w']},{bb['n']},{bb['e']}"
    q = (f'[out:json][timeout:120];(way["building"]({b});way["highway"]({b});way["natural"]({b});'
         f'way["landuse"]({b});way["leisure"]({b});way["waterway"]({b});way["amenity"="parking"]({b}););out geom;')
    key = hashlib.sha1(q.encode()).hexdigest()[:12]

    def producer():
        body = urllib.parse.urlencode({'data': q}).encode()
        for attempt in range(3):
            for url in OVERPASS:
                try:
                    print(f'  overpass: {url}', file=sys.stderr)
                    blob = fetch(url, body, timeout=180)
                    json.loads(blob)  # validate before caching
                    return blob
                except Exception as e:  # busy mirror -> try the next one
                    print(f'    failed: {e}', file=sys.stderr)
            time.sleep(10 * (attempt + 1))
        sys.exit('Could not reach any Overpass mirror. Try again later.')

    return json.loads(cached(f'osm-{key}.json', producer, refresh))['elements']


# ---------- PNG decode (8-bit RGB/RGBA, non-interlaced) ----------
def decode_png(blob):
    assert blob[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    pos, idat = 8, []
    while pos < len(blob):
        ln, typ = struct.unpack('>I4s', blob[pos:pos + 8])
        chunk = blob[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, depth, ctype, _, _, interlace = struct.unpack('>IIBBBBB', chunk)
            assert depth == 8 and ctype in (2, 6) and interlace == 0, 'unsupported PNG'
        elif typ == b'IDAT':
            idat.append(chunk)
        pos += 12 + ln
    bpp = 3 if ctype == 2 else 4
    raw, stride = zlib.decompress(b''.join(idat)), w * bpp
    out, prev = bytearray(h * stride), bytearray(stride)
    for y in range(h):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b, c = prev[i], (prev[i - bpp] if i >= bpp else 0)
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, bpp, out


def lon2t(lon, z): return (lon + 180) / 360 * 2 ** z
def lat2t(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z


def load_elevation(cfg, bb, refresh):
    z = cfg.zoom
    x0, x1 = int(lon2t(bb['w'], z)), int(lon2t(bb['e'], z))
    y0, y1 = int(lat2t(bb['n'], z)), int(lat2t(bb['s'], z))
    tiles = {}
    for tx in range(x0, x1 + 1):
        for ty in range(y0, y1 + 1):
            url = TERRARIUM.format(z=z, x=tx, y=ty)
            blob = cached(f'terrarium-{z}-{tx}-{ty}.png', lambda u=url: fetch(u), refresh)
            w, h, bpp, px = decode_png(blob)
            tiles[(tx, ty)] = [px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768
                               for k in range(0, w * h * bpp, bpp)]

    def metres(gx, gy):  # global pixel coords at zoom z
        tx, ty = gx // 256, gy // 256
        t = tiles.get((tx, ty))
        if t is None:
            tx, ty = min(max(tx, x0), x1), min(max(ty, y0), y1)
            gx, gy = min(max(gx, x0 * 256), x1 * 256 + 255), min(max(gy, y0 * 256), y1 * 256 + 255)
            t = tiles[(tx, ty)]
        return t[(gy - ty * 256) * 256 + (gx - tx * 256)]

    n = cfg.n
    hts = [0.0] * (n * n)
    for j in range(n):
        for i in range(n):
            x, zz = -cfg.half + i * cfg.step, -cfg.half + j * cfg.step
            lon, lat = cfg.lon + x / cfg.mx, cfg.lat - zz / cfg.mz
            fx, fy = lon2t(lon, z) * 256 - 0.5, lat2t(lat, z) * 256 - 0.5
            ix, iy = math.floor(fx), math.floor(fy)
            a, b = fx - ix, fy - iy
            v = ((metres(ix, iy) * (1 - a) + metres(ix + 1, iy) * a) * (1 - b)
                 + (metres(ix, iy + 1) * (1 - a) + metres(ix + 1, iy + 1) * a) * b)
            hts[j * n + i] = max(-12.0, v)
    return hts


# ---------- coastline ----------
class Coast:
    """Nearest-coastline lookup. OSM coastlines have land on the LEFT.
    Works in (east, north) = (x, -z)."""
    CELL = 64.0

    def __init__(self, coast):
        self.grid = {}
        for c in coast:
            p = c['p']
            for k in range(1, len(p)):
                s = (p[k - 1][0], -p[k - 1][1], p[k][0], -p[k][1])
                for gx in range(self._c(min(s[0], s[2])), self._c(max(s[0], s[2])) + 1):
                    for gy in range(self._c(min(s[1], s[3])), self._c(max(s[1], s[3])) + 1):
                        self.grid.setdefault((gx, gy), []).append(s)

    def _c(self, v):
        return int(math.floor(v / self.CELL))

    def nearest(self, x, z):
        """(distance in m, +1 land / -1 sea) for scene point (x, z); (inf, 1) without coast."""
        px, py = x, -z
        cx, cy = self._c(px), self._c(py)
        best, side, bestn, r = math.inf, 1.0, -1.0, 0
        while self.grid and r < 200:
            for gx in range(cx - r, cx + r + 1):
                for gy in range(cy - r, cy + r + 1):
                    if max(abs(gx - cx), abs(gy - cy)) != r:
                        continue
                    for ax, ay, bx, by in self.grid.get((gx, gy), ()):
                        dx, dy = bx - ax, by - ay
                        L = dx * dx + dy * dy or 1.0
                        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
                        d = (ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2
                        cr = dx * (py - ay) - dy * (px - ax)
                        nrm = abs(cr) / math.sqrt(L)
                        # ties at a shared vertex: trust the segment the point is most "beside"
                        if d < best - 1e-6 or (abs(d - best) <= 1e-6 and nrm > bestn):
                            best, side, bestn = d, cr, nrm
            if best < math.inf and math.sqrt(best) <= r * self.CELL:
                break
            r += 1
        return math.sqrt(best), (1 if side >= 0 else -1)


def apply_coast_mask(cfg, hts, coast):
    """Sea vs land from the OSM coastline, with a continuous shore profile so the
    waterline sits exactly on the coastline (no grid staircase)."""
    if not coast.grid:
        print('  warning: no coastline in area, mask skipped', file=sys.stderr)
        return
    sea = SEA / cfg.hscale          # sea level in real metres
    n = cfg.n
    for j in range(n):
        for i in range(n):
            d, side = coast.nearest(-cfg.half + i * cfg.step, -cfg.half + j * cfg.step)
            k = j * n + i
            if side < 0:
                hts[k] = min(hts[k], sea - min(12.0, d * 0.05))
            else:
                # SRTM-style DEMs include canopy/roofs: remove the bias, then keep the
                # beach between a gentle floor and a slope cap that relaxes after ~25 m
                floor = sea + min(0.8, d * 0.04)
                cap = sea + 0.5 + d * 0.12 + max(0.0, d - 25) * 2.0
                hts[k] = min(max(hts[k] - cfg.dem_bias, floor), cap)


def densify(p, step=10.0):
    out = [p[0]]
    for a, b in zip(p, p[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / step))
        out += [[a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n] for t in range(1, n + 1)]
    return out


class Lines:
    """Nearest-distance lookup to a set of polylines (corridor centre lines)."""
    CELL = 64.0

    def __init__(self):
        self.grid = {}

    def add(self, p, reach):
        for a, b in zip(p, p[1:]):
            s = (a[0], a[1], b[0], b[1], reach)
            for gx in range(int(math.floor((min(a[0], b[0]) - reach) / self.CELL)), int(math.floor((max(a[0], b[0]) + reach) / self.CELL)) + 1):
                for gz in range(int(math.floor((min(a[1], b[1]) - reach) / self.CELL)), int(math.floor((max(a[1], b[1]) + reach) / self.CELL)) + 1):
                    self.grid.setdefault((gx, gz), []).append(s)

    def within(self, x, z):
        """True if (x, z) is within its segment's `reach` of any line."""
        for ax, az, bx, bz, reach in self.grid.get((int(math.floor(x / self.CELL)), int(math.floor(z / self.CELL))), ()):
            dx, dz = bx - ax, bz - az
            t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz or 1.0)))
            if (ax + t * dx - x) ** 2 + (az + t * dz - z) ** 2 <= reach * reach:
                return True
        return False


def corridor_lines(els, xz, half):
    """The centre lines of every CORRIDORS match, clipped to the map square (and the corridor's box)."""
    out = []
    for e in els:
        t, geo = e.get('tags') or {}, e.get('geometry')
        if not geo or t.get('highway') not in ROAD_KINDS:
            continue
        p = [xz(g) for g in geo]
        for c in CORRIDORS:
            if 'ref' in c and c['ref'] not in (t.get('ref') or '').split(';'):
                continue
            if 'name' in c and c['name'] not in (t.get('name') or ''):
                continue
            if 'kinds' in c and t['highway'] not in c['kinds']:
                continue
            if 'ways' in c and e.get('id') not in c['ways']:
                continue
            b = c.get('box') or [-half, half, -half, half]
            inside = lambda q: b[0] <= q[0] <= b[1] and b[2] <= q[1] <= b[3] and max(abs(q[0]), abs(q[1])) <= half - 20
            run = []
            for q in densify(p) + [None]:
                if q is not None and inside(q):
                    run.append(q)
                    continue
                if len(run) >= 2:
                    out.append((c, clean_line(run)))
                run = []
    return out


def clip_near(p, keep):
    """Split a polyline into the runs where keep(x, z) holds."""
    runs, cur = [], []
    for q in densify(p):
        if keep(*q):
            cur.append(q)
        elif cur:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    return [r for r in runs if len(r) >= 2]


def touches(p, keep):
    return any(keep(*q) for q in densify(p + p[:1], 20.0))


# ---------- geometry cleanup ----------
def dp(pts, tol):
    if len(pts) < 3:
        return pts
    (ax, az), (bx, bz) = pts[0], pts[-1]
    dx, dz = bx - ax, bz - az
    L = math.hypot(dx, dz)
    far, idx = -1.0, 0
    for k in range(1, len(pts) - 1):
        x, z = pts[k]
        d = abs(dx * (az - z) - (ax - x) * dz) / L if L > 1e-9 else math.hypot(x - ax, z - az)
        if d > far:
            far, idx = d, k
    if far <= tol:
        return [pts[0], pts[-1]]
    return dp(pts[:idx + 1], tol)[:-1] + dp(pts[idx:], tol)


def clean_line(p):
    return [[round(x, 1), round(z, 1)] for x, z in dp(p, SIMPLIFY)]


def clean_ring(p):
    """Closed polygon without the repeated end point; None if it collapses."""
    ring = p[:-1] if p[0] == p[-1] else p
    # split at the vertex farthest from the first so DP keeps the ring's extent
    far = max(range(len(ring)), key=lambda k: (ring[k][0] - ring[0][0]) ** 2 + (ring[k][1] - ring[0][1]) ** 2)
    s = dp(ring[:far + 1], SIMPLIFY)[:-1] + dp(ring[far:] + [ring[0]], SIMPLIFY)[:-1]
    s = [[round(x, 1), round(z, 1)] for x, z in s]
    return s if len(s) >= 3 else None


def levels(e, t):
    try:
        return max(1, int(float(t['building:levels'])))
    except (KeyError, ValueError):
        pass
    if t.get('building') in TALL:
        return 6
    return 1 + (e['id'] * 2654435761 >> 7) % 2  # deterministic 1-2 levels per OSM id


# ---------- main ----------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--lat', type=float, default=13.2950)
    ap.add_argument('--lon', type=float, default=100.9100)
    ap.add_argument('--half', type=float, default=2400)
    ap.add_argument('--step', type=float, default=8)
    ap.add_argument('--hscale', type=float, default=1.5)
    ap.add_argument('--zoom', type=int, default=14)
    ap.add_argument('--dem-bias', type=float, default=6.0, help='metres of canopy/roof bias removed from land')
    ap.add_argument('--inland', type=float, default=100, help='keep features within this many m of the coast (0 = all)')
    ap.add_argument('--name', default='bangsaen')
    ap.add_argument('--refresh', action='store_true', help='ignore the download cache')
    cfg = ap.parse_args()
    cfg.mx, cfg.mz = 111320 * math.cos(math.radians(cfg.lat)), 110540
    cfg.n = int(round(2 * cfg.half / cfg.step)) + 1
    bb = {'s': cfg.lat - cfg.half / cfg.mz, 'n': cfg.lat + cfg.half / cfg.mz,
          'w': cfg.lon - cfg.half / cfg.mx, 'e': cfg.lon + cfg.half / cfg.mx}
    xz = lambda g: [(g['lon'] - cfg.lon) * cfg.mx, -(g['lat'] - cfg.lat) * cfg.mz]

    print('Loading OpenStreetMap...', file=sys.stderr)
    els = load_osm(bb, cfg.refresh)
    print('Loading elevation...', file=sys.stderr)
    hts = load_elevation(cfg, bb, cfg.refresh)

    coast_raw = [{'p': [xz(g) for g in e['geometry']]} for e in els
                 if e.get('tags', {}).get('natural') == 'coastline' and e.get('geometry')]
    coast = Coast(coast_raw)
    print(f'Applying coastline mask ({len(coast_raw)} ways)...', file=sys.stderr)
    apply_coast_mask(cfg, hts, coast)

    inland = cfg.inland if cfg.inland > 0 else math.inf
    data = {'origin': {'lat': cfg.lat, 'lon': cfg.lon}, 'scale': 1, 'hscale': cfg.hscale, 'sea': SEA,
            'inland': cfg.inland,
            'core': {'x0': -cfg.half, 'z0': -cfg.half, 'step': cfg.step, 'nx': cfg.n, 'nz': cfg.n},
            'buildings': [], 'roads': [], 'areas': [], 'streams': [], 'coast': [], 'corridors': []}
    walk, reach = Lines(), Lines()
    for c, line in corridor_lines(els, xz, cfg.half):
        data['corridors'].append({'n': c['n'], 'w': c['walk'], 'p': line, **({'bare': 1} if c.get('bare') else {})})
        walk.add(line, c['walk'])
        if not c.get('bare'):
            reach.add(line, c['keep'])
    keep = lambda x, z: coast.nearest(x, z)[0] <= inland or reach.within(x, z)
    keep_line = lambda x, z: coast.nearest(x, z)[0] <= inland or walk.within(x, z)
    print(f'Keeping features within {cfg.inland} m of the coast + {len(data["corridors"])} corridor lines...', file=sys.stderr)
    for e in els:
        t, geo = e.get('tags'), e.get('geometry')
        if not t or not geo or len(geo) < 2:
            continue
        p = [xz(g) for g in geo]
        closed = len(p) > 3 and e['nodes'][0] == e['nodes'][-1]
        area = t.get('natural') or t.get('leisure') or t.get('landuse') or (
            'parking' if t.get('amenity') == 'parking' else None)
        if t.get('natural') == 'coastline':
            data['coast'].append({'p': clean_line(p)})
        elif t.get('building') and closed:
            ring = touches(p, keep) and clean_ring(p)
            if ring:
                b = {'p': ring, 'lv': levels(e, t), 'b': t['building']}
                if t.get('name'): b['n'] = t['name']
                try: b['h'] = round(float(t['height'].split()[0]), 1)
                except (KeyError, ValueError): pass
                data['buildings'].append(b)
        elif t.get('highway') in ROAD_KINDS or t.get('waterway'):
            key, kind = ('roads', t['highway']) if t.get('highway') in ROAD_KINDS else ('streams', t['waterway'])
            runs = [p] if inland == math.inf else clip_near(p, keep_line)
            data[key] += [{'k': kind, 'p': clean_line(r)} for r in runs]
        elif closed and area in AREA_KINDS:
            ring = touches(p, keep) and clean_ring(p)
            if ring:
                data['areas'].append({'k': area, 'p': ring})

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{cfg.name}.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    bin_ = array('h', (max(-32768, min(32767, round(v * 10))) for v in hts))
    if sys.byteorder != 'little':
        bin_.byteswap()
    (OUT / f'{cfg.name}-core.bin').write_bytes(bin_.tobytes())
    lo, hi = min(hts), max(hts)
    print(f"{len(data['buildings'])} buildings, {len(data['roads'])} roads, {len(data['areas'])} areas, "
          f"{len(data['streams'])} streams, {len(data['coast'])} coast ways; "
          f'heights {lo:.1f}..{hi:.1f} m; grid {cfg.n}x{cfg.n}', file=sys.stderr)


if __name__ == '__main__':
    main()
