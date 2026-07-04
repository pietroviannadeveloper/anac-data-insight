# Diagnóstico do Roadmap

**Data:** 2026-06-09
**Escopo:** Comparação entre `docs/roadmap.md` (estado declarado) e o código/infraestrutura atual do repositório. Análise somente leitura — nenhum arquivo de código foi alterado.

---

## 1. Resumo executivo

O projeto está em estado bem mais avançado do que o roadmap sugere. As versões v0.1–v0.4 estão de fato concluídas e bem evidenciadas no código (RBAC, JWT em cookie httpOnly, auditoria, módulo PTA completo, testes ≥80%). Os três itens listados como "v0.5 em andamento" já estão, na prática, **majoritariamente implementados no código** — o que falta é trabalho operacional/externo (deploy real no servidor da ANAC) e refinamento de documentação (OpenAPI customizada). O backlog tem 2 itens totalmente não iniciados (Power BI, upload em lote), 1 com estrutura pronta mas sem novos tipos definidos, 1 já implementado (mapa interativo) e 1 parcialmente coberto (dashboard multi-ano). Há também três arquivos não rastreados (`apps/api/package.json`, `apps/api/package-lock.json`, `apps/api/.coverage`) que parecem acidentais e devem ser limpos antes do próximo commit.

---

## 2. Itens concluídos

Confirmados com evidência de código (além dos já marcados ✅ no roadmap v0.1–v0.4):

- **JWT httpOnly + RBAC 3 níveis** — `apps/api/app/core/dependencies.py`, `apps/api/app/models/user.py`.
- **AuditLog completo para gestão de usuários** — `apps/api/app/routes/admin.py` registra `user_created`, `user_activated`/`deactivated`, `password_reset`, `user_deleted`; endpoint `GET /admin/audit-logs` com filtros e paginação.
- **Rate limiting em `/auth/token` e `/auth/google`** — `apps/api/app/core/rate_limit.py` (sliding window in-memory, thread-safe).
- **Validação de SECRET_KEY/AUTH_PASSWORD em produção** — `_validate_settings()` em `apps/api/app/main.py` rejeita valores padrão/inseguros.
- **Email service implementado e integrado** — `apps/api/app/services/email_service.py` (SMTP, TLS, HTML templates) é chamado em `routes/upload.py` (`_post_analysis_hooks`) e em `services/scheduler.py` (relatórios agendados via APScheduler). A remoção desta linha do backlog (alteração não commitada em `docs/roadmap.md`) está correta.
- **PostgreSQL como banco padrão** — `apps/api/app/core/config.py` já define `database_url` padrão como `postgresql+psycopg2://...`; `docker-compose.yml` sobe serviço `postgres:16-alpine` com healthcheck; `apps/api/.env` local já aponta para Postgres; Alembic configurado (`alembic.ini`, 5 migrations em `apps/api/alembic/versions/`).
- **Dockerfiles + `.env.production.example`** — `apps/api/Dockerfile` (Python 3.11-slim, Uvicorn multi-worker), `apps/web/Dockerfile` (Next 14 multi-stage), `.env.production.example` documenta SECRET_KEY, AUTH_PASSWORD, SMTP, CORS, pool size.
- **OpenAPI funcional (auto-gerado)** — `apps/api/app/main.py` define `title`, `description`, `version`, e routers com `tags`. Schemas Pydantic em `app/schemas/`.
- **Mapa interativo de cobertura por cidade** (item do backlog) — `apps/web/components/analysis/MapTab.tsx` + `MapView.tsx` (Leaflet), consumindo `/api/v1/analyses/{id}/map-data`, com severidade por cidade.
- **CI** — `.github/workflows/ci.yml` roda lint (ruff/ESLint), pytest com cobertura, type-check (tsc) e build do frontend.
- **Cobertura de testes** — 17 arquivos de teste no backend (`apps/api/tests/`), 15 arquivos `*.test.tsx` no frontend.

---

## 3. Itens parcialmente concluídos

### 3.1 v0.5 — Migração para PostgreSQL
- **O que existe:** configuração padrão, docker-compose, Alembic, `.env` local já usando Postgres.
- **O que falta:** validar a migração com dados reais de produção/homologação (não há evidência de teste de carga ou rodada de `alembic upgrade head` contra um banco com dados existentes); documentar o procedimento de migração de dados de SQLite legado, se houver instância em uso.
- **Arquivos relacionados:** `apps/api/app/db/database.py`, `apps/api/alembic/versions/`, `docker-compose.yml`.
- **Prioridade:** Média (tecnicamente pronto, falta validação operacional).

### 3.2 v0.5 — Deploy em servidor interno ANAC
- **O que existe:** Dockerfiles, docker-compose, `.env.production.example`, validação de settings em produção.
- **O que falta:** não há pasta `deploy/`, runbook, configuração de nginx/reverse proxy, certificados TLS, ou registro de execução real no servidor da ANAC. Esta é majoritariamente uma tarefa operacional/infra fora do repositório.
- **Prioridade:** Alta (depende de acesso/infra da ANAC — bloqueio externo).

### 3.3 v0.5 — Documentação de API (OpenAPI expandida)
- **O que existe:** Swagger UI funcional (`/docs`), tags por domínio, schemas Pydantic nas rotas principais.
- **O que falta:** `response_model` nem sempre presente em todas as rotas; sem `tags_metadata` descritivo, sem exemplos (`examples=`) nos schemas, sem página de documentação externa (ex. Redoc customizado ou export para Postman/Insomnia).
- **Arquivos relacionados:** `apps/api/app/main.py`, `apps/api/app/routes/*.py`, `apps/api/app/schemas/*.py`.
- **Prioridade:** Baixa.

### 3.4 Backlog — Suporte a outros tipos de planilha (RBAC, certificações, fiscalizações)
- **O que existe:** `services/classifier.py` define `SpreadsheetType = Literal["ciclos", "generic", "unknown"]` com pipeline genérico (`generic_analyzer`) capaz de processar planilhas não reconhecidas.
- **O que falta:** nenhum tipo novo (`rbac`, `certificacoes`, `fiscalizacoes`) foi adicionado ao enum nem possui analisador dedicado conforme o passo-a-passo de "Como adicionar um novo tipo de planilha" do CLAUDE.md.
- **Prioridade:** Baixa (depende de planilhas de exemplo da gerência).

### 3.5 Backlog — Dashboard executivo consolidado multi-ano
- **O que existe:** `GET /api/v1/dashboard/summary` com filtros `analysis_id`, `date_from`, `date_to`; `apps/web/app/dashboard/page.tsx` com KPIs e gráficos Recharts.
- **O que falta:** não há agregação que cruze múltiplos anos do histórico PTA (2021-2025, ver `docs/historicoPTA/`) num único relatório executivo consolidado — o dashboard atual é por análise/período, não multi-ano.
- **Prioridade:** Média.

### 3.6 Feature `/pta` — Histórico e Comparativo (docs/feature-pta.md)
- **Status declarado:** "NÃO IMPLEMENTADO — aguardando arquivos e critérios da gerência" (em `docs/context.md`), mas o roadmap v0.2 já marca "Módulo PTA anual: snapshots, histórico, comparativo entre anos" e "Planejamento PTA assistido por IA" como ✅ concluídos, e existem rotas/páginas `pta/`, `pta/historico/`, `pta/[tipo]/[year]/`, `planejamentopta/`.
- **Inconsistência a resolver:** confirmar com a gerência se a lógica de planejamento via IA (mencionada como "PENDENTE" em `docs/context.md`) já foi de fato definida/implementada ou se o botão "Planejar PTA" continua desabilitado conforme a especificação original.
- **Prioridade:** Média (risco de divergência entre documentação e comportamento real).

---

## 4. Itens pendentes

- **Integração com Power BI** — nenhum endpoint OData/conector identificado. Não iniciado.
- **Upload em lote (múltiplos arquivos simultâneos)** — `routes/upload.py` aceita um único `UploadFile`; frontend de upload não suporta seleção múltipla. Não iniciado.
- **Runbook/infra de deploy no servidor ANAC** — ver item 3.2.
- **Tipos de planilha adicionais (RBAC, certificações, fiscalizações)** — ver item 3.4, depende de planilhas de exemplo a serem fornecidas por Pietro.
- **Dashboard executivo multi-ano** — ver item 3.5.

---

## 5. Lacunas não documentadas no roadmap

1. **Arquivos não rastreados potencialmente acidentais no `apps/api/`:**
   - `apps/api/package.json` contém apenas `{"dependencies": {"sonner": "^2.0.7"}}` — `sonner` é uma lib de toast React e já está corretamente declarada em `apps/web/package.json` (v2.0.7, usada em `app/layout.tsx`). O arquivo em `apps/api/` parece ter sido criado por engano (ex.: `npm install` rodado no diretório errado).
   - `apps/api/package-lock.json` — lock file decorrente do mesmo engano.
   - `apps/api/.coverage` — artefato de execução de `pytest --cov`, não deveria ser versionado; `.gitignore` não cobre `.coverage` (apenas `.env*`, `.venv/`, `venv/`, `next-env.d.ts`).

2. **`.gitignore` incompleto** — falta entrada para `.coverage`, `htmlcov/`, `coverage.xml`, e (se aplicável) `apps/api/package*.json`/`node_modules` caso sejam realmente indesejados ali.

3. **Rate limiting in-memory não escala para múltiplos workers** — comentário no próprio `apps/api/app/core/rate_limit.py` indica que em produção com `WEB_CONCURRENCY > 1` (Dockerfile usa default 2), cada worker tem seu próprio contador, então o limite efetivo é multiplicado pelo número de workers. Não é um bloqueio, mas é uma lacuna de segurança não documentada.

4. **Chave de API exposta em `apps/api/.env`** — `GEMINI_API_KEY` está presente em texto puro no `.env` local. O arquivo está corretamente listado no `.gitignore` (não está no histórico do git), mas vale reforçar a prática de rotação caso esse arquivo já tenha sido compartilhado fora do controle de versão.

5. **Inconsistência entre `docs/feature-pta.md`/`docs/context.md` e o roadmap** — ver item 3.6.

---

## 6. Riscos e bloqueios

| Risco/Bloqueio | Tipo | Impacto |
|---|---|---|
| Deploy real no servidor ANAC depende de acesso/infra externa à equipe de dev | Bloqueio externo | Alto — impede fechar v0.5 |
| Critérios de "Planejar PTA" via IA ainda pendentes de definição pela gerência | Dependência externa | Médio — funcionalidade pode ficar incompleta/desabilitada indefinidamente |
| Rate limiting in-memory não é multi-worker safe | Risco técnico | Médio em produção com `WEB_CONCURRENCY>1` (mencionado como TODO futuro pelo próprio código) |
| Arquivos `apps/api/package.json`/`package-lock.json`/`​.coverage` não commitados podem ser commitados por engano | Higiene de repositório | Baixo, mas fácil de corrigir agora |
| Backlog de novos tipos de planilha depende de planilhas de exemplo da gerência (RBAC, certificações, fiscalizações) | Dependência externa | Baixo — não bloqueia v0.5 |

---

## 7. Próximas ações recomendadas

1. **Limpar arquivos não rastreados** — remover `apps/api/package.json` e `apps/api/package-lock.json` (acidentais), e adicionar `.coverage`, `htmlcov/`, `coverage.xml` ao `.gitignore`.
2. **Atualizar `docs/roadmap.md`** para refletir que PostgreSQL, Dockerfiles, OpenAPI básica e email service já estão implementados — mover esses itens de "v0.5 em andamento" para "concluído", deixando como pendente apenas: (a) execução do deploy real no servidor ANAC, (b) expansão opcional do OpenAPI (tags_metadata, exemplos).
3. **Confirmar com a gerência** o status real da feature `/pta` — alinhar `docs/feature-pta.md`/`docs/context.md` (status "NÃO IMPLEMENTADO") com o roadmap v0.2 (marcado ✅), já que o código aparenta ter as rotas/páginas implementadas.
4. **Planejar runbook de deploy** — criar `docs/deploy.md` com passos para subir via `docker-compose` no servidor ANAC, configuração de proxy reverso/TLS e variáveis de produção.
5. **Avaliar migração do rate limiter para Redis** (ou usar `WEB_CONCURRENCY=1` por enquanto) antes de ir para produção multi-worker.
6. **Priorizar backlog**: solicitar a Pietro as planilhas de exemplo para RBAC/certificações/fiscalizações, se essa expansão for prioridade para o próximo ciclo.
7. **Avaliar dashboard executivo multi-ano** — definir requisitos com a gerência usando os dados já disponíveis em `docs/historicoPTA/`.

---

## 8. Checklist final

- [ ] Remover `apps/api/package.json` e `apps/api/package-lock.json` (acidentais)
- [ ] Adicionar `.coverage`, `htmlcov/`, `coverage.xml` ao `.gitignore`
- [ ] Atualizar `docs/roadmap.md` movendo PostgreSQL/Docker/OpenAPI básico/email service para "concluído"
- [ ] Validar `docs/feature-pta.md` vs. estado real do código `/pta` e `/planejamentopta`
- [ ] Criar runbook de deploy (`docs/deploy.md`) para servidor interno ANAC
- [ ] Avaliar e mitigar limitação do rate limiter em ambiente multi-worker
- [ ] Expandir OpenAPI: `tags_metadata`, `response_model` em rotas restantes, exemplos em schemas
- [ ] Definir prioridade e planilhas de exemplo para novos tipos (RBAC, certificações, fiscalizações)
- [ ] Especificar requisitos do "dashboard executivo consolidado multi-ano" com a gerência
- [ ] Avaliar upload em lote (múltiplos arquivos) e integração Power BI como próximos itens de backlog
