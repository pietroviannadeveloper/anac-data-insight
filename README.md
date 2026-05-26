# ANAC Data Insight

Plataforma institucional de análise de dados operacionais da aviação civil brasileira.

> **Uso interno restrito** — Agência Nacional de Aviação Civil (ANAC)

---

## O que é

O ANAC Data Insight permite que equipes operacionais importem planilhas CSV ou Excel e recebam automaticamente:

- Detecção do tipo de planilha (ciclos de inspeção, análise genérica)
- Cálculo de indicadores operacionais (taxa de execução, agendamento, pendências)
- Alertas de qualidade de dados (sem GIASO, sem PCDP, locais indefinidos)
- Resumo executivo gerado com apoio de inteligência artificial

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│   Navegador — Next.js 14 (TypeScript · Tailwind · shadcn)   │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST / JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           FastAPI (Python 3.11+) — apps/api                 │
│    upload · analyses · ai · health                          │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            ▼                             ▼
     SQLite / PostgreSQL           OpenAI API (opcional)
```

---

## Pré-requisitos

- **Node.js** 18+
- **Python** 3.11+
- **pip** ou **uv**

---

## Instalação e execução

### Backend (FastAPI)

```bash
cd apps/api

# Criar e ativar ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env conforme necessário

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

API disponível em: http://localhost:8000  
Documentação interativa: http://localhost:8000/docs

### Frontend (Next.js)

```bash
cd apps/web

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.local.example .env.local

# Iniciar servidor de desenvolvimento
npm run dev
```

Interface disponível em: http://localhost:3000

---

## Endpoints da API

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/v1/upload` | Upload de arquivo CSV/XLSX |
| GET | `/api/v1/analyses` | Listar análises (paginado) |
| POST | `/api/v1/analyses` | Criar análise a partir de upload |
| GET | `/api/v1/analyses/{id}` | Detalhes de uma análise |
| GET | `/api/v1/analyses/{id}/preview` | Preview das primeiras linhas |
| GET | `/api/v1/analyses/{id}/summary` | Indicadores calculados |
| GET | `/api/v1/analyses/{id}/alerts` | Alertas de qualidade |
| GET | `/api/v1/analyses/{id}/treated-data` | Dados tratados |
| GET | `/api/v1/analyses/{id}/export/excel` | Exportar em Excel |
| POST | `/api/v1/analyses/{id}/ai-summary` | Gerar resumo com IA |

---

## Variáveis de ambiente

### Backend (`apps/api/.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./anac_data_insight.db` | URL do banco de dados |
| `UPLOAD_DIR` | `./uploads` | Diretório de uploads |
| `GENERATED_DIR` | `./generated` | Diretório de arquivos gerados |
| `MAX_UPLOAD_SIZE_MB` | `50` | Tamanho máximo de upload |
| `OPENAI_API_KEY` | _(vazio)_ | Chave da API OpenAI |
| `OPENAI_MODEL` | `gpt-4o` | Modelo OpenAI a usar |
| `ENVIRONMENT` | `development` | Ambiente de execução |

### Frontend (`apps/web/.env.local`)

| Variável | Padrão | Descrição |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL base da API |

---

## Próximos passos

Veja o [roadmap](docs/roadmap.md) completo.

1. Implementar regras de análise de ciclos em `apps/api/app/services/ciclo_analyzer.py`
2. Conectar frontend ao backend nos fluxos de upload e exibição de resultados
3. Adicionar autenticação para uso em produção

---

## Documentação

- [Visão de Produto](docs/produto.md)
- [Arquitetura](docs/arquitetura.md)
- [Regras de Ciclos](docs/regras-ciclos.md)
- [Segurança](docs/seguranca.md)
- [Roadmap](docs/roadmap.md)
