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