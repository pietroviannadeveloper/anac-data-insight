# CLAUDE.md — Guia de desenvolvimento para Claude Code

Este projeto é uma plataforma institucional de análise de dados da ANAC. Leia este guia antes de qualquer modificação.

---

## Estrutura do projeto

```
anac-data-insight/
├── apps/
│   ├── web/          Next.js 14 App Router (TypeScript, Tailwind)
│   └── api/          FastAPI backend (Python 3.11+)
├── docs/             Documentação do produto e decisões técnicas
├── samples/          Planilhas de exemplo para teste
├── README.md
└── CLAUDE.md
```

---

## Frontend (`apps/web`)

### Convenções

- Todos os componentes são TypeScript com extensão `.tsx`.
- Use Tailwind classes para **toda** estilização. Evite `style={{}}` inline.
- A cor institucional primária é `#003A70`. Use como `bg-[#003A70]` ou `text-[#003A70]`, ou via `bg-anac-blue` (definida em `tailwind.config.ts`).
- Componentes de UI reutilizáveis ficam em `components/ui/`.
- Componentes de layout (header, footer, sidebar) ficam em `components/layout/`.
- Componentes específicos de cada seção ficam em subpastas: `components/home/`, `components/dashboard/`, `components/upload/`.
- Use `@/` para imports absolutos (alias configurado em `tsconfig.json`).

### Estrutura de página

Toda página deve:
1. Importar `AppHeader` e `AppFooter`.
2. Envolver o conteúdo com `<div className="flex flex-col min-h-screen">`.
3. Usar `<main className="flex-1 ...">` para o conteúdo principal.

### Como adicionar uma nova página

1. Crie `apps/web/app/<rota>/page.tsx`.
2. Adicione o link em `AppHeader` (array `navLinks`) e em `AppSidebar`.
3. Crie os componentes específicos da página em `components/<area>/`.

### Comunicação com API

Use `lib/api.ts`. Nunca chame `fetch` diretamente nas páginas.

```ts
import { api } from "@/lib/api";
const data = await api.get("/api/v1/analyses");
const result = await api.upload("/api/v1/upload", file);
```

---

## Backend (`apps/api`)

### Estrutura

```
app/
├── main.py           FastAPI app, CORS, routers, lifespan
├── core/config.py    Pydantic Settings (variáveis de ambiente)
├── db/database.py    SQLAlchemy engine, SessionLocal, Base
├── models/           SQLAlchemy ORM models
├── schemas/          Pydantic schemas (request/response)
├── routes/           FastAPI routers (um arquivo por domínio)
├── services/         Lógica de negócio (sem dependência de HTTP)
└── utils/            Utilitários reutilizáveis
```

### Padrão de router

```python
from fastapi import APIRouter
router = APIRouter()

@router.get("/recurso", tags=["Tag"], response_model=Schema)
async def list_recursos():
    ...
```

Registre o router em `main.py`:
```python
app.include_router(meu_router.router, prefix="/api/v1")
```

### Como adicionar um novo tipo de planilha

1. Em `services/classifier.py`, adicione as colunas características ao conjunto de detecção e retorne o novo tipo.
2. Crie `services/<tipo>_analyzer.py` com a função `analyze_<tipo>(df: pl.DataFrame) -> dict`.
3. Documente as regras em `docs/regras-<tipo>.md`.
4. Adicione o tipo ao enum `SpreadsheetType` em `app/models/analysis.py` e em `apps/web/types/analysis.ts`.
5. Crie as colunas adicionais no banco em um novo modelo SQLAlchemy, se necessário.

### Leitura de arquivos

Use sempre `services/file_reader.py`. Não leia arquivos diretamente nas rotas.

```python
from app.services.file_reader import read_file, get_preview
df = read_file(Path(settings.upload_dir) / stored_filename)
```

### Banco de dados

- Use `get_db()` como dependência FastAPI nas rotas que precisam de DB.
- Nunca use `SessionLocal()` diretamente nas rotas.
- Para novas tabelas, adicione o modelo em `models/`, importe-o em `db/database.py` dentro de `create_tables()`.

### IA

- Nunca envie dados brutos ao provedor de IA. Apenas indicadores calculados.
- Use `get_ai_provider()` de `services/ai_summary.py`. Ele retorna `MockAIProvider` se `OPENAI_API_KEY` não estiver configurada.

---

## Padrões gerais

- Sem `console.log` ou `print` em código de produção.
- Mensagens de erro ao usuário em **português**.
- Docstrings em inglês nos serviços Python.
- Comentários explicativos em português quando necessário para clareza do domínio.
