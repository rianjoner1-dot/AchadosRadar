# Módulo de Catálogo (`src/modules/catalog/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Este módulo é o coração da vitrine e da navegação de produtos do **Achados Radar**. Ele gerencia:
- O consumo seguro da RPC `search_catalog_v2` do Supabase via chave anônima.
- A ordenação e seleção de carrosséis de destaques com base em descontos observados e disponibilidade de estoque.
- A alternância equilibrada de vitrine entre diferentes lojas (Mercado Livre e Magazine Luiza).
- A paginação estável por cursor determinístico e recuperação após erros de conexão.
- O tratamento robusto e resiliente de imagens externas dos marketplaces.

---

## 2. Estrutura de Arquivos

| Arquivo | Descrição |
| :--- | :--- |
| [client.ts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/client.ts) | Cliente TypeScript para chamadas ao catálogo; invoca `search_catalog_v2` ou ativa modo mock local em `PUBLIC_CATALOG_DEMO`. |
| [spotlights.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/spotlights.mjs) | Algoritmo determinístico para seleção de carrosséis temáticos (até 5 produtos por trilha) priorizando maiores descontos reais. |
| [spotlights.d.mts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/spotlights.d.mts) | Declarações de tipos estritos para as trilhas de destaque. |
| [platform-mix.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/platform-mix.js) | Balanceador de vitrine que intercala produtos de diferentes lojas mantendo a ordem relativa de pontuação. |
| [product-identity.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/product-identity.mjs) | Validador estrito de IDs/SKUs dos marketplaces (ex: prefixos `MLB` e caminhos oficiais Magalu). |
| [image-identity.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/image-identity.mjs) | Previne divergência de imagem, validando se a URL da foto condiz com o SKU e a CDN oficial do marketplace. |
| [image-fallback.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/image-fallback.js) | Manipulador de falha de carregamento de imagens no navegador, exibindo placeholder acessível sem quebrar o layout. |
| [image-health.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/image-health.js) | Telemetria no cliente para reportar imagens com resposta 404 ou 1x1 pixel vazio para rechecagem. |
| [gallery-utils.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/gallery-utils.js) | Navegação por teclado (Setas, Home, End) e sincronização de miniaturas da galeria de fotos. |
| [related-feed.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/related-feed.js) | Paginação infinita do feed de produtos relacionados com desduplicação por UUID. |
| [search-request.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/search-request.js) | Mapeamento dos parâmetros da URL (`q`, `setor`, `loja`, `min`, `max`, `cursor`) para o payload da RPC. |
| [search-utils.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/search-utils.js) | Sanitização de queries, remoção de diacríticos e tolerância a erros leves de digitação. |
| [offer-observation.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/offer-observation.mjs) | Classifica a idade da última observação e oferece rótulos de disponibilidade sem prometer que preço ou estoque continuam válidos. |
| [offer-observation.d.mts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/offer-observation.d.mts) | Tipos públicos dos estados de observação: recente, sem data e que precisa de nova verificação. |
| [share.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/share.js) | Compartilhamento nativo via `navigator.share` com fallback progressivo para WhatsApp e cópia para Clipboard. |
| [types.ts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/types.ts) | Tipos canônicos da vitrine: `CatalogProduct`, `ProductImage`, `Offer`, `AffiliateLink`, etc. |

---

## 3. Contratos e Regras Críticas

1. **Somente Dados Observados**: Não invente campos de parcelamento, frete ou preço. Se uma informação não veio da coleta oficial da loja, seu valor deve ser nulo ou omitido honestamente.
2. **Estabilidade de Cursor**: A paginação via cursor do catálogo usa uma tupla composta `(score, current_price, created_at, id)`. Qualquer alteração de ordenação deve preservar consistência absoluta para não duplicar nem ocultar produtos entre páginas.
3. **Limites de Chamada**: O frontend nunca solicita mais de 20 produtos por página.

---

## 4. Testes Associados

Ao alterar qualquer código neste módulo, execute os seguintes testes:
```bash
node --test tests/spotlight_selection.test.cjs
node --test tests/catalog_search_request.test.cjs
node --test tests/catalog_product_identity.test.cjs
node --test tests/catalog_image_identity.test.cjs
node --test tests/gallery_utils.test.cjs
node --test tests/image_fallback.test.cjs
node --test tests/platform_mix.test.cjs
node --test tests/related_feed.test.cjs
node --test tests/search_utils.test.cjs
node --test tests/offer_observation.test.cjs
node --test tests/share_product.test.cjs
```

Documentação central relacionada:
- [docs/CONTRATO_PRODUTO.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/CONTRATO_PRODUTO.md)
- [docs/BUSCA_E_SETORES.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/BUSCA_E_SETORES.md)
- [docs/IMPLEMENTACAO_BUSCA_CATEGORIA_CARROSSEL.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/IMPLEMENTACAO_BUSCA_CATEGORIA_CARROSSEL.md)

Detalhes adicionais observados: a leitura do produto pode incluir rating, quantidade de avaliações e especificações fornecidos pela loja. Esses campos são opcionais, preservam ausência como desconhecida e só aparecem no detalhe quando retornados pelo schema atualizado. O fallback global de imagens aguarda uma URL antes de agir e preserva `alt=""` em imagens decorativas.
