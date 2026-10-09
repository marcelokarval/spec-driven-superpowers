"""Bounded CLI experiment; persist public events only, never private reasoning.
Each case starts a fresh thread then resumes its exact ID for fixed prompt B.
"""
import concurrent.futures, hashlib, json, os, selectors, signal, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent
MODEL='gpt-6-luna'; EFFORT='high'; TIMEOUT=240

def now(): return datetime.now(timezone.utc).isoformat()
def emit(path,obj):
 with path.open('a') as f:f.write(json.dumps(obj,ensure_ascii=False)+'\n')
def snapshot(workspace,case,phase,known):
 current={}
 for p in workspace.rglob('*'):
  if not p.is_file() or p.is_symlink() or any(x in {'.git','node_modules'} for x in p.relative_to(workspace).parts):continue
  rel=str(p.relative_to(workspace))
  if p.name.startswith('.env') or p.name in {'auth.json','credentials.json'}:continue
  try:data=p.read_bytes()
  except FileNotFoundError:continue
  h=hashlib.sha256(data).hexdigest();current[rel]=h
  if known.get(rel)!=h:
   saved=None
   if len(data)<=200000:
    try:
     body=data.decode('utf8');dest=case/'versions'/f'{h}.txt';dest.parent.mkdir(exist_ok=True);dest.write_text(body);saved=str(dest.relative_to(case))
    except UnicodeDecodeError:pass
   emit(case/'mutations.jsonl',{'at':now(),'phase':phase,'path':rel,'previous':known.get(rel),'sha256':h,'bytes':len(data),'content':saved})
 for rel,h in known.items():
  if rel not in current:emit(case/'mutations.jsonl',{'at':now(),'phase':phase,'path':rel,'previous':h,'deleted':True})
 known.clear();known.update(current)

def public(event):
 kind=event.get('type')
 if kind in {'thread.started','turn.started','turn.completed','turn.failed','error'}:
  return {k:event[k] for k in ['type','thread_id','usage','error','message'] if k in event}
 if kind in {'item.started','item.updated','item.completed'}:
  item=event.get('item',{});itype=item.get('type')
  if itype in {'agent_message','command_execution','mcp_tool_call','web_search','file_change','todo_list'}:
   # Tool output intentionally omitted. Commands, exit status, final messages,
   # real file effects and fixture test results remain separately inspectable.
   return {'type':kind,'item':{k:item[k] for k in ['id','type','text','command','exit_code','status','server','tool','arguments','changes','items'] if k in item}}
 return None

def run_phase(case,phase,thread=None):
 w=case/'workspace';prompt=(case/f'prompt-{phase}.txt').read_text()
 args=['codex','exec','--skip-git-repo-check','--model',MODEL,'--config',f'model_reasoning_effort="{EFFORT}"','--sandbox','workspace-write','--cd',str(w),'--json','--color','never']
 if thread:args+=['resume',thread,'-']
 else:args+=['-']
 record={'startedAt':now(),'requestedModel':MODEL,'requestedEffort':EFFORT,'cwd':str(w),'argv':args,'phase':phase,'resumeThread':thread,'timeoutSeconds':TIMEOUT}
 result=case/f'result-{phase}.json';result.write_text(json.dumps(record,indent=2)+'\n')
 known={};snapshot(w,case,f'{phase}-before',known)
 start=time.monotonic();proc=subprocess.Popen(args,cwd=w,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
 proc.stdin.write(prompt);proc.stdin.close()
 sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ,'stdout');sel.register(proc.stderr,selectors.EVENT_READ,'stderr')
 timed_out=False; finals=[]; counters={}; stderr_count=0;lastsnap=start
 while sel.get_map():
  elapsed=time.monotonic()-start
  if elapsed>TIMEOUT and not timed_out:
   timed_out=True;os.killpg(proc.pid,signal.SIGTERM)
  if timed_out and elapsed>TIMEOUT+5 and proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL)
  for key,_ in sel.select(timeout=.25):
   line=key.fileobj.readline()
   if not line:sel.unregister(key.fileobj);continue
   if key.data=='stderr':
    stderr_count+=1
    # Stderr may include local configuration or provider internals. No raw dump.
    continue
   try:event=json.loads(line)
   except json.JSONDecodeError:continue
   out=public(event)
   if out:
    out['observedAt']=now();emit(case/f'events-{phase}.jsonl',out)
    counters[out['type']]=counters.get(out['type'],0)+1
    if out['type']=='thread.started':record['threadId']=out.get('thread_id')
    if out['type']=='turn.completed':record['usage']=out.get('usage')
    if out.get('item',{}).get('type')=='agent_message' and out['type']=='item.completed':finals.append(out['item'].get('text',''))
  if time.monotonic()-lastsnap>.5:snapshot(w,case,phase,known);lastsnap=time.monotonic()
 code=proc.wait();snapshot(w,case,f'{phase}-after',known)
 record.update(endedAt=now(),durationSeconds=round(time.monotonic()-start,2),exitCode=code,timedOut=timed_out,eventCounts=counters,stderrLinesOmitted=stderr_count,afterHashes=known)
 result.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
 (case/f'responses-{phase}.md').write_text('\n\n---\n\n'.join(finals))
 print(json.dumps({'case':case.name,'phase':phase,'exit':code,'seconds':record['durationSeconds'],'thread':record.get('threadId',thread),'timeout':timed_out}),flush=True)
 return record

def run_case(id):
 case=ROOT/'cases'/id
 if (case/'result-A.json').exists():raise RuntimeError('Refusing silent rerun of existing case '+id)
 a=run_phase(case,'A');thread=a.get('threadId')
 if thread and not a['timedOut'] and a['exitCode']==0:
  run_phase(case,'B',thread)
 else:emit(case/'skipped.jsonl',{'phase':'B','reason':'A did not complete cleanly; no automatic retry'})

if __name__=='__main__':
 ids=sys.argv[1:] or [x['id'] for x in json.loads((ROOT/'cases.json').read_text())]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for future in [pool.submit(run_case,id) for id in ids]:future.result()
