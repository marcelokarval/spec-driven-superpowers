"""Read-only evidence audit. Never loads private reasoning into exported reports."""
from pathlib import Path
import hashlib, json
ROOT=Path(__file__).resolve().parent
categories=['Argument list too long','Operation not permitted','Permission denied','No such file or directory','not a git repository']
rows=[]
for case in sorted((ROOT/'cases').iterdir()):
    first=json.loads((case/'result-A.json').read_text())
    sid=first.get('threadId')
    files=list(Path('/home/marcelo-karval/.codex/sessions').glob(f'*/*/*/*{sid}.jsonl')) if sid else []
    failures=[];contexts=[]
    for p in files:
        for n,line in enumerate(p.open(),1):
            e=json.loads(line); kind=e.get('type'); payload=e.get('payload',{})
            if kind=='turn_context':
                contexts.append({k:payload.get(k) for k in ('turn_id','cwd','model','effort')})
            if kind!='response_item' or payload.get('type')!='custom_tool_call_output':continue
            output=payload.get('output',[])
            text='\n'.join(x.get('text','') for x in output if isinstance(x,dict) and x.get('type')=='input_text') if isinstance(output,list) else ''
            found=[c for c in categories if c in text]
            if found:failures.append({'line':n,'callId':payload.get('call_id'),'categories':found})
    (case/'tool-failure-categories.json').write_text(json.dumps({'nativeSources':[str(x) for x in files],'failures':failures},ensure_ascii=False,indent=2)+'\n')
    rows.append({'case':case.name,'nativeSources':len(files),'contextCount':len(contexts),'allRecordedLunaHigh':bool(contexts) and all(x['model']=='gpt-6-luna' and x['effort']=='high' for x in contexts),'failures':len(failures)})
env=json.loads((ROOT/'environment.json').read_text())
skills=[{'path':x['path'],'unchanged':hashlib.sha256(Path(x['path']).read_bytes()).hexdigest()==x['sha256']} for x in env['skills']]
(ROOT/'audit.json').write_text(json.dumps({'cases':rows,'skillReadback':skills},indent=2)+'\n')
print(json.dumps({'cases':rows,'skillReadback':skills},indent=2))
