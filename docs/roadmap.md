# Roadmap — ANAC Data Insight

> Atualizado em 2026-06-09. Itens marcados com ✅ foram entregues.

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

## 🔄 v0.5 — Em andamento / próximos

- [x] Migração de SQLite para PostgreSQL em produção (já é o padrão em `config.py`, `docker-compose.yml` e Alembic)
- [ ] Deploy público — **decidido**: frontend (`apps/web`) no **Vercel**, backend (`apps/api` + Postgres) no **Railway**, comunicação via rewrite same-origin do Next.js (`/api/*` → backend Railway). Detalhes e passo a passo em `docs/deploy.md` (a criar). Tarefas:
  - [ ] Ajustar `apps/web/next.config.js`: usar variável server-side `BACKEND_API_URL` (sem prefixo `NEXT_PUBLIC_`) como destino do rewrite, deixando `NEXT_PUBLIC_API_URL` indefinida em produção
  - [ ] Confirmar `secure=True` nos cookies quando `ENVIRONMENT=production`
  - [ ] Configurar projeto Railway: build via `apps/api/Dockerfile`, plugin Postgres, volume persistente para `apps/api/uploads/` e `apps/api/generated/`, `WEB_CONCURRENCY=1` (rate limiter é in-memory por worker)
  - [ ] Configurar projeto Vercel: root directory `apps/web`, env var `BACKEND_API_URL` apontando para o domínio gerado pelo Railway
  - [ ] Criar `docs/deploy.md` com o passo a passo completo
- [ ] Documentação de API (OpenAPI expandida)

---

## Backlog


- Integração com Power BI via conector dedicado
- Upload em lote (múltiplos arquivos simultâneos)
- Suporte a outros tipos de planilha (RBAC, certificações, fiscalizações)
- Mapa interativo de cobertura por cidade expandido
- Dashboard executivo consolidado multi-ano
