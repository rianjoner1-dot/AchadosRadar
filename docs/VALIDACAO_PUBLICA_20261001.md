# Validacao publica do carrinho e rotas — 01/10/2026

## Resultado

- URL auditada: `https://achadosradar.vercel.app` (deploy publico atual).
- `node scripts/verify-responsive.mjs https://achadosradar.vercel.app`: 12 combinacoes entre seis rotas e duas larguras; zero falhas, rotas ignoradas, overflow ou controles sem nome.
- `node scripts/verify-responsive.mjs https://achadosradar.vercel.app --routes=/ --viewports=390 --smoke-guest-cart`: item de demonstracao salvo uma vez, visivel em `/carrinho`, removido com sucesso e compra permaneceu desativada.
- O smoke usou perfil temporario isolado; os destinos `/api/out/*` e chamadas de metricas/imagens foram bloqueados pelo verificador. Nenhum link de marketplace foi aberto nem evento artificial enviado.
- `npm run validate:local`: Astro check em 96 arquivos, zero diagnosticos; build Vercel concluido; 139/139 testes; 1 funcao; transferencia estatica estimada em 1.349.612 bytes.
- Macro/extensao: `node --test tests/*.test.cjs` passou com 75/75; `python -m unittest discover -s tests -p test_unavailable_reports.py` passou com 5/5.
- Ponte de integracao: `npm run verify:bridge-default` retornou health 200, save 201 e gravou 1 item apenas no catalogo temporario.
- Conta/carrinho: 23/23 testes focados passaram para exclusao segura, erros de sessao/rede, preservacao do carrinho ate a confirmacao e isolamento entre contas.
- Avatar G1.4: uploads usam `cacheControl: '0'` e URL publica versionada para evitar exibir a imagem anterior apos substituicao; testes confirmam HTTPS, preservacao do caminho do objeto e nova versao de cache. Validacao local completa 139/139; troca real de avatar em sessao autenticada continua pendente.
- Importacao E1: revisoes de link (`lastCheckedAt`, `linkVerifiedAt`, `verified_at`) nao sao mais aceitas como horario de coleta de preco/estoque; e IDs da URL oficial e do link Magalu sao comparados com o produto antes de publicar. ID divergente da URL original invalida a linha; link Magazine Voce de outro SKU fica quebrado e nao publicavel. Importador + ponte 10/10; validacao local completa 139/139.

## Limites desta evidencia

- Confirma carrinho visitante e responsividade da producao; nao prova sessao autenticada, sincronizacao de carrinho no Supabase, OTP ou pedido de compra real.
- O link de acesso visto pelo usuario redirecionou para `localhost:3000`. O codigo publicado solicita retorno para a origem atual, portanto as URLs Site URL/Redirect URLs do Supabase precisam ser conferidas pelo Antigravity antes do teste autenticado.
- O teste nao abriu links de afiliado; a compra continua individualmente pelo marketplace e nao ha checkout/pagamento proprio.
- Os testes da macro e da ponte sao automatizados/sinteticos; nao substituem captura de ofertas reais de Magalu e Mercado Livre no Chrome.
- A verificacao local do importador nao altera os 20 produtos remotos; importacao real e ciclo de radar no Chrome continuam pendentes. A politica de cache do avatar tambem nao foi exercitada contra o bucket remoto.
- A checagem de identidade Magalu no link afiliado cobre URLs `magazinevoce.com.br` com SKU no caminho; links curtos sem SKU no caminho continuam dependentes da validacao especifica do marketplace.
