# Roadmap — ANAC Data Insight

> Atualizado em 2026-06-08. Itens marcados com ✅ foram entregues.

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

## 🔄 v0.4 — Em andamento / próximos

- [ ] Login institucional via Microsoft Entra ID (Azure AD) — substitui Google OAuth; necessário pois ANAC usa Outlook
- [ ] Migração de SQLite para PostgreSQL em produção
- [ ] Testes de componente (React Testing Library)
- [ ] Cobertura de testes backend (meta: >80%)
- [ ] Deploy em servidor interno ANAC
- [ ] Documentação de API (OpenAPI expandida)

---

## Backlog

- Notificações por e-mail: resumo periódico do PTA, alertas críticos (infraestrutura de email_service.py já existe)
- Integração com Power BI via conector dedicado
- Upload em lote (múltiplos arquivos simultâneos)
- Suporte a outros tipos de planilha (RBAC, certificações, fiscalizações)
- Mapa interativo de cobertura por cidade expandido
- Dashboard executivo consolidado multi-ano
