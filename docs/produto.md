# Visão de Produto — ANAC Data Insight

## Problema

As equipes operacionais da ANAC gerenciam ciclos de inspeção e atividades regulatórias por meio de planilhas Excel/CSV. O processo atual de análise é manual, sujeito a erros humanos, e não oferece visibilidade rápida sobre pendências críticas.

## Solução

O **ANAC Data Insight** é uma plataforma web institucional de uso interno que permite:

1. **Importar** planilhas CSV ou Excel diretamente pelo navegador.
2. **Detectar automaticamente** o tipo de planilha (ciclos de inspeção, análise genérica, etc.).
3. **Calcular indicadores** operacionais sem configuração manual.
4. **Identificar pendências** de forma estruturada: atividades sem agendamento, sem GIASO, sem PCDP, etc.
5. **Gerar relatórios executivos** com suporte de IA, baseados exclusivamente nos dados importados.

## Público-alvo

- Técnicos e gestores das gerências de inspeção da ANAC.
- Analistas de dados internos.
- Gestores que precisam de visibilidade rápida para tomada de decisão.

## Princípios

- **Dados primeiro**: toda análise é baseada em dados concretos. A IA nunca inventa informações.
- **Simplicidade**: interface limpa, sem curva de aprendizado.
- **Segurança**: uso restrito a ambiente interno; nenhum dado é enviado a terceiros além da IA configurada pelo próprio usuário.
- **Transparência**: cada indicador exibe de onde veio e como foi calculado.

## MVP — Escopo

- Upload de arquivos CSV e XLSX.
- Classificação automática de planilha.
- Análise de ciclos de inspeção com indicadores básicos.
- Interface web responsiva.
- API REST com FastAPI.
- Resumo IA via OpenAI (opcional, desativado por padrão).
