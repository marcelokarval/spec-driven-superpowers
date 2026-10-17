# ASDS passivo — relatório final de fonte e evidência C10/C11

**Estado: evidências consolidadas, aceite de fonte ainda pendente da ROOT/oracle
`ses_ebfe922c2ffe0EpfJccvkv2HSf`.** A revisão deve incluir os três achados originais
e a correção adicional autor ≠ coordenador. Este relatório não declara que essa
revisão já aceitou as correções. Não houve instalação, release, commit/push ou
execução do produto CSV. A publicação descrita abaixo é do pacote de planejamento.

## Solicitado, implementado e demonstrado

| Item | Implementação/resultado | Evidência e limite |
|---|---|---|
| Planejador passivo | Harness raciocina e despacha nativamente; ASDS compila, registra resultados explícitos e confere persistência. Authority/daemon/headless supervisor/listeners retirados do caminho operacional. | Manifesto de 57 superfícies e lista de remoções; história preservada. Não promete autenticar harness hostil. |
| P1 boundary | Ready, publish e verificação do receipt nativo consultam readiness dos contratos persistidos, não apenas projeção do manifest. | RED pending-boundary com F/Q válidas, depois regressões GREEN; progresso `[x]` não vira prova de implementação. |
| P1 resync planning | Recompilação não muda status do pedido congelado apenas porque chegou a delivered; nenhum campo material foi removido do hash. | No-op com/sem checkbox conserva candidato/reviews/readback; mudança real invalida. |
| P2 schema | Parent textual opcional; findings/limitations fechados conforme schema. | REDs e negativos para tipos/chaves extras; native parent permitido. |
| Snapshot | Expected da skill atualizado somente após aprovação humana do SHA exato. | SKILL raiz/distribuída não alteradas nas remediações; snapshot passa. |
| Autor ≠ coordenador | Requester/observer identificam o mesmo coordenador real dentro do envelope e entre F/Q, sem exigir igualdade ao autor. Reviewers distintos de ambos. | RED de separação; regressões preservam autor=coordenador e rejeitam inconsistência/reuso. **Ainda requer review independente da ROOT/oracle.** |
| Layers | C12/C13/C14/C16 são assessments observados; C15/readback/delivered vêm do publisher. Sem ciclo de hash: outputs fora do candidato, dentro do digest final. | Transição sintética testada e transição C10 real persistida, sem mudar candidato. |
| C9 | Suíte anterior à separação 586/586; após correção extra 589/589, check/validate/diff exit 0. | [Worklog](PASSIVE-CORRECTION-WORKLOG.md) contém RED/GREEN e logs de sessão. Cadeia C11 pós-documentação registrada abaixo. |
| C10 nativo | Dois reviewers nativos canônicos, registros F→Q, publicação, readback em novo Node e retorno planning-delivered. | Domínio **sintético**, observações de sessões **reais**. Não é execução/aceite operacional Stage-3. |

## C10 observado e reaberto

Destino canônico mantido: `/tmp/opencode/asds-passive-c10-native/package`.
Autor: `ses_ec355f101ffeug9mfrO0v161eh`; coordenador/observer:
`ses_ec3692bb6ffeW2ypMeuSN2v8Ug`. Pacote `csv-own-orders-native-c10`, revisão `r1`,
quatro contratos; DAG `0001 → {0002,0003} → 0004`.

| Registro canônico | Sessão nativa | Mensagem final exata |
|---|---|---|
| Fidelity PASS | `ses_ebf19f63affe52X2mitA2QWLYi` | `msg_140e745a20019kf3hxGv4h7aED` |
| Quality PASS | `ses_ebf16bee0ffe0gNbD0qgz2SUUG` | `msg_140e98dc5001pRtq0YOArJtNVo` |

Ambos os exports locais registram `openai/gpt-6-astra`, variant `default`, agent
`spec-driven-superpowers-reviewer`, parent coordenador, final `finish: stop` e
session outcome `succeeded`. Os bytes de request/final text foram comparados
**exatamente** aos arquivos request/evidence registrados; digests conferem. O final
F precede o request Q nos timestamps exportados; o request Q nomeia o digest F
registrado e Q.priorReviewDigest coincide. Isso é evidência operacional do harness
confiado, não assinatura independente contra comprometimento do host nem prova de
sandbox/ausência de todo efeito colateral em plataformas arbitrárias.

```text
candidateSha256  850fcb25cc5811b6cfba2f26862efbfa10c556eeabff2f8b7ec81527f8aaaa2a
F envelopeDigest 14983fc6ba1e6795b19a264edee6933cfc1d5011a32626326fb51d98a15c6397
Q envelopeDigest 600900dcf9995e043978f30d771960ba2b76eeb0955f52e5071d4d2018cc33f4
final manifest   367c3bcae20e2792871791212dc93027ba40c4c78b681bc0c2508f77d6cd4207
readbackSha256   324aa8a88e5f82e88f8a5701f36fb8e28a60e10441dd9b9ea26e1a3f06a41035
```

Nesta consolidação C11, um **novo processo Node** reexecutou `verifyPlanningReceipt`
no destino canônico: matched=true, errors=[], reviewMatched=true. Recriar
deterministicamente `createPlanningReturn` a partir do intake/receipt produziu objeto
igual ao retorno salvo: status delivered, owner null, produto planning fulfilled.
[Readback C11](c10-native-evidence/canonical-readback.json) não afirma semanticCertification.
O handoff demonstrado é o **retorno de planejamento v2**, não um execution-handoff
operacional nem admissão Stage-3. Não há alvo real inspecionado, grants de execução
reais ou boundary de host enforcement para isso; esse gate permanece obrigatório.

## Achados, anomalias e contradições preservadas

- **F-001 e Q-001 continuam non-material/open**, com evidência, correção esperada e
  disposição preservadas. F-001: resumo de task 0002 diz “ignore/reject” onde design
  e aceite exigem rejeição 400. Q-001: enumeração de estados de origem omite
  empty/denied, embora o invariante só-loading-disabled indique controles habilitados.
  Não declarar zero findings. Correção material futura exige nova revisão/F→Q;
  nada foi editado silenciosamente depois dos reviews.
- ROOT relatou Q extra `ses_ebf16cc0effenPI3ecvu5aYna2`, também PASS, disparado
  inadvertidamente após restart/confusão de continuidade. **Não é o Q registrado**.
  C11 não invocou/leu essa sessão; o relato e sua atribuição constam no metadata.
- ROOT relatou retry duplicado de registro F rejeitado por EEXIST/already registered.
  Não reproduzido em C11; há um único F canônico e seus bytes conferem com o export.
- Manifest mantém `originalRequestedProduct.status: in_progress` como material
  congelado, enquanto state/attendance e retorno informam entrega/fulfilled. É uma
  divergência de bookkeeping explícita, **não normalizada nesta entrega**.
- C16 conserva o assessment pré-publicação que ainda dizia C15 pendente. C15 final
  e receipt comprovam a publicação posterior; o motivo C16 é um snapshot anterior,
  não narrativa atualizada. Não alteramos manifest/digests para esconder isso.
- `synthetic:false` não torna o domínio uma aplicação real: aqui distingue registros/
  observações reais de fixtures fabricadas. O alvo, interfaces e quatro tasks são
  sintéticos/futuros. Nenhum teste futuro dos contratos foi executado.
- O aviso de bloqueio autor/coordenador no README histórico do kit está supersedido
  pela correção de fonte; o kit foi conservado para re-review, não reescrito.

## Persistência de evidência e integridade

[Diretório auditável](c10-native-evidence/README.md): 16 arquivos exatos do pacote
canônico (fontes/índice/DAG/contratos/manifest/reviews/finais), receipt/return/intake,
bindings, assessments e requests selecionados; metadados mínimos derivados dos
exports. **Nenhum raw session export, reasoning/encrypted reasoning, providerState,
snapshot ou payload interno de tool foi copiado.** Modelo/tempos/agent/finish/parent
foram selecionados por allowlist; texto final/request somente.

As cópias são **história de auditoria autorizada**, não instalação, runtime, backup
operacional ou pacote vivo alternativo. `destination` permanece absoluto em /tmp;
verificar o receipt copiado continua apontando ao canônico, não valida este espelho
como novo destino. Nenhum dado/evidência único do kit foi removido.

- [PASSIVE-SOURCE-SHA256.txt](PASSIVE-SOURCE-SHA256.txt): 57 superfícies atuais;
  somente PROJECT-STATUS muda nesta fase documental. Inclui as seis remoções git.
- [Lista de remoções](c10-native-evidence/source-deletions.txt): confirma git e
  manifesto; distingue componentes 1B não rastreados que já haviam sido retirados.
- [FINAL-ARTIFACT-SHA256.txt](c10-native-evidence/FINAL-ARTIFACT-SHA256.txt): hashes
  separados de relatório/worklog/status/manifestações/logs/evidência. Exclui a si
  próprio para evitar recursão. FINAL-SOURCE histórico anterior permanece intocado.

## Cadeia C11 pós-documentação e aceite

Comando exigido, executado uma vez após preparar estes documentos:
`TMPDIR=/tmp/opencode npm test && npm run check && npm run validate && git diff --check`.
**Resultado observado: exit 0, 589/589**, zero falhas/cancelamentos/skips;
check/validate/diff-check passaram. [Log integral](c10-native-evidence/c11-validation.log)
e [status estruturado](c10-native-evidence/c11-validation-status.json). Seleção normal
explícita `tests/*.test.js`; nenhum runner/fixture histórico foi descoberto por escopo.
Produto/código/testes/SKILL permaneceram congelados. ROOT verificará independentemente
log, hashes e destino/readback. Publicação/release,
instalação real e Stage-3 não estão implicitamente aprovados por C10/C11.
