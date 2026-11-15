import json, math, heapq, sys
d=json.load(open('src/town/data/bangsaen.json'))
R=d['roads']
key=lambda p:(round(p[0]),round(p[1]))
adj={}; pos={}
def add(a,b,k):
    ka,kb=key(a),key(b)
    if ka==kb: return
    w=math.hypot(a[0]-b[0],a[1]-b[1])
    adj.setdefault(ka,{})[kb]=(w,k); adj.setdefault(kb,{})[ka]=(w,k); pos[ka]=a; pos[kb]=b
for r in R:
    if r['k'] in ('footway','path','steps','pedestrian','cycleway','service'): continue
    for i in range(1,len(r['p'])): add(r['p'][i-1],r['p'][i],r['k'])
# join near nodes (dangling ends within 6 m)
nodes=list(adj)
print('nodes',len(nodes), 'kinds', sorted(set(r['k'] for r in R)))
def cross(a,b,C,ang):
    # does segment a-b cross the ray from C at angle ang
    dx,dz=math.cos(ang),math.sin(ang)
    def side(p): return (p[0]-C[0])*dz-(p[1]-C[1])*dx
    def along(p): return (p[0]-C[0])*dx+(p[1]-C[1])*dz
    sa,sb=side(a),side(b)
    if sa*sb>=0: return 0
    t=sa/(sa-sb); al=along(a)+(along(b)-along(a))*t
    return (1 if sa<0 else -1) if al>0 else 0
def loop(C,ang):
    cut=set(); cand=[]
    for u in adj:
        for v in adj[u]:
            c=cross(u,v,C,ang)
            if c: cut.add((u,v)); 
            if c>0: cand.append((u,v))
    best=None
    for (u,v) in cand:
        dist={v:0}; prev={}; pq=[(0,v)]
        while pq:
            dd,x=heapq.heappop(pq)
            if x==u: break
            if dd>dist.get(x,1e18): continue
            for y,(w,k) in adj[x].items():
                if (x,y) in cut: continue
                nd=dd+w
                if nd<dist.get(y,1e18): dist[y]=nd; prev[y]=x; heapq.heappush(pq,(nd,y))
        if u in dist:
            L=dist[u]+adj[u][v][0]
            if best is None or L<best[0]:
                path=[u]; x=u
                while x!=v: x=prev[x]; path.append(x)
                best=(L,path[::-1])
    return best
b=loop((-640,-1900),1.57)
L, path = b
pts = [pos[k] for k in path]
# start on the longest straight run (little turning over 250 m)
n = len(pts)
def turn(i, span=250):
    acc = 0; tot = 0; j = i
    while acc < span:
        a, b2, c = pts[j % n], pts[(j + 1) % n], pts[(j + 2) % n]
        h1 = math.atan2(b2[0] - a[0], b2[1] - a[1]); h2 = math.atan2(c[0] - b2[0], c[1] - b2[1])
        dh = math.atan2(math.sin(h2 - h1), math.cos(h2 - h1)); tot += abs(dh)
        acc += math.hypot(b2[0] - a[0], b2[1] - a[1]); j += 1
    return tot
i0 = min(range(n), key=turn)
pts = pts[i0:] + pts[:i0]
kinds = {}
for i in range(n):
    k = adj[key(pts[i])][key(pts[(i + 1) % n])][1]; kinds[k] = kinds.get(k, 0) + math.hypot(pts[i][0] - pts[(i + 1) % n][0], pts[i][1] - pts[(i + 1) % n][1])
print('length', round(L), 'points', n, 'start', pts[0], 'kinds', {k: round(v) for k, v in kinds.items()}, file=sys.stderr)
open('src/gp/loop.js', 'w').write('// The race loop round Khao Sam Muk, from the baked OSM roads (tools/gp_loop.py writes this file):\n// the shortest ring of roads that encloses the hill, as [x, z] in local metres, starting on its longest straight.\nexport const LOOP = ' + json.dumps([[round(p[0], 1), round(p[1], 1)] for p in pts]).replace(' ', '') + ';\n')
