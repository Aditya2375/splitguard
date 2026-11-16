"""Independent integer interval ledger, pairwise scan, union via covered unit ticks.
No imported production code or third-party packages. Tick-set reference intentionally
uses a different path than sorted interval merging. Fixed synthetic bounds only.
"""
import subprocess,json,os
count=0
def compare(a,b):
 global count
 if isinstance(a,list):
  assert len(a)==len(b)
  for x,y in zip(a,b):compare(x,y)
 elif isinstance(a,dict):
  assert a.keys()==b.keys()
  for k in a:compare(a[k],b[k])
 else:assert a==b,(a,b);count+=1
def ref(k,h,emb,seed):
 state=seed;events=[];time=0
 for _ in range(60):
  state=(state*1664525+1013904223)%2**32;time+=state%3+1
  state=(state*1664525+1013904223)%2**32;events.append([time,time+1+state%h])
 sizes=[60//k+(f<60%k)for f in range(k)];out=[];lo=0
 for size in sizes:
  hi=lo+size;test=events[lo:hi];edge=max(e[1]for e in test);covered=set(t for a,b in test for t in range(a,b));un=[]
  for t in sorted(covered):
   if un and un[-1][1]==t:un[-1][1]=t+1
   else:un.append([t,t+1])
  rows=[];purged=embargoed=train=past=future=pairs=ticks=0
  for i,(a,b)in enumerate(events):
   inside=emb>0 and edge<=a<edge+emb;c=duration=0;first=-1
   if lo<=i<hi:role='TEST'
   else:
    for j in range(lo,hi):
     overlap=set(range(a,b)).intersection(range(*events[j]))
     if overlap:
      c+=1;duration+=len(overlap)
      if first==-1:first=j
    pairs+=c;ticks+=duration
    if c:role='PURGED';purged+=1
    elif inside:role='EMBARGO';embargoed+=1
    else:
     role='TRAIN';train+=1
     if i<lo:past+=1
     else:future+=1
   rows.append([i,a,b,role,c,duration,first,inside])
  out.append({'summary':[lo,hi,edge,edge+emb,size,60-size,purged,embargoed,train,past,future,pairs,ticks],'union':un,'rows':rows});lo=hi
 return {'events':events,'splits':out}
for seed in [1,17,9999]:
 for k in [3,5,8]:
  for h in [1,12,24]:
   for emb in [0,4,16]:
    actual=json.loads(subprocess.check_output([os.environ.get('JAVA','java'),'-cp','build/classes','Dump',*map(str,[k,h,emb,seed])],text=True));compare(ref(k,h,emb,seed),actual)
print(f'{count} independent Python integer field checks passed')
