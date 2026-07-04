# Fluxo de trabalho: Claude + Codex

Este documento descreve como Claude Code e Codex colaboram no desenvolvimento do ANAC Data Insight.

## Papel do Claude

Claude atua como Tech-Lead, arquiteto e desenvolvedor principal:

- Analisa requisitos e a arquitetura atual antes de qualquer alteração.
- Cria ou atualiza `plano.md` antes de tarefas relevantes.
- Implementa as partes complexas, críticas ou arquiteturais do sistema.
- Resolve bugs difíceis e integrações sensíveis.
- Revisa o diff completo antes de qualquer commit.
- Toma a decisão técnica final, considerando o feedback do Codex.

## Papel do Codex

Codex atua como revisor técnico e assistente de contexto:

- Revisa o `plano.md` e o diff das alterações.
- Aponta riscos, inconsistências e impactos em funcionalidades existentes.
- Sugere melhorias, testes e ajustes de documentação.
- Ajuda a checar contexto de arquivos quando solicitado.
- Não toma a decisão arquitetural final — isso é responsabilidade do Claude.

## Ordem de trabalho

1. Ler o requisito e analisar a estrutura atual do projeto.
2. Identificar padrões já existentes no código.
3. Criar ou atualizar `plano.md` com objetivo, contexto, arquivos impactados e critérios de aceite.
4. Implementar as mudanças de forma controlada e rastreável.
5. Revisar o diff completo.
6. Pedir ao Codex revisão do plano e do diff.
7. Avaliar os comentários do Codex e corrigir problemas relevantes.
8. Confirmar que build, lint e testes estão ok.
9. Listar pendências e riscos residuais.
10. Só sugerir commit após validação e autorização explícita do usuário.

## Regras de segurança

### Claude

- Não inventar funcionalidades, rotas, APIs, componentes, tabelas ou regras de negócio.
- Não alterar arquitetura sem explicar o impacto.
- Não remover código existente sem justificar.
- Não alterar `.env`, tokens, secrets, credenciais ou configurações sensíveis sem autorização explícita.
- Não fazer commit sem autorização explícita do usuário.
- Não usar Claude co-work para commitar.
- Não aprovar commit se houver erro de build, lint ou teste.
- Não misturar mudanças não relacionadas na mesma implementação.
- Não ignorar alertas, erros ou inconsistências encontrados durante o desenvolvimento.

### Codex

- Não tomar decisões arquiteturais finais — apenas revisar e recomendar.
- Não aprovar um diff sem checar se ele corresponde ao escopo descrito no `plano.md`.
- Não deixar de sinalizar riscos, mesmo que a tarefa pareça de baixo impacto.
- Não implementar funcionalidade nova por conta própria.
- Não alterar código sem pedido explícito.
- Não fazer commit nem push.
- Limitar alterações próprias a correções pequenas, e apenas quando solicitado.

## Quando pedir revisão ao Codex

- Antes de qualquer commit, para revisar o diff completo.
- Sempre que um `plano.md` novo ou atualizado for criado para uma tarefa relevante.
- Quando houver dúvida sobre impacto em funcionalidade existente.
- Ao final de refatorações estruturais ou mudanças em regras de negócio críticas.
- Quando o escopo da tarefa envolver múltiplos arquivos ou áreas do sistema.

## Quando não fazer commit

- Sem autorização explícita do usuário.
- Se houver erro de build, lint ou teste.
- Se o Codex apontar risco relevante ainda não resolvido.
- Se o diff misturar alterações fora do escopo pedido.
- Se arquivos sensíveis (`.env`, credenciais, configurações de produção) tiverem sido tocados sem pedido explícito.
