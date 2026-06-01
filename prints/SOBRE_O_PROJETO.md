# ANAC Data Insight — O que é e para que serve

## O que é

**ANAC Data Insight** é uma plataforma web interna de análise automatizada de dados operacionais da Agência Nacional de Aviação Civil (ANAC). Desenvolvida para uso restrito das equipes de fiscalização, ela transforma planilhas brutas de ciclos de atividades em informação estruturada, indicadores visuais, alertas automáticos e relatórios executivos — tudo em português e com acesso controlado por perfis de usuário.

A plataforma funciona como um **BI especializado** para a realidade da fiscalização aeronáutica brasileira: aceita os formatos reais de planilha usados pela ANAC (Ciclo Base, Ciclo Desempenho, Vigilâncias Não Programadas), detecta automaticamente o tipo de arquivo e aplica as regras de negócio específicas de cada modalidade.

---

## Para que serve

### 1. Análise automatizada de ciclos de fiscalização

A principal finalidade do sistema é processar as planilhas de planejamento e execução de atividades de fiscalização da ANAC. Para cada planilha importada, o sistema calcula automaticamente:

- **Taxa de execução** — percentual de atividades realizadas sobre o total planejado
- **Taxa de agendamento** — percentual de atividades com data agendada ou realizada
- **Pendências críticas** — soma de atividades sem GIASO, com PCDP duplicada ou com múltiplas PCDPs
- **Atividades sem GIASO, sem PCDP, sem processo** — rastreabilidade de cada fiscalização
- **Locais indefinidos** — atividades sem cidade/aeródromo definido
- **Breakdown por tipo de ciclo** — Base, Desempenho e Não Programadas em separado

Isso elimina o trabalho manual de cruzamento de planilhas, centraliza a informação e garante que todos os indicadores sigam o mesmo critério de cálculo.

### 2. Painel de BI (Dashboard)

O dashboard consolida os dados de todas as análises ou de um ciclo específico em gráficos interativos:

- Distribuição de atividades por status (realizado, agendado, sem agendamento)
- Tipos de atividade O135 e sua taxa de execução
- Empresas com mais atividades e com mais pendências
- Consolidado por empresa com gráfico de barras empilhadas
- Principais alertas do período

O dashboard suporta **filtro de período** (7 dias, 30 dias, trimestre, ano) e **filtro por análise individual**, além de permitir **comparativo lado a lado** de dois ciclos com seleção direta pelo nome do arquivo.

### 3. Relatórios executivos automáticos

Para cada análise concluída, o sistema gera relatórios prontos para uso em reuniões e apresentações:

- **PDF** — relatório executivo com capa, indicadores, alertas, breakdown por tipo e resumo de IA
- **Word (DOCX)** — versão editável do mesmo conteúdo, para gestores que precisam adaptar antes de enviar
- **Excel** — dados tratados com coluna de status calculado por linha

Os relatórios são gerados sem intervenção técnica: basta clicar em "Baixar PDF" ou "Word" na página da análise.

### 4. Resumo executivo com Inteligência Artificial

Após a análise, o usuário pode solicitar um resumo gerado por IA (Google Gemini ou OpenAI) que interpreta os indicadores e produz:

- Resumo executivo em português
- Principais achados
- Riscos operacionais identificados
- Recomendações de ação
- Plano de ação com prioridades (Alta, Média, Baixa)
- Perguntas sugeridas para aprofundar a análise

A IA recebe apenas indicadores calculados — nenhum dado bruto ou informação sensível é enviado para fora.

### 5. Chat com os dados

O módulo de Chat permite fazer perguntas em linguagem natural sobre qualquer análise ou sobre toda a base de dados. Exemplos de perguntas que o sistema responde:

> "Quais empresas têm mais atividades sem GIASO?"
> "Qual a taxa de execução geral do ciclo?"
> "Quantas atividades estão sem agendamento na gerência GOAG?"
> "Mostre um resumo dos principais problemas."

O sistema consulta o banco de dados estruturado, monta o contexto relevante e envia à IA, que responde em português com base exclusivamente nos dados disponíveis.

### 6. Análise e visualização de PDFs

Além de planilhas, a plataforma aceita documentos PDF (editais, relatórios externos, normativos, atas). Para cada PDF:

- Extrai texto completo e metadados (título, autor, número de páginas, palavras)
- Exibe o documento diretamente no navegador na aba "Visualizar PDF"
- Permite solicitar resumo e análise via IA
- Gera relatório executivo em PDF/Word com o conteúdo extraído

### 7. Mapa de atividades

Para análises de ciclos, a aba "Mapa" exibe um mapa interativo do Brasil com marcadores por cidade:

- Tamanho do marcador proporcional ao número de atividades
- Cor por criticidade: verde (sem pendências), âmbar (com pendências), vermelho (>50% pendentes)
- Popup com detalhamento de GIASO, PCDP e processo ao clicar em cada cidade

### 8. Comparativo entre ciclos

A funcionalidade de comparativo permite selecionar dois ciclos (pelo nome do arquivo) e ver as métricas lado a lado, com indicação automática de melhora (↑ verde) ou piora (↓ vermelho) em cada indicador. Acessível diretamente pelo Dashboard ou pelo botão "Comparar" nas análises com versões anteriores.

### 9. Alertas configuráveis e relatórios agendados

O sistema suporta **regras de alerta automáticas**: quando uma análise concluída viola um limiar configurado (ex: taxa de execução < 60%), um alerta é registrado e um email é enviado a todos os usuários cadastrados.

Os **relatórios agendados** permitem configurar envios automáticos por cron (ex: "todo dia 1 do mês às 8h"), com geração de PDF e envio por email para uma lista de destinatários — sem necessidade de intervenção humana.

### 10. Controle de acesso e auditoria

A plataforma possui **três perfis de usuário**:

| Perfil    | Permissões |
|-----------|-----------|
| `admin`   | Acesso total: gerenciar usuários, excluir análises, configurar sistema |
| `analyst` | Fazer upload, criar análises, exportar, gerar resumo IA |
| `viewer`  | Visualizar análises, dashboards e relatórios já gerados |

Toda ação sensível é registrada no **log de auditoria**: uploads, exclusões, exportações, logins. O administrador pode consultar o histórico completo de acessos e operações pelo painel Admin.

---

## Casos de uso típicos

| Quem usa | Para quê |
|---|---|
| Coordenador de fiscalização | Acompanhar taxa de execução do ciclo mensal sem abrir planilhas |
| Gerente de área | Gerar relatório PDF para apresentar em reunião de resultados |
| Analista operacional | Identificar empresas com mais pendências de GIASO/PCDP |
| Superintendente | Receber relatório mensal por email automaticamente |
| Equipe de controle | Comparar desempenho entre dois ciclos e identificar tendências |
| Usuário avançado | Perguntar "qual empresa tem mais atividades sem agendamento?" em linguagem natural |

---

## Tecnologia

O sistema é uma plataforma web moderna, acessível por qualquer navegador, sem necessidade de instalação local:

- **Frontend**: Next.js 14 — interface responsiva, dark theme institucional `#003A70`
- **Backend**: FastAPI (Python) — API RESTful com autenticação JWT
- **Banco de dados**: SQLite em desenvolvimento, PostgreSQL em produção
- **IA**: Google Gemini (padrão) ou OpenAI (fallback)
- **Segurança**: Tokens httpOnly, RBAC no backend, sem dados brutos enviados à IA

---

## Prints das principais telas

| Arquivo | Tela |
|---|---|
| `01_login.png` | Tela de login institucional |
| `02_home.png` | Página inicial com upload rápido |
| `03_dashboard.png` | Dashboard BI com gráficos e indicadores |
| `04_analises.png` | Lista de análises com criador e badges de role |
| `05_upload.png` | Upload de planilha ou PDF |
| `06_ciclos.png` | Painel de ciclos de fiscalização |
| `07_documentos.png` | Documentos PDF enviados |
| `08_relatorios.png` | Relatórios disponíveis para download |
| `09_chat.png` | Chat IA com seletor de análise |
| `10_configuracoes.png` | Configurações: alertas, cron jobs, SMTP |
| `11_admin.png` | Painel administrativo — usuários |
| `12_admin_arquivos.png` | Painel administrativo — histórico de arquivos |
| `13_analise_detalhe.png` | Detalhe de análise com indicadores |
| `14_atividades.png` | Tabela de atividades com filtros e paginação |
| `15_chat_tab.png` | Chat dentro da análise |
| `16_mapa.png` | Mapa de atividades por cidade |
