# Feature: Aba /pta — Histórico e Comparativo de PTA

## Status
**Planejado — não implementado.**
Aguardando definição dos critérios de planejamento com a gerência antes de ativar o botão "Planejar PTA".

---

## O que é

Aba exclusiva para administradores (`/pta`) que exibe o histórico de Programas de Trabalho Anual (PTA) de 2021 a 2025, permite comparar taxas de realização entre qualquer par de anos e reserva espaço para o planejamento do PTA do ano seguinte via IA (desabilitado por ora).

---

## Regras de negócio

### Dados históricos (seed)
- Os arquivos do PTA 2021–2025 são carregados via **script de seed** antes de a aplicação ir ao ar.
- Ficam em `apps/api/seeds/pta/` no repositório.
- Convenção de nomenclatura dos arquivos: `Ciclo_base_20XX.csv`, `Desempenho_20XX.csv`, `Nao_programadas_20XX.csv`.
- O ano é extraído automaticamente do nome do arquivo (regex `20\d{2}`).
- Inseridos no banco com flag `is_pta = true` e campo `reference_year = XXXX`.
- **Não podem ser deletados pela interface** (nem por admin) — proteção via backend.
- Nenhum usuário comum vê ou interage com esses registros.

### Formato dos arquivos
- Mesmo formato das planilhas já suportadas pelo sistema (colunas: Item, Atividade, Gerência, Setor, Regulado, Cidade, Mes, MesAgendado, MesRealizado, GIASO, Processo, PCDP, Prioridade).
- Classificação por tipo de ciclo via prefixo do campo `Item` (já implementado no `classifier.py`):
  - `D...` → CICLO_DESEMPENHO
  - `N\d+` → NAO_PROGRAMADA
  - Numérico → CICLO_BASE

---

## A aba /pta

### Acesso
- Somente usuários com `role = admin`.
- Invisível no menu para outros perfis (mesmo padrão da aba /admin).

### Conteúdo

**Biblioteca histórica (2021–2025)**
- Lista os arquivos PTA disponíveis agrupados por ano e tipo de ciclo.
- Exibe indicadores resumidos de cada ano: total de atividades, taxa de execução, pendências críticas.

**Comparativo entre anos**
- Admin seleciona dois anos quaisquer (ex: 2026 vs 2021).
- O sistema compara **mesmo tipo de ciclo** (Base vs Base, Desempenho vs Desempenho, Não Programadas vs Não Programadas).
- BI com gráficos lado a lado mostrando taxa de realização por tipo, por gerência e evolução temporal.

**Botão "Planejar PTA"**
- Visível mas **desabilitado (cinza, sem ação)** por padrão.
- Habilitado **apenas quando os dois anos selecionados estiverem dentro de uma janela de 2 anos de distância** entre si.
  - Exemplo válido: 2025 e 2026 → pode planejar 2027.
  - Exemplo inválido: 2021 e 2026 → botão permanece cinza.
- A lógica de planejamento via IA **ainda não está definida** — aguardando critérios da gerência.
- Quando habilitado no futuro, gerará sugestão de planejamento para o ano N+1 com base nos N anos selecionados.

---

## Pendências antes de implementar

1. **Arquivos de seed**: Pietro precisa disponibilizar os CSVs/XLSX do PTA 2021–2025 na pasta `apps/api/seeds/pta/`.
2. **Critérios de planejamento**: definir com a gerência quais métricas e regras a IA deve usar para sugerir o PTA do ano seguinte.
3. **Modelo de dados**: decidir se os registros PTA ficam na tabela `analyses` (com `is_pta=true`) ou em tabela separada `pta_cycles`.

---

## Decisões técnicas sugeridas (a confirmar)

| Decisão | Opção recomendada | Alternativa |
|---|---|---|
| Onde guardar os dados | Tabela `analyses` com `is_pta=true` e `reference_year` | Tabela separada `pta_cycles` |
| Como proteger contra delete | Backend recusa DELETE se `is_pta=true` | Coluna `locked=true` |
| Como carregar o seed | Script `seed_pta.py` rodado uma vez no deploy | Migration com dados embutidos |
| Extração do ano do arquivo | Regex `20\d{2}` no nome do arquivo | Campo manual no upload |
