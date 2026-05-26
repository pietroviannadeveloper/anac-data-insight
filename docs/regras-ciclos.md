# Regras de Análise — Planilhas de Ciclos de Inspeção

## Identificação do Tipo de Planilha

Uma planilha é classificada como **ciclos** quando contém ao menos 3 das seguintes colunas obrigatórias (após normalização: minúsculas, sem espaços/underscores):

| Coluna | Descrição |
|---|---|
| `item` | Número sequencial da atividade. |
| `atividade` | Descrição da atividade de inspeção. |
| `gerencia` | Gerência responsável pela atividade. |
| `mes` | Mês planejado no ciclo. |
| `mesagendado` | Mês em que a atividade foi agendada. |
| `mesrealizado` | Mês em que a atividade foi efetivamente realizada. |

Colunas opcionais que aumentam a confiança na classificação:

`setor`, `regulado`, `cidade`, `giaso`, `processo`, `pcdp`, `prioridade`

## Regras de Status por Atividade

Cada linha da planilha recebe um status calculado:

| Status | Condição |
|---|---|
| `realizado` | Campo `mes_realizado` está preenchido (não nulo, não vazio). |
| `agendado` | Campo `mes_agendado` está preenchido, mas `mes_realizado` está vazio/nulo. |
| `sem-agendamento` | Ambos `mes_agendado` e `mes_realizado` estão vazios/nulos. |

## Flags de Pendência por Linha

| Flag | Regra |
|---|---|
| `sem_giaso` | Coluna `giaso` está nula ou vazia. |
| `sem_pcdp` | Coluna `pcdp` está nula ou vazia. |
| `sem_processo` | Coluna `processo` está nula ou vazia. |
| `local_indefinido` | Coluna `cidade` (ou equivalente) está nula, vazia, `"indefinido"`, `"a definir"`, ou `"tbd"` (case-insensitive). |

## Regras Agregadas

| Indicador | Regra |
|---|---|
| `pcdp_duplicada` | O mesmo valor de PCDP aparece em mais de uma linha da planilha. Contagem de PCDPs duplicados. |
| `multiplas_pcdps` | O mesmo par `atividade` + `regulado` possui mais de um valor distinto de PCDP. Contagem de atividades com este problema. |

## Indicadores Calculados

| Indicador | Fórmula |
|---|---|
| `taxa_execucao` | `realizadas / total_atividades * 100` |
| `taxa_agendamento` | `(realizadas + agendadas) / total_atividades * 100` |
| `pendencias_criticas` | `sem_giaso + pcdp_duplicada + multiplas_pcdps` |

## Criticidade por Gerência (planejado)

Para cada gerência, calcula-se:

| Nível | Condição |
|---|---|
| Regular | Taxa de execução >= 80% e pendências críticas == 0 |
| Atenção | Taxa de execução entre 60% e 80%, ou pendências críticas <= 2 |
| Crítico | Taxa de execução entre 40% e 60%, ou pendências críticas <= 5 |
| Muito crítico | Taxa de execução < 40%, ou pendências críticas > 5 |
