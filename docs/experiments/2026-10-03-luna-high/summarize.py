"""Mechanical evidence index; semantic assessment belongs to the coordinator."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def events(p):
 return [json.loads(l) for l in p.read_text().splitlines()] if p.exists() else []
def main():
 summary=[]
 for case in json.loads((ROOT/'cases.json').read_text()):
  c=ROOT/'cases'/case['id'];phases={};report=[f"# Caso {case['id']} — {case['title']}", '', '## Prompt A', '', (c/'prompt-A.txt').read_text(), '', '## Prompt B (predefinido)', '', (c/'prompt-B.txt').read_text()]
  thread=None
  for phase in 'ABC':
   rp=c/f'result-{phase}.json'
   if not rp.exists():continue
   if phase=='C':report+=['','## Prompt C suplementar — decisão fornecida pelo operador','',(c/'prompt-C.txt').read_text()]
   result=json.loads(rp.read_text());thread=result.get('threadId',thread)
   ev=events(c/f'events-{phase}.jsonl');completed=[e['item'] for e in ev if e.get('type')=='item.completed' and e.get('item')]
   commands=[i for i in completed if i['type']=='command_execution'];texts=[i.get('text','') for i in completed if i['type']=='agent_message']
   before=json.loads((c/'baseline.json').read_text()) if phase=='A' else phases.get('B' if phase=='C' else 'A',{}).get('afterHashes',{})
   after=result.get('afterHashes',{})
   changed=[p for p in sorted(set(before)|set(after)) if before.get(p)!=after.get(p)] if 'exitCode' in result else []
   phase_data={**result,'commandCount':len(commands),'failedCommands':sum(i.get('exit_code') not in (0,None) for i in commands),'changedPaths':changed,'accelerateReadObserved':any('accelerate/SKILL.md' in i.get('command','') and i.get('exit_code')==0 for i in commands),'asdsReadObserved':any('spec-driven-superpowers/SKILL.md' in i.get('command','') and i.get('exit_code')==0 for i in commands),'planningReferenceReadObserved':any('references/planning.md' in i.get('command','') and i.get('exit_code')==0 for i in commands)}
   phases[phase]=phase_data
   report += ['',f'## Interação {phase} — resultado', '',f"Saída CLI: {result.get('exitCode','em andamento')}; duração: {result.get('durationSeconds','—')} s; timeout: {result.get('timedOut','—')}",f"Comandos concluídos: {len(commands)}; com falha: {phase_data['failedCommands']}",f"Arquivos diferentes ao final: {', '.join(changed) or 'nenhum'}",'', '### Respostas públicas', '', '\n\n---\n\n'.join(texts),'','### Ações públicas, na ordem']
   for e in ev:
    if e.get('type')!='item.completed':continue
    item=e.get('item',{});kind=item.get('type')
    if kind=='command_execution':report+=['',f"**{e['observedAt']} · comando · exit {item.get('exit_code')}**",'```sh',item.get('command',''),'```']
    elif kind in {'file_change','todo_list','mcp_tool_call'}:report+=['',f"**{e['observedAt']} · {kind}**",'```json',json.dumps(item,ensure_ascii=False,indent=2),'```']
  if thread:
   metadata=[]
   for p in Path('/home/marcelo-karval/.codex/sessions').glob(f'*/*/*/*{thread}.jsonl'):
    for line in p.open():
     d=json.loads(line)
     if d.get('type')=='turn_context':metadata.append({k:d['payload'][k] for k in ['turn_id','cwd','model','effort'] if k in d['payload']})
   (c/'model-readback.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
  changes=[e for e in events(c/'mutations.jsonl') if not e.get('phase','').endswith('-before')]
  report+=['','## Persistência observada','',f'{len(changes)} transições de conteúdo observadas por polling. Consulte mutations.jsonl e versions/. Mudanças transitórias menores que o intervalo de amostragem podem não ter sido capturadas.','', '## Limites da evidência','', 'As respostas são conteúdo público do modelo; explicações não revelam raciocínio privado. Comandos, exit codes e efeitos foram registrados. Outputs brutos de ferramentas e stderr foram omitidos; não se afirma leitura integral de todo resultado de ferramenta. O transcript nativo continua na instalação Codex. A/B pertencem à mesma sessão; casos distintos começam sessões novas.']
  (c/'REPORT.md').write_text('\n'.join(report)+'\n')
  row={'id':case['id'],'title':case['title'],'threadId':thread,'phases':phases,'observedMutations':len(changes)};summary.append(row)
 (ROOT/'results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps([{'id':r['id'],'phases':{p:{k:v.get(k) for k in ['exitCode','durationSeconds','commandCount','failedCommands','changedPaths']} for p,v in r['phases'].items()}} for r in summary],ensure_ascii=False,indent=2))
if __name__=='__main__':main()
