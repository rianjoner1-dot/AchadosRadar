# Suíte de Testes Automatizados (`tests/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo novos testes adicionados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

A suíte de testes do **Achados Radar** é baseada no runner nativo do Node.js (`node:test` e `node:assert/strict`).
- **Execução Ultrarrápida e Confiável**: Testes executados de forma determinística (`--test-concurrency=1`).
- **Banco de Dados Real em Memória**: Utiliza **PGlite** (`@electric-sql/pglite`) para aplicar 100% das migrações SQL locais em tempo de teste, validando RLS, constraints, triggers e RPCs sem depender de um banco remoto ou conexões de rede.
- **Isolamento Completo**: Nenhuma chamada externa é feita durante os testes unitários e de integração.

---

## 2. Mapa dos 45 Arquivos de Teste

| Arquivo de Teste | Área Testada |
| :--- | :--- |
| `database_block_d.test.cjs` | Executa todas as migrações sequencialmente no PGlite, testa RLS para anon e service role, triggers e RPCs. |
| `anonymous_search_migration.test.cjs` | Testa a criação e agregação de pesquisas anônimas no PostgreSQL. |
| `migration_inventory.test.cjs` | Garante que cada arquivo em `supabase/migrations/` esteja presente e auditado no script de verificação remota. |
| `budget_and_contracts.test.cjs` | Testa regras de negócio, limites de funções Vercel e orçamentos de payload. |
| `catalog_import.test.cjs` | Valida o comportamento do importador nos modos dry-run e persistência, checando regras de lojas. |
| `spotlight_selection.test.cjs` | Testa o algoritmo de seleção de carrosséis por categoria e desconto. |
| `catalog_search_request.test.cjs` | Mapeamento de filtros e paginação para o contrato da RPC v2. |
| `catalog_product_identity.test.cjs` | Validação de identificadores de produtos das lojas parceiras. |
| `catalog_image_identity.test.cjs` | Validação de correspondência entre imagem e SKU do produto. |
| `product_card_checkout.test.cjs` | Roteamento seguro do card para detalhe e comportamento fail-closed de checkout. |
| `auth_cart_sync.test.cjs` | Fusão do carrinho anônimo com o carrinho remoto no login. |
| `cart_store.test.cjs` | Operações atômicas de leitura, gravação e remoção do carrinho em `localStorage`. |
| `avatar_processing.test.cjs` | Validação e corte WebP de avatar no cliente. |
| `avatar_upload_contract.test.cjs` | Contrato de upload de foto no Storage sob `userId/avatar.webp`. |
| `account_deletion.test.cjs` | Exclusão de conta LGPD e limpeza do estado local após confirmação. |
| `outbound_allowlist.test.cjs` | Bloqueio de domínios não autorizados na saída de compra. |
| `outbound_freshness.test.cjs` | Rejeição de ofertas com observação antiga ou prazo expirado. |
| `outbound_redirect_policy.test.cjs` | Validação de tokens de saída contra replay e manipulação. |
| `offer_readiness.test.cjs` | Portão de prontidão: verifica estoque, link ativo e status publicado. |
| `redirect_handler.test.cjs` | Resposta HTTP 307 com headers `no-store` e telemetria anônima. |
| `admin_metrics_handler.test.cjs` | Proteção do endpoint `/api/admin/metrics` por papel administrativo. |
| `admin_metrics_loader.test.mjs` | Carregamento frontend com cabeçalhos anti-cache. |
| `admin_dashboard_markup.test.cjs` | Estrutura semântica e acessibilidade da tela de métricas. |
| `privacy_disclosure.test.cjs` | Garantia de transparência legal na página de privacidade e termos. |
| `landmark_structure.test.cjs` | Validação estrutural de landmarks acessíveis (`<main>`, `<nav>`, `<header>`, `<footer>`). |
| `share_product.test.cjs` | Compartilhamento via Web Share API, WhatsApp e área de transferência. |
| `related_feed.test.cjs` | Paginação infinita do feed de produtos recomendados. |
| `search_utils.test.cjs` | Normalização de termos e tolerância a erros tipográficos na busca. |
| `offer_observation.test.cjs` | Rótulos de observação recente, sem data e que precisa de nova verificação; disponibilidade depende de observação recente. |
| `category_images.test.cjs` | Garante mapeamento de assets locais e carregamento imediato das imagens das categorias. |
| `platform_mix.test.cjs` | Alternância balanceada entre lojas nos resultados da vitrine. |
| `gallery_utils.test.cjs` | Navegação por teclado e miniaturas da galeria de fotos. |
| `image_fallback.test.cjs` | Fallback de fotos, guard para imagens sem URL e preservação de `alt=""` decorativo. |
| `image_failure_cooldown.test.cjs` | Cooldown para evitar envio excessivo de reports de fotos quebradas. |
| `check_images_in_chrome.test.cjs` | Auditoria de imagens em navegador real. |
| `local_catalog_bridge.test.cjs` | Segurança do servidor HTTP de ponte local na porta 6876. |
| `observed_product_details_migration.test.cjs` | Campos observados de avaliação e especificações com limites e validação. |

---

## 3. Como Executar os Testes

```bash
# Executa todos os 189 testes da suíte
npm test

# Executa um arquivo de teste isolado
node --test tests/spotlight_selection.test.cjs
```

## Regressões da coleta

Os testes também cobrem bloqueio de redirecionamentos antes do acesso, normalização de slug, encerramento da fila com pedidos em andamento, parada após 30 resultados, tabelas e entidades HTML, avaliações ausentes e parcelamento inválido/juros desconhecidos.

collection-regressions.test.cjs cobre CSV com linhas internas, fila concorrente limitada e falhas isoladas, cursor de páginas filtradas, identidade da página KaBuM e segurança dos deep links. observed_product_details_migration.test.cjs também aplica as migrations de plataformas e união de PC Gamer em Eletrônicos. O teste do robô refresh_failure_sync cobre retenção/reenvio da fila durante uma falha da ponte.
