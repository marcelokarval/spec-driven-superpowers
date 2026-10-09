Vou ler o `AGENTS.md` do caso e as duas skills indicadas, depois examinar apenas os arquivos sintéticos pertinentes para preparar o pacote OpenSpec e os contratos de tarefas. Vou manter a entrega em planejamento, sem implementar o comportamento.

---

A primeira tentativa de leitura não conseguiu iniciar o processo de shell: o executor rejeitou até comandos curtos com erro de tamanho de argumentos. Vou tentar uma chamada mínima sem shell de login; ainda não li nem alterei arquivos.

---

Li o `AGENTS.md`, as skills Accelerate e Spec-Driven Superpowers e as referências de intake, ativação, protocolo, planejamento, contratos e continuidade. Inspecionei o README e os arquivos da aplicação. A pasta `openspec/` ainda não existe; a autorização explícita permite criá-la.

Há uma decisão que muda o desenho dos contratos: nesta aplicação estática, **“persistência em JSON local”** pode significar guardar JSON no `localStorage` do navegador ou manter um arquivo JSON no projeto. A segunda opção exige definir como a página grava esse arquivo, por exemplo, com um servidor local ou um fluxo de importação/exportação.

Qual dessas formas você quer? Vou aguardar essa decisão antes de criar o pacote OpenSpec e os contratos. Não alterei arquivos.