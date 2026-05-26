# Segurança da Informação — ANAC Data Insight

## Classificação

Esta plataforma é classificada como **uso interno restrito**. Não deve ser exposta à internet sem autenticação corporativa.

## Validação de Arquivos

- Apenas extensões `.csv`, `.xlsx` e `.xls` são aceitas.
- O tamanho máximo por arquivo é configurável (padrão: 50 MB).
- O nome do arquivo é sanitizado antes de ser salvo no disco: caracteres especiais são removidos e um prefixo UUID é adicionado.
- Nenhum arquivo é executado ou interpretado como código. Fórmulas Excel são ignoradas — apenas os valores das células são lidos.
- Arquivos são lidos com Polars em modo somente leitura. Não há execução de macros.

## Dados e IA

- **Nunca envie dados brutos à IA**. Apenas os indicadores calculados (números e metadados) são transmitidos ao provedor de IA.
- O prompt instrui explicitamente o modelo a não inventar informações além dos dados fornecidos.
- A chave de API da OpenAI (`OPENAI_API_KEY`) deve ser configurada apenas em ambiente controlado e nunca deve ser comitada no repositório.

## Logs e Auditoria

- Todos os uploads devem ser registrados no banco de dados com: timestamp, nome original do arquivo, tamanho, usuário (quando implementado).
- O campo `created_by` no modelo `Analysis` deve ser preenchido com o identificador do usuário autenticado.
- Logs de erro devem ser registrados em arquivo separado, sem incluir o conteúdo dos arquivos.

## Armazenamento

- Arquivos enviados são armazenados no diretório `uploads/` (configurável via `UPLOAD_DIR`).
- Arquivos gerados (relatórios, exportações) ficam em `generated/` (configurável via `GENERATED_DIR`).
- Ambos os diretórios devem estar fora do diretório público do servidor web.
- Considere criptografia em repouso para ambientes de produção.

## Autenticação (roadmap)

- O MVP não inclui autenticação. Para produção, integrar com o sistema de identidade corporativo da ANAC (ex.: Active Directory via OAuth2/OIDC).
- Endpoints de upload e análise devem ser protegidos por autenticação antes de qualquer implantação em rede interna.

## Dependências

- Manter todas as dependências atualizadas. Verificar CVEs regularmente.
- Usar `pip audit` e `npm audit` no pipeline de CI/CD.
