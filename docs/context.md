# Prompt para implementar página `/admin` no ANAC Data Insight

Você é um engenheiro fullstack sênior trabalhando no projeto **ANAC Data Insight**.

## Contexto técnico do projeto

O projeto é um monorepo com:

- Backend em **FastAPI**
- Frontend em **Next.js 14 App Router**
- Banco via **SQLAlchemy**
- SQLite em desenvolvimento e PostgreSQL em produção
- Autenticação via **JWT HS256**
- Rotas da API com prefixo `/api/v1`
- Frontend usando TypeScript, Tailwind CSS e componentes próprios
- Uploads de arquivos já existentes nas rotas:
  - `POST /api/v1/upload`
  - `POST /api/v1/upload-and-analyze`
- Análises persistidas no modelo `Analysis`, que já contém:
  - `id`
  - `original_filename`
  - `stored_filename`
  - `file_type`
  - `detected_type`
  - `status`
  - `total_rows`
  - `total_columns`
  - `created_by`
  - `created_at`
  - `completed_at`
  - `error_message`

A autenticação atual usa usuário e senha definidos por ambiente:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=anac2024
ACCESS_TOKEN_EXPIRE_MINUTES=480


Atue como um desenvolvedor full-stack sênior. Analise o projeto atual antes de alterar qualquer arquivo e implemente um sistema de gerenciamento manual de usuários administrativos.

Objetivo:
Quero permitir que apenas usuários com perfil de administrador consigam acessar a área administrativa do sistema e criar novos usuários manualmente. Não quero botão, link ou página pública de registro.

Requisitos funcionais:
1. Remover ou desabilitar qualquer fluxo público de cadastro/registro de usuários.
2. Alterar o usuário administrador atual para:
   - login/usuário: pietro.rocha
   - senha inicial: Pietro007@
   - perfil: admin total / superadmin
3. O usuário pietro.rocha deve ter acesso completo a todas as áreas e funcionalidades do sistema.
4. A página /admin que foi escondida anteriormente deve ser desconsiderada e reescrita do jeito correto.
5. A área /admin deve funcionar como uma aba normal dentro do sistema, junto das outras abas existentes.
6. Quando um usuário com perfil de admin fizer login, a aba /admin deve aparecer normalmente no menu/navegação do sistema.
7. Quando um usuário sem perfil de admin fizer login, a aba /admin deve ficar invisível e ele deve ver apenas as abas normais do sistema.
8. Mesmo que um usuário comum tente acessar /admin diretamente pela URL, o acesso deve ser bloqueado.
9. Dentro de /admin, o usuário admin deve conseguir criar novos usuários manualmente.
10. Ao criar um usuário, o formulário deve permitir informar pelo menos:
   - nome
   - login/usuário
   - senha
   - tipo/permissão do usuário, se o sistema já possuir níveis de acesso
11. Apenas usuários autorizados/admin devem conseguir acessar /admin.
12. Usuários comuns não devem conseguir acessar /admin nem criar outros usuários.

Requisitos de segurança:
1. Não salvar senhas em texto puro no banco.
2. Usar o método de hash de senha já existente no projeto. Se não existir, implementar hashing seguro.
3. Não deixar a senha Pietro007@ hardcoded em componentes de frontend.
4. Se for necessário criar um seed, migration ou script para atualizar/criar o admin pietro.rocha, explique onde ele está e como executar.
5. Validar autenticação e autorização no backend, não apenas no frontend.
6. A invisibilidade da aba /admin no frontend deve ser apenas uma melhoria de interface, não a única proteção.
7. Caso exista middleware de autenticação/autorização, reutilize-o ou ajuste-o.
8. Após login, redirecionar o admin para o painel principal do sistema, mantendo a aba /admin visível no menu.

Tarefas:
1. Identifique como o projeto faz autenticação atualmente.
2. Identifique onde ficam usuários, senhas, roles/permissões e rotas protegidas.
3. Verifique como o sistema monta as abas/menu de navegação.
4. Implemente a alteração do admin atual para pietro.rocha.
5. Reescreva a página /admin ignorando a implementação escondida anterior.
6. Faça a aba /admin aparecer somente para usuários com perfil de admin.
7. Faça a aba /admin ficar invisível para usuários sem perfil de admin.
8. Proteja a rota /admin também no backend ou na camada de autorização apropriada.
9. Implemente o formulário de criação manual de usuários em /admin.
10. Remova ou esconda qualquer opção pública de “registrar/cadastrar”.
11. Teste os principais fluxos.

Critérios de aceite:
- Não existe botão/link público de registro.
- O login pietro.rocha com a senha inicial Pietro007@ consegue entrar.
- pietro.rocha tem permissão total no sistema.
- Para usuários admin, a aba /admin aparece normalmente junto das outras abas.
- Para usuários comuns, a aba /admin não aparece.
- Usuários comuns não conseguem acessar /admin diretamente pela URL.
- O admin consegue criar novos usuários manualmente.
- As senhas dos novos usuários são armazenadas com hash.
- A página /admin anterior/escondida foi desconsiderada e substituída pela nova implementação correta.
- O sistema continua funcionando sem quebrar as abas e rotas existentes.

Antes de modificar o código:
- Liste os arquivos que pretende alterar.
- Explique rapidamente a estratégia.
- Depois implemente as mudanças.
- Ao final, entregue um resumo das alterações e os comandos necessários para rodar/testar.




Atue como um desenvolvedor full-stack sênior. Analise o projeto atual e corrija o controle de acesso da área administrativa.

Contexto:
Já existe um usuário administrador com o login:

- login: pietro.rocha
- perfil/role: admin

Mesmo com esse usuário admin logado, o botão ou aba para acessar a página de admin não aparece no sistema. Porém, se eu digitar manualmente a rota /admin na URL, o sistema abre a página de admin.

Quero que você corrija isso.

Objetivo:
Implementar corretamente o acesso à página /admin para que:

1. Usuários com role admin vejam um botão ou aba chamado “Admin” no menu principal do sistema.
2. Esse botão/aba deve levar para a página /admin.
3. Usuários sem role admin não devem ver esse botão/aba.
4. Usuários sem role admin também não podem acessar /admin diretamente pela URL.
5. A proteção deve funcionar tanto no frontend quanto na camada de autenticação/autorização apropriada do sistema.

Requisitos funcionais:
1. Verifique como o sistema identifica o usuário logado e suas permissões/roles.
2. Verifique se o usuário pietro.rocha está realmente sendo reconhecido com role admin após o login.
3. Corrija a lógica que controla a exibição das abas/botões do menu.
4. Adicione um botão ou aba “Admin” junto das outras abas normais do sistema.
5. O botão/aba “Admin” deve aparecer somente quando o usuário logado tiver role admin.
6. Ao clicar no botão/aba “Admin”, o usuário deve ser direcionado para /admin.
7. Caso um usuário sem role admin tente acessar /admin diretamente pela URL, ele deve ser bloqueado.
8. O bloqueio pode redirecionar para a página inicial, dashboard ou página de acesso negado, seguindo o padrão do projeto.
9. A página /admin deve continuar acessível normalmente para usuários com role admin.

Requisitos de segurança:
1. Não confiar apenas em esconder o botão no frontend.
2. A rota /admin também deve validar a permissão do usuário antes de renderizar a página ou retornar dados.
3. Se existir middleware, guard, protected route ou função de autorização no projeto, reutilize ou ajuste essa estrutura.
4. Garanta que usuários comuns não consigam acessar recursos administrativos via URL direta, API ou manipulação do frontend.
5. Não alterar permissões de usuários comuns para admin por engano.

Tarefas:
1. Analise o fluxo de login atual.
2. Confirme onde o role do usuário é salvo ou retornado: banco de dados, sessão, JWT, localStorage, contexto global, API etc.
3. Confirme se o login pieetro.rocha recebe corretamente o role admin.
4. Corrija a renderização condicional do menu para exibir “Admin” apenas para role admin.
5. Corrija a proteção da rota /admin contra acesso direto pela URL.
6. Teste os seguintes cenários:
   - pieetro.rocha logado vê o botão/aba Admin.
   - pieetro.rocha consegue acessar /admin pelo botão.
   - pieetro.rocha consegue acessar /admin diretamente pela URL.
   - usuário comum não vê o botão/aba Admin.
   - usuário comum não consegue acessar /admin digitando a URL.
   - usuário deslogado não consegue acessar /admin.

Critérios de aceite:
- O botão/aba “Admin” aparece no menu quando pieetro.rocha está logado.
- O botão/aba “Admin” não aparece para usuários sem role admin.
- O botão/aba leva corretamente para /admin.
- /admin não pode ser acessada diretamente por usuários comuns.
- /admin não pode ser acessada por usuários deslogados.
- /admin funciona normalmente para usuários com role admin.
- A correção não quebra as outras abas, rotas ou fluxos de login do sistema.

Antes de alterar o código:
- Liste os arquivos que pretende modificar.
- Explique rapidamente onde estava o problema provável.
- Depois implemente a correção.
- Ao final, entregue um resumo do que foi alterado e como testar.






# Prompt — Completar MVP do ANAC Data Insight com Controle de Admin

Você está trabalhando no projeto **ANAC Data Insight**, uma plataforma web interna para análise automatizada de planilhas operacionais da ANAC.

O projeto usa:

- **Backend:** FastAPI, SQLAlchemy, Pydantic, Polars, JWT
- **Frontend:** Next.js 14, TypeScript, Tailwind, App Router
- **Banco:** SQLite em desenvolvimento, PostgreSQL planejado
- **IA:** OpenAI opcional via provider abstrato, com `MockAIProvider` em desenvolvimento

A arquitetura principal já existe, incluindo:

- Upload de planilhas
- Análise automatizada
- Autenticação JWT
- Listagem de análises
- Página de detalhe da análise
- Resumo com IA
- Controle inicial de admin

---

## Objetivo

Completar o MVP funcional e seguro do projeto, priorizando:

1. Fechar as regras de negócio do módulo de ciclos.
2. Exibir dados tratados reais de `CicloActivity`.
3. Consolidar o controle de admin/RBAC no backend e no frontend.
4. Melhorar a segurança da autenticação.
5. Adicionar testes mínimos para evitar regressões.
6. Preparar a base para dashboard, relatórios e produção.

---

## 1. Backend — Completar análise de ciclos

Revise e complete o arquivo:

```text
apps/api/app/services/ciclo_analyzer.py
```

A função principal deve processar planilhas de ciclos e calcular corretamente os seguintes indicadores:

```text
total_atividades
realizadas
agendadas
sem_agendamento
sem_giaso
sem_pcdp
sem_processo
locais_indefinidos
pcdp_duplicada
multiplas_pcdps
taxa_execucao
taxa_agendamento
pendencias_criticas
```

### Regras de status

Cada linha deve ser classificada assim:

| Status | Regra |
|---|---|
| `realizado` | Quando `mes_realizado` estiver preenchido |
| `agendado` | Quando `mes_agendado` estiver preenchido e `mes_realizado` estiver vazio |
| `sem-agendamento` | Quando `mes_agendado` e `mes_realizado` estiverem vazios |

### Regras de pendência

Cada linha deve gerar as seguintes flags:

| Flag | Regra |
|---|---|
| `sem_giaso` | Coluna `giaso` vazia |
| `sem_pcdp` | Coluna `pcdp` vazia |
| `sem_processo` | Coluna `processo` vazia |
| `local_indefinido` | Coluna `cidade` vazia ou igual a `"indefinido"` |

### Indicadores agregados

Implementar os cálculos:

```text
taxa_execucao = realizadas / total_atividades * 100

taxa_agendamento = (realizadas + agendadas) / total_atividades * 100

pendencias_criticas = sem_giaso + pcdp_duplicada + multiplas_pcdps
```

Também validar:

- `pcdp_duplicada`: PCDPs que aparecem em mais de uma linha.
- `multiplas_pcdps`: pares de `atividade + regulado` com mais de uma PCDP distinta.

### Requisitos técnicos

- Evitar divisão por zero.
- Normalizar strings antes de comparar valores.
- Tratar valores nulos, vazios e espaços em branco.
- Não quebrar quando colunas opcionais estiverem ausentes.
- Persistir corretamente os registros de `CicloActivity`.
- Atualizar `Analysis.indicators`.
- Todos os erros retornados ao usuário devem estar em português.

---

## 2. Backend — Endpoint de dados tratados com paginação

Revise o endpoint:

```text
GET /api/v1/analyses/{id}/treated-data
```

Ele deve retornar os registros de `CicloActivity` de forma paginada.

### Query params esperados

Adicionar suporte aos seguintes parâmetros:

```text
page
page_size
status
gerencia
cidade
setor
sem_giaso
sem_pcdp
sem_processo
local_indefinido
search
sort_by
sort_order
```

### Resposta esperada

A resposta deve seguir uma estrutura semelhante a:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20,
  "total_pages": 0
}
```

### Requisitos

- Validar se a análise existe.
- Validar permissão do usuário.
- Não retornar dados de outra análise.
- Usar SQLAlchemy de forma eficiente.
- Evitar carregar todas as linhas em memória.
- Manter compatibilidade com o frontend existente.
- Retornar erros em português.

---

## 3. Backend — Consolidar RBAC/Admin

O projeto agora possui controle de admin inicial. Revise se o controle é apenas visual ou se também está garantido no backend.

O controle de permissão precisa existir no backend. Não basta esconder botões ou páginas no frontend.

### Papéis de usuário

Criar ou validar suporte aos papéis:

```text
admin
analyst
viewer
```

### Permissões esperadas

#### `viewer`

Pode:

- Visualizar análises.
- Visualizar resumo.
- Visualizar alertas.
- Visualizar dados tratados.
- Visualizar resumo IA já gerado.

Não pode:

- Fazer upload.
- Criar análise.
- Excluir análise.
- Exportar Excel.
- Gerar resumo IA.
- Gerenciar usuários.
- Alterar configurações administrativas.

#### `analyst`

Pode:

- Fazer upload.
- Criar análise.
- Visualizar análises.
- Visualizar dados tratados.
- Exportar Excel.
- Gerar resumo IA.

Não pode:

- Gerenciar usuários.
- Alterar configurações administrativas.
- Acessar funções exclusivas de admin.

#### `admin`

Pode tudo, incluindo:

- Gerenciar usuários.
- Excluir análises.
- Acessar `/configuracoes`.
- Alterar configurações administrativas.
- Executar ações administrativas.

### Dependências esperadas no backend

Criar ou revisar dependências semelhantes a:

```python
get_current_user()
require_role(...)
require_any_role(...)
```

### Rotas que devem exigir admin

```text
/admin/*
/users/*
/configuracoes/*
```

### Rotas que devem exigir analyst ou admin

```text
POST /upload
POST /upload-and-analyze
POST /analyses
POST /analyses/{id}/ai-summary
GET /analyses/{id}/export/excel
```

### Rotas que podem aceitar viewer, analyst ou admin

```text
GET /analyses
GET /analyses/{id}
GET /analyses/{id}/preview
GET /analyses/{id}/summary
GET /analyses/{id}/alerts
GET /analyses/{id}/treated-data
GET /analyses/{id}/ai-summary
```

---

## 4. Segurança — Corrigir autenticação JWT

Atualmente o JWT é salvo em cookie acessível via JavaScript. Corrigir para um modelo mais seguro.

### Implementar

- Cookie `httpOnly`.
- Cookie `Secure` em produção.
- Cookie `SameSite=Lax` ou `SameSite=Strict`.
- Remover dependência de `document.cookie` para leitura do token no frontend.
- Criar endpoint de logout que remove o cookie.
- Criar endpoint `/auth/me` para retornar usuário autenticado.
- Garantir que o backend leia o token do cookie.
- Manter leitura via header `Authorization: Bearer` apenas se necessário para compatibilidade.

### Também revisar

- `SECRET_KEY` não pode usar valor padrão em produção.
- Validar variáveis de ambiente no startup.
- Senhas devem ser armazenadas com hash.
- Login deve ter mensagens genéricas em caso de erro.
- Adicionar rate limiting em login e upload, se possível sem grande complexidade.
- Não expor detalhes internos em mensagens de erro.

---

## 5. Backend — Usuários e administração

Caso ainda não exista um modelo de usuários real, implementar uma base simples.

### Modelo sugerido

```text
User
- id
- username
- email
- hashed_password
- role
- is_active
- created_at
- updated_at
```

### Endpoints administrativos sugeridos

```text
GET /api/v1/users
GET /api/v1/users/{id}
POST /api/v1/users
PATCH /api/v1/users/{id}
DELETE /api/v1/users/{id}
```

### Regras

- Apenas admin pode acessar esses endpoints.
- Não retornar senha ou hash de senha.
- Não permitir que um usuário remova o próprio papel de admin se for o único admin ativo.
- Validar duplicidade de username e email.
- Retornar mensagens em português.

---

## 6. Backend — Auditoria

Adicionar uma camada simples de auditoria para ações importantes.

### Ações a registrar

- Login bem-sucedido.
- Tentativa de login inválida.
- Upload de arquivo.
- Criação de análise.
- Exclusão de análise.
- Geração de resumo IA.
- Criação de usuário.
- Alteração de usuário.
- Remoção/desativação de usuário.
- Alteração de configuração administrativa.

### Modelo sugerido

```text
AuditLog
- id
- user_id
- action
- entity_type
- entity_id
- metadata
- created_at
```

### Requisitos

- Não armazenar dados brutos sensíveis.
- Não armazenar senha.
- Usar JSON para metadados simples.
- Permitir consulta futura por admin.

---

## 7. Frontend — Exibir tabela real de atividades

Na página:

```text
apps/web/app/analises/[id]/page.tsx
```

ou nos componentes relacionados, substituir ou complementar o preview limitado por uma tabela real de `CicloActivity`.

A tabela deve consumir:

```text
GET /api/v1/analyses/{id}/treated-data
```

### Funcionalidades da tabela

- Paginação.
- Ordenação.
- Busca textual.
- Filtros por:
  - status
  - gerência
  - cidade
  - setor
  - sem GIASO
  - sem PCDP
  - sem processo
  - local indefinido
- Badge visual para status.
- Badge visual para pendências.
- Loading state.
- Empty state.
- Estado de erro em português.

### Colunas mínimas

```text
item
atividade
gerencia
setor
regulado
cidade
mes
mes_agendado
mes_realizado
giaso
processo
pcdp
prioridade
status
pendências
```

### Requisitos de UX

- Não travar a tela ao trocar página ou filtro.
- Preservar filtros na URL, se possível.
- Mostrar total de registros.
- Mostrar página atual e total de páginas.
- Usar mensagens claras em português.
- Evitar tabela larga quebrada em telas menores.

---

## 8. Frontend — Consolidar admin/configurações

Transformar a página:

```text
apps/web/app/configuracoes/page.tsx
```

em uma página funcional de administração.

### Requisitos

- Só admin pode acessar.
- Se o usuário não for admin, exibir mensagem de acesso negado ou redirecionar.
- Mostrar dados básicos do usuário logado.
- Exibir painel de usuários, se o backend suportar CRUD de usuários.
- Exibir configurações do sistema, se existirem.
- Não depender apenas de validação visual.
- A API também deve bloquear acesso indevido.

### Conteúdo sugerido

A página pode conter:

- Card com usuário logado.
- Card com papel/permissão atual.
- Lista de usuários.
- Botão para criar usuário.
- Ações para ativar/desativar usuário.
- Ações para alterar papel.
- Área futura para configurações do sistema.

---

## 9. Frontend — Ajustar autenticação para cookie httpOnly

Com o token em cookie `httpOnly`, o frontend não deve mais ler o JWT com `document.cookie`.

### Ajustar

```text
apps/web/lib/auth.ts
apps/web/lib/api.ts
apps/web/middleware.ts
```

### Requisitos

- Requests devem usar `credentials: "include"` quando necessário.
- Login deve depender do backend setar o cookie.
- Logout deve chamar endpoint do backend.
- `/auth/me` deve ser usado para recuperar o usuário autenticado.
- Middleware deve proteger rotas privadas.
- Frontend deve reconhecer papel do usuário para renderização condicional.

---

## 10. Dashboard e gráficos

Depois de completar os dados tratados, implementar gráficos iniciais com Recharts.

Na página:

```text
apps/web/app/dashboard/page.tsx
```

implementar:

- Total de análises.
- Total de atividades.
- Taxa média de execução.
- Pendências críticas totais.
- Gráfico de execução por mês.
- Gráfico por gerência.
- Cards de alertas principais.

Caso ainda não exista endpoint consolidado, criar um endpoint simples no backend:

```text
GET /api/v1/dashboard/summary
```

### Resposta sugerida

```json
{
  "total_analyses": 0,
  "total_activities": 0,
  "average_execution_rate": 0,
  "critical_pending_items": 0,
  "execution_by_month": [],
  "execution_by_department": [],
  "top_alerts": []
}
```

### Requisitos

- Proteger endpoint com autenticação.
- Viewer, analyst e admin podem visualizar.
- Evitar queries muito pesadas.
- Retornar dados já agregados.
- Não retornar dados brutos desnecessários.

---

## 11. Página de ciclos

Transformar a página:

```text
apps/web/app/ciclos/page.tsx
```

em uma página funcional do módulo de ciclos.

### Conteúdo sugerido

- Lista de análises do tipo `ciclos`.
- Filtros por período, status e gerência.
- Cards com indicadores agregados.
- Link para detalhes da análise.
- Link para upload de nova planilha.
- Estado vazio com CTA para upload.

---

## 12. Página de relatórios

Transformar a página:

```text
apps/web/app/relatorios/page.tsx
```

em uma página funcional inicial.

### Funcionalidades mínimas

- Listar análises disponíveis.
- Permitir exportar Excel tratado.
- Preparar estrutura para relatório PDF futuro.
- Mostrar data da análise, nome do arquivo e status.
- Bloquear exportação para viewer, se essa for a regra adotada.

### Funcionalidades futuras

- Geração de PDF executivo.
- Filtros por período.
- Filtros por tipo de análise.
- Histórico de relatórios gerados.

---

## 13. IA — Garantir privacidade e cache

Revisar o fluxo de IA.

### Requisitos

- Nunca enviar dados brutos para IA.
- Enviar apenas indicadores agregados.
- Reutilizar resumo IA em cache quando já existir.
- Permitir regenerar resumo apenas para analyst ou admin.
- Viewer pode visualizar resumo já gerado, mas não gerar novo.
- Tratar erros da OpenAI com mensagem amigável em português.
- Manter `MockAIProvider` funcionando sem chave.

---

## 14. Exportação Excel

Revisar o endpoint:

```text
GET /api/v1/analyses/{id}/export/excel
```

### Requisitos

- Exportar dados tratados de `CicloActivity`.
- Incluir aba de indicadores.
- Incluir aba de alertas ou pendências, se possível.
- Usar `xlsxwriter` para formatação.
- Nome do arquivo deve ser seguro.
- Analyst e admin podem exportar.
- Viewer não pode exportar, salvo se a regra do produto permitir.

---

## 15. Alertas

Revisar o endpoint:

```text
GET /api/v1/analyses/{id}/alerts
```

### Alertas mínimos

Gerar alertas para:

- Atividades sem agendamento.
- Atividades sem GIASO.
- Atividades sem PCDP.
- Atividades sem processo.
- Locais indefinidos.
- PCDPs duplicadas.
- Múltiplas PCDPs para mesma atividade/regulado.
- Taxa de execução baixa.

### Requisitos

- Classificar alertas em:
  - crítico
  - atenção
  - informação
- Incluir contadores.
- Incluir link lógico para filtrar dados tratados quando possível.
- Mensagens em português.

---

## 16. Testes

Adicionar testes mínimos para backend e frontend.

---

### 16.1 Backend

Usar `pytest`.

Criar testes para:

```text
classifier.py
ciclo_analyzer.py
auth/RBAC
treated-data pagination
```

### Casos mínimos para `ciclo_analyzer.py`

- Planilha vazia.
- Todas as atividades realizadas.
- Todas as atividades agendadas.
- Todas as atividades sem agendamento.
- Linhas sem GIASO.
- Linhas sem PCDP.
- Linhas sem processo.
- Cidade indefinida.
- PCDP duplicada.
- Múltiplas PCDPs para mesma atividade/regulado.
- Colunas opcionais ausentes.
- Valores com espaços em branco.
- Valores nulos.

### Casos mínimos para RBAC

- Viewer consegue listar análises.
- Viewer não consegue fazer upload.
- Viewer não consegue gerar resumo IA.
- Analyst consegue fazer upload.
- Analyst não consegue gerenciar usuários.
- Admin consegue gerenciar usuários.
- Usuário não autenticado recebe erro apropriado.

---

### 16.2 Frontend

Adicionar testes básicos para:

- Login.
- Logout.
- UploadDropzone.
- Renderização da página de análise.
- Renderização da tabela de atividades.
- Filtros da tabela.
- Paginação da tabela.
- Bloqueio de acesso à página de configurações para não-admin.
- Renderização condicional por papel de usuário.

---

## 17. Migrations

Alembic já está disponível, mas o projeto ainda usa `create_tables()`.

Implementar Alembic de forma incremental.

### Requisitos

- Criar estrutura de migrations se ainda não existir.
- Gerar migration inicial compatível com os modelos atuais.
- Garantir que o projeto continue funcionando em SQLite.
- Preparar compatibilidade com PostgreSQL.
- Não quebrar ambiente de desenvolvimento.
- Documentar como rodar migrations.

### Comandos esperados no README

Adicionar instruções semelhantes a:

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

---

## 18. Infraestrutura mínima

Adicionar ou revisar suporte a desenvolvimento local.

### Docker Compose

Criar ou revisar:

```text
docker-compose.yml
```

Serviços sugeridos:

- `api`
- `web`
- `postgres`, se já for viável
- volume para uploads

### CI/CD

Criar pipeline inicial com GitHub Actions:

- Lint backend.
- Testes backend.
- Lint frontend.
- Testes frontend.
- Build frontend.

---

## 19. Qualidade de código

### Regras gerais

- Não reescrever a arquitetura inteira.
- Não trocar FastAPI, Next.js, SQLAlchemy ou Polars.
- Não introduzir dependências pesadas sem necessidade.
- Não enviar dados brutos para IA.
- Não deixar controle de permissão apenas no frontend.
- Não quebrar rotas existentes.
- Manter compatibilidade com o fluxo atual de upload e análise.
- Preferir alterações pequenas, testáveis e incrementais.
- Mensagens ao usuário devem estar em português.
- Remover `console.log` desnecessário.
- Remover `print` desnecessário.
- Evitar duplicação de lógica.
- Tipar corretamente os retornos.
- Tratar erros de forma explícita.

---

## 20. Critérios de aceite

Considere a tarefa concluída quando:

- Upload de planilha de ciclos funciona.
- Análise gera indicadores corretos.
- Registros de `CicloActivity` são persistidos.
- Tabela de dados tratados aparece no frontend.
- Filtros, busca e paginação funcionam.
- Admin possui permissões reais no backend.
- Viewer não consegue executar ações restritas.
- Analyst consegue fazer upload e gerar análise.
- JWT não fica mais acessível via JavaScript.
- `/auth/me` funciona.
- Logout funciona.
- Testes principais passam.
- Erros aparecem em português.
- Nenhum dado bruto é enviado para IA.
- Não há `console.log` ou `print` desnecessário em produção.
- Build do frontend passa.
- Backend inicia sem erro.
- Fluxo principal funciona ponta a ponta.

---

## 21. Ordem recomendada de implementação

Execute nesta ordem:

1. Inspecionar modelos, rotas e serviços atuais.
2. Completar `ciclo_analyzer.py`.
3. Criar testes unitários do analisador.
4. Implementar paginação e filtros em `treated-data`.
5. Criar tabela real de `CicloActivity` no frontend.
6. Consolidar RBAC/admin no backend.
7. Ajustar frontend para respeitar papéis de usuário.
8. Migrar JWT para cookie `httpOnly`.
9. Implementar `/auth/me` e logout.
10. Implementar `/configuracoes` funcional.
11. Criar dashboard básico com gráficos.
12. Criar página `/ciclos` funcional.
13. Criar página `/relatorios` inicial.
14. Adicionar Alembic.
15. Adicionar testes frontend.
16. Adicionar CI básico.
17. Rodar testes, lint e build.
18. Corrigir regressões encontradas.

---

## 22. Entrega esperada

Ao final, entregue:

1. Resumo do que foi alterado.
2. Lista de arquivos modificados.
3. Novos endpoints criados ou alterados.
4. Novos modelos ou campos adicionados.
5. Novas permissões implementadas.
6. Novos testes adicionados.
7. Como rodar o projeto.
8. Como rodar migrations.
9. Como rodar os testes.
10. Pendências restantes, se houver.

---


---

## 23. Observações finais

A prioridade não é criar uma arquitetura nova.  
A prioridade é transformar a arquitetura existente em um MVP realmente funcional, seguro e testável.

Os pontos mais críticos são:

1. Precisão da análise de ciclos.
2. Exibição dos dados tratados.
3. Permissões reais no backend.
4. Autenticação mais segura.
5. Testes mínimos.

Não avance para funcionalidades sofisticadas antes de garantir que esses cinco pontos estejam corretos.


Você é um especialista em análise de planilhas Excel, consolidação de dados gerenciais e automação com Python/pandas.

Contexto:
Até agora, trabalhamos principalmente com planilhas de CICLO BASE. Já consolidamos a lógica, limpeza, tratamento e análises gerenciais sobre esse tipo de arquivo.

Agora precisamos expandir o mesmo processo para mais dois tipos de planilhas:
1. CICLO DESEMPENHO
2. VIGILÂNCIAS NÃO PROGRAMADAS / NÃO INFORMADAS

Na pasta `docs`, existem arquivos de exemplo com os nomes aproximados:
- `ciclo base`
- `não informadas`

Objetivo:
Criar um plano de ação e uma lógica de análise Excel capaz de:
1. Identificar automaticamente se cada arquivo, aba ou linha pertence a:
   - CICLO_BASE
   - CICLO_DESEMPENHO
   - NAO_PROGRAMADA
   - INDEFINIDO
2. Reaplicar nas planilhas de CICLO DESEMPENHO e NÃO PROGRAMADAS/NÃO INFORMADAS as mesmas etapas já feitas para o CICLO BASE:
   - leitura dos arquivos
   - identificação de cabeçalho
   - padronização de colunas
   - limpeza dos dados
   - consolidação
   - geração de análises gerenciais
   - validações
   - exportação dos resultados

Regras de classificação:
Use prioritariamente a coluna `Item`, mesmo que o nome venha com variações como `ITEM`, `item`, `Itens`, `Código`, `Cod Item` ou similares.

Classifique cada linha assim:

1. CICLO_DESEMPENHO
   - Quando o valor da coluna `Item` começar com a letra `D`.
   - Exemplos:
     - `D1`
     - `D01`
     - `D-001`
     - `D alguma coisa`
   - Regex sugerida:
     `^\s*D[\s.\-_/]*[A-Za-z0-9]+`

2. NAO_PROGRAMADA
   - Quando o valor da coluna `Item` começar com a letra `N` seguida de alguma numeração.
   - Exemplos:
     - `N1`
     - `N01`
     - `N-001`
     - `N 12`
   - Regex sugerida:
     `^\s*N[\s.\-_/]*\d+`

3. CICLO_BASE
   - Quando o arquivo ou aba indicar claramente `ciclo base`;
   - ou quando a estrutura da planilha for igual/semelhante ao modelo já consolidado de ciclo base;
   - ou quando a linha não for classificada como `D` nem `N`, mas estiver dentro de uma planilha identificada como ciclo base.

4. INDEFINIDO
   - Quando não houver coluna `Item`;
   - ou quando o valor de `Item` estiver vazio;
   - ou quando houver conflito entre nome do arquivo, aba e padrão do item;
   - ou quando a classificação não puder ser feita com segurança.

Ordem de prioridade para classificação:
1. Valor da coluna `Item`
2. Nome da aba
3. Nome do arquivo
4. Similaridade estrutural com os modelos de exemplo
5. INDEFINIDO

Atenção:
- Tratar `não programadas`, `nao programadas`, `não informadas` e `nao informadas` como o mesmo grupo lógico: `NAO_PROGRAMADA`.
- Não assumir que todas as planilhas têm o mesmo cabeçalho.
- Detectar automaticamente a linha de cabeçalho quando houver linhas introdutórias acima da tabela.
- Padronizar nomes de colunas antes da análise.
- Preservar o nome do arquivo e da aba de origem em todas as linhas consolidadas.
- Criar uma coluna nova chamada `tipo_ciclo` com os valores:
  - `CICLO_BASE`
  - `CICLO_DESEMPENHO`
  - `NAO_PROGRAMADA`
  - `INDEFINIDO`
- Criar uma coluna chamada `criterio_classificacao`, explicando por que aquela linha recebeu o tipo atribuído.

Entregáveis esperados:
1. Plano de ação técnico.
2. Regras de classificação.
3. Estrutura sugerida do pipeline.
4. Validações necessárias.
5. Lista de possíveis riscos/inconsistências.
6. Sugestão de saídas finais em Excel.

Formato da resposta:
Responda em Markdown, com as seguintes seções:

## 1. Diagnóstico do cenário
Explique o que já existe e o que precisa ser expandido.

## 2. Plano de ação
Monte uma tabela com:
- Etapa
- Ação
- Critério de sucesso
- Saída esperada

## 3. Regras de classificação dos arquivos e linhas
Explique as regras para CICLO_BASE, CICLO_DESEMPENHO, NAO_PROGRAMADA e INDEFINIDO.

## 4. Pipeline sugerido
Descreva a sequência:
- localizar arquivos
- ler abas
- detectar cabeçalho
- normalizar colunas
- identificar coluna Item
- classificar linhas
- consolidar dados
- gerar análises
- validar resultados
- exportar arquivos finais

## 5. Validações obrigatórias
Incluir, no mínimo:
- quantidade de arquivos lidos
- quantidade de abas lidas
- quantidade de linhas por tipo de ciclo
- linhas sem Item
- linhas classificadas como INDEFINIDO
- conflitos entre nome do arquivo e padrão da coluna Item
- duplicidades
- colunas ausentes
- arquivos ignorados

## 6. Saídas finais recomendadas
Sugerir os arquivos Excel finais, por exemplo:
- `consolidado_geral.xlsx`
- `consolidado_ciclo_base.xlsx`
- `consolidado_desempenho.xlsx`
- `consolidado_nao_programadas.xlsx`
- `relatorio_validacao.xlsx`
- `analises_gerenciais.xlsx`

## 7. Próximos passos
Liste a ordem prática de implementação.




---

# Feature Planejada: Aba /pta — Histórico e Comparativo de PTA

**Status: NÃO IMPLEMENTADO — aguardando arquivos e critérios da gerência.**

## Resumo
Aba exclusiva para admins com histórico do PTA 2021–2025 pré-carregado via seed,
comparativo de taxas de realização entre qualquer par de anos, e botão "Planejar PTA"
(desabilitado até definição dos critérios com a gerência).

## Regras principais
- Arquivos serão disponibilizados por Pietro em `apps/api/seeds/pta/`
- Convenção de nome: `Ciclo_base_20XX.csv`, `Desempenho_20XX.csv`, etc.
- Dados históricos protegidos contra delete pela interface
- Comparativo: mesmo tipo de ciclo (Base vs Base, Desempenho vs Desempenho)
- Qualquer par de anos pode ser comparado (ex: 2021 vs 2026)
- Botão "Planejar PTA" só habilita quando os dois anos têm distância ≤ 2 anos
  (ex: 2025 + 2026 → planejar 2027; mas 2021 + 2026 → botão cinza)
- Lógica de planejamento via IA: PENDENTE — Pietro vai verificar critérios com a gerência

## Documentação completa
Ver: docs/feature-pta.md


Na página inicial do sistema, na seção "Início rápido", atualmente existe apenas a opção para enviar uma planilha.

Quero adicionar uma segunda opção ao lado: "Enviar PDF".

A tela inicial deve permitir dois fluxos independentes:

1. Enviar planilha
2. Enviar PDF

O sistema não deve depender exclusivamente das planilhas de ciclos para funcionar. Ele precisa aceitar arquivos genéricos, tanto Excel quanto PDF, mesmo que não sejam de ciclo base, ciclo desempenho ou vigilâncias não programadas.

Novo comportamento esperado:

- Se o usuário enviar uma planilha genérica, o sistema deve analisar a estrutura disponível, identificar colunas, resumir os dados e gerar um relatório gerencial básico.
- Se o usuário enviar um PDF genérico, o sistema deve extrair o conteúdo, identificar os principais tópicos, resumir informações relevantes e gerar um relatório executivo em PDF ou em tela.
- Se o arquivo for relacionado aos ciclos conhecidos, aplicar as regras específicas já existentes.
- Se o arquivo não for relacionado aos ciclos, seguir o fluxo genérico de análise.
- A geração de relatório não deve depender obrigatoriamente de uma análise completa de ciclos.
- O sistema deve conseguir gerar relatório a partir de apenas um PDF, apenas uma planilha, ou ambos.

Regras de decisão:

- Arquivo Excel com padrão de ciclo → usar análise específica de ciclos.
- Arquivo Excel sem padrão de ciclo → usar análise genérica de planilha.
- Arquivo PDF relacionado aos ciclos → usar contexto dos ciclos quando possível.
- Arquivo PDF genérico → gerar relatório executivo genérico.
- Excel + PDF enviados juntos → cruzar as informações quando possível e gerar relatório consolidado.

Na interface, mostrar claramente os dois botões:

- "Enviar planilha"
- "Enviar PDF"

E após o envio, perguntar ou detectar automaticamente o tipo de análise:

- Análise de ciclos
- Análise genérica de planilha
- Relatório executivo de PDF
- Relatório consolidado com planilha + PDF

Objetivo final:
Permitir que o sistema funcione tanto para os arquivos específicos de ciclos quanto para documentos genéricos, sem bloquear a geração de relatório quando não houver uma análise completa de ciclos.



Quero criar uma nova área chamada **/ptamensal**, destinada ao acompanhamento mensal do PTA 2026.

Ao acessar a aba **/pta**, o usuário deverá visualizar dois botões principais:

1. **PTA Histórico**

   * Mantém o acesso às informações históricas já existentes.

2. **Acompanhamento PTA Vigente**

   * Nova área para acompanhar o PTA atual, com filtros, indicadores e visão gerencial da execução.

A aba **Acompanhamento PTA Vigente** deve permitir filtrar as informações por:

* Mês do ano de 2026;
* Dia vigente, considerando a data e o horário atual;
* Atividade;
* Local;
* Servidor responsável;
* Status da execução;
* Tipo de planilha enviada.

Como o **PTA 2026 estará sempre em atualização**, o sistema deve permitir que o usuário **exclua uma planilha antiga** para enviar uma versão mais atualizada. Dessa forma, sempre que houver uma nova planilha do PTA, o usuário poderá substituir a anterior sem gerar conflito de informações.

As planilhas devem ser organizadas por tipo, por exemplo:

* **Ciclo Base**
* **Desempenho**
* **Controle PTA**
* **PTA Final**
* **Não Informadas**

Caso uma planilha já esteja pronta, como **Controle PTA** ou **PTA Final**, ela também deverá poder ser enviada e analisada normalmente.

O sistema deve permitir que o usuário envie **uma ou mais planilhas**, mas também deve funcionar quando o usuário enviar **apenas uma planilha**, entregando a análise possível com base nos dados disponíveis.

Quando houver mais de uma planilha enviada, o sistema deve separar, identificar e cruzar as informações conforme o tipo de planilha, permitindo uma análise mais completa do PTA 2026.

Essa área deve apresentar uma visualização em formato de BI, permitindo entender:

* Quantos por cento do PTA planejado já foi realizado;
* Quanto foi planejado para o ano;
* Quanto foi executado até o momento;
* Se a execução está acima, abaixo ou dentro do previsto;
* Se alguma atividade foi realizada além do necessário;
* Se o cronograma está adiantado ou atrasado;
* Quais atividades deveriam receber mais atenção no ano;
* Quais atividades estão em andamento no dia vigente;
* Em quais locais as atividades estão sendo realizadas;
* Quais servidores estão envolvidos;
* Quais servidores estão fora ou indisponíveis;
* Quanto tempo cada atividade deve durar;
* Quanto tempo cada atividade já levou para ser executada;
* Se as atividades previstas para determinado mês, como junho, já foram concluídas ou ainda estão pendentes.

O objetivo principal dessa funcionalidade é melhorar o controle diário do PTA, oferecendo uma visão clara do que foi planejado, do que já foi executado e do que ainda precisa ser feito.

A nova tela deve ajudar a responder perguntas como:

* O que deveria estar sendo feito hoje?
* Qual atividade está em execução agora?
* Onde a atividade está sendo feita?
* Quem está responsável por ela?
* Quanto tempo falta para concluir?
* A execução mensal está dentro do planejado?
* Estamos adiantados ou atrasados em relação ao PTA anual?
* Fizemos mais do que o necessário em alguma atividade?
* Quais atividades precisam de reforço ou priorização?
* Qual planilha está sendo usada como base para a análise?
* Existe alguma planilha antiga que precisa ser removida ou substituída?
* A análise está sendo feita com base em Ciclo Base, Desempenho, Controle PTA, PTA Final ou planilha não informada?

A visualização deve ser objetiva, com indicadores percentuais, gráficos, filtros e separação por tipo de planilha, facilitando a tomada de decisão e o acompanhamento operacional do PTA ao longo de 2026.


ROADMAP UPDATE
Você é um engenheiro de software sênior atuando como auditor técnico do projeto.

Objetivo:
Leia e analise o estado atual do repositório para identificar o que ainda falta para completarmos o roadmap até agora.

Tarefa:
1. Inspecione o projeto inteiro, incluindo:
   - arquivos de roadmap, backlog, TODOs, issues locais ou documentos de planejamento;
   - README, documentação técnica e arquivos de configuração;
   - estrutura de pastas;
   - código-fonte implementado;
   - testes existentes;
   - scripts, migrations, integrações e dependências.

2. Compare o que está descrito no roadmap com o que já foi implementado no código.

3. Identifique:
   - itens do roadmap já concluídos;
   - itens parcialmente implementados;
   - itens ainda não iniciados;
   - lacunas técnicas ou funcionais que não aparecem claramente no roadmap;
   - riscos, bloqueios e dependências;
   - testes, documentação ou validações que ainda faltam.

4. Não altere nenhum arquivo neste momento. Faça apenas leitura e análise.

Formato da resposta:
Retorne um relatório em Markdown com as seguintes seções:

# Diagnóstico do Roadmap

## 1. Resumo executivo
Explique em poucas frases o estado atual do projeto e o quanto o roadmap parece completo.

## 2. Itens concluídos
Liste os itens que parecem já estar implementados, citando os arquivos ou evidências encontrados.

## 3. Itens parcialmente concluídos
Para cada item, informe:
- o que já existe;
- o que ainda falta;
- arquivos relacionados;
- nível de prioridade: Alta, Média ou Baixa.

## 4. Itens pendentes
Liste o que ainda precisa ser feito para completar o roadmap.

## 5. Lacunas não documentadas no roadmap
Aponte coisas importantes que parecem faltar, mesmo que não estejam explicitamente escritas no roadmap.

## 6. Riscos e bloqueios
Liste riscos técnicos, dependências externas, ausência de testes, problemas de arquitetura ou decisões pendentes.

## 7. Próximas ações recomendadas
Crie uma lista priorizada de tarefas, em ordem de execução sugerida.

## 8. Checklist final
Monte um checklist objetivo no formato:
- [ ] Tarefa
- [ ] Tarefa
- [ ] Tarefa




---

# Plano de Deploy — Vercel (web) + Railway (api)

**Status: DECIDIDO, AGUARDANDO IMPLEMENTAÇÃO.**

Diagnóstico completo em `docs/diagnostico-roadmap-2026-06-09.md`.

## Decisão de arquitetura

```
Usuários ──► Vercel (apps/web, Next.js)
                  │
                  │ rewrite server-side /api/* (mesma origem, sem CORS)
                  ▼
              Railway (apps/api, FastAPI + Postgres + volume persistente)
```

O Vercel não é adequado para o backend (serverless = sem processo persistente,
quebra o APScheduler de relatórios agendados e o rate limiter in-memory; filesystem
efêmero perderia uploads/PDFs gerados). Por isso: **frontend no Vercel, backend no Railway**.

O projeto já foi desenhado para o padrão "same-origin via rewrite":
`apps/web/next.config.js` já tem `rewrites()` de `/api/*` → backend, e
`apps/web/lib/api.ts` já usa URL relativa quando `NEXT_PUBLIC_API_URL` está vazio
(comentário no código: "Empty string → relative URL → proxied by Next.js rewrites → sem cross-origin").
Vamos manter esse padrão — evita complicações de CORS/cookies cross-site.

## Mudanças de código necessárias

1. **`apps/web/next.config.js`**: hoje usa `NEXT_PUBLIC_API_URL` como destino do
   rewrite. Como variáveis `NEXT_PUBLIC_*` são embutidas no bundle do client, isso
   faria `lib/api.ts` chamar o Railway diretamente (cross-origin), quebrando o
   padrão same-origin. **Trocar para uma variável server-only, ex. `BACKEND_API_URL`**
   (sem prefixo `NEXT_PUBLIC_`), usada só dentro de `next.config.js`.
2. **Não definir `NEXT_PUBLIC_API_URL`** no ambiente de produção do Vercel — assim
   `lib/api.ts` continua usando caminhos relativos.
3. **Backend (`apps/api`)**: confirmar que `secure=True` nos cookies (`anac_token`,
   `anac_role`) é ativado quando `ENVIRONMENT=production` (ver `_validate_settings()`
   e onde os cookies são setados em `routes/auth.py`).
4. Ajustar `cors_origins` (config.py) para incluir o domínio Vercel como defesa
   extra, mesmo que o tráfego principal passe pelo rewrite.

## Configuração no Railway (apps/api)

- Root directory: `apps/api`. Build a partir do `apps/api/Dockerfile` já existente.
- Plugin **PostgreSQL** do Railway → injeta `DATABASE_URL` (confirmar formato
  `postgresql+psycopg2://` vs `postgresql://` aceito pelo SQLAlchemy/psycopg2).
- **Volume persistente** montado em `apps/api/uploads/` e `apps/api/generated/`
  (sem isso, planilhas e PDFs/Excel gerados somem a cada deploy/restart).
- Variáveis de ambiente:
  - `DATABASE_URL` (do plugin Postgres)
  - `SECRET_KEY` (≥32 chars, forte)
  - `AUTH_USERNAME`, `AUTH_PASSWORD`
  - `ENVIRONMENT=production`
  - `CORS_ORIGINS=["https://<seu-app>.vercel.app"]`
  - `GEMINI_API_KEY` / `OPENAI_API_KEY`
  - `SMTP_*` (se for usar e-mail)
  - `WEB_CONCURRENCY=1` (rate limiter atual é in-memory por worker; com >1 worker
    o limite efetivo multiplica — ver `apps/api/app/core/rate_limit.py`)

## Configuração no Vercel (apps/web)

- Root directory: `apps/web`.
- Variável de ambiente: `BACKEND_API_URL=https://<seu-backend>.up.railway.app`
- **Não definir** `NEXT_PUBLIC_API_URL`.
- Verificar se `output: "standalone"` em `next.config.js` causa algum problema no
  build da Vercel (geralmente é ignorado, mas validar com build de teste).

## Ordem de implementação (próxima sessão)

1. Ajustar `apps/web/next.config.js` (`BACKEND_API_URL` em vez de `NEXT_PUBLIC_API_URL`).
2. Conferir/ajustar `cors_origins` e `secure` dos cookies para produção em `apps/api`.
3. Rodar `npm run build` em `apps/web` localmente para validar que nada quebra.
4. Criar `docs/deploy.md` com o passo a passo completo (Railway + Vercel + variáveis).
5. **Pendente do usuário**: criar projetos no Railway e Vercel; após o Railway gerar
   o domínio do backend, informar a URL para configurar `BACKEND_API_URL` no Vercel.

Critérios de qualidade:
- Seja específico e cite arquivos, funções, pastas ou evidências sempre que possível.
- Não invente funcionalidades que não encontrou.
- Quando houver incerteza, marque como “precisa confirmar”.
- Priorize clareza, completude e utilidade prática para desenvolvimento.
- Separe análise de recomendação.