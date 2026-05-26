# Arquitetura — ANAC Data Insight

## Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        Navegador                            │
│                    Next.js 14 (App Router)                  │
│           TypeScript · Tailwind CSS · shadcn/ui             │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / REST (JSON)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI (Python)                          │
│          Routers: upload · analyses · ai · health           │
│          Services: file_reader · classifier · ciclo_analyzer│
│                    ai_summary                               │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────┐      ┌──────────────────────────────┐
│   SQLite / PostgreSQL│      │  OpenAI API (opcional)        │
│   SQLAlchemy ORM    │      │  GPT-4o via HTTPS             │
└─────────────────────┘      └──────────────────────────────┘
```

## Componentes

### Frontend (`apps/web`)

- **Framework**: Next.js 14 com App Router.
- **Linguagem**: TypeScript.
- **Estilização**: Tailwind CSS + componentes shadcn/ui.
- **Ícones**: lucide-react.
- **Gráficos**: recharts.
- **Tabelas**: @tanstack/react-table.
- **Comunicação com API**: `lib/api.ts` (fetch nativo).

### Backend (`apps/api`)

- **Framework**: FastAPI.
- **Linguagem**: Python 3.11+.
- **ORM**: SQLAlchemy 2.0.
- **Banco de dados**: SQLite (dev) / PostgreSQL (prod).
- **Leitura de planilhas**: Polars (principal) + Pandas (fallback).
- **HTTP client (IA)**: httpx.

### Camada de IA

- Abstração `AIProvider` com implementações:
  - `OpenAIProvider` — usa GPT-4o via API.
  - `MockAIProvider` — retorna placeholder quando sem API key.
- **Princípio de segurança**: apenas os indicadores calculados são enviados à IA, nunca os dados brutos da planilha.

## Fluxo de Upload e Análise

1. Usuário seleciona arquivo no frontend.
2. `POST /api/v1/upload` salva o arquivo no disco e retorna um `upload_id`.
3. `POST /api/v1/analyses` cria um registro de análise e inicia processamento.
4. Backend lê o arquivo com Polars, classifica o tipo, calcula indicadores.
5. Frontend polling/webhook recebe status `completed`.
6. Usuário pode solicitar resumo IA via `POST /api/v1/analyses/{id}/ai-summary`.

## Banco de Dados

Tabelas principais:

| Tabela | Descrição |
|---|---|
| `analyses` | Registro de cada upload e seu estado de processamento. |
| `ciclo_activities` | Linhas processadas de planilhas do tipo ciclo. |
| `ai_analyses` | Resumos gerados por IA para cada análise. |
