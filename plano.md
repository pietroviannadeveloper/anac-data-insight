# Plano — Teste de fluxo Claude + Codex com documentação

## Objetivo
Validar se o fluxo Claude → Codex funciona usando uma alteração segura, restrita a documentação (nenhum código-fonte ou configuração é tocado).

## Contexto
Sequência do teste anterior (fluxo de processo puro). Desta vez a tarefa inclui a criação de um artefato real, porém de baixo risco: um documento explicando a colaboração Claude + Codex neste projeto.

## Arquitetura atual (referência rápida)
- `apps/web`: Next.js 14 App Router (TypeScript, Tailwind) — não tocado neste teste.
- `apps/api`: FastAPI (Python 3.11+) — não tocado neste teste.
- `docs/`: documentação de produto e decisões técnicas — destino do novo arquivo `fluxo-ia.md`.

## Arquivos impactados

### Alterados
- `plano.md` (este arquivo, atualizado na raiz).
- `docs/fluxo-ia.md` (criado).

### Consultados (não alterados)
- `docs/` (listagem, para verificar convenção de nomes e evitar duplicidade).
- `CLAUDE.md` (raiz do projeto) — base das regras gerais de arquitetura e padrões.
- `.maestri/roles/.../CLAUDE.md` — base das regras de papel do Claude e do Codex refletidas em `docs/fluxo-ia.md`.

## Não escopo
- Nenhum código-fonte (`apps/web`, `apps/api`).
- Nenhuma configuração (`.env`, `package.json`, `requirements.txt`, arquivos de build).
- Nenhuma alteração em banco de dados.
- Nenhum commit.

## Etapas de implementação
1. Analisar rapidamente a estrutura do projeto (`apps/web`, `apps/api`, `docs/`). — feito
2. Atualizar este `plano.md`. — feito
3. Criar `docs/fluxo-ia.md` com: papel do Claude, papel do Codex, ordem de trabalho, regras de segurança, quando pedir revisão, quando não fazer commit.
4. Não alterar nenhum outro arquivo.

## Partes implementadas pelo Claude
- `plano.md` (este documento).
- `docs/fluxo-ia.md`.

## Pontos para revisão do Codex
- Confirmar que `docs/fluxo-ia.md` reflete corretamente o papel de cada agente conforme definido nas roles do projeto (`.maestri/roles/.../CLAUDE.md`).
- Verificar se as regras de segurança e critérios de "quando não commitar" estão completos e sem contradição com o `CLAUDE.md` da raiz.
- Apontar se falta alguma seção relevante para o documento servir como referência oficial do fluxo de trabalho.

## Critérios de aceite
- `docs/fluxo-ia.md` criado com as seis seções pedidas.
- `plano.md` atualizado refletindo esta tarefa.
- Nenhum arquivo de código-fonte, configuração, `.env`, `package.json` ou banco de dados alterado.
- Nenhum commit realizado.

## Riscos técnicos
- Baixo: alteração restrita a documentação (Markdown), sem impacto em build, lint ou testes.

## Plano de testes
- N/A — não há código executável envolvido nesta tarefa.

## Comandos de validação
- `git status --short` — confirmar que apenas `plano.md` e `docs/fluxo-ia.md` aparecem como novos/alterados. O diretório `.maestri/` pode aparecer como não rastreado; é artefato operacional do ambiente Maestri, fora do escopo desta tarefa.

## Status
- Concluído (aguardando revisão do Codex).
