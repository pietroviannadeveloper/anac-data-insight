# Roadmap — ANAC Data Insight

## MVP (v0.1.0) — Em desenvolvimento

- [x] Estrutura do projeto (monorepo)
- [x] Frontend Next.js 14 com App Router
- [x] Página inicial institucional
- [x] Componente de upload com drag-and-drop
- [x] Backend FastAPI
- [x] Endpoint de upload com validação
- [x] Modelos de banco de dados (SQLAlchemy)
- [x] Classificador de planilhas
- [x] Leitor de arquivos CSV/Excel (Polars)
- [x] Camada de IA (OpenAI / Mock)
- [ ] Análise completa de ciclos (regras implementadas)
- [ ] Exibição de indicadores no frontend
- [ ] Preview de dados no frontend
- [ ] Geração de relatório PDF
- [ ] Exportação Excel tratada

## v0.2.0 — Ciclos completos

- [ ] Implementação de todas as regras de ciclo (`ciclo_analyzer.py`)
- [ ] Tabela de atividades com filtros e ordenação
- [ ] Indicadores por gerência (com criticidade)
- [ ] Gráfico de execução por mês
- [ ] Alertas de pendência consolidados
- [ ] Resumo IA integrado ao frontend

## v0.3.0 — Relatórios e exportações

- [ ] Geração de relatório PDF executivo
- [ ] Exportação da planilha tratada em Excel
- [ ] Histórico de análises com paginação
- [ ] Comparação entre ciclos

## v0.4.0 — Autenticação e produção

- [ ] Autenticação via OAuth2/OIDC (Active Directory corporativo)
- [ ] Controle de acesso por perfil (leitura / análise / admin)
- [ ] Migração para PostgreSQL
- [ ] Deploy em servidor interno
- [ ] Pipeline CI/CD

## Backlog (futuro)

- Integração com Power BI via conector dedicado.
- Notificações por e-mail quando análise for concluída.
- Upload em lote (múltiplos arquivos).
- Dashboard consolidado com histórico de ciclos.
- Suporte a outros tipos de planilha (RBAC, certificações, etc.).
