# Roadmap — ANAC Data Insight

> Atualizado em 2026-06-23 (sessão de governança e ação — Ciclos + PTA Mensal combinados). Itens marcados com ✅ foram entregues.

---

## ✅ MVP / v0.1 — Concluído

- [x] Estrutura do projeto (monorepo apps/web + apps/api)
- [x] Frontend Next.js 14 App Router (TypeScript, Tailwind)
- [x] Componente de upload com drag-and-drop
- [x] Backend FastAPI + SQLAlchemy + SQLite
- [x] Classificador de planilhas (ciclos, PTA, PDF, etc.)
- [x] Leitor de arquivos CSV/Excel com Polars
- [x] Análise completa de ciclos com regras de status e pendência
- [x] Indicadores por gerência, cidade, servidor
- [x] Tabela de atividades com filtros, paginação e busca
- [x] Geração de relatório PDF e DOCX
- [x] Exportação Excel (ciclos + atividades PTA mensal)
- [x] Camada de IA com cache e privacidade (indicadores, nunca dados brutos)
- [x] RBAC 3 níveis: viewer / analyst / admin
- [x] Autenticação JWT via cookie httpOnly
- [x] Auditoria de ações (analysis_created, deleted, exported)
- [x] CI/CD com GitHub Actions (lint + build + testes)

---

## ✅ v0.2 — Módulo PTA Concluído

- [x] Módulo PTA anual: snapshots, histórico, comparativo entre anos
- [x] Módulo PTA Mensal: upload, BI, dashboards interativos
- [x] KPIs consolidados: taxa de execução, situação do cronograma
- [x] Planejamento PTA assistido por IA
- [x] Exportar gráfico mensal (PNG via Canvas API)
- [x] Exportar atividades filtradas (.xlsx)
- [x] Dashboard comparativo de ciclos
- [x] Chat com IA contextual (análises + PTA)
- [x] Alertas configuráveis por métrica com threshold
- [x] Relatórios agendados (APScheduler + configurações de cron)

---

## ✅ v0.3 — Qualidade e infraestrutura

- [x] Migração Alembic para schema inicial
- [x] Docker Compose (api + web + postgres)
- [x] Rate limiting em /auth/token
- [x] Validação de SECRET_KEY em produção
- [x] E2E tests com Playwright (auth, PTA mensal, dashboard)
- [x] Correção de hydration mismatch SSR/client (isAdmin)

---

## ✅ v0.4 — Qualidade, UX e testes — Concluído

- [x] Filtros clicáveis por tipo de planilha no PTAMensal (chips + cards upload)
- [x] KPIs do BI atualizam ao filtrar (fetchSummary por parâmetro, sem stale closure)
- [x] Suporte a multi-filtro tipos[] no backend (ex.: PTA Completo = BASE + DESEMPENHO)
- [x] Chat com IA flutuante por página (AIChat widget com createPortal, tema dark ANAC)
- [x] Sugestões de perguntas contextuais por página (PTAMensal / Histórico PTA)
- [x] Testes de componente React Testing Library — 40 testes (AIChat, ConfirmDialog, Skeleton, StatusBadge)
- [x] Cobertura de testes backend ≥ 80% — 257 testes pytest passando
- [x] Configuração Jest com ts-jest, jsdom, mocks de CSS/arquivo e alias @/

---

## ✅ v0.5 — Infraestrutura, segurança e polimento — Concluído

- [x] Migração de SQLite para PostgreSQL em produção (padrão em `config.py`, `docker-compose.yml` e Alembic, 5 migrations)
- [x] Dockerfiles de produção (`apps/api/Dockerfile`, `apps/web/Dockerfile`) + `.env.production.example`
- [x] AuditLog completo para gestão de usuários (`user_created`, `activated/deactivated`, `password_reset`, `user_deleted`) com endpoint `GET /admin/audit-logs`
- [x] Rate limiting em `/auth/token` e `/auth/google` (sliding window in-memory)
- [x] Validação de `SECRET_KEY`/`AUTH_PASSWORD` em produção (`_validate_settings()`)
- [x] Serviço de e-mail (SMTP/TLS) integrado a upload e relatórios agendados
- [x] OpenAPI básico funcional (`/docs`, tags por domínio, schemas Pydantic)
- [x] Mapa interativo de cobertura por cidade (`MapTab.tsx` + Leaflet) — saiu do backlog
- [x] Limpeza de arquivos acidentais (`apps/api/package.json`/`package-lock.json`/`.coverage`) e `.gitignore` cobrindo `.coverage`/`htmlcov`/`coverage.xml`
- [x] Chat com IA flutuante global (`pageType="geral"`) injetado via `PageWrapper` em todas as páginas, exceto login/PTA mensal/histórico PTA/chat (que já têm assistente contextual próprio)
- [x] Redesign do widget de chat: tema "avião" arrastável com persistência de posição em `localStorage`
- [x] Refatoração de `fetch` direto para `api.uploadForm` em `planejamentopta/page.tsx` (conformidade com a regra de nunca chamar `fetch` direto nas páginas)

---

## ✅ v0.6 — Governança e ação operacional — Concluído

- [x] **Dicionário de dados institucional** — `DictionaryEntry` (categoria + valor canônico + aliases), CRUD em `/dictionary`, aba "Dicionário de dados" em `/admin`; serviço `dictionary_lookup.normalize()` só sinaliza divergências, nunca reescreve dados
- [x] **Validação de qualidade no upload** — `quality_validator.py`: bloqueia (erro) colunas obrigatórias ausentes em planilhas de ciclos; avisa (não bloqueante) sobre campos vazios, atividades duplicadas e valores de cidade/gerência divergentes do dicionário. `Analysis.quality_report` persiste o relatório; `force=true` permite prosseguir mesmo com erros. Tela de pré-processamento no frontend (`/upload`) com opção "Prosseguir mesmo assim"
- [x] **Central de pendências** — `PendenciaTracking`/`PendenciaHistorico`, **polimórfico** sobre `CicloActivity` (uploads via `/upload`) e `PTAMensalActivity` (PTA Mensal vigente) — ambas as fontes compartilham os mesmos flags (sem GIASO/PCDP/processo, local indefinido, sem agendamento); severidade automática (baixa/média/alta/crítica); página `/pendencias` com filtros (incluindo `origem`: Ciclos/PTA Mensal/ambas), paginação e tratamento de status (analyst/admin); criação automática nos três fluxos de upload (`/upload-and-analyze`, `/upload` + `POST /analyses`, `/pta-mensal/upload`); limpeza explícita de pendências órfãs ao excluir análises ou substituir/excluir uploads do PTA Mensal (sem FK polimórfica no banco)
- [x] **Trilha de auditoria analítica** — `analysis_created` agora registrado nos três caminhos de criação (antes só um auditava), com hash SHA-256 do arquivo, versão do classificador, linhas/colunas e score de qualidade; exports (`excel`/`pdf`/`docx`/`pptx`) registram a versão da análise; novo endpoint `GET /analyses/{id}/audit-trail` e aba "Auditoria" na página de detalhe
- [x] **Workflow de aprovação** — `Analysis.approval_status` (rascunho/em_validação/aprovado/rejeitado/arquivado) + `AnalysisApproval` (histórico); rotas `submit`/`approve`/`reject`/`archive`/`approval-history`; **informativo — não bloqueia exportação de relatórios**; badge e ações na listagem e no detalhe de análises, gated por role
- [x] **Briefing executivo + Exportação PowerPoint** — `pptx_report.py` (python-pptx) gera apresentação (capa, KPIs, ranking por tipo de ciclo, pendências críticas, recomendações de IA, metodologia); `GET /analyses/{id}/export/pptx`; `GET /dashboard/briefing` combina KPIs de Ciclos + PTA Mensal, pendências críticas ativas das duas fontes, gerências/cidades em atenção, e compara a taxa de execução com o ano anterior usando o **PTA Histórico** (`PTASnapshot`, indicadores agregados — não dá para recortar por gerência/cidade nessa comparação, só por tipo de ciclo); nova página `/briefing`
- [x] **Filtros por origem e por valores disponíveis** — `/briefing` ganhou o mesmo filtro `origem` (Ciclos/PTA Mensal/ambas) de `/pendencias`, mais um toggle "Comparar com PTA Histórico" (`incluir_historico`) já que a comparação usa uma fonte pré-agregada separada; novo endpoint `GET /pendencias/filtros` retorna os valores de gerência/cidade que **realmente existem** nos dados (escopados por origem), usado para trocar os campos de texto livre por `<select>` em ambas as páginas — evita filtrar por um valor que não existe e não retorna nada

---

## 🔄 v0.7 — Em andamento / próximos

- [ ] Deploy público — **decidido**: frontend (`apps/web`) no **Vercel**, backend (`apps/api` + Postgres) no **Railway**, comunicação via rewrite same-origin do Next.js (`/api/*` → backend Railway). Detalhes e passo a passo em `docs/deploy.md` (a criar). Tarefas:
  - [ ] Ajustar `apps/web/next.config.mjs`: usar variável server-side `BACKEND_API_URL` (sem prefixo `NEXT_PUBLIC_`) como destino do rewrite, deixando `NEXT_PUBLIC_API_URL` indefinida em produção
  - [ ] Confirmar `secure=True` nos cookies quando `ENVIRONMENT=production`
  - [ ] Configurar projeto Railway: build via `apps/api/Dockerfile`, plugin Postgres, volume persistente para `apps/api/uploads/` e `apps/api/generated/`, `WEB_CONCURRENCY=1` (rate limiter é in-memory por worker)
  - [ ] Configurar projeto Vercel: root directory `apps/web`, env var `BACKEND_API_URL` apontando para o domínio gerado pelo Railway
  - [ ] Criar `docs/deploy.md` com o passo a passo completo
- [ ] Versionamento de datasets e snapshots (comparação entre versões, rollback lógico, reprodução de análises a partir do snapshot original)
- [ ] Workflow de aprovação: avaliar se deve evoluir de informativo para bloqueio configurável de exportação
- [ ] Documentação de API expandida (`tags_metadata`, `response_model` em rotas restantes, exemplos nos schemas)
- [ ] Avaliar migração do rate limiter para Redis (ou manter `WEB_CONCURRENCY=1`) antes de produção multi-worker
- [ ] Confirmar com a gerência o status real da feature `/pta` — `docs/context.md` ainda descreve "planejamento via IA" como pendente de critérios, enquanto o roadmap e o código (`/planejamentopta`) já têm a funcionalidade implementada
- [ ] Corrigir inconsistência de chaves de coluna em `analyses.py::_save_ciclo_activities` (usa `"mesrealizado"`/`"mesagendado"` literais em vez do casamento fuzzy de `upload.py`, fazendo toda linha cair em "sem-agendamento" nesse caminho de upload em dois passos)
- [ ] Investigar mojibake em campos de texto do upload do PTA Mensal (`pta_mensal_service.py`) — valores acentuados (ex.: "Operações") saem double-encoded em UTF-8 na resposta da API; suspeita de decodificação latin-1/cp1252 trocada em algum ponto do parsing

---

## v0.8 — Inteligência avançada (futuro)

- Detecção de anomalias (queda de execução, concentração de atrasos)
- Forecast de execução do PTA
- Benchmarking entre períodos, gerências e cidades

---

## Backlog

- Integração com Power BI via conector dedicado
- Upload em lote (múltiplos arquivos simultâneos)
- Suporte a outros tipos de planilha (RBAC, certificações, fiscalizações) — `classifier.py` já tem pipeline genérico, falta planilhas de exemplo da gerência
- Dashboard executivo consolidado multi-ano (cruzando histórico PTA 2021-2025)
- Workflow de comentários/anotações mais rico (por atividade/gerência/cidade/KPI, menções, status) — hoje `Comment` é flat por análise
- Templates configuráveis de relatório (diretoria/gerência/operacional/auditoria)
