import json, math, sys
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely.prepared import prep
d=json.load(open('out/niseko_design.json'))
W=Polygon(d['walk']['ext'],d['walk']['holes'])
polys=[Polygon(pc).buffer(1e-4) for l in d['lots'] for pc in l['pieces']]
U=unary_union(polys); pu=prep(U)
bad=[]; tot=0
rings=[d['walk']['ext']]+d['walk']['holes']
for ri,r in enumerate(rings):
    for i in range(len(r)-1):
        a,b=r[i],r[i+1]; L=math.hypot(b[0]-a[0],b[1]-a[1])
        for k in range(int(L/0.25)+1):
            t=min(1,k*0.25/L); p=(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
            dx,dz=(b[0]-a[0])/L,(b[1]-a[1])/L
            for sgn in (1,-1):
                for dist in (0.15,1.0):
                    q=(p[0]+sgn*dz*dist,p[1]-sgn*dx*dist)
                    if not W.contains(Point(q)):
                        tot+=1
                        if not pu.contains(Point(q)): bad.append((ri,i,dist,[round(v,2) for v in q]))
                if True: break
print('samples',tot,'uncovered',len(bad)); print(bad[:12])
