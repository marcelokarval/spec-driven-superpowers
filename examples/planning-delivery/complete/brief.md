# Briefing autônomo — catálogo local (complete)

**SYNTHETIC**. Revisão complete-r1; destinatário: mantenedor do catálogo de exemplo.
Projeto ilustrativo `/synthetic/catalog` não foi criado nem editado. Pedido S01:
“Implementar listagem somente leitura e exportação do catálogo existente, com guia
para consumidores, sem alterar os registros.” ASDS contribui apenas com o plano;
software original continua não implementado. Nenhum dado pessoal, auth, billing ou remoção; catálogo público sintético.

## Requisitos e fontes
- R01 (S01): listar todos os registros em ordem lexicográfica por id; base vazia produz lista vazia.
- R02 (S01): exportar exatamente os mesmos registros/campos; resultado vazio preserva cabeçalho quando CSV.
- R03 (S01): guia explica listagem/exportação, saída vazia, falhas e ausência de alterações.
- R04 (S01): nenhuma gravação, exclusão, reordenação da base ou alteração de identificadores.
- S02: interface preexistente sintética `CatalogReader.readAll(): Array<{id: string, name: string}>`;
  leitura pode lançar `CatalogReadError`; CLI já converte esse erro para exit 2 e stderr sem stack.
- S03: convenção sintética ES modules Node; arquivos-alvo em src/, testes node:test.
  Comandos mencionados nas folhas são futuros; não se afirma que os arquivos já existem.
- S04: instrução sintética de entrega nesta pasta-modelo; não é autorização real para publicar ou inicializar OpenSpec.

## Decisões com proveniência
- D01 (S01, proprietário sintético): somente leitura; reaproveitar leitor existente, sem novo banco/framework.
- D02: CSV UTF-8, cabeçalho id,name, quebra LF e escaping RFC 4180; fonte: decisão sintética do proprietário.
- D03 (S03, mantenedor sintético): separar transformações puras de adaptador CLI existente;
  listagem e exportação são resultados independentes que compartilham leitura, não gravação.
- D04 (S04, proprietário sintético): não inicializar OpenSpec; tasks.md e contratos bastam;
  não instalar, publicar ou executar o projeto. Recusa deve permanecer no retorno.

## Interface compartilhada e decomposição
`CatalogReader` entrega strings id/name sem duplicatas por id; validação pertence
ao leitor existente e não será recriada. Listagem ordena cópia, exportação usa a
mesma ordenação sem depender da implementação de listagem. Guia depende dos dois
resultados para exemplos estáveis. P01 compõe os três resultados, não os precede.
R04 é obrigação transversal. Escopo somente arquivos enumerados em cada folha;
fonte do leitor e CLI preexistente são read-only.

## Estado e lacunas
Sem lacuna material neste cenário sintético; baixo risco e nenhuma política exigindo revisão independente.
Não executar nenhum comando das folhas para encerrar a contribuição ASDS.
