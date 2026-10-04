# Scripts de Automação, Teste e Operações (`scripts/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Esta pasta reúne ferramentas de automação, pipelines de importação, verificadores de orçamentos e utilitários de diagnóstico do **Achados Radar**.

---

## 2. Mapa dos Scripts por Categoria

### 🤖 Ponte Local e Robô de Coleta
- [local-catalog-bridge.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/local-catalog-bridge.mjs): Servidor HTTP local rodando em `127.0.0.1:6876` que recebe dados da extensão do navegador via POST, valida a origem `chrome-extension://` e realiza upsert atômico no arquivo local `data/catalogo_macro.json`.
- [orchestrate-radar.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/orchestrate-radar.mjs): Orquestrador principal. Inicia o bridge local na porta `6876`, executa o Chromium off-screen em modo `--headless=new` com suporte nativo a extensões MV3 e controle por CDP (`Runtime.evaluate`), disparando o piloto automático (`runAutoPilot()`) para varredura multi-loja (Amazon, Magalu, Shopee, Mercado Livre e KaBuM).
- [open-awin-session.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/open-awin-session.mjs): Abre o Link Builder Awin em uma janela visível do mesmo perfil persistente do robô; se o Chromium do perfil já estiver ativo, cria uma nova janela via CDP e traz para a tela. Não preenche credenciais, não inicia a coleta e não gera links automaticamente. Use `npm run awin:session` para conferir login/cookies e fazer verificações manualmente.
- [open-robot-session.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/open-robot-session.mjs): Abre uma janela visível no desktop usando o perfil persistente do robô (`data/chrome-profile`) com flags anti-detecção (`--disable-blink-features=AutomationControlled`). Permite fazer login na Shopee (`affiliate.shopee.com.br`) e Amazon uma única vez para salvar a sessão permanentemente. Use `npm run session:shopee`.
- [chrome-executable.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/chrome-executable.mjs): Localizador automático do executável do Google Chrome ou Chromium do Playwright no Windows.

### 📦 Importação e Tratamento de Catálogo
- [import-catalog.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/import-catalog.mjs): Motor de importação do catálogo.
  - Modo `--dry-run`: Valida formato, URLs, fotos, estoque e links de afiliado sem fazer chamadas de rede ou escritas.
  - Modo real: Requer `PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env` para gravar no banco via RPC.
  - Normaliza preço Pix e cartão separadamente e transfere rating, quantidade de avaliações e até 18 especificações observadas; a bridge também mantém no máximo um vídeo HTTPS permitido com poster seguro.
- [import-shopee-affiliate-csv.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/import-shopee-affiliate-csv.mjs): Importador e enriquecedor de lotes CSV baixados da aba de ofertas com supercomissão (`affiliate.shopee.com.br/offer/product_offer`).
  - Lê automaticamente o CSV mais recente em `~/Downloads` (padrão `BatchProductLinks*.csv`).
  - Combina o link de afiliado oficial encurtado (`s.shopee.com.br`) e comissão de 20-30% com fotos em alta resolução, especificações e avaliações extraídas.
  - Sincroniza em `data/shopee_imported_batch.json` e realiza upsert atômico direto no `data/catalogo_macro.json`.
- [kabum-page.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/kabum-page.mjs): Extrator estruturado de páginas de produto da KaBuM via payload Next.js (`__NEXT_DATA__`).
  - Enriquece preço Pix (`pixPrice`), cartão (`cardPrice`), parcelamento real (`installments`), avaliações (`rating`, `reviewsCount`), marca e especificações técnicas sem inventar dados fictícios.
  - Suporta normalização de URL canônica e extração de vídeos autorizados.
- [collect-kabum-background.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/collect-kabum-background.mjs): Coletor e validador em segundo plano com pool de concorrência (`concurrency=3`).
  - Suporta redirecionamento 301/302 para slugs canônicos preservando a identidade do SKU.
  - Rastreamento e quarentena de falhas (`retryCount`, `firstFailedAt`) e circuit breaker contra bloqueios/alterações de layout.
- [collect-background.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/collect-background.mjs): Daemon orquestrador de coleta contínua com trava de processo (`collection-background.lock`) e importação atômica em lotes.

### 📊 Orçamento e Validação de Build Vercel
- [verify-functions.cjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/verify-functions.cjs): Audita a contagem de funções serverless em `.vercel/output/functions` (meta: <= 4, teto rígido: 12).
- [verify-payload.cjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/verify-payload.cjs): Audita o tamanho do JSON inicial da vitrine (<= 100 KB) e o orçamento cumulativo de arquivos estáticos (< 5 MiB gzip).

### 🔍 Auditorias de Imagens e Páginas
- [audit-live-product-images.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/audit-live-product-images.mjs): Inspeciona se as imagens dos produtos publicados respondem com HTTP 200 e dimensões naturais válidas.
- [check-images-in-chrome.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/check-images-in-chrome.mjs): Teste em Chrome headless de renderização real de imagens.
- [audit-public-catalog-pages.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/audit-public-catalog-pages.mjs): Rastreia e confere os códigos de status das rotas públicas.

### 🧪 Verificações de Extensão
- [verify-extension-chromium-load.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/verify-extension-chromium-load.mjs): Testa o carregamento seguro da extensão no Chromium do Playwright em ambiente isolado.
- [verify-extension-product-extraction.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/verify-extension-product-extraction.mjs): Valida os seletores de extração de dados da extensão.
- [verify-bridge-default-port.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/verify-bridge-default-port.mjs): Garante que a ponte local escute na porta `6876`.

### 🗄️ Banco de Dados e Migrações
- [verify-remote-schema.sql](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/verify-remote-schema.sql): Script SQL somente leitura que audita a aplicação exata de todas as migrações no Supabase remoto.
- [preflight-catalog-search-v2.sql](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/preflight-catalog-search-v2.sql): Diagnóstico pré-voo da busca v2.
- [dev-demo.ps1](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/dev-demo.ps1): Inicia o Astro em modo mock demonstrativo seguro (`PUBLIC_CATALOG_DEMO=true`).

---

## 3. Comandos Úteis

```bash
# Iniciar a ponte do catálogo local
npm run bridge

# Iniciar o orquestrador do robô
npm run orchestrate

# Abrir a Awin no perfil persistente e em janela visível
npm run awin:session

# Auditar orçamentos de performance
npm run test:budget

# Rodar dry-run do catálogo
node scripts/import-catalog.mjs data/catalogo_macro.json --dry-run --summary
```

### Read-only product page verifier

`verify-extension-product-extraction.mjs` accepts `amazon`, `magalu`, `mercadolivre`, and `shopee` in `--product=platform|ID|HTTPS_URL`. It checks the expected ID, title, positive price, and at least one image in an isolated temporary Chromium profile. It does not save products, access the bridge, write to Supabase, or open affiliate links.

## Coleta em segundo plano — 04/10/2026

O verificador remoto inclui a migration `20261004160000`, que otimiza a RPC de busca sem mudar assinatura ou permissões.

A coleta HTTP da KaBuM usa o feed oficial Awin (merchant 17729, publisher 3105840). Configure AWIN_FEED_LIST_URL no .env; nunca publique a URL assinada.

- npm run collect:once executa download, leitura CSV, validação de até 500 páginas e importação do lote.
- npm run collect:background continua em lotes, com intervalo de 60 segundos e um lock por processo. Não abre navegador.
- node scripts/collect-kabum-background.mjs --limit=500 --concurrency=3 permite executar só o leitor de páginas.
- node scripts/import-catalog.mjs data/catalogo_kabum_verified.json.batch.json --concurrency=4 importa somente as observações do lote.

CSV suporta aspas, quebras de linha e preços brasileiros; filtra anunciante/identidade/links. Dados do feed ficam separados do catálogo da ponte. Estoque, parcelamento e frete ausentes ficam desconhecidos. A página oficial precisa confirmar identidade, preço, fotos e disponibilidade. Checkpoints a cada 25 itens; itens observados nas últimas seis horas são pulados. Falhas de HTTP/layout ficam pendentes e não arquivam produtos. O arquivo .batch.json evita repetir ofertas antigas ao sincronizar.

A ponte grava produtos localmente; isso sozinho não confirma importação no Supabase. A etapa import-catalog precisa concluir e emitir imported/rejected_count. ML/Magalu/Amazon/Shopee continuam no robô existente; não há promessa de dois novos coletores completos para essas lojas. O orquestrador de navegador reutiliza uma ponte/perfil ativos, preserva locks e encerra somente seus próprios processos.

Lotes pendentes de importação são reenviados antes de gerar o lote seguinte e apagados somente após sucesso. A RPC preserva uma única oferta por produto/horário de observação nos retries, sem apagar o histórico existente.

Revisão dos tópicos 3/4: redirecionamentos são validados antes de acessar cada destino (HTTPS, host, SKU, até cinco saltos). O circuito de 60% dispara a partir do resultado 30, aguarda solicitações em andamento e salva os resultados. Falhas não visitadas permanecem no histórico; novas falhas recebem recuo exponencial de 2 minutos até 24 horas. Sucesso limpa a falha. Lotes pendentes são mesclados e gravados antes do checkpoint. Use o orquestrador com lock para evitar escritores concorrentes. Tabelas simples e entidades numéricas são reconhecidas; juros ausentes ficam desconhecidos. HTTP 404 não arquiva automaticamente; YouTube permanece fora do contrato atual de vídeos.
