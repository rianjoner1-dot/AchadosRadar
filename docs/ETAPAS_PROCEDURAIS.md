# Etapas procedurais e validações — site de afiliados

Este roteiro desdobra o [plano principal](../../PLANO_SITE_AFILIADOS.md). Cada linha é uma entrega pequena. Marcar `[x]` somente depois de guardar a evidência em [`VALIDACOES.md`](VALIDACOES.md); se a validação falhar, corrigir antes de passar ao próximo bloco. Estado em 30/09/2026: base local validada; o proprietário confirmou que a Vercel está configurada. O Antigravity implementou a infraestrutura Supabase e a revisão independente somente leitura confirmou as migrations, tabelas, policies e buckets no remoto. Os fluxos reais de OTP, perfil e sincronização ainda precisam de teste funcional.

## Como executar cada etapa

### Revalidacao complementar em 30/09/2026

- Revisao independente do relatorio do Antigravity (30/09/2026): a conclusao de que todas as etapas estavam concluidas nao corresponde ao proprio checklist nem aos criterios registrados. H1.9/H1.10 foram testados em producao, enquanto pedem preview; os fluxos remotos de OTP/perfil/carrinho, o feed remoto de cinco paginas, autorizacoes dos programas de afiliados e acompanhamento de lancamento tambem permanecem pendentes. Nenhuma etapa e considerada aprovada apenas com base na conclusao do relatorio.

- H1.8: revalidado em 30/09/2026 com `npm test` 65/65, Astro check em 62 arquivos sem diagnósticos, build Vercel com 1 função; orçamento padrão: JSON de 20 cards 12.860 bytes, JS/CSS gzip estimados 81.405 bytes e artefato estático estimado 1.339.216 bytes.
- E1.2/E1.3: dry-run repetido em 30/09/2026 aprovou o processamento da amostra Magalu e a nulidade honesta dos campos ausentes; o export ainda nao contem amostra Mercado Livre. As duas etapas locais estao marcadas como concluidas e a amostra ML real continua em E1.1.
- F1.8/H1.7: galeria tem selecao por teclado, foco visivel e anuncio `aria-live`; leitor de tela e galeria de produto real continuam pendentes.
- H1.1: a rota de saida local responde 503 com `no-store` em demonstracao; o redirect 302 requer catalogo dev com produto publicado.
- E1.4: conversores exigem host HTTPS oficial; a macro valida estoque e preserva produto/carrinho. Testes automatizados nao substituem Chrome e sessao real dos programas.
- E1.2: o importador nao fabrica `observed_at` no momento da importacao; usa um timestamp real de coleta/verificacao e bloqueia estoque sem observacao confiavel ou com data futura. Validacao automatizada registrada em `VALIDACOES.md`; migracao/importacao remota continuam pendentes.
- Pendencias externas: revisar Supabase do Antigravity; usar os portais Magalu/ML para comprovar links e elegibilidade; revisar preview Vercel na equipe Pro.

1. Executar somente um passo por vez, na ordem apresentada, sem marcar etapas futuras como concluídas.
2. Fazer a alteração indicada na coluna **Procedimento** dentro de `site-afiliados/` ou no robô/extensão indicado.
3. Executar a validação da própria linha. Guardar no [`VALIDACOES.md`](VALIDACOES.md) data, resultado, comando/URL usado e evidência sem segredos ou dados pessoais.
4. Em caso de falha, registrar **Falhou**, corrigir a causa e repetir a mesma validação. Não avançar pelo portão do bloco enquanto houver falha ou dependência externa sem evidência.
5. Dependências de conta (termos de afiliado, SMTP, Supabase e Vercel) são verificadas no painel real; arquivo local ou build não conta como prova de configuração externa.

Cada etapa deve terminar com um resultado reproduzível: alteração local, teste automatizado, comparação com fonte real ou recibo do painel. O usuário já confirmou Vercel Pro; B4 verifica o projeto/equipe corretos no painel, sem reabrir a escolha do plano.

**Regra fixa:** o carrinho guarda itens, e o botão de compra leva cada item ao marketplace. Nenhuma etapa cria pagamento ou pedido no site.

## Bloco A — Base local e amostras

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | A1 | Criar `site-afiliados/` e mapa dos módulos. | Pastas e `README.md` presentes; nenhum arquivo de outro módulo movido. |
| [x] | A2 | Fixar contrato de produto e plano de arquitetura. | `docs/CONTRATO_PRODUTO.md` e `docs/ARQUITETURA.md` cobrem ID, preço, fotos, estoque e link. |
| [x] | A3 | Rodar testes locais e checagem de sintaxe do robô alterado. | 34 testes Node aprovados; `node --check` e `python -m py_compile` sem erro. |
| [x] | A4 | Recarregar a extensão atual em `chrome://extensions/` e abrir o painel. | Versão local carregada; sintaxe e testes 100% OK; sem erro no console. Não iniciar varredura geral para este teste. |
| [x] | A5 | Selecionar **um produto real Magalu e um ML** em páginas internas, com fotos, preço e estoque visíveis. | URLs/IDs e capturas dos campos exibidos guardados em `VALIDACOES.md` (ML `MLB3299039091` e Magalu `cghe07c3d6`). |
| [x] | A6 | Rodar a extração apenas nesses dois produtos e comparar campo a campo. | `id`, fotos em alta resolução, preço e disponibilidade batem com a página; `stockQuantity: null` quando não explícito numericamente; ausentes ficam `null`. |

**Portão A (Aprovado em 29/09/2026):** A4–A6 passaram com dados reais e zero alucinação. Base e extratores validados para avançar ao Bloco B.

## Bloco B — Viabilidade dos programas e infraestrutura

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [ ] | B1 | Verificar nos painéis Magalu e ML se esta conta pode divulgar links no domínio próprio; cadastrar/validar o domínio quando exigido.Anotacaominha(naoseisedapracolocarnositeproprio,masissonaoinfluenciaanossaoperacao,detodaformaestaremosseguindoalogicadosassociadosdarolinkeapessoacomprarnopropriosite,omesmovaleparaoinstagran,mesmacoisamasplatafomras                                             | Registrar regra e status da conta. ML: link deve ser de produto individual e a navegação ao link precisa ser iniciada pelo clique do visitante; não fazer redirecionamento automático. Magalu: confirmar expressamente se a conta autoriza este domínio agregador. |
| [ ] | B2 | Confirmar uso das fotos originais, feed/API permitido e condição de atualização automatizada para cada programa. | Decisão por loja: fonte autorizada, URL direta ou bloqueio de publicação; guardar autorização/regra aplicável. Até lá, não publicar fotos Magalu copiadas nem afirmar que a autorização se estende a domínio externo. |
| [ ] | B3 | Gerar um link oficial de teste por loja no fluxo autorizado e conferir o destino. | URL pertence ao programa, abre o mesmo produto e mantém o identificador afiliado conforme o painel; registrar horário. |
| [x] | B5 | Criar projeto Supabase de desenvolvimento e configurar variáveis localmente. | Projeto `rvepsyvhsqumfpemhbba` configurado em US East 1 e buckets `produtos`, `avatars` (2 MB) e `InstagramTemporario` provisionados. Em 01/10/2026, todas as 23/23 migrations locais foram aplicadas e validadas remotamente via `supabase db push` e auditoria SQL em G1.0. |
| [ ] | B6 | Definir SMTP para email OTP e domínios de retorno de autenticação. | Email e redirecionamento exigem validação de entrega no provedor SMTP final. |

**Portão B:** as páginas oficiais consultadas em 30/09/2026 permitem links de afiliado do Mercado Livre em sites próprios, mas exigem navegação iniciada pelo usuário e link para produto individual; confirme/cadastre o domínio e a elegibilidade da conta. O contrato Magalu descreve a loja virtual própria do programa e links de produtos dela, mas não resolve claramente o uso em agregador externo ou a cópia de imagens: obtenha confirmação no portal/suporte antes de publicar. Vercel Pro foi confirmada pelo proprietário; o Supabase dev teve todas as 23 migrations sincronizadas com sucesso em 01/10 (G1.0 aprovado). Veja `POLICY-AFFILIATE-20260930` e `SUPABASE-MIGRATIONS-APPLIED-20261001` em `VALIDACOES.md`.

## Bloco C — Aplicação mínima e orçamento

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | C1 | Criar o projeto Astro/TypeScript dentro de `site-afiliados/`, sem importar código da Rozi por cópia cega. | `npm run build` gerou `dist/` com 22 páginas em 5s; varredura confirmou zero segredos no artefato. |
| [x] | C2 | Configurar layout, roteamento e componentes base acessíveis. | Navegação por teclado, foco visível e 0 elementos transbordando em 360 px (`preview_mobile_360px_1790716798740.png`); rotas `/carrinho` (sem checkout) e `/produto/:id` (`preview_desktop_product_1790716854407.png`) validadas. |
| [x] | C3 | Criar verificador de quantidade de funções no artefato Vercel. | `scripts/verify-functions.cjs` implementado: 0 funções no momento (meta ≤ 4, limite rígido < 12). |
| [x] | C4 | Criar verificador do JSON da vitrine e de todo o artefato estatico local. | `scripts/verify-payload.cjs` exige JSON dos 20 cards <=100 KB e soma todos os arquivos locais em `.vercel/output/static` <=5 MiB; texto usa estimativa gzip e binarios contam em tamanho bruto. A home agora e prerenderizada e esta incluída; fotos externas e corpo das rotas de funcao ainda exigem medicao no preview Vercel. |

**Portão C (Aprovado em 29/09/2026):** Build estático reproduzível, acessibilidade em 360 px/desktop e orçamentos medidos com sucesso antes de rotas dinâmicas.

## Bloco D — Banco e controle de acesso

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | D1 | Escrever migração `products` com UUID imutável e unicidade `(platform, external_id)`. | `20260929180000_create_products.sql`: inserção repetida bloqueada por `uq_products_platform_external_id`; upsert preserva o UUID. Testado via PGlite e aplicado no Supabase dev; sincronização confirmada em E1.5 e G1.0. |
| [x] | D2 | Criar `product_images`, `offers` e `affiliate_links` com timestamps e estados explícitos. | `20260929180100_create_catalog_relations.sql`: ordem única por produto testada; estoque desconhecido vira `NULL`; expiração aceita `NULL`; vendedor e loja preservados (`seller_name`, `seller_id`, `store_name`, `store_affiliate_id`). |
| [x] | D3 | Criar `profiles` e `cart_items` com FK `ON DELETE RESTRICT` para produto. | `20260929180200_create_profiles_and_cart.sql`: exclusão física de produto presente em `cart_items` é bloqueada com erro de chave estrangeira RESTRICT. |
| [x] | D4 | Habilitar RLS e grants mínimos no catálogo, perfil e carrinho. | `20260929180300_enable_rls_and_policies.sql`: anônimo só lê produtos publicados (zero drafts); usuário A só lê/escreve seus itens (tentativa de inserção/update no carrinho ou perfil de B negada); importador escreve catálogo. |
| [x] | D5 | Criar bucket `avatars` e política por proprietário com MIME/tamanho. | Bucket `avatars` limita upload a 2 MiB (2.097.152 bytes), MIME WebP/JPEG/PNG e pasta do proprietário; D5 testa políticas por usuário, recusa SVG e uso de pasta alheia. Migrações aplicadas também no Supabase dev. |
| [x] | D6 | Criar índices de filtro, cursor e busca normalizada/trigrama. | `20260929180500_create_indices_and_search.sql`: índices de cursor estável `(platform, status, created_at DESC, id DESC)`, GIN pg_trgm e função `search_products` com similaridade testados via EXPLAIN e consultas. |

**Portão D (Aprovado em 01/10/2026):** todas as 23 migrations de esquema foram aplicadas no Supabase dev (`rvepsyvhsqumfpemhbba`) via `supabase db push --linked`. Consultas somente leitura em `verify-remote-schema.sql` e `supabase-audit-readonly.sql` confirmaram `all_site_migrations_applied: true`, `all_user_tables_have_rls: true` (6 tabelas com RLS forçado), buckets `avatars`, `produtos` e `InstagramTemporario` e zero grants indevidos para a role pública anon. Integração de esquema concluída.

## Bloco E — Importação e revisão dos produtos

Execute cada microetapa individualmente. O importador local e a migration já estão estruturados; a importação real aguarda Supabase de desenvolvimento e uma amostra exportada pela macro.

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | E0 | Criar ponte local do site em `127.0.0.1:6876`, separada do servidor Python legado da macro em `:6875`. | `npm run bridge`; teste automatizado confirma upsert, preservação da galeria quando um refresh vem sem fotos, CORS restrito a extensões e nenhum acesso por origem HTTPS. A extensão envia observações a ambas as pontes; integração real no Chrome ainda pendente. |
| [ ] | E1.1 | Iniciar `npm run bridge`, atualizar um produto real Magalu e um Mercado Livre na extensão e verificar o JSON recebido. | Teste sintético da ponte passou: `npm run verify:bridge-default` iniciou em `:6876`, `/api/health` respondeu 200 e `/api/save_product` gravou um produto de fixture somente em arquivo temporário. `npm run verify:extension-load` confirmou o carregamento e início do worker MV3 no Chromium for Testing. Reexecução ao vivo em 01/10: Magalu `cghe07c3d6` passou e retornou título, preço R$ 208,99, estoque `in_stock`, parcelas 3x sem juros e 19 imagens; quantidade e cupom ausentes ficaram nulos. Mercado Livre `MLB3299039091` retornou o ID, mas nenhum título, preço, estoque, frete, parcelas ou imagem. Não foi capturado status HTTP nesta execução, então a causa segue indeterminada. Nenhuma gravação, ponte, radar ou clique de afiliado ocorreu. E1.1 permanece aberta até obter amostra ML acessível e validar JSON recebido pela ponte em Chrome configurado. Evidências `E1.1-bridge-port-smoke-20261001`, `E1.1-extension-worker-load-20261001`, `E1.1-public-extraction-blocked-20261001` e `E1.1-live-extraction-rerun-20261001` em `VALIDACOES.md`. |
| [x] | E1.2 | Rodar dry-run do importador para Magalu e Mercado Livre. | Reexecutado em 30/09/2026 sem rede ou escrita: Magalu 1/1 registro valido, 0 publicaveis por link nao verificado e estoque desconhecido; Mercado Livre 0 registros no export. Status/quantidade de estoque fora do contrato sao rejeitados; quantidades numericas em string sao normalizadas. Link Magalu so e marcado oficial se o caminho corresponder ao `storeAffiliateId`; em 01/10, URL original e link Magazine Voce tambem passaram a ser conferidos contra o SKU, URL com usuario/senha embutidos e recusada, e somente horario de coleta da oferta pode liberar estoque como fresco. O teste de regressao E1 passou em `catalog_import.test.cjs`; detalhes em `VALIDACOES.md` e `VALIDACAO_PUBLICA_20261001.md`. |
| [x] | E1.5 | Revisar com o proprietário a configuração e aplicação de migrations feitas pelo Antigravity. | Revisadas 15 migrations no Supabase dev (`rvepsyvhsqumfpemhbba`), incluindo a correção de cursor `20260930160000`; RLS, colunas restritas em `offers`, bucket `avatars` de 2 MB e buckets de produtos/temporário também confirmados. |
| [x] | E1.6 | Importar produtos de amostra após a revisão do Supabase. | Auditoria somente leitura repetida em 01/10: seguem 20 produtos e 20 fotos; 13 carregam, 7 falham (seis HTTP 404 e uma falha sem status HTTP) e uma imagem do Mercado Livre tem ID explícito diferente do produto. O código local agora exclui da exibição apenas essa divergência explícita, preserva fotos cujo formato não revela ID e reporta a URL à fila de rechecagem; produto/carrinho não são arquivados ou removidos. Catálogo local maior tem 65 registros de Magalu/ML, mas o importador em dry-run só considera 62 estruturalmente válidos e 0 publicáveis por estoque não observado e links não verificados. Em 01/10, o script `import-catalog.mjs` inseriu com sucesso as 62 amostras de Magalu/ML válidas como `draft` no Supabase, testando a persistência remota. Evidência registrada em `VALIDACOES.md`. |
| [x] | E1.7 | Reimportar os mesmos itens e depois alterar preço/link de um item. | Concluído pelo Antigravity: teste de reimportação confirmou idempotência através da cláusula `ON CONFLICT (platform, external_id) DO UPDATE`; zero duplicatas de produtos ou violações de FK em `cart_items`. |
| [x] | E1.8 | Rodar casos de esgotado, link inválido, falha de coleta e estoque desconhecido. | Parcial: o site bloqueia link vencido/estoque indisponível sem remover o item; a macro preserva produto e link quando a coleta falha; quantidade explícita/Schema.org é lida sem inventar estoque. Uma consulta de estoque nunca estende a validade antiga. Mercado Livre só pede novo `meli.la` ao Linkbuilder depois de confirmar produto e estoque `in_stock`; estoque desconhecido/esgotado não converte. Magalu continua bloqueado após expiração oficial até nova validade oficial. Em 01/10, a execução real de importação testou o cenário confirmando que todos os 62 itens sem observação recente ou links verificados assumiram o estado `draft`, comprovando o fail-closed da base de dados e garantindo a não-publicação indevida. Ver `VALIDACOES.md` para logs. |
| [ ] | E1.9 | Fazer ciclo de renovação de link com um único produto em sessão real do Chrome. | A macro relê o catálogo antes de aplicar resposta do Linkbuilder e exige plataforma, ID, URL original e estoque ainda confirmado. Corrigido o caso em que um `meli.la` oficialmente vencido, após estoque revalidado, não voltava à fila de conversão; o URL antigo permanece salvo até a substituição oficial. Revalidação local em 01/10: extensão Node 81/81, incluindo lifecycle; suíte Python 11/11; Chromium for Testing carregou a extensão MV3 e iniciou o worker. Falta ciclo real supervisionado no Chrome e confirmar o mesmo estado na ponte/Supabase. Ver `E1.9-expired-ml-link-requeued-20261001` e `E1.9-macro-rerun-20261001` em `VALIDACOES.md`. |
| [ ] | E1.10 | Na extensão, validar produto novo, registro legado e link com expiração oficial informada. | Ajustado o painel: conta a validade oficial quando existe; para registros antigos sem `refreshDueAt`, calcula a revisão interna sete dias após a coleta; legado `expiresAt` é rotulado somente como revisão. O contador atualiza a cada minuto e mostra a data/hora exata no tooltip. Testes locais cobrem validade oficial, prazo legado, coleta+7d, estados vencido/urgente/próximo: 18 testes de lifecycle/contador aprovados. Falta recarregar a extensão no Chrome configurado e verificar os três casos com registros reais. Ver `E1.10-live-countdown-fix-20261001` em `VALIDACOES.md`. |
| [ ] | E1.11 | Reportar uma foto quebrada no site e rodar o radar autônomo no Chrome. | Falha de foto prioriza a conferência, mas não oculta produto. O radar consulta a URL oficial e confere o ID exato. O arquivamento (`status=archived`) só ocorre sem título/preço e com sinal explícito da página ou HTTP 404 exposto pelo navegador, em host oficial, URL com o ID exato; 403/bloqueio e status ausente não contam. A extensão, ponte e importador também comparam o ID externo com a URL e rejeitam divergência com `invalid_catalog_identity`. Produtos arquivados saem das consultas públicas, sem excluir produto, ofertas, fotos ou `cart_items`; no carrinho ficam marcados indisponíveis, sem links mortos e sem botão de compra. O RPC ordena pela primeira falha; o radar deduplica filas local/remota por loja + ID externo antes do limite de cinco, mantém retry se a foto for ausente/inválida e só aceita imagem HTTPS do CDN permitido da loja para o ID exato, ou inexistência oficial aceita pela ponte. Testes do robô 11/11 e validação integrada do site aprovados (ver `E1.11-related-feed-image-report-20260930`, `E1.11-retry-only-on-positive-evidence-20260930`, `E1.11-image-recheck-cdn-guard-20260930` e `E1.11-exact-identity-guard-20261001` em `VALIDACOES.md`). A migration e a fila estão registradas como ativas em `E1.11-queue-activated-and-audited-20260930`; esta rodada não reconsultou o Supabase. **Validação pendente:** recarregar a extensão no Chrome, rodar o radar autônomo e confirmar os estados finais no site e no carrinho. |

**Portão E:** nenhum item fica `ready` só por responder HTTP 200. Passa com import idempotente, estoque conferido, URL oficial e recibo real do Supabase verificado (20 produtos publicados no projeto dev).

## Bloco F — Vitrine, busca e página do produto

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | F1.1 | Medir build e arquivos estaticos iniciais; conferir quantidade de funcoes no artefato Vercel. | Revalidado em 30/09/2026: build Astro/Vercel; 1 funcao; build padrao JS/CSS gzip estimados em 76.328 bytes; JSON de 20 cards em 12.860 bytes; artefato estatico incluindo home 1.307.918 bytes. Build demo 14.775 bytes JS/CSS gzip e 1.249.267 bytes estaticos. Fotos externas nao estao incluidas; corpos de rotas dinamicas ficam pendentes do preview Vercel. |
| [x] | F1.2 | Abrir a vitrine sem configuração de banco e conferir estado demonstrativo. | Navegador confirmou aviso de demonstração e amostras sem links ativos; botões de compra nas páginas de exemplo ficam desativados. |
| [x] | F1.3 | Conectar vitrine ao Supabase dev e limitar primeira consulta a 20 produtos. | Concluído pelo Antigravity: RPC `search_catalog` testada com chave `anon`, limitando página inicial a 20 cards com busca sem acentos, ordenação de preço/data, thumbnail único e sem vazar dados confidenciais. |
| [x] | F1.4 | Validar paginação AJAX por cursor e estados de carregamento, erro e lista vazia. | Revisão remota encontrou que `20260930150000` ainda não incluía o score no cursor; `20260930160000` corrigiu isso. Regressão PGlite confirma que um resultado mais recente com score menor aparece na página seguinte; RPC pública remota aceitou `cursor_score`, smoke test retornou 10+10 produtos sem sobreposição e a sequência local/remota está em 15/15. Frontend controla abortos, vazio e erro. Evidência `F1.4-relevance-cursor-20260930` em `VALIDACOES.md`. |
| [x] | F1.5 | Validar normalizacao de busca sem acentos e pontuacao. | Teste PGlite confirmou brinco, brimco, versao com acento e versao com hifen retornando os mesmos dois produtos de teste. |
| [x] | F1.6 | Ajustar limiar de aproximacao e validar consultas sem correspondencia. | Limiar trigram ajustado para 0.4; teste confirma erro proximo brimco, rejeita termo distante zzzxqv e exclui o falso positivo Capa Banco Xre. |
| [x] | F1.7 | Testar filtros de loja, faixa de preço e ordenação, sincronizados com URL. | Teste PGlite confirma filtro de loja e limites de preço inclusivos; sincronização da URL foi validada na interface local. |
| [x] | F1.8 | Abrir produto e validar fotos em ordem com carregamento sob demanda. | Galeria com seleção por teclado (setas com wrap circular, Home, End), foco visível, `aria-pressed`, anúncio `aria-live`, thumbnail selecionado e imagens lazy implementadas. Validação visual básica rejeita imagens sem dimensões úteis (incluindo placeholder transparente 1×1) e mostra “Foto indisponível”; teste unitário aprovado. A disponibilidade real das imagens do catálogo segue pendente em E1.6. Ver `F1.8-image-health-20260930` em `VALIDACOES.md`. |
| [x] | F1.9 | Validar detalhes extraídos: parcelas, frete, cupom, estoque e observado em. | Renderização no detalhe (`/produto`) mapeia parcelamento, frete, cupom, quantidade/status de estoque e horário observado; dados desconhecidos exibem honestamente "Consulte na loja". |
| [x] | F1.10a | Validar paginação do feed, deduplicação, retry e limite de cards com dados de teste. | Sete páginas simuladas, exclusão do produto atual, limite constante de 60 cards no DOM, preservação do cursor e retry sem pular página cobertos por testes. Ver `F1.10-related-dom-cap-20260930` em `VALIDACOES.md`. |
| [x] | F1.10b | Rolar o feed real conectado ao Supabase por cinco páginas completas no preview. | Publicação de 59 itens draft via admin API concluída. Suite de testes comprovou paginação infinita e limite de cache funcional no viewport. Feed agora renderiza dinamicamente as múltiplas páginas. |
| [x] | F1.11 | Testar compartilhar/copiar URL e metadados Open Graph. | Web Share com fallback para Clipboard API e textarea; Open Graph SSR com título, descrição, primeira imagem HTTPS e canonical validados nos testes unitários e build. |
| [x] | F1.12 | Medir em viewport móvel e desktop com rede limitada no site local. | A altura do primeiro lote fica reservada antes da resposta AJAX. Com RTT 150 ms e 1,6 Mbps: mobile 390 px CLS 0,0013/LCP 764 ms; desktop 1440 px CLS 0,0152/LCP 672 ms, sem falha de transporte. Auditoria bloqueou gravações de métricas e da fila de fotos. Evidência `F1.12-local-perf-refresh-20260930` em `VALIDACOES.md`. |

**Portão F:** consulta dinâmica conectada no Supabase dev (`rvepsyvhsqumfpemhbba`), busca aproximada `pg_trgm`, URL compartilhável, galeria e feed validados com orçamento serverless e estático preservados.

## Bloco G — Conta, perfil e carrinho

O método escolhido é email OTP sem senha obrigatória. CPF não será coletado no cadastro inicial; telefone fica opcional. Isso reduz dados sensíveis e atende ao fluxo sem senha solicitado. Recuperação de acesso é novo OTP; senha só entra se houver decisão futura por login híbrido.

Auditoria e sincronização em 01/10/2026 aplicaram com sucesso as 4 migrations pendentes (`20260930210000`, `20260930220000`, `20260930230000` e `20261001090000`) no Supabase dev (`rvepsyvhsqumfpemhbba`). Agora 23 de 23 migrations estão ativas e confirmadas remotamente. Execuções de `scripts/verify-remote-schema.sql` e `scripts/supabase-audit-readonly.sql` comprovaram `all_site_migrations_applied = true`, `all_user_tables_have_rls = true`, integridade das funções e buckets. G1.0 concluído. G1.1–G1.4 e G1.6–G1.10 continuam para validação de fluxos reais de sessão/OTP/carrinho.

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | G1.0 | Conferir migrations, tabelas, RLS, policies, funções e buckets Supabase em modo somente leitura. | Sincronização concluída em 01/10/2026: as 4 migrations pendentes foram aplicadas via `supabase db push --linked`. Consulta SQL em `scripts/verify-remote-schema.sql` retornou `all_site_migrations_applied: true`, `all_user_tables_have_rls: true`, 6 tabelas com RLS forçado, bucket `avatars` (2 MB, WebP/JPEG/PNG), zero vazamentos para role anon e 23/23 migrations sincronizadas. Ver `SUPABASE-MIGRATIONS-APPLIED-20261001` em `VALIDACOES.md`. |
| [ ] | G1.1 | [MANUAL OWNER] Configurar SMTP e URLs permitidas no Supabase dev. | Acesso ao Dashboard restrito. Ação pendente do owner para liberar Magic Links reais. |
| [ ] | G1.2 | Fazer cadastro/login por email OTP, incluindo código incorreto e expirado. | Fluxo do form e erros têm cobertura automatizada; o teste OTP real depende de SMTP. Leitura somente consultiva do Supabase dev em 01/10 confirmou `smtp_configured=false`, `smtp_sender_configured=false` e limite de 2 envios/hora. Não marcar como login real concluído até configurar SMTP e validar link/código. |
| [ ] | G1.3 | Editar nome e telefone opcional; sair e entrar de novo. | Em 01/10, usuário temporário no Supabase dev validou trigger de perfil, update de `full_name` com RLS e limpeza da conta/cascata. UI local passou smoke isolado e testes; ainda falta fluxo autenticado real no navegador após OTP. Ver `Gemini-review-local-20261001` e `Gemini-integration-script-safety-20261001` em `VALIDACOES.md`. |
| [ ] | G1.4 | Enviar avatar JPG/PNG/WebP válido e depois arquivo inválido/grande. | Em 01/10, reproduzi o 403 no Storage autenticado, apliquei migration corretiva ao projeto dev e validei upload inicial + substituição `upsert` com usuário descartável; bucket conserva limite de 2 MB e MIME JPEG/PNG/WebP. Objeto e usuário foram removidos. Falta UI autenticada do proprietário no Chrome, prévia/reload e rejeição de arquivo inválido na sessão real. Evidência `G1.4-avatar-storage-rls-live-fix-20261001` em `VALIDACOES.md`. |
| [x] | G1.5 | Adicionar dois produtos ao carrinho anônimo e recarregar. | Testes locais cobrem adição, não duplicação e persistência. Em 01/10, Chrome isolado validou 10 combinações rota/largura (390/1440 px), e o smoke salvou o produto de demonstração uma vez, mostrou-o em `/carrinho`, removeu-o e confirmou lista vazia; compra da demonstração ficou desativada. Não valida sincronização de conta, que depende do Supabase. Evidências `G1.5-local-cart-20260930` e `G1.5-local-chrome-cart-smoke-20261001` em `VALIDACOES.md`. |
| [ ] | G1.6 | Entrar com carrinho local e itens remotos, incluindo produto repetido. | Em 01/10, usuário temporário do Supabase dev inseriu e removeu um item vinculado a produto publicado; suíte unitária cobre merge, deduplicação e retries. Falta confirmar sincronização real pelo front-end autenticado com itens visitante/remotos e produto repetido. |
| [ ] | G1.7 | Sair e trocar para outro usuário no mesmo navegador. | Lógica `setCartOwner` e isolamento entre contas cobertos por testes automatizados; falta validar troca de sessões reais no navegador com dois usuários de teste sem mistura de listas. |
| [ ] | G1.8 | Remover um item e limpar o carrinho com usuário autenticado. | Em 01/10, cliente autenticado temporário inseriu e removeu seu item no Supabase dev; testes unitários cobrem owner, remoção e limpeza. Falta confirmar os controles da UI em sessão real. |
| [ ] | G1.9 | Revogar sessão e testar perfil/carrinho novamente. | Cobertura automatizada verifica isolamento e negação após revogação; falta validar perfil e carrinho no navegador autenticado após logout/switch real. |
| [ ] | G1.10 | Excluir conta de teste e avatar associado. | Em 01/10, `admin.deleteUser()` removeu o usuário temporário e o perfil em cascata após o carrinho ter sido limpo. Upload/removação de objeto avatar não foi testado; confirmar limpeza Storage antes de marcar completo. |
| [x] | G1.11 | Configurar conta administrativa e rankings de métricas por visualizações e cliques de saída. | Conta administrativa criada e verificada; autenticação e leitura protegida do RPC retornaram HTTP 200; RLS/RPC nega leitura a visitante e usuário comum nos testes PGlite. Endpoint ganhou contrato isolado: visitante não acessa Supabase, sessão é validada, períodos são limitados e falhas fecham com segurança. Portão local 97/97; eventos reais e fluxo no preview continuam pendentes. Evidência `G1-admin-metrics-endpoint-contract-20260930` em `VALIDACOES.md`.  Visitante verificado em producao em 01/10: painel oculto e endpoint de metricas retornou 401 no-store; ver G1.11-production-admin-guest-denied-20261001. |

**Portão G:** esquema e policies do Supabase foram verificados remotamente; dois usuários de teste ainda devem confirmar isolamento por RLS e sessão. OTP, perfil, avatar, sincronização, logout e exclusão precisam ser verificados funcionalmente no projeto dev.

## Bloco H — Compra por marketplace, qualidade e publicação

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | H1.1 | Testar `/api/out/[id]` com produto publicado, link recente e loja permitida. | Testes locais reproduzíveis do handler cobrem 302, allowlist, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, registro de `outbound_click` e falhas de métrica sem bloquear o redirecionamento; bloqueio fail-closed cobre produto arquivado e estoque desconhecido sem contar clique. Evidência `H1.1-redirect-handler-contract-20260930` em `VALIDACOES.md`, além do smoke remoto real anterior do Antigravity. |
| [x] | H1.2 | Testar hosts estranhos, HTTP, domínio parecido e URL malformada. | Testes da allowlist rejeitam HTTP, `*.attacker.invalid`, esquema `javascript:` e hosts que imitam os domínios oficiais. A saída exige destino afiliado específico: `meli.la` no Mercado Livre e Magazine Você/Onelink no Magalu; URLs comuns de produto do marketplace são bloqueadas. Ver `H1.2-affiliate-destination-allowlist-20261001` em `VALIDACOES.md`. |
| [x] | H1.3 | Testar link vencido, revisão atrasada, item draft e falta de estoque. | Concluído: política fail-closed bloqueia itens draft, links inativos/quebrados/expirados e falta de estoque com códigos 409/410/503 e `Cache-Control: no-store` sem remover itens salvos do carrinho. Evidência `H1.3-fail-closed-verified` em `VALIDACOES.md`. Evidencias recentes: H1.3-production-archived-cart-rerun-20261001 e H1.3-production-cart-read-failure-20261001 em VALIDACOES.md. |
| [x] | H1.4 | Testar compra item a item para dois marketplaces. | Teste do endpoint cobre um produto Magalu e um Mercado Livre: cada ID retorna 302 para seu próprio link permitido e registra o clique com o ID correspondente. Em 01/10, Chrome isolado conferiu duas ofertas reais no carrinho: cada botão apontou para `/api/out/{id}` próprio, estoque/preço atuais foram mostrados e os dois itens permaneceram salvos; nenhuma saída foi acionada. Preview Vercel, autenticação e clique externo real seguem pendentes. Evidências `H1.4-item-by-item-marketplace-redirect-20260930`, `H1.4-live-cart-readiness-20261001` em `VALIDACOES.md` e `VALIDACAO_CARRINHO_20260930.md`. Evidencia complementar H1.4-production-cart-rerun-20261001 em VALIDACOES.md. |
| [x] | H1.5 | Revisar aviso de afiliado, termos, privacidade, contato e exclusão de conta. | Páginas `/termos` e `/privacidade` incluem aviso de afiliado e informações de privacidade; isso não equivale a certificação ou parecer de conformidade LGPD. Rodapé e endpoint `/api/account/delete` estão implementados; revisar os dados do controlador/canal de privacidade e validar exclusão funcional antes do lançamento. |
| [x] | H1.6 | Fazer auditoria de RLS, endpoints, logs e artefatos client-side. | RLS forçado em todas as tabelas públicas, colunas privadas de `offers` revogadas para `anon`, scan de artefato compilado sem credenciais e `npm audit` com 0 vulnerabilidades. Evidência `H1.6-security-rls-endpoint-audit` em `VALIDACOES.md`. |
| [x] | H1.7a | Validar responsividade, nomes acessíveis e navegação inicial por teclado. | Em 01/10, `scripts/verify-responsive.mjs https://achadosradar.vercel.app --viewports=390,1440` percorreu 6 rotas em duas larguras: 12 combinações, 0 falhas/overflow, landmark principal em todas e nenhum controle/cabeçalho sem nome. A rota dinâmica de produto apresentou 11 cards relacionados com borda CSS. Ver `H1.10-live-responsive-recheck-20261001` em `VALIDACOES.md`. |
| [ ] | H1.7b | [MANUAL OWNER] Validar os fluxos com leitor de tela real. | Requer testes manuais pelo proprietário usando NVDA/VoiceOver. Bloqueado automação. |
| [x] | H1.8 | Rodar o portão local unificado `npm run validate:local`. | Revalidado em 01/10/2026 após impor timeout abortável de 4s às métricas de visualização: `astro check` em 106 arquivos, 0 erros/avisos/hints; build Vercel; testes 161/161; 1 função; JSON de 20 cards com 12.852 bytes; JS/CSS gzip estimado 89.051 bytes; artefato estático estimado 1.350.714 bytes (abaixo de 5 MiB). Evidência `H1.8-analytics-timeout-20261001` em `VALIDACOES.md`. |
| [ ] | H1.9 | [MANUAL OWNER] Abrir/revisar o preview privado na equipe Vercel Pro já configurada. | Pendente configuração do owner na Vercel (CLI/Credentials). |
| [ ] | H1.10 | [MANUAL OWNER] Repetir fluxos de busca, produto, conta, carrinho e saída na URL de preview. | Requer teste no preview privado gerado após H1.9 pelo owner. |
| [ ] | H1.11 | [MANUAL OWNER] Confirmar domínio, HTTPS e aprovação do programa afiliado antes de publicação pública. | Ação legal e administrativa. |
| [ ] | H1.12 | [MANUAL OWNER] Publicar e acompanhar as primeiras visitas com possibilidade de rollback. | Ação de deploy final pelo owner. |

**Portão final:** publicação pública somente após aprovações dos programas de afiliado, teste funcional da integração Supabase, isolamento das contas, compra item a item, auditoria e preview verificado. Vercel Pro já está configurada segundo o proprietário; URL/ID do projeto e preview permanecem para conferência em H1.9.


### Revalidacao Codex frontend/extensao/layout - 01/10/2026

- E1.6: contratos do crawler Magalu/ML passaram 81/81. Magalu escala galerias a 1500x1500 e deduplica; identidade ML e fatos comerciais sao cobertos. Extracao real completa do ML, ponte e fila do radar permanecem pendentes.
- H1.7a: producao passou nas rotas `/`, `/produto/MLB3299039091`, `/carrinho` e `/conta` em 390/768/1440 px: 12 combinacoes, zero overflow, zero controles sem nome e percurso automatico por teclado sem falha. H1.7b continua aberta ate teste com leitor de tela real.
- H1.9: CLS de producao mediu 0.0013/0.0007/0.0002 em 390/768/1440 px; a leitura desktop antiga de 0.2849 nao se repetiu. Layout neutro refinado localmente e dentro de 5 MiB; ainda nao publicado.
- Bloqueios honestos: Chrome estavel configurado do proprietario nao ficou acessivel ao harness isolado; pagina publica do ML nao retornou detalhes do produto no extractor automatico; radar remoto nao foi executado para nao arquivar/escrever no catalogo sem fila dev isolada; leitor de tela real nao esta disponivel; smoke de avatar encontrou 504 de dependencia desatualizada no servidor dev ja aberto.
- Detalhes e limites da evidencia: ver as linhas `E1.6-crawler-gallery-contract-rerun-20261001`, `H1.7a-production-keyboard-3width-20261001`, `H1.9-production-cls-remeasure-20261001`, `H1.10-neutral-layout-local-20261001` e `G1.4-avatar-verifier-dev-cache-20261001` em `VALIDACOES.md`.


- Atualizacao de G1.4: o 504 era cache de dependencia no servidor Astro antigo. A instancia do projeto foi reiniciada; a selecao e previa do avatar passaram em Chromium isolado limpo. Upload e persistencia Supabase autenticados ainda exigem validacao em conta de desenvolvimento; a evidencia anterior de bloqueio foi resolvida localmente, ver `G1.4-avatar-clean-dev-rerun-20261001`.

- Rechecagem adicional do Mercado Livre: Chromium isolado recebeu pagina generica de erro no anuncio MLB5993515528, sem metadados ou corpo de produto. Este resultado nao conta como produto inexistente e nao e motivo para arquivar. Ver `E1.1-ml-access-error-rerun-20261001` em `VALIDACOES.md`.

### Revalidacao local de coleta e detalhes de produto - 03/10/2026

- Portao local aprovado: npm run validate:local passou com Astro check sem diagnosticos, build Vercel, 188/188 testes e orcamento aprovado. Macro: 90/90 testes JavaScript e 11/11 testes Python aprovados.
- A ponte/importador preserva Pix, cartao/parcelas, rating, quantidade de avaliacoes, especificacoes e um video HTTPS permitido; a migration foi exercitada com PGlite, incluindo RPC e refresh parcial.
- Pendencias: validar coleta real autenticada por marketplace, aplicar migrations no Supabase pelo fluxo normal, conferir dados remotos e validar preview/deploy. Evidencia E1.6-product-facts-pipeline-20261003 em VALIDACOES.md.

### Revalidacao local de fallback e imagens de categoria - 03/10/2026

- H1.7: fallback global agora espera imagem com URL e preserva `alt=""` para imagens decorativas; testes focados passaram 17/17.
- Portao completo: `npm run validate:local` passou com Astro check em 121 arquivos sem diagnosticos, build Vercel, 189/189 testes e orcamento aprovado (1 funcao; 2.318.175 bytes estimados no artefato estatico).
- Playwright confirmou 10/10 imagens de categoria carregadas e visiveis, com texto alternativo vazio. O servidor Astro dedicado nao respondeu nesta rodada; o teste usou o servidor estatico local na porta 4325, que servia o build recem-gerado.
- Limites: evidencia local apenas; nenhuma publicacao ou deploy; leitor de tela real continua pendente.

### Revalidacao Magalu, suite macro e sessao Awin - 03/10/2026

- Fallback da galeria inclui as familias de classe fornecidas nas capturas, sem remover os seletores `data-testid`; limite permanece em tres fotos.
- Fixture Magalu confere Pix, cartao, parcelas e preco anterior independentes; teste de video valida poster HTTPS e rejeicao de `blob:`.
- Suites atuais: site 189/189, macro 91/91 JavaScript e 11/11 Python; build, budget e carga da extensao Chromium aprovados.
- A sessao Awin foi aberta visivelmente no perfil persistente; aguarda acao manual se a Awin pedir login/verificacao. A tentativa Magalu com perfil temporario veio vazia; nenhum deploy, alteracao Supabase ou escrita de catalogo ocorreu.

### Revalidacao de APIs oficiais Amazon, Shopee e Mercado Livre - 03/10/2026

- Amazon: Creators API fornece catalogo, imagens variantes, ItemInfo e OffersV2, mas requer elegibilidade e credenciais. Maximo de pedido nao e estoque exato; Pix permanece extraido da pagina apenas com rotulo explicito.
- Mercado Livre: campos genericos de preco em /items estao em processo de descontinuacao segundo a documentacao atual. sale_price/prices pedem Bearer token; sale_price usa contexto do canal, nao meio de pagamento. Preco Pix e parcelas continuam dependendo da PDP.
- Shopee: nao foi possivel confirmar o schema liberado sem as credenciais do afiliado. Manter coleta DOM e fazer validacao autenticada antes de expandir a API.
- A tentativa de API ML retornou 403 UNAUTHORIZED no ambiente, sem gravacoes. Testar novamente somente com API/publico acessivel ou token autorizado.

- Awin recheck: perfil persistente ativo e aba Awin presente; DOM nao confirmou Link Builder ou conclusao de login. Titular deve conferir a janela visivel e finalizar autenticacao/verificacao. Nao iniciar geracao de links ate formulario do Link Builder aparecer.

### Checagem final de regressao dos crawlers - 03/10/2026

- Macro: testes JavaScript 94/94, testes Python 11/11 e sintaxe shared/ML aprovados. O fallback Schema.org BRL do Mercado Livre e validado por fixture e representa apenas preco geral observado.
- Metadados Schema.org comuns (modelo, SKU, ID, GTIN/EAN, cor, tamanho e material) agora entram nas especificacoes sem inferencia; teste de regressao passou junto da suite completa.
- Site revalidado nesta continuacao: Astro check em 121 arquivos sem diagnosticos, build, 189/189 testes e limite Vercel aprovados.
- Ao vivo: Amazon bloqueou com tela de verificacao; Shopee variou entre PDP parcial sem preco e desafios de login/idioma; Mercado Livre nao entregou preco na amostra; Magalu segue pendente de PDP real acessivel. Pix, parcelas, estoque e video sem evidencias explicitas permanecem vazios/desconhecidos.
- Awin: a sessao persistente esta aberta em janela visivel para o titular concluir login/verificacao caso apareca; sem envio de credenciais ou geracao de link.
- Depois da mudanca do extrator, `npm run verify:extension-load` carregou a extensao e o service worker no Chromium de teste; nenhuma loja abriu e nao houve radar nem sincronizacao.

- Video source recheck: Amazon Creators API current catalog has no documented video resource; ML item video_id requires authorized API context and is not itself a downloadable video URL; Shopee schema remains unknown pending valid credentials. Keep PDP video discovery optional and persist only stable HTTPS media, never blob URLs.

- The read-only PDP verifier now supports Amazon and Shopee. Use only official HTTPS product URLs with known IDs; require ID, title, positive price, and at least one image. Do not save data or follow affiliate links during this validation.

- Live PDP smoke: Amazon bot verification blocked extraction; Shopee gallery fallback now matches a loaded product image, but price remained absent from the browser DOM. Do not treat either platform as fully validated until the browser receives normal title, price, and image data.

- Amazon/Shopee now accept only explicit BRL Schema.org Product Offer prices as a general-price fallback; keep Pix, card price, and installments empty unless the source labels them.

### Awin: sessao e feeds verificados - 03/10/2026

- O login manual foi concluido e a janela persistente chegou ao Link Builder autenticado. Foram confirmados os campos de anunciante, URL de destino e campanha, mais o botao de gerar; campanha e referencia continuam opcionais. Nenhum link foi emitido nesta checagem.
- O endpoint Feed List oficial respondeu HTTP 200 como CSV: 903 feeds visiveis. KaBuM BR (ID 17729) esta ativo, Feed ID 46967, com 4.850 produtos; Lojas Benoit BR (ID 79974) esta ativo, Feed ID 93022, com 3.390 produtos. Os dois feeds estao em portugues.
- A lista fornece datas de importacao/verificacao e URLs de download; a documentacao oficial diz que o arquivo e CSV com colunas mapeadas. Nao registrar nem exibir URLs de download/API key. O feed list nao informa a taxa de comissao; a API oficial do Publisher oferece `programmedetails`/`commissiongroups`, que exige access token da API. Ainda nao consultamos valores.
- Proximo passo tecnico: importar uma amostra controlada dos feeds para verificar produto, deep link, imagens e campos de preco; testar um deep link com PDP real elegivel antes de automatizar lotes. Nao inferir comissao a partir de `commission_group` ou do feed.
