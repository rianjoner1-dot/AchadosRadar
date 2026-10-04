# Prioridades do site, macro e coleta de ofertas

Auditoria local do catálogo e da extensão em 02/10/2026. A inspeção visual completa e a coleta real autenticada nos marketplaces continuam pendentes; as conclusões abaixo distinguem código local, documentação pública e dependências externas.

## Prioridades selecionadas

| Prioridade | Área | Recomendação e motivo |
|---|---|---|
| P0 | Confiança dos dados | Exibir separadamente Pix, cartão/parcelas e preço anterior; mostrar quando foi observado e se a oferta precisa de nova consulta. Nunca chamar quantidade estimada de estoque exato. Preço, frete, cupom e estoque podem mudar por variação, CEP, login ou campanha. |
| P0 | Macro: coleta confiável | Abrir a página do produto, coletar até três fotos e um vídeo estável quando existente, descrição, atributos, preço por forma de pagamento, frete, cupom e estado/quantidade do estoque; marcar cada dado como observado, indisponível ou não confirmado. Evitar URLs `blob:` para mídia persistida. |
| P1 | Busca do site | Manter texto livre independente do filtro de categoria. Permitir combinar termo, categoria, marketplace e faixa de preço sem inserir palavras no campo de busca. A estrutura da página já separa categorias, loja e busca; validar esse fluxo no celular. |
| P1 | Produto e recomendações | Completar a página de produto com galeria, vídeo, descrição e especificações disponíveis. Recomendar produtos da mesma categoria e compatíveis com a busca, filtrando oferta sem imagem, link inválido ou observação vencida. |
| P1 | Macro: controle e diagnóstico | Tornar claros os estados do robô, do servidor local e da ponte do site; mostrar etapa atual, motivo de item ignorado e resumo do que foi coletado. Separar varredura rápida das opções avançadas para reduzir a carga da tela operacional. |
| P2 | Descoberta e confiança | Manter destaques automáticos por categoria/loja, com controles acessíveis, sem afirmar desconto ou economia sem base comparável. Usar avaliações/quantidade vendida apenas quando a fonte e o horário estiverem explícitos. |

## O que a inspeção do código confirmou

- O site já possui busca livre, filtro de marketplace, preço mínimo/máximo, ordenação e categorias distintas em `src/pages/index.astro`.
- Os carrosséis de destaque já agrupam produtos por categoria e limitam cada grupo; os cards do catálogo mostram frete, cupom, parcelas e disponibilidade quando esses campos existem.
- A página `src/pages/produto.astro` já tem espaço para vídeo e apresenta preço Pix, cartão e parcelas quando as colunas estão disponíveis.
- A extensão já possui páginas de busca e de detalhe para Amazon, Shopee, Mercado Livre e Magalu. Os extratores dependem de DOM/seletor e, por isso, precisam de fixtures e uma amostra real supervisionada após mudanças das lojas.
- Os crawlers de produto da Amazon, Shopee e Mercado Livre agora limitam a mídia enviada a até três fotos e um vídeo. A rotina comum separa preço Pix e cartão somente quando encontra o rótulo de pagamento junto do valor; quando não encontra, deixa os campos vazios. Frete, cupom, vendedor, estado/quantidade e parcelas continuam sujeitos aos sinais disponíveis no HTML/JSON-LD da página.
- A sincronização local usa dois serviços: o servidor do robô na porta 6875 e a ponte do catálogo do site na 6876. A macro informa os dois estados no popup; quando a ponte do site está indisponível, a coleta local continua, mas a atualização remota não está confirmada.
- Nesta execução, o importador normaliza o preço Pix como preço principal, mantém cartão/parcelas em campos próprios, limita a galeria a três imagens e aceita um único vídeo HTTPS com poster permitido. O dashboard da macro ordena pelo Pix observado e mostra cartão/parcelamento separados.
- A ponte do site agora preserva Pix, cartão, vídeo seguro, avaliação e características técnicas da coleta. O importador passa avaliação/quantidade de avaliações e até 18 especificações à RPC; o detalhe do produto renderiza esses fatos escapados e mantém a leitura opcional enquanto a migration ainda não foi aplicada.

## Diferenças e limites por marketplace

### Amazon

- A lista atual de operacoes/recursos da Creators API documenta imagens e dados de produto/oferta, mas nao apresenta recurso de video de produto. Tratar video como campo opcional da PDP, extrair somente URL estavel HTTPS observada e deixar vazio se so houver player/URL temporaria.
- A API oficial para afiliados é a **Creators API**. `SearchItems`/`GetItems` disponibilizam recursos de imagens primárias e variantes, item info, ofertas, disponibilidade e quantidade máxima de pedido; `ItemInfo` inclui título, marca e descrição. A inscrição de afiliado, acesso liberado e credenciais são pré-requisitos.
- O esquema público de OffersV2 traz preço, availability, máximo de pedido e saving basis, mas não identifica uma condição Pix como campo próprio. Pix e parcelamento devem vir da página quando o rótulo estiver explícito; não converter o preço genérico da API em “preço no Pix”. A quantidade máxima de pedido não deve ser anunciada como estoque exato.
- A macro atual ainda usa DOM na página autenticada. A API é o caminho mais estável para catálogo, imagens/variantes e disponibilidade quando a conta habilitar acesso; preservar o DOM como enriquecimento para condições específicas de pagamento e dados ausentes na API.
- A macro atual lê preço/imagens da busca e aprofunda descrição, atributos, parcelas/estoque e galeria na página do produto. Verificar se campanhas Pix estão capturadas separadamente antes de publicar essa distinção.
- O detalhe da Amazon usa preço principal/original e seletores para descrição, especificações, disponibilidade e parcelas. Pix/cartão só entram como valores próprios se o HTML trouxer rótulo explícito; 3 fotos e 1 vídeo são o limite persistido.

### Shopee

- A API Affiliate Open API nao teve schema visivel no explorer sem credencial valida. O crawler atual tenta sinais de video da PDP (`og:video`, scripts/CDN) e fotos do DOM; nao assumir que o schema afiliado fornece video, estoque exato ou Pix ate confirmar isso no explorer autenticado e em produto real.
- A Shopee mantém um Affiliate Open API oficial em GraphQL; o explorer brasileiro solicita App ID e segredo. O robô já assina requests HMAC e usa o API para converter links, mas ainda não usa o API para enriquecer dados de produto. O explorer autenticado do titular precisa confirmar as operações/campos exatos liberados para a conta brasileira antes de integrá-los.
- No estado atual, o crawler de PDP usa DOM para descrição/atributos, condição explícita de pagamento, parcelas e estoque disponível na página. Não assumir que a resposta de ofertas afiliadas inclui preço Pix/cartão ou saldo de estoque exato sem confirmar o schema liberado no explorer.
- A página do produto pode mostrar vários níveis de estoque/preço por promoção e quantidade. A própria Central de Ajuda diferencia estoque geral, estoque de desconto e saldo de promoção. Portanto, salvar só um número sem variação/condição pode ser enganoso.
- Preservar a forma de pagamento e o texto da parcela como observação. O checkout oferece Pix e SParcelado, mas a disponibilidade e o total final dependem das condições da compra.
- O crawler lê descrição e atributos da página, mantém quantidade desconhecida quando não há sinal explícito e agora usa os mesmos limites de mídia e extração rotulada de Pix/cartão. A existência desses valores deve ser confirmada em página real; o checkout não é evidência suficiente para atribuí-los ao preço do produto.

### Mercado Livre

- A documentacao de itens mostra `pictures` e `video_id` no recurso de item, mas os exemplos sao autenticados e `video_id` identifica a midia, nao garante URL MP4 estavel para o site afiliado. O crawler atual inspeciona estado pre-carregado da PDP; persistir apenas URL HTTPS real observada, nunca `blob:` ou o identificador isolado como URL.
- Atualizacao da documentacao oficial consultada em 03/10/2026: os campos `price`, `base_price` e `original_price` de `/items` estao em processo de descontinuacao. A API orienta consultar `/items/{id}/sale_price?context=channel_marketplace` para o preco vencedor do canal e `/items/{id}/prices` para precos standard/promocionais e suas condicoes. Os exemplos exigem `Authorization: Bearer`; `sale_price` nao representa um meio de pagamento Pix e nao deve ser mapeado automaticamente para esse campo. `regular_amount` e preco anterior sao informacoes distintas, portanto nao declarar economia sem observar ambos na oferta.
- O teste direto dos tres endpoints (`/items/{id}`, `/prices` e `/sale_price`) para a amostra `MLB3299039091` retornou HTTP 403 com `UNAUTHORIZED` nesta rede. Isso comprova apenas o bloqueio do ambiente, nao que o produto ou endpoint esteja indisponivel. Para o robo afiliado sem token autorizado, manter a pagina do produto como fonte de Pix, parcelas e sinais visiveis; integrar esses endpoints somente depois de validar token permitido e contexto de acesso.
- A API oficial de itens dá acesso a título, categoria, fotos, preço e atributos; a descrição detalhada vem do endpoint `/items/{id}/description`. O crawler atual ainda usa DOM na página de produto e aproveita JSON-LD quando disponível.
- A documentação oficial alerta que `available_quantity` em recursos públicos é uma faixa referencial, enquanto a quantidade exata é informação restrita ao vendedor. Mostrar “disponível” ou a faixa observada; não apresentar contagem precisa como fato público.
- O preço comum da API não representa necessariamente eventual condição Pix ou desconto de campanha. Guardar o preço Pix apenas se estiver explicitamente visível no produto, junto à observação e ao horário. Checar fotos e variações pela resposta do item, mantendo identidade exata do MLB.
- Na página do produto, descrição, especificações, frete, parcelas e estado/quantidade vêm do DOM/JSON-LD quando presentes. A coleta agora limita as imagens a três e vídeos a um; preço Pix/cartão não é inferido do preço geral da API.

### Magazine Luiza

- A coleta implementada nesta execução usa o DOM da página de produto. Quando não encontra um player, tenta acionar somente um controle identificado como vídeo/assistir/reproduzir, sem tocar em botões de compra; depois procura a URL HTTPS estável e o poster oficial. O vídeo reproduzido em `blob:` não é persistível.
- Pix, valor de cartão e parcelas são extraídos de trechos distintos da página. O resultado continua condicionado a uma inspeção real de um produto Magalu no Chrome e à aplicação da migration antes de aparecer no Supabase.
- A tentativa de abertura do player passou em teste automatizado (incluindo a asserção de que “Adicionar ao carrinho” não é clicado). A consulta pública ao produto usada nesta execução recebeu HTTP 403; portanto, o seletor e a extração de mídia ainda precisam de validação com uma sessão real.

### Awin: Lojas Benoit e KaBuM

- A lista de feeds da Awin contém feeds que o publisher já aderiu e também feeds de anunciantes que permitem divulgação antes da adesão. Portanto, ela não significa “todos os anunciantes” nem que todos os itens gerem comissão. Filtrar pelo `Membership Status` e importar apenas programas `Joined` até a adesão estar confirmada.
- O feed pode evitar gerar deep link manualmente item por item: quando existe, `aw_deep_link` já é o link de tracking para aquele produto. `merchant_deep_link` é o destino da loja. Conferir se o deep link corresponde ao produto e testar que abre a loja correta antes de publicar.
- A lista documentada informa anunciante, região, status de vínculo, feed, idioma, categoria e última atualização. O CSV de cada feed fornece apenas colunas mapeadas pelo anunciante; campos típicos incluem nome, ID, descrição curta, marca, categoria, preço atual/anterior, disponibilidade, quantidade, imagens alternativas e `commission_group`. Nem todo feed tem todos esses dados. `commission_group` é um identificador de grupo, não a porcentagem de comissão.
- A lista privada enviada pelo usuário foi consultada em 03/10/2026: retornou 903 registros no total, 12 para o Brasil; 901 constam como `Not Joined` e dois como `active`. Esses dois registros são KaBuM (`17729`, 4.855 itens) e Lojas Benoit (`79974`, 3.390 itens). O status real da lista usa `active` em vez do `Joined` exibido na documentação de exemplo.
- Os dois feeds reais foram baixados sem salvar ou exibir os links privados de download. Todas as 4.855 linhas da KaBuM e as 3.390 da Benoit contêm `aw_deep_link` em `www.awin1.com`; assim, para esses catálogos, não é preciso chamar o Link Builder produto por produto. Os destinos originais estão em `merchant_deep_link` e as imagens vêm de campos de imagem do próprio feed.
- A estrutura real diverge por loja: KaBuM fornece nome, descrição, marca, categoria, preço (`search_price`), URLs afiliada/original e imagem, mas não sinalizou estoque nem preço anterior no exemplo conferido. Benoit também fornece disponibilidade/quantidade, garantia, condição e até quatro imagens alternativas. Os feeds não trazem Pix, parcelas ou vídeo nos campos mapeados observados; esses detalhes continuam dependendo da coleta da página do produto. `search_price` não foi rotulado como Pix, então entra como preço comum.
- Os feeds não são uma fonte para a taxa da conta do publisher. O diretório público da Awin informa Benoit (`79974`) com CPA de 4%, cookie de 30 dias e atribuição last-click; o perfil lista “Search” como método não permitido. KaBuM (`17729`) informa cookie de 1 dia, CPA de 2,30% para produtos 1P/2P e 1,15% para produtos 3P/marketplace; só comissiona compra na mesma sessão do last-click. Cupons não autorizados são vedados, e a divulgação por extensão/plugin de navegador exige aprovação do anunciante.
- Referência bruta para R$ 100 em uma compra elegível: Benoit R$ 4,00; KaBuM 1P/2P R$ 2,30; KaBuM 3P R$ 1,15. Isso é estimativa pela taxa pública, não garantia de comissão. Cancelamento, devolução, atribuição, elegibilidade, eventual taxa diferenciada do publisher e aprovação da transação alteram o valor efetivamente recebido. Conferir a taxa vigente em **Advertisers > Programme Commission Rates** na conta autenticada.
- A página Link Builder continua como fallback: selecionar o anunciante correspondente, usar a URL original do produto como destino e deixar campanha/referências vazias. Para a automação, abrir a janela visível no perfil persistente do robô; tentar a sessão/cookies salvos e deixar o usuário concluir login/verificação quando necessário. Não armazenar senha em código, extensão, logs ou URL.
- O comando `npm run awin:session` foi criado para abrir essa janela sem iniciar a coleta. Nesta execução, o endpoint CDP respondeu e listou uma aba com a URL do Link Builder Awin. O título ficou vazio e não foi possível confirmar visualmente o formulário nem o estado da autenticação/verificação. Credenciais não foram preenchidas automaticamente; se a Awin pedir verificação adicional, a janela fica pronta para você concluir.
- **Limite atual do site:** o banco e as rotas de saída ainda aceitam somente `mercadolivre` e `magalu` como plataformas. Os feeds Awin não devem ser importados diretamente para produção até criar e validar um modelo de anunciante/loja (Benoit/KaBuM), expandir a allowlist do Link Builder e das imagens e incluir suporte de apresentação/filtro no site. Um staging local do CSV pode ser usado antes dessa mudança.
- A lista e os dois feeds ativos foram lidos nesta execução. O arquivo bruto, URLs de download e links individuais não foram persistidos nem mostrados no relatório. Ainda falta integrar `platform=awin` ao modelo do site e importar os feeds em staging antes da publicação.

## Critérios para liberar a publicação de uma oferta

1. Identidade e URL da página original correspondem ao mesmo produto.
2. Imagem HTTPS permitida e carregável; sem imagem, não gerar arte que pareça foto do produto.
3. Preço com origem e horário; Pix e cartão separados. Comparação com preço anterior só se ambos foram realmente observados.
4. Estoque desconhecido permanece desconhecido; faixas públicas não viram contagem exata.
5. Vídeo no máximo um por produto, HTTPS estável, host permitido; `blob:`, URLs de sessão e trackers ficam de fora.
6. Link de afiliado validado para o produto. Um estado de revisão do robô não é prova de validade nem de expiração oficial.

## Próximo checkpoint de validação

- Rodar os testes focados da macro e do importador, o check/build/teste do site e as verificações Python do servidor de postagem.
- Validar no Chrome, em um produto real de cada marketplace, Pix/cartão, parcelas, estoque, fotos, vídeo e descrição; capturar falhas de seletores sem publicar.
- Aplicar as migrations `20261002160000_magalu_pix_prices_and_product_videos.sql` e `20261003100000_product_observed_ratings_and_specs.sql` somente no fluxo normal de publicação do projeto e verificar o schema remoto antes de afirmar que os campos chegaram à produção.
- Fazer uma passada visual manual do site em celular e desktop; o usuário indicou que fará a inspeção página a página depois da prioridade principal.

## Referências externas consultadas

- Amazon Creators API: [introdução e pré-requisitos](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction), [SearchItems e campos](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/search-items), [imagens principais e variantes](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/resources/images), [OffersV2 e disponibilidade](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/resources/offersV2).
- Awin: [programa Lojas Benoit BR](https://ui.awin.com/merchant-profile/79974), [programa KaBuM BR](https://ui.awin.com/merchant-profile/17729), [Product Feed List Download e campos](https://help.awin.com/developers/docs/product-feed-list-download), [descrição dos campos do feed](https://help.awin.com/developers/docs/hosting-feeds), [comissões atuais no painel](https://success.awin.com/articles/en_US/Knowledge/How-can-i-view-advertiser-commission-rate), [API para gerar tracking links](https://help.awin.com/apidocs/generatelink).
- Shopee Brasil: [Affiliate Open API explorer](https://open-api.affiliate.shopee.com.br/explorer), [gerar links de afiliado](https://help.shopee.com.br/portal/10/article/128461-Como-gerar-seus-links-de-Afiliado-ou-ID-de-produto-para-compartilhar), [termos do programa](https://help.shopee.com.br/portal/10/article/124094-Programa-de-Afiliados-da-Shopee-Termos-e-Condi%C3%A7%C3%B5es), [pagamentos na Shopee](https://help.shopee.com.br/portal/4/article/92067-%5BParceiras-de-Pagamento%5D-Quais-s%C3%A3o-as-parceiras-de-pagamento-da-Shopee).
- Mercado Livre Developers: [publicação e detalhe de itens](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/publicacao-de-produtos), [busca pública e faixas de estoque](https://developers.mercadolivre.com.br/pt_br/itens-e-buscas), [descrição](https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos).

## Revalidacao local da coleta - 03/10/2026

- Suite do robô: 90/90 testes JavaScript, 11/11 testes Python e verificacao sintatica dos crawlers/service worker passaram. Chromium de teste carregou a extensao sem abrir marketplaces ou acionar radar/sincronizacao.
- Suite do site: 189/189 testes, Astro check em 121 arquivos sem diagnosticos, build e orcamento local aprovados; 10/10 imagens de categoria carregadas com `alt=""`.
- Pendente: observar um produto real por marketplace com URL fornecida, Chrome real/autenticado quando necessario, confirmar seletores Magalu/ML/Amazon/Shopee e aplicar migration/verificar o Supabase no fluxo normal. A janela Awin pode solicitar login/verificacao manual; nao foi usada nesta rodada.

- Atualizacao do teste ao vivo: a URL de produto `MLB3299039091` retornou ID/titulo/uma imagem no harness da extensao, mas sem preco (0) e estoque permaneceu desconhecido. Uma segunda navegacao Chromium recebeu erro generico da loja. Resultado inconclusivo por variacao/bloqueio de acesso, sem evidenciar qual seletor falhou; nenhum dado foi gravado. A coleta de cada marketplace segue aberta ate uma pagina real acessivel com campos verificados.

- Magalu: seletores de PDP agora cobrem tambem as familias de galeria vistas nas capturas (`hMZfhv`, `fqkvVR`, `dYOqWG`) e ha fixture com Pix/cartao/parcelas/preco anterior informado. A tentativa isolada Chromium recebeu pagina sem conteudo; validacao de campo real continua pendente na sessao Chrome do titular. Video `blob:` e descartado, poster HTTPS e preservado.
- Awin: `npm run awin:session` abriu a pagina Link Builder em janela visivel do perfil persistente do robo; nao preencheu credenciais nem iniciou geracao/coleta. O titular pode concluir login/verificacao nesta janela.

## Revalidacao final do crawler - 03/10/2026

- Macro: 94/94 testes JavaScript, 11/11 testes Python e `node --check` dos crawlers shared e Mercado Livre passaram. O fallback Schema.org BRL do ML e geral; nao e rotulado como Pix nem cartao sem evidencia explicita.
- Site: revalidado nesta continuacao: Astro check em 121 arquivos sem diagnosticos, build concluido, 189/189 testes e orcamento aprovado (1 funcao; artefato estatico estimado em 2.318.175 bytes).
- Detalhes da PDP: o extrator comum da macro agora inclui modelo, SKU, ID do produto, GTIN/EAN, cor, tamanho e material como especificacoes Schema.org quando publicados pela loja; sem preencher campos ausentes, duplicados ou além do limite de 18.
- A coleta real nao esta completa: Amazon retornou verificacao; Shopee forneceu uma amostra parcial sem preco e depois exigiu login/idioma; Mercado Livre nao confirmou preco na amostra. Magalu segue sem PDP real acessivel no perfil isolado. Nao tratar fixture como prova de funcionamento ao vivo.
- A janela Awin foi aberta visivelmente no perfil persistente e aguarda o titular concluir login/verificacao se solicitado; nenhum deep link foi gerado nesta validacao.
- Rechecagem nesta continuacao: `npm run awin:session` confirmou a abertura da Awin em janela visivel; `npm run verify:extension-load` retornou `passed=true` e `extensionLoaded=true` no Chromium, sem abrir lojas, iniciar radar ou sincronizar catalogo.

## Fontes oficiais verificadas em 03/10/2026

- Mercado Livre: https://developers.mercadolivre.com.br/devcenter/api-de-precos ; https://developers.mercadolivre.com.br/pt_br/itens-e-buscas. O endpoint sale_price exige Bearer token e contexto; estoque publico continua referencial.
- Amazon Creators API: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction ; https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/search-items ; https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/resources/offersV2 ; https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/resources/images. Images/ItemInfo/OffersV2 podem enriquecer catalogo quando a conta tiver acesso; maxOrderQuantity nao e saldo real de estoque.
- Shopee: https://open-api.affiliate.shopee.com.br/explorer ; https://help.shopee.com.br/portal/10/article/128461-Como-gerar-seus-links-de-Afiliado-ou-ID-de-produto-para-compartilhar. O explorer nao revelou schema sem credenciais; confirmar os campos autorizados no login do titular antes de integrar.
- Requisito de acesso Amazon confirmado pela documentacao Creators API em 03/10/2026: programa de Associados no marketplace de destino, 10 vendas qualificadas nos 30 dias anteriores, registro da API e credenciais. Se a conta nao cumprir isso, manter o crawler DOM e nao programar integracao API como caminho disponivel.
- Rechecagem da sessao Awin: o perfil CDP persistente respondeu, com duas abas e uma aba ui.awin.com. O DOM resumido nao confirmou Link Builder nem campo de senha/codigo; portanto, nao prova autenticacao concluida nem desafio especifico. Janela permanece aberta para o titular verificar visualmente.
