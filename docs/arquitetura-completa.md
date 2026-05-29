# Arquitetura Completa — ANAC Data Insight

> Documento de referência técnica para desenvolvimento e evolução da plataforma.  
> Atualizado em: 2026-05-28

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estrutura do Monorepo](#3-estrutura-do-monorepo)
4. [Backend — FastAPI](#4-backend--fastapi)
5. [Frontend — Next.js](#5-frontend--nextjs)
6. [Banco de Dados](#6-banco-de-dados)
7. [Fluxos de Dados](#7-fluxos-de-dados)
8. [Autenticação e Segurança](#8-autenticação-e-segurança)
9. [Camada de Inteligência Artificial](#9-camada-de-inteligência-artificial)
10. [Análise de Ciclos (Domínio)](#10-análise-de-ciclos-domínio)
11. [Gaps e Pendências do MVP](#11-gaps-e-pendências-do-mvp)
12. [Roadmap Técnico](#12-roadmap-técnico)
13. [Skills Recomendadas](#13-skills-recomendadas)
14. [Decisões Arquiteturais](#14-decisões-arquiteturais)

---

## 1. Visão Geral

**ANAC Data Insight** é uma plataforma web de uso interno restrito da Agência Nacional de Aviação Civil (ANAC) para análise automatizada de planilhas operacionais.

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO INTERNO                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS (browser)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND  ·  Next.js 14  ·  Port 3000              │
│         App Router, TypeScript, Tailwind, Recharts              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST/JSON  (Authorization: Bearer)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               BACKEND  ·  FastAPI  ·  Port 8000                 │
│      Polars · SQLAlchemy · JWT · Pydantic · aiofiles            │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  SQLite (dev)            │   │  OpenAI GPT-4o  (opcional)       │
│  PostgreSQL (produção)   │   │  MockAIProvider (sem chave)      │
└──────────────────────────┘   └──────────────────────────────────┘
```

**Princípios fundamentais:**
- Dados brutos nunca saem do servidor — apenas indicadores calculados chegam à IA
- Autenticação obrigatória em todas as rotas exceto `/health` e `/auth/token`
- Erros e mensagens ao usuário sempre em **português**
- Código limpo: sem `console.log` nem `print` em produção

---

## 2. Stack Tecnológico

### Backend

| Pacote | Versão | Papel |
|--------|--------|-------|
| `fastapi` | 0.111.0 | Web framework ASGI |
| `uvicorn[standard]` | 0.30.1 | Servidor ASGI |
| `pydantic` / `pydantic-settings` | 2.7.4 / 2.3.3 | Validação e configuração |
| `sqlalchemy` | 2.0.31 | ORM (engine + sessions) |
| `alembic` | 1.13.2 | Migrations de banco |
| `polars` | 0.20.31 | Leitura/processamento de planilhas |
| `pandas` | 2.2.2 | Fallback para operações específicas |
| `openpyxl` | 3.1.4 | Leitura de Excel |
| `xlsxwriter` | 3.2.0 | Exportação Excel tratado |
| `duckdb` | 0.10.3 | Queries analíticas (reservado) |
| `python-jose[cryptography]` | 3.3.0 | JWT HS256 |
| `passlib` | 1.7.4 | Hashing de senha |
| `httpx` | 0.27.0 | Cliente HTTP para OpenAI |
| `aiofiles` | 23.2.1 | I/O assíncrono de arquivos |
| `python-dotenv` | 1.0.1 | Leitura de `.env` |

### Frontend

| Pacote | Versão | Papel |
|--------|--------|-------|
| `next` | 14.2.5 | Framework React (App Router) |
| `react` / `react-dom` | ^18 | UI library |
| `typescript` | ^5 | Tipagem estática |
| `tailwindcss` | ^3.4.1 | Estilização utilitária |
| `recharts` | ^2.12.7 | Gráficos (ainda não usados no MVP) |
| `@tanstack/react-table` | ^8.19.3 | Tabelas com sorting/filtering |
| `lucide-react` | ^0.400.0 | Ícones SVG |
| `clsx` + `tailwind-merge` | ^2.x | Composição de classes |
| `@radix-ui/*` | — | Componentes acessíveis headless |

---

## 3. Estrutura do Monorepo

```
anac-data-insight/
├── apps/
│   ├── api/                          FastAPI backend
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── config.py         Pydantic Settings
│   │   │   │   ├── security.py       JWT encode/decode
│   │   │   │   └── dependencies.py   get_current_user()
│   │   │   ├── db/
│   │   │   │   └── database.py       engine, SessionLocal, Base, create_tables()
│   │   │   ├── models/
│   │   │   │   └── analysis.py       Analysis, CicloActivity, AIAnalysis (ORM)
│   │   │   ├── schemas/
│   │   │   │   ├── auth.py           Token, LoginRequest
│   │   │   │   ├── upload.py         UploadResponse, AnalysisResponse
│   │   │   │   └── ai.py             AISummaryResponse
│   │   │   ├── routes/
│   │   │   │   ├── health.py         GET /health
│   │   │   │   ├── auth.py           POST /auth/token
│   │   │   │   ├── upload.py         POST /upload, /upload-and-analyze
│   │   │   │   ├── analyses.py       CRUD + preview + alerts + export
│   │   │   │   └── ai.py             POST/GET /ai-summary
│   │   │   ├── services/
│   │   │   │   ├── classifier.py     detect_spreadsheet_type()
│   │   │   │   ├── ciclo_analyzer.py analyze_ciclos() → indicators dict
│   │   │   │   ├── file_reader.py    read_file(), get_preview()
│   │   │   │   ├── ai_summary.py     get_ai_provider(), MockAIProvider
│   │   │   │   └── __init__.py
│   │   │   ├── utils/
│   │   │   │   └── file_utils.py     sanitize_filename()
│   │   │   └── main.py               app, CORS, lifespan, routers
│   │   ├── requirements.txt
│   │   ├── .env.example
│   │   └── uploads/                  Arquivos enviados (gitignore)
│   │
│   └── web/                          Next.js 14 frontend
│       ├── app/                      App Router
│       │   ├── layout.tsx            RootLayout
│       │   ├── page.tsx              Home (público)
│       │   ├── login/page.tsx        Formulário de login
│       │   ├── upload/page.tsx       Upload de planilhas
│       │   ├── analises/
│       │   │   ├── page.tsx          Lista de análises
│       │   │   └── [id]/page.tsx     Detalhe (4 tabs)
│       │   ├── dashboard/page.tsx    Stub
│       │   ├── ciclos/page.tsx       Stub
│       │   ├── relatorios/page.tsx   Stub
│       │   └── configuracoes/page.tsx Stub
│       ├── components/
│       │   ├── ui/                   EmptyState, StatusBadge, AlertBadge
│       │   ├── layout/               AppHeader, AppFooter, AppSidebar
│       │   ├── home/                 Hero, Stats, Features, QuickUpload, Modules
│       │   ├── upload/               UploadDropzone
│       │   └── dashboard/            MetricCard
│       ├── lib/
│       │   ├── api.ts                Abstração fetch com auth
│       │   ├── auth.ts               JWT em cookies (8h)
│       │   └── utils.ts
│       ├── types/
│       │   └── analysis.ts           Tipos TypeScript do domínio
│       ├── images/                   Ativos estáticos (logo)
│       ├── middleware.ts             Guard /login redirect
│       ├── tailwind.config.ts        anac-blue: #003A70
│       └── tsconfig.json             alias @/
│
├── docs/                             Documentação do produto
│   ├── produto.md                    Problema, solução, público-alvo
│   ├── arquitetura.md                Visão geral simplificada
│   ├── arquitetura-completa.md       ← Este documento
│   ├── regras-ciclos.md              Regras de negócio (planilhas de ciclo)
│   ├── seguranca.md                  Controles de segurança
│   └── roadmap.md                    Versões e features planejadas
│
├── samples/                          Planilhas de exemplo para testes
├── CLAUDE.md                         Guia para Claude Code
└── README.md
```

---

## 4. Backend — FastAPI

### Rotas de API (todas com prefixo `/api/v1`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/health` | ✗ | Status da API |
| POST | `/auth/token` | ✗ | Login → JWT |
| POST | `/upload` | ✓ | Upload de arquivo → `upload_id` |
| POST | `/upload-and-analyze` | ✓ | Upload + análise síncrona |
| POST | `/analyses` | ✓ | Criar análise a partir de `upload_id` |
| GET | `/analyses` | ✓ | Listar análises (paginado) |
| GET | `/analyses/{id}` | ✓ | Detalhe da análise |
| DELETE | `/analyses/{id}` | ✓ | Deletar análise e arquivo |
| GET | `/analyses/{id}/preview` | ✓ | Primeiras 10 linhas |
| GET | `/analyses/{id}/summary` | ✓ | Indicadores calculados |
| GET | `/analyses/{id}/alerts` | ✓ | Alertas de qualidade |
| GET | `/analyses/{id}/treated-data` | ✓ | Dados processados (ciclos) |
| GET | `/analyses/{id}/export/excel` | ✓ | Download Excel tratado |
| POST | `/analyses/{id}/ai-summary` | ✓ | Gerar resumo com IA |
| GET | `/analyses/{id}/ai-summary` | ✓ | Recuperar resumo em cache |

### Serviços Principais

```
classifier.py        detect_spreadsheet_type(df)
                     → "ciclos" | "generic" | "unknown"
                     Heurística: presença de colunas características

ciclo_analyzer.py    analyze_ciclos(df, db, analysis_id)
                     → dict com 13 indicadores
                     + cria registros CicloActivity no banco

file_reader.py       read_file(path) → pl.DataFrame
                     get_preview(path, n=10) → list[dict]
                     Suporta .csv, .xlsx, .xls via Polars

ai_summary.py        get_ai_provider() → AIProvider
                     → OpenAIProvider se OPENAI_API_KEY presente
                     → MockAIProvider caso contrário
                     Envia apenas indicadores (nunca dados brutos)
```

### Configuração (`.env` / `core/config.py`)

```bash
DATABASE_URL=sqlite:///./anac_data_insight.db
UPLOAD_DIR=./uploads
GENERATED_DIR=./generated
MAX_UPLOAD_SIZE_MB=50
OPENAI_API_KEY=                           # opcional
OPENAI_MODEL=gpt-4o
AI_PROVIDER=openai
ENVIRONMENT=development
SECRET_KEY=insecure-dev-secret-change-in-production
AUTH_USERNAME=admin
AUTH_PASSWORD=anac2024
ACCESS_TOKEN_EXPIRE_MINUTES=480           # 8 horas
```

---

## 5. Frontend — Next.js

### Páginas e Status

| Rota | Página | Status | Auth |
|------|--------|--------|------|
| `/` | Home institucional | ✅ Implementado | Público |
| `/login` | Formulário de login | ✅ Implementado | Público |
| `/upload` | Upload de planilhas | ✅ Implementado | ✓ |
| `/analises` | Lista de análises | ✅ Implementado | ✓ |
| `/analises/[id]` | Detalhe + 4 tabs | ✅ Implementado | ✓ |
| `/dashboard` | Dashboard consolidado | 🔲 Stub | ✓ |
| `/ciclos` | Módulo ciclos | 🔲 Stub | ✓ |
| `/relatorios` | Geração de relatórios | 🔲 Stub | ✓ |
| `/configuracoes` | Configurações | 🔲 Stub | ✓ |

### Camada de Comunicação (`lib/api.ts`)

```typescript
api.get(path)                    // GET com Bearer token
api.post(path, body)             // POST JSON com Bearer token
api.delete(path)                 // DELETE com Bearer token
api.upload(path, file)           // FormData multipart com Bearer token
api.login(username, password)    // Obtém JWT e salva em cookie (8h)
```

### Autenticação Client-Side (`lib/auth.ts`)

```typescript
auth.getToken()      // Lê cookie "token"
auth.setToken(t)     // Grava cookie com maxAge=8h
auth.clearToken()    // Remove cookie
auth.isAuthenticated()
```

`middleware.ts` intercepta rotas protegidas e redireciona para `/login?redirect=...` quando não autenticado.

### Tabs da Página de Detalhe (`/analises/[id]`)

| Tab | Conteúdo |
|-----|----------|
| **Resumo** | Grid 4×3 com 11 métricas (taxa_execucao, realizadas, agendadas, etc.) |
| **Dados** | Tabela das 10 primeiras linhas (preview) |
| **Alertas** | Cards de alertas crítico / atenção / info com contadores |
| **IA** | Resumo executivo, achados, riscos, recomendações, plano de ação |

---

## 6. Banco de Dados

### Modelo ER Simplificado

```
┌──────────────────┐        ┌─────────────────────┐
│    Analysis      │ 1───∞  │   CicloActivity      │
├──────────────────┤        ├─────────────────────┤
│ id (PK)          │        │ id (PK)              │
│ original_filename│        │ analysis_id (FK)     │
│ stored_filename  │        │ item                 │
│ file_type        │        │ atividade            │
│ detected_type    │        │ gerencia             │
│ status           │        │ setor                │
│ total_rows       │        │ regulado             │
│ total_columns    │        │ cidade               │
│ indicators (JSON)│        │ mes                  │
│ created_by       │        │ mes_agendado         │
│ created_at       │        │ mes_realizado        │
│ completed_at     │        │ giaso, processo, pcdp│
│ error_message    │        │ prioridade, status   │
└──────┬───────────┘        │ sem_giaso (flag)     │
       │ 1                  │ sem_pcdp (flag)      │
       │                    │ sem_processo (flag)  │
       ▼ 1                  │ local_indefinido     │
┌──────────────────┐        └─────────────────────┘
│   AIAnalysis     │
├──────────────────┤
│ id (PK)          │
│ analysis_id (FK) │
│ resumo_executivo │
│ principais_achados (JSON)│
│ riscos_operacionais (JSON)│
│ recomendacoes (JSON)│
│ plano_acao (JSON)│
│ perguntas_sugeridas (JSON)│
│ created_at       │
└──────────────────┘
```

### Estratégia de Banco

- **Desenvolvimento**: SQLite (`anac_data_insight.db`) — zero-config
- **Produção**: PostgreSQL — alta disponibilidade, concorrência
- **Migrations**: Alembic (disponível mas ainda não usado; `create_tables()` cria direto)
- **Sessions**: `get_db()` como dependência FastAPI — garante fechamento correto

---

## 7. Fluxos de Dados

### Fluxo de Upload e Análise

```
1. Usuário seleciona arquivo em /upload
2. Frontend → POST /api/v1/upload-and-analyze (multipart/form-data)
3. FastAPI:
   a. Valida extensão (.csv/.xlsx/.xls) e tamanho (≤50 MB)
   b. Sanitiza nome → {uuid8}_{stem}.{ext}
   c. Salva em uploads/
   d. Lê com Polars → DataFrame
   e. classifier.detect_spreadsheet_type(df) → "ciclos"
   f. ciclo_analyzer.analyze_ciclos(df, db, analysis_id):
      - Calcula 13 indicadores
      - Cria registros CicloActivity (linha a linha)
      - Atualiza Analysis.indicators (JSON)
   g. Retorna Analysis object (status=completed)
4. Frontend redireciona para /analises/{id}
5. Usuário visualiza tabs: Resumo → Dados → Alertas → IA
```

### Fluxo de Geração de Resumo IA

```
1. Usuário clica "Gerar resumo com IA" na tab IA
2. Frontend → POST /api/v1/analyses/{id}/ai-summary
3. Backend:
   a. Carrega Analysis.indicators (apenas indicadores, sem dados brutos)
   b. get_ai_provider() → OpenAIProvider ou MockAIProvider
   c. Monta prompt estruturado com indicadores
   d. Chama API OpenAI → resposta estruturada JSON
   e. Salva AIAnalysis no banco
4. Frontend exibe: resumo, achados, riscos, recomendações, plano de ação
```

---

## 8. Autenticação e Segurança

### JWT (MVP)

- Algoritmo: **HS256**
- TTL: **8 horas** (`ACCESS_TOKEN_EXPIRE_MINUTES=480`)
- Armazenamento client: **cookie** (`document.cookie`)
- Header de request: `Authorization: Bearer {token}`
- Refresh: não implementado (MVP — re-login após expiração)

### Validação de Arquivo (Upload)

| Verificação | Implementação |
|-------------|---------------|
| Extensão permitida | `.csv`, `.xlsx`, `.xls` |
| Tamanho máximo | 50 MB |
| Nome sanitizado | `{uuid8}_{stem}.{ext}` — sem path traversal |
| Sem execução de macros | Polars lê apenas valores/fórmulas resolvidas |
| Tipo MIME | validado pelo `python-magic` (verificar dependência) |

### Controles de Privacidade

- **Dados brutos nunca enviados à IA**: apenas o dict `indicators`
- Prompt explícito: modelo instruído a não inventar informações
- `OPENAI_API_KEY` nunca comitada (`.env` no `.gitignore`)
- Uploads ficam em `uploads/` fora do diretório público do servidor

### Produção (Pendente — v0.4.0)

- Substituir `SECRET_KEY` padrão por segredo forte gerado (`openssl rand -hex 32`)
- Autenticação via **OAuth2/OIDC** integrado ao Active Directory corporativo
- **RBAC**: leitura / análise / admin
- HTTPS obrigatório no reverse proxy (Nginx/Caddy)
- Auditoria: log de uploads com timestamp, tamanho e usuário

---

## 9. Camada de Inteligência Artificial

### Abstração de Provider

```python
class AIProvider:                         # interface base
    async def generate_summary(indicators: dict) -> AISummaryResponse

class OpenAIProvider(AIProvider):         # GPT-4o via httpx
class MockAIProvider(AIProvider):         # retorna dados fixos para dev
```

`get_ai_provider()` em `services/ai_summary.py` retorna o provider correto baseado em `settings.openai_api_key`.

### Estrutura da Resposta IA

```typescript
interface AISummaryResponse {
  resumo_executivo: string;
  principais_achados: string[];
  riscos_operacionais: string[];
  recomendacoes: string[];
  plano_acao: Array<{
    prioridade: "Alta" | "Média" | "Baixa";
    acao: string;
    justificativa: string;
  }>;
  perguntas_sugeridas: string[];
}
```

### Indicadores Enviados à IA (13 campos)

```
total_atividades, realizadas, agendadas, sem_agendamento,
sem_giaso, sem_pcdp, sem_processo, locais_indefinidos,
pcdp_duplicada, multiplas_pcdps,
taxa_execucao, taxa_agendamento, pendencias_criticas
```

---

## 10. Análise de Ciclos (Domínio)

### Classificação de Tipo de Planilha

O `classifier.py` normaliza nomes de coluna (minúsculas, sem espaços) e aplica heurística:

| Condição | Resultado |
|----------|-----------|
| Tem (`mes_realizado` + `mes_agendado`) OU tem (`giaso`/`pcdp`) | `ciclos` |
| Tem ≥3 das 6 colunas: atividade, gerencia, regulado, mes, cidade, status | `ciclos` |
| Nenhuma das condições | `generic` |

### Status por Linha de Atividade

| Status | Critério |
|--------|---------|
| `realizado` | `mes_realizado` preenchido |
| `agendado` | `mes_agendado` preenchido E `mes_realizado` vazio |
| `sem-agendamento` | ambos vazios |

### Flags de Pendência (por linha)

| Flag | Critério |
|------|---------|
| `sem_giaso` | coluna `giaso` vazia |
| `sem_pcdp` | coluna `pcdp` vazia |
| `sem_processo` | coluna `processo` vazia |
| `local_indefinido` | `cidade` vazia ou valor = "indefinido" |

### Indicadores Agregados

| Indicador | Cálculo |
|-----------|---------|
| `taxa_execucao` | `(realizadas / total) × 100` |
| `taxa_agendamento` | `((realizadas + agendadas) / total) × 100` |
| `pendencias_criticas` | `sem_giaso + pcdp_duplicada + multiplas_pcdps` |
| `pcdp_duplicada` | PCDPs que aparecem em mais de uma linha |
| `multiplas_pcdps` | pares (atividade + regulado) com > 1 PCDP distinto |

### Criticidade por Gerência (Planejado — v0.2.0)

| Faixa de taxa_execucao | Nível |
|------------------------|-------|
| ≥ 90% | Regular |
| 70–89% | Atenção |
| 50–69% | Crítico |
| < 50% | Muito crítico |

---

## 11. Gaps e Pendências do MVP

### Backend

| Gap | Impacto | Prioridade |
|-----|---------|-----------|
| `ciclo_analyzer.py` incompleto — regras parcialmente implementadas | Alto — indicadores imprecisos | 🔴 Alta |
| Sem Alembic migrations — `create_tables()` não escala | Médio — risco ao adicionar colunas | 🟡 Média |
| Sem testes automatizados (pytest) | Alto — risco de regressão | 🔴 Alta |
| `pcdp_duplicada` e `multiplas_pcdps` precisam de validação com dados reais | Médio | 🟡 Média |
| `duckdb` importado mas não usado | Baixo — dead code | 🟢 Baixa |
| Sem rate limiting nos endpoints | Médio — segurança | 🟡 Média |
| Sem paginação em `treated-data` | Médio — performance com planilhas grandes | 🟡 Média |

### Frontend

| Gap | Impacto | Prioridade |
|-----|---------|-----------|
| Páginas `/dashboard`, `/ciclos`, `/relatorios`, `/configuracoes` são stubs | Alto — funcionalidade prometida | 🔴 Alta |
| Gráficos com Recharts não implementados | Médio — visualização de dados | 🟡 Média |
| Tabela de atividades (`CicloActivity`) não exibida | Alto — dado principal da análise | 🔴 Alta |
| Sem testes (Jest/Playwright) | Alto — risco de regressão | 🔴 Alta |
| Token JWT em cookie sem `httpOnly` — XSS risk | Alto — segurança | 🔴 Alta |
| Sem loading states em todas as rotas | Médio — UX | 🟡 Média |
| `recharts` instalado mas não usado | Baixo — bundle size | 🟢 Baixa |

### Infraestrutura

| Gap | Impacto | Prioridade |
|-----|---------|-----------|
| SQLite sem WAL mode para concorrência | Médio — múltiplos usuários | 🟡 Média |
| Sem variáveis de ambiente validadas no startup | Médio — falhas silenciosas | 🟡 Média |
| Sem Docker Compose para dev | Baixo — onboarding | 🟢 Baixa |
| Sem CI/CD pipeline | Alto — qualidade e deploy | 🔴 Alta |

---

## 12. Roadmap Técnico

### v0.1.x — Completar MVP (urgente)

- [ ] Completar `ciclo_analyzer.py` com todas as regras de negócio
- [ ] Exibir tabela de `CicloActivity` na tab "Dados" (com sorting + filtros)
- [ ] Corrigir armazenamento JWT para `httpOnly` cookie (via Set-Cookie no backend)
- [ ] Adicionar testes unitários no `ciclo_analyzer` (pytest)
- [ ] Adicionar testes básicos no frontend (Jest — componentes críticos)
- [ ] Implementar Alembic para migrations

### v0.2.0 — Ciclos completos + Gráficos

- [ ] Gráfico de execução por mês (Recharts — `BarChart`)
- [ ] Gráfico por gerência com indicador de criticidade
- [ ] Indicadores por gerência (tabela/cards)
- [ ] Alertas consolidados com drill-down
- [ ] Resumo IA totalmente integrado ao frontend
- [ ] Comparação entre dois ciclos

### v0.3.0 — Relatórios e Exportações

- [ ] Geração de relatório PDF executivo (reportlab ou weasyprint)
- [ ] Exportação Excel tratado com formatação (xlsxwriter — já disponível)
- [ ] Histórico de análises com busca e filtros
- [ ] Página `/relatorios` funcional

### v0.4.0 — Produção

- [ ] OAuth2/OIDC com Active Directory corporativo
- [ ] RBAC: leitura / análise / admin
- [ ] Migração para PostgreSQL
- [ ] Docker Compose (dev) + Dockerfile (prod)
- [ ] CI/CD via GitHub Actions (lint, test, build, deploy)
- [ ] Nginx como reverse proxy com HTTPS

### Backlog

- Integração Power BI via API dedicada
- Notificações por e-mail (análise concluída)
- Upload em lote (múltiplos arquivos)
- Dashboard consolidado com histórico de ciclos
- Outros tipos de planilha: RBAC, certificações (nova abstração no classifier)
- WebSocket para status em tempo real de análises longas

---

## 13. Skills Recomendadas

Skills da plataforma [skills.sh](https://skills.sh/) que agregam valor ao desenvolvimento do projeto:

### Já Disponíveis (instaladas neste workspace)

| Skill | Uso recomendado |
|-------|-----------------|
| `front-end-developer` | Desenvolvimento de componentes React/Next.js, Tailwind, acessibilidade |
| `code-review` | Revisão de PRs com foco em bugs, segurança e simplificação |
| `security-review` | Análise de vulnerabilidades antes de merge para produção |
| `verify` | Confirmar que features funcionam no browser antes de marcar como concluído |
| `run` | Iniciar o projeto e testar golden paths |

### Recomendadas para Instalar

#### Gráficos e Visualização de Dados
```bash
npx skills add antvis/chart-visualization-skills@chart-visualization -g -y
# 3K+ installs — guia completo de visualização de dados
```
Usar em: implementação dos gráficos com Recharts (v0.2.0)

#### Testes Frontend (Jest + React Testing Library)
```bash
npx skills add manutej/luxor-claude-marketplace@jest-react-testing -g -y
# 739 installs — padrões Jest + RTL para React
```
Usar em: criar suite de testes para componentes críticos (UploadDropzone, tabs de análise)

#### Testes Backend (pytest)
```bash
npx skills add pluginagentmarketplace/custom-plugin-python@pytest-testing -g -y
# 154 installs — padrões pytest para Python
```
Usar em: testes do `ciclo_analyzer.py`, `classifier.py`, rotas FastAPI

#### Python / FastAPI Backend
```bash
npx skills add jiatastic/open-python-skills@python-backend -g -y
# 1.5K installs — boas práticas Python backend
```
Usar em: refatorações, adição de novas rotas e serviços

#### FastAPI Específico
```bash
npx skills add sickn33/antigravity-awesome-skills@python-fastapi-development -g -y
# 400 installs — padrões FastAPI, async, Pydantic v2
```
Usar em: implementar rate limiting, WebSockets para status em tempo real

#### Code Review com Foco em Segurança
```bash
npx skills add hieutrtr/ai1-skills@code-review-security -g -y
# 306 installs — revisão orientada a segurança
```
Usar em: antes de fazer deploy — revisar autenticação, validação de inputs, OWASP Top 10

---

## 14. Decisões Arquiteturais

| Decisão | Escolha | Motivação |
|---------|---------|-----------|
| Leitura de planilhas | Polars (não Pandas) | 5–10× mais rápido para arquivos grandes; imutabilidade evita bugs sutis |
| Banco dev | SQLite | Zero-config; fácil troca para PostgreSQL via `DATABASE_URL` |
| Migrations | Alembic disponível mas não ativado | MVP: `create_tables()` é suficiente; ativar Alembic antes da v0.2.0 |
| IA | Abstração com Mock | Permite desenvolvimento offline sem chave de API |
| Auth MVP | JWT simples (HS256, cookie) | Suficiente para MVP interno; OAuth2 corporativo na v0.4.0 |
| Frontend auth | Cookie JS-acessível | Funcional para MVP; migrar para `httpOnly` Set-Cookie (segurança) antes de produção |
| Routing | Next.js App Router | Alinhado com futuras Server Components e RSC quando necessário |
| Estilização | Tailwind | Velocidade de desenvolvimento e consistência institucional via `anac-blue` |
| Monorepo | Pastas `apps/` sem Turborepo | Simples; adicionar Turborepo se o build começar a ser lento |

---

*Documento gerado automaticamente a partir da análise do código-fonte em 2026-05-28.*
