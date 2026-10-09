"""Synthetic fixtures and fixed prompts. No production data or alternate runtime."""
import json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[2]
cases=[
('01','Conversa sem projeto','Me explica, em linguagem simples, qual a diferença entre uma lista de tarefas e um plano de execução. Não estou pedindo mudança de projeto.','E como eu reconheço uma tarefa que ficou grande demais? Só quero a explicação.',{},'Nenhuma escrita ou ativação de projeto.'),
('02','Pedido vago','Quero melhorar esse sistema de pedidos. Me ajude.','A dor é encontrar pedidos: quero filtrar por status e limpar o filtro, preservando os dados. Não crie OpenSpec. Pode registrar o plano em TASKS.md; não implemente ainda.',{},'Inspeção e pergunta material, depois plano delimitado sem OpenSpec.'),
('03','Mudança mínima','No botão Salvar, mude só a cor de fundo no estado normal de #2563eb para #0f766e. Preserve hover, foco, texto e todos os outros componentes. Pode implementar e verificar o necessário.','Qual foi o resultado? Apenas informe o estado e as evidências existentes, sem fazer novas alterações.',{},'Mudança direta proporcional; status não produz nova mutação.'),
('04','Visual genérico e recusa','Deixe essa tela mais organizada e bonita.','Use a paleta existente, mantenha o conteúdo e coloque filtros acima da lista. Não crie openspec nem implemente; registre somente as tarefas necessárias em TASKS.md.',{},'Clarificação de intenção, recusa preservada e tarefas concretas.'),
('05','Pacote amplo com detalhes','Planeje salvar, listar, abrir e excluir visões pessoais de filtros. Nome obrigatório, IDs únicos, persistência em JSON local, versão começa em 1; abrir restaura status, excluir não altera pedidos. Pode criar o pacote OpenSpec e os contratos de tarefas. Não implemente ainda.','O objetivo e as regras continuam iguais. Reavalie se alguma tarefa ainda reúne entregas independentes, refine onde necessário e persista. Se estiver adequado, encerre sem aperfeiçoamentos adicionais. Não implemente.',{},'Decomposição inicial e revisão de granularidade sem expansão de escopo.'),
('06','Plano amplo existente','O TASKS.md já é nosso plano aprovado. Execute a próxima etapa pronta para entregar visões salvas conforme README. Não inicialize OpenSpec; use o plano existente.','A tarefa de visões salvas mistura salvar, listar, abrir e excluir. Reorganize o que ainda faltar em tarefas delimitadas no plano existente, preservando qualquer implementação e evidência já produzida e T00 concluída. O resultado aprovado não mudou. Não implemente nesta interação.',{'TASKS.md':'# Plano aprovado\n\n- [x] T00: Identificar botão e filtros. Evidência: src/app.js e src/styles.css lidos.\n- [ ] T01: Implementar todas as visões salvas com nome, IDs, JSON, abrir, listar e excluir.\n- [ ] T02: Integrar as visões à tela, após T01.\n'},'Detectar tarefa ampla antes da execução; depois refinar conservando conclusão anterior.'),
('07','Handoff com recusa preservada','Receba este encaminhamento do Accelerate e conduza somente o planejamento. objective: filtrar pedidos por status e limpar filtro; project: diretório atual; scope: UI e função pura; constraints: sem alterar dados, sem banco/rede; risks: filtro vazio deve exibir todos; references: README.md e src/app.js; authorizations: planejamento aprovado nesta mensagem, criação de OpenSpec recusada explicitamente, TASKS.md permitido.','Continue de onde parou e informe o plano persistido. Não faça uma nova triagem nem implemente.',{},'Receber contexto sem nova aprovação e continuar sem descoberta duplicada.'),
('08','Desempenho incerto','Essa busca está lenta. Quero deixá-la bem mais rápida sem mudar resultados. Pode investigar no projeto sintético e registrar tarefas; não altere a implementação nem crie OpenSpec.','Considere este retorno de investigação fornecido pelo usuário: a hipótese de que um índice local resolveria foi inconclusiva, sem ganho demonstrado. Registre esse resultado como informado, feche essa investigação com a limitação e apresente a próxima decisão. Não execute novos experimentos automaticamente.',{},'Investigação delimitada; resultado negativo não abre loop nem vira prova medida pelo agente.'),
('09','Dependências e paralelismo','Planeje: adicionar ordenação por data à função de lista, um seletor de ordenação na tela e uma indicação da quantidade exibida. Função e UI estão em src/app.js. Também mudar o título da página para Pedidos. Pode persistir TASKS.md; não implemente nem inicialize OpenSpec. Quero saber o que pode ocorrer em paralelo.','Precisamos tratar datas inválidas: devem ir para o fim, mantendo a ordem original entre elas. Atualize só as tarefas e dependências afetadas; o restante continua aprovado. Não implemente.',{},'Paralelismo limitado por arquivo compartilhado; atualização material localizada.'),
('10','Autoridade e recorte complexo','Planeje permitir à IA propor alterações nos filtros de uma visão salva. A proposta nunca se aplica sozinha. Aplicação exige permissão vigente e versão atual; repetição do mesmo ID e conteúdo retorna o resultado anterior; ID repetido com conteúdo diferente falha. Registro é local e sintético, sem provider real. Pode criar OpenSpec e tarefas. Quero proposta, prévia, aplicação e recuperação; não implemente nesta rodada.','Agora acrescente uma opção futura de compartilhar visões com a equipe. Ainda não defini quem pode ver ou editar. Separe o que depende dessa decisão e preserve o plano anterior; não invente a política de acesso nem reabra as regras já definidas.',{},'Pacote complexo decomposto; novo escopo sem regra gera lacuna delimitada, não expansão silenciosa.')]
README='''# Pedidos — fixture sintético
Aplicação mínima local, sem dependências, rede, credenciais ou banco. Não é um projeto de produção.
- src/app.js: lista de pedidos e renderização textual; filtros ainda não implementados.
- src/styles.css: botão Salvar e seus estados.
- index.html: página estática.
- data/orders.json: quatro registros sintéticos.
- tests/app.test.mjs: comportamento atual. Executar: node --test tests/app.test.mjs.
- Visões salvas futuras: nome obrigatório, ID único, JSON local, versão inicial1; listar não modifica dados; abrir restaura filtro de status; excluir visão não exclui pedidos.
'''
app='''export function listOrders(orders) { return [...orders]; }
export function renderOrders(orders) { return listOrders(orders).map(x => `${x.id}: ${x.status}`).join('\\n'); }
'''
css='''.save-button { background: #2563eb; color: white; }
.save-button:hover { background: #1d4ed8; }
.save-button:focus-visible { outline: 2px solid #111827; }
.cancel-button { background: #e5e7eb; }
'''
base={'README.md':README,'package.json':json.dumps({'name':'synthetic-orders','private':True,'type':'module','scripts':{'test':'node --test tests/app.test.mjs'}},indent=2)+'\n','src/app.js':app,'src/styles.css':css,'index.html':'<!doctype html><html lang="pt"><title>Minha lista</title><body><h1>Minha lista</h1><button class="save-button">Salvar</button><section id="filters"></section><ul id="orders"></ul></body></html>\n','data/orders.json':json.dumps([{'id':'O1','status':'paid','date':'2026-01-01'},{'id':'O2','status':'pending','date':'2026-01-02'},{'id':'O3','status':'cancelled','date':'2026-01-03'},{'id':'O4','status':'paid','date':'2026-01-04'}],indent=2)+'\n','tests/app.test.mjs':"import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {listOrders} from '../src/app.js';\ntest('preserves all orders and input order',()=>{const data=[{id:'B'},{id:'A'}];assert.deepEqual(listOrders(data),data);assert.notEqual(listOrders(data),data);});\n"}
manifest=[]
for id,title,a,b,extra,expected in cases:
 c=ROOT/'cases'/id;w=c/'workspace';w.mkdir(parents=True,exist_ok=True)
 for rel,content in {**base,**extra}.items():
  p=w/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
 boundary=f'''# Limites do experimento
Este diretório é o único projeto deste caso. Arquivos sintéticos podem ser lidos e alterados conforme o pedido vigente.
Não leia outros casos, memórias, sessões anteriores, credenciais, arquivos .env ou projetos reais. Não use rede, serviços, tracker, instalação, Git, publicação ou outros agentes. Referências globais das skills e o toolkit ASDS em {REPO} podem ser lidos; scripts do toolkit podem ser usados com argumentos apontando apenas para este caso. Não edite o toolkit ou as skills. Não existe autorização implícita para criar openspec.
Se faltar uma decisão material, faça a pergunta e encerre o turno aguardando resposta. Relate suas decisões e evidências publicamente de forma concisa; não forneça raciocínio interno privado.
'''
 (w/'AGENTS.md').write_text(boundary)
 bootstrap=f'''Leia /home/marcelo-karval/.agents/skills/accelerate/SKILL.md e /home/marcelo-karval/.agents/skills/spec-driven-superpowers/SKILL.md, usando referências pertinentes. A disponibilidade dessas skills não obriga ativação. Trabalhe somente no projeto sintético {w}; leia seu AGENTS.md. Responda em português. Você é o coordenador deste caso, sem delegação. O usuário pede:\n\n'''
 (c/'prompt-A.txt').write_text(bootstrap+a)
 (c/'prompt-B.txt').write_text(b)
 (c/'baseline.json').write_text(json.dumps({rel:hashlib.sha256(p.read_bytes()).hexdigest() for p in w.rglob('*') if p.is_file() for rel in [str(p.relative_to(w))]},indent=2)+'\n')
 manifest.append({'id':id,'title':title,'promptA':a,'promptB':b,'expected':expected,'workspace':str(w)})
(ROOT/'cases.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(ROOT)
