import json, math, sys
from PIL import Image, ImageDraw
S=10.0; CX,CY=651.0,575.0
d=json.load(open('out/layout_trace.json')); rings=[d['ext']]+d['holes']
Z=2
W,H=1324*Z,1188*Z
im=Image.new('RGB',(W,H),(235,235,235)); dr=ImageDraw.Draw(im)
px=lambda p:((p[0]*S+CX)*Z,(p[1]*S+CY)*Z)
dr.polygon([px(p) for p in rings[0]],fill=(40,40,40))
for h in rings[1:]: dr.polygon([px(p) for p in h],fill=(235,235,235))
for ri,r in enumerate(rings):
    for i in range(len(r)-1):
        a,b=px(r[i]),px(r[i+1]); L=math.hypot(r[i+1][0]-r[i][0],r[i+1][1]-r[i][1])
        dr.line([a,b],fill=(255,160,0) if L<1.6 else (120,200,255),width=2)
        dr.ellipse((a[0]-3,a[1]-3,a[0]+3,a[1]+3),fill=(255,60,60) if L<1.6 else (0,120,255))
        if len(sys.argv)>1: dr.text((a[0]+4,a[1]+2),'%d.%d'%(ri,i),fill=(255,255,0))
import numpy as np
m=np.load('out/mm_masks.npz')
for k,c in (('red',(220,40,40)),('green',(60,220,60))):
    ys,xs=np.nonzero(m[k][::2,::2]); 
    for y,x in zip(ys[::3],xs[::3]): dr.point((x*2*Z/1,y*2*Z/1),fill=c)
im.save('out/trace_view.png')
for name,box in (('NW',(0,0,W//2+100,H//2+100)),('NE',(W//2-100,0,W,H//2+100)),('SW',(0,H//2-100,W//2+100,H)),('SE',(W//2-100,H//2-100,W,H))):
    im.crop(box).save('out/trace_%s.png'%name)
