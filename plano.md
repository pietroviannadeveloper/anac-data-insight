# Plano — PTA Mensal: dashboards mais interativos e menos poluídos

## Objetivo
Reduzir a densidade visual da aba `/ptamensal` e tornar os gráficos/tabelas mais interativos,
sem remover indicadores existentes nem alterar regras de negócio ou contratos com a API.

## Contexto do problema
`apps/web/app/ptamensal/page.tsx` tem 1649 linhas e concentra, sempre visível e empilhado
verticalmente, na seguinte ordem:
1. Painel de upload de planilhas (já colapsável).
2. 5 KPI cards "gerais" (Planejado/Realizado/Agendado/Sem Agendamento/Cronograma).
3. Bloco de KPIs "do período selecionado" — quase duplica o bloco anterior (mesmas métricas,
   escopo diferente: ano todo vs. mês selecionado).
4. Barra de Taxa de Execução do mês.
5. Gráfico de barras "Execução Mensal" (12 meses) + Pizza "Distribuição de Status" — não colapsáveis.
6. Gráfico "Execução por Gerência" — não colapsável, até 12 barras.
7. Tabela "Servidores" — já colapsável (`CollapsibleCard`).
8. Tabela "PCDPs" — já colapsável (`CollapsibleCard`).
9. Tabela "Atividades" com 12 colunas, filtros e paginação.

Problemas identificados:
- **Duplicação de KPIs** (itens 2 e 3): mesmas métricas em dois lugares — a maior fonte de "poluição".
- **Inconsistência de padrão**: Servidores/PCDPs já usam `CollapsibleCard`, mas os gráficos (itens 5–6)
  não usam o mesmo padrão, então ficam sempre expandidos ocupando a tela.
- **Baixa interatividade**: os gráficos são só leitura. Os cards de tipo de planilha (item 1) já
  implementam clique-para-filtrar (`filterTipoBI`); os gráficos de execução mensal e por gerência não —
  seria natural clicar numa barra do mês para selecionar o período, ou numa gerência para filtrar a tabela.
- **Tabela de atividades densa**: 12 colunas sempre visíveis é pesado, principalmente em telas menores.

## Arquitetura atual relacionada
- Componentes reutilizáveis já existentes e usados neste padrão: `CollapsibleCard` (definido
  localmente no próprio arquivo), `Reveal` (`components/ui/Reveal.tsx`, anima entrada ao rolar),
  `KpiCard`, `ChartTooltip`. Devem ser reaproveitados, não recriados.
- Gráficos usam Recharts (`BarChart`, `PieChart`) já com gradientes e animação de entrada.
- Estado do período (`periodoMes`, `periodoAnoCompleto`) já existe e alimenta os KPIs do item 3 —
  a consolidação deve reusar esse estado, não criar um novo.
- Filtros da tabela de atividades (`filterMes`, `filterGerencia`, etc.) já existem — os gráficos
  interativos devem escrever nesses mesmos estados, não criar filtros paralelos.

## Arquivos prováveis impactados
- `apps/web/app/ptamensal/page.tsx` (principal, único arquivo de código-fonte tocado).
- Nenhuma mudança de API/backend prevista — dado já vem pronto em `bi` (`ConsolidatedBI`).

## Etapas de implementação

1. **Consolidar KPIs duplicados — exceto Cronograma** — substituir os blocos 2 e 3 por um único
   bloco com toggle "Mês selecionado / Ano completo" (reaproveitando `periodoMes`/
   `periodoAnoCompleto`). O card **Cronograma não entra no toggle**: ele não é um KPI duplicado
   (mostra `situacao_cronograma` + realizado/planejado até o mês atual, informação própria) e
   deve continuar sempre visível, fora do bloco alternável.
2. **Agrupar seções secundárias em abas** — trocar o empilhamento vertical de "Execução por
   Gerência", "Servidores" e "PCDPs" por navegação em abas. "Execução Mensal" + "Distribuição de
   Status" continuam na visão principal. **Cada `TabPanel` só monta o conteúdo quando a aba está
   ativa** (unmount, não `display:none`) — Recharts não redimensiona corretamente dentro de
   containers escondidos via CSS.
3. **Interatividade nos gráficos**:
   - Clique numa barra do gráfico "Execução Mensal" → seleciona esse mês em `periodoMes`, usando
     o índice/`mes_num` do dado clicado (não o texto do label, que já vem abreviado em pt-BR).
   - Clique numa fatia da pizza "Distribuição de Status" → aplica `filterStatus` com o valor
     correto (`realizado`, `agendado`, `sem-agendamento` — mapear a partir do `name` da fatia,
     que usa rótulos como "Sem Agend.") e rola até a tabela via `ref`/`scrollIntoView` (não existe
     scroll pronto para reaproveitar: o botão "Ver atividades do período" hoje só filtra/pagina,
     não rola).
   - Clique numa barra de "Execução por Gerência" → aplica `filterGerencia` e rola do mesmo jeito.
   - Ao aplicar qualquer filtro por clique, preservar o filtro de tipo já ativo (`filterTipoBI`
     no dashboard vs. `filterTipo` na tabela são independentes hoje — não sincronizar os dois,
     só evitar que um clique no gráfico apague um filtro de tipo que o usuário já tinha escolhido
     na tabela).
4. **Reduzir densidade da tabela de Atividades** — esconder por padrão colunas secundárias
   (Processo, PCDP) atrás de um toggle "Mostrar todas as colunas", mantendo-as pesquisáveis
   via `search`.

## Divisão do trabalho entre agentes

Codex apontou risco de edição paralela no mesmo arquivo (`ptamensal/page.tsx` é o único arquivo
de código tocado por quase todas as etapas) — por isso a divisão evita dois agentes editando o
mesmo arquivo ao mesmo tempo:

- **Claude Code (eu, Tech-Lead)**: implemento sozinho as etapas 1, 2, 3 e 4 em `ptamensal/page.tsx`
  — é um único arquivo, mudança arquitetural (estado, composição, interatividade), não faz
  sentido fatiar entre agentes dentro dele.
- **Claude Code #2 (Claude Worker)**: constrói em paralelo um componente `Tabs` reutilizável e
  isolado em `apps/web/components/ui/Tabs.tsx` (arquivo novo, sem overlap comigo) — acessível
  (`role="tablist"`, `aria-selected`, navegação por seta), estilo consistente com o resto do
  projeto (`bg-white/4 border-white/8`, padrão de cores já usado em `FILTER_CHIPS`), e **cada
  painel só renderiza os filhos quando ativo** (mesmo princípio do `Reveal`, para não quebrar
  Recharts). Eu integro esse componente na etapa 2 depois que ele terminar.
- **Codex #2 (QA)**: não edita código. Ao final da implementação, testa a página no navegador
  (`localhost:3000/ptamensal`, API em `localhost:8001`) seguindo o plano de testes abaixo e
  reporta bugs/regressões.
- **Codex (revisor técnico)**: já revisou este plano (ver `## Revisão do Codex`) e revisa o diff
  final antes de qualquer commit.

## Revisão do Codex (resumo)

Veredito: **Aprovado com ressalvas**, incorporadas nas etapas acima:
1. Cronograma não é KPI duplicado — deve ficar fora do toggle geral/mês (etapa 1).
2. Não existe scroll pronto para reaproveitar no clique dos gráficos — precisa `ref`/`id`
   explícito (etapa 3).
3. Recharts pode renderizar mal se escondido via CSS dentro de aba inativa — painéis devem
   desmontar o conteúdo, não escondê-lo (etapa 2, componente `Tabs`).
4. Mapear corretamente o rótulo da fatia da pizza ("Sem Agend.") para o valor de filtro
   (`sem-agendamento`) e usar `mes_num` (não o texto do mês) no clique do gráfico mensal (etapa 3).
5. Risco de implementação paralela no mesmo arquivo — mitigado pela divisão de trabalho acima.

## Pontos que devem ser revisados pelo Codex (na revisão final do diff)
- Se a consolidação dos KPIs manteve o Cronograma sempre visível.
- Se os `TabPanel`s realmente desmontam o conteúdo inativo (não só escondem via CSS).
- Se os cliques de filtro nos gráficos usam os valores corretos (`mes_num`, mapeamento de status)
  e não apagam um filtro de tipo que o usuário já tinha ativo.
- Consistência visual com o resto do projeto (cor institucional, padrões de `CollapsibleCard`).

## Critérios de aceite
- Nenhum indicador hoje visível deixa de existir — apenas reorganizado.
- Nenhuma chamada de API nova é necessária (dado já vem em `summary.consolidado`).
- Build (`npm run build`) e lint (`npm run lint`) passam sem erros novos.
- Página testada manualmente em `localhost:3000/ptamensal`: upload, filtros, cliques nos
  gráficos e abas funcionando.
- Nenhuma regressão nas telas `/dashboard`, `/pta/[tipo]/[year]` (compartilham `Reveal`/padrões
  visuais, mas não são tocadas).

## Riscos técnicos
- Reestruturar em abas pode quebrar o link direto para uma seção específica, se algum lugar do
  app aponta para âncoras dentro da página — precisa checar `grep -rn "ptamensal#"`.
- Cliques em gráficos precisam de `cursor-pointer` e feedback visual (hover), senão a
  interatividade fica "escondida" e o ganho de UX não se realiza.
- Consolidar os dois blocos de KPI é a mudança de maior risco de "esconder" algo que algum
  usuário específico esperava ver sempre — por isso o toggle mantém ambas as visões acessíveis
  em vez de escolher uma só.

## Plano de testes
- Manual: abrir `/ptamensal` com dados carregados, alternar toggle geral/mês, clicar nas abas,
  clicar em barras/fatias dos gráficos e conferir que os filtros da tabela respondem.
- `npm run lint` e `npm run build` em `apps/web`.

## Comandos de validação
```bash
cd apps/web && npm run lint && npm run build
```

## Revisão final do Codex (diff)
Veredito: **Aprovado com ressalvas** na implementação técnica (não é aprovação de commit).
1. **Bug real, corrigido**: `defaultTab="gerencia"` era fixo — se `por_gerencia` estivesse vazio,
   a aba abria desabilitada e o painel ficava vazio. Corrigido: `defaultDashTab` calcula a
   primeira aba com dado disponível (gerência → servidores → PCDPs) e `key={defaultDashTab}`
   remonta o `<Tabs>` se o melhor default mudar (ex.: troca de `filterTipoBI` altera quais
   seções têm dado). Trade-off aceito: isso também reresseta uma seleção manual do usuário
   nesse caso raro — não implementado o auto-switch "reage se a aba ativa virar inválida"
   dentro do componente `Tabs` por ser mudança mais invasiva para um ganho marginal.
2. **Aceito como comportamento existente, não corrigido**: cliques nos gráficos que setam
   `filterGerencia`/`filterStatus` combinam (AND) com `filterDiaVigente`/`filterMesVigente` se
   estiverem ativos — mesma semântica que já existia para todos os filtros manuais da tabela
   (input de gerência, select de status). Não é um bug introduzido por esta tarefa.
3. **Aplicado (custo baixo)**: botão "Ver atividades do período" agora também chama
   `scrollToActivities()`, por consistência com os cliques nos gráficos.

## QA final do Codex #2
Veredito: **Aprovado com ressalvas**.
1. Mobile (390x844): sem overflow horizontal global; abas quebram linha corretamente; tabela
   usa scroll horizontal interno (padrão já existente no projeto para tabelas largas).
2. Navegação por teclado nas abas: ArrowRight/ArrowLeft move o foco e ativa a aba corretamente.
3. Aba PCDPs desabilitada (dataset simulado sem PCDPs): `disabled=true` aplicado, não quebra,
   não é possível ativá-la.
4. Regressão: `/dashboard` e `/pta/CICLO_BASE/2021` carregam normalmente (200, sem erro).
5. Console do navegador em `/ptamensal`: nenhum erro JS; só warning padrão do Next sobre LCP
   em `/anac-logo.png` (pré-existente, não relacionado a esta tarefa).
6. **Única ressalva**: mojibake (`InspeÃ§Ã£o`, `BrasÃ­lia`) em parte dos dados da tabela de
   Atividades. Confirmado como **pré-existente** — vem da importação/dados (`file_reader.py`
   ou encoding da planilha de origem), não da mudança desta tarefa (outros textos da mesma
   tabela renderizam acentos normalmente). **Fora do escopo** — registrado aqui para o Pietro
   decidir se abre uma tarefa separada de correção de encoding no pipeline de leitura de
   arquivos.

## Status
- Implementação concluída (etapas 1-4 em `ptamensal/page.tsx` + componente `Tabs.tsx` novo) +
  correção do fallback de aba padrão apontada pela revisão final do Codex.
- `npx tsc --noEmit` e `npm run build` passam sem erros. Sem ESLint configurado no projeto
  (pré-existente, fora do escopo).
- Validado manualmente via portal de navegador (Maestri) e via QA automatizado do Codex #2
  (Playwright): golden path, mobile, teclado, aba desabilitada e regressão — todos OK.
- **Concluído.** Nenhum commit realizado — aguardando autorização do Pietro.
