# Evidência C10 selecionada — espelho histórico, não pacote vivo

Canônico: `/tmp/opencode/asds-passive-c10-native/package`. Não rebasing/normalização
dos arquivos: `package/` guarda os 16 arquivos exatos listados pelo receipt original,
incluindo destinos absolutos, reviews e resultados. Top-level receipt/return/intake,
bindings, assessments e requests também são cópias exatas. São artefatos de auditoria
duráveis autorizados, não instalação alternativa ou runtime/backup operacional.

- `selected-artifacts.json`: origem, tamanho e SHA dos 24 arquivos copiados.
- `runtime-readback-metadata.json`: allowlist de session/message/time/model/agent/
  finish/parent extraída dos exports locais; confirma igualdade dos bytes request/final
  com os arquivos registrados. Sem conteúdo reasoning/providerState/tool/snapshot.
  Q extra e retry F constam com atribuição **relatado pela ROOT**, não observação nova.
- `canonical-readback.json`: novo Node C11 reabriu o destino original e recriou o
  retorno igual ao salvo. Não verifica este espelho como destino autorizado.
- `source-deletions.txt`: remoções da fonte, sem cópias operacionais ocultas.
- `c11-validation.log` / `c11-validation-status.json`: uma cadeia full C11 após docs.
- `FINAL-ARTIFACT-SHA256.txt`: caminhos relativos à raiz do repositório, excluindo
  o próprio arquivo. Pode ser conferido com `sha256sum -c CAMINHO` na raiz.

O kit /tmp foi preservado para ROOT; raw exports completos permanecem somente lá,
não foram publicados neste diretório. Os registros são operacionais sob confiança
no harness, não prova contra host malicioso. Domínio sintético, reviewers reais.
Os findings F-001/Q-001 nonmaterial/open permanecem. Não há produto executado nem
execution-handoff/admissão Stage-3 comprovados. Aceite de fonte ROOT/oracle pendente.
