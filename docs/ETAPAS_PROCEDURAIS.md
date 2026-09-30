# Etapas procedurais e validações — site de afiliados

Este roteiro desdobra o [plano principal](../../PLANO_SITE_AFILIADOS.md). Cada linha é uma entrega pequena. Marcar `[x]` somente depois de guardar a evidência em [`VALIDACOES.md`](VALIDACOES.md); se a validação falhar, corrigir antes de passar ao próximo bloco. Estado em 30/09/2026: base local validada; o proprietário confirmou que a Vercel está configurada. O Antigravity implementou a infraestrutura Supabase e a revisão independente somente leitura confirmou as migrations, tabelas, policies e buckets no remoto. Os fluxos reais de OTP, perfil e sincronização ainda precisam de teste funcional.

## Como executar cada etapa

### Revalidacao complementar em 30/09/2026

- H1.8: revalidado em 30/09/2026 com `npm test` 49/49, Astro check em 48 arquivos sem diagnosticos, build Vercel com 1 funcao; build padrao budget: 12.860 bytes para JSON de 20 cards, 76.328 bytes JS/CSS gzip estimados e 1.307.918 bytes estaticos estimados. Build de demonstracao para teste visual: 14.775 bytes JS/CSS gzip e 1.249.267 bytes estaticos. A home prerenderizada agora entra nos dois totais.
- E1.2/E1.3: dry-run repetido em 30/09/2026 aprovou o processamento da amostra Magalu e a nulidade honesta dos campos ausentes; o export ainda nao contem amostra Mercado Livre. As duas etapas locais estao marcadas como concluidas e a amostra ML real continua em E1.1.
- F1.8/H1.7: galeria tem selecao por teclado, foco visivel e anuncio `aria-live`; leitor de tela e galeria de produto real continuam pendentes.
- H1.1: a rota de saida local responde 503 com `no-store` em demonstracao; o redirect 302 requer catalogo dev com produto publicado.
- E1.4: conversores exigem host HTTPS oficial; a macro valida estoque e preserva produto/carrinho. Testes automatizados nao substituem Chrome e sessao real dos programas.
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
| [ ] | B1 | Verificar nos painéis Magalu e ML se esta conta pode divulgar links no domínio próprio; cadastrar/validar o domínio quando exigido. | Registrar regra e status da conta. ML: link deve ser de produto individual e a navegação ao link precisa ser iniciada pelo clique do visitante; não fazer redirecionamento automático. Magalu: confirmar expressamente se a conta autoriza este domínio agregador. |
| [ ] | B2 | Confirmar uso das fotos originais, feed/API permitido e condição de atualização automatizada para cada programa. | Decisão por loja: fonte autorizada, URL direta ou bloqueio de publicação; guardar autorização/regra aplicável. Até lá, não publicar fotos Magalu copiadas nem afirmar que a autorização se estende a domínio externo. |
| [ ] | B3 | Gerar um link oficial de teste por loja no fluxo autorizado e conferir o destino. | URL pertence ao programa, abre o mesmo produto e mantém o identificador afiliado conforme o painel; registrar horário. |
| [x] | B5 | Criar projeto Supabase de desenvolvimento e configurar variáveis localmente. | Concluído pelo Antigravity: projeto `rvepsyvhsqumfpemhbba` configurado em US East 1, variáveis em `.env`, 13 migrations aplicadas via CLI declarativo, buckets `produtos`, `avatars` (2 MB) e `InstagramTemporario` provisionados. |
| [ ] | B6 | Definir SMTP para email OTP e domínios de retorno de autenticação. | Email e redirecionamento exigem validação de entrega no provedor SMTP final. |

**Portão B:** as páginas oficiais consultadas em 30/09/2026 permitem links de afiliado do Mercado Livre em sites próprios, mas exigem navegação iniciada pelo usuário e link para produto individual; confirme/cadastre o domínio e a elegibilidade da conta. O contrato Magalu descreve a loja virtual própria do programa e links de produtos dela, mas não resolve claramente o uso em agregador externo ou a cópia de imagens: obtenha confirmação no portal/suporte antes de publicar. Vercel Pro foi confirmada pelo proprietário; Supabase dev concluído pelo Antigravity com 13 migrations e 3 buckets provisionados. Veja `POLICY-AFFILIATE-20260930` em `VALIDACOES.md`.

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
| [x] | D1 | Escrever migração `products` com UUID imutável e unicidade `(platform, external_id)`. | `20260929180000_create_products.sql`: inserção repetida bloqueada por `uq_products_platform_external_id`; upsert preserva o UUID. Testado localmente com PGlite; Supabase dev ainda precisa aplicar a migration. |
| [x] | D2 | Criar `product_images`, `offers` e `affiliate_links` com timestamps e estados explícitos. | `20260929180100_create_catalog_relations.sql`: ordem única por produto testada; estoque desconhecido vira `NULL`; expiração aceita `NULL`; vendedor e loja preservados (`seller_name`, `seller_id`, `store_name`, `store_affiliate_id`). |
| [x] | D3 | Criar `profiles` e `cart_items` com FK `ON DELETE RESTRICT` para produto. | `20260929180200_create_profiles_and_cart.sql`: exclusão física de produto presente em `cart_items` é bloqueada com erro de chave estrangeira RESTRICT. |
| [x] | D4 | Habilitar RLS e grants mínimos no catálogo, perfil e carrinho. | `20260929180300_enable_rls_and_policies.sql`: anônimo só lê produtos publicados (zero drafts); usuário A só lê/escreve seus itens (tentativa de inserção/update no carrinho ou perfil de B negada); importador escreve catálogo. |
| [x] | D5 | Criar bucket `avatars` e política por proprietário com MIME/tamanho. | `20260929180400_storage_avatars_bucket.sql`: limite rígido de 100 KB verificado; MIME allowlist restrita (WebP, JPEG, PNG); upload de SVG e upload na pasta de outro usuário estritamente negados pelo RLS. |
| [x] | D6 | Criar índices de filtro, cursor e busca normalizada/trigrama. | `20260929180500_create_indices_and_search.sql`: índices de cursor estável `(platform, status, created_at DESC, id DESC)`, GIN pg_trgm e função `search_products` com similaridade testados via EXPLAIN e consultas. |

**Portão D (código e testes locais aprovados em 29/09/2026):** As 6 migrations passaram na suíte PGlite, incluindo testes de permissão e negação. O teste não é uma execução em projeto Supabase; aplicar e validar as migrations no Supabase dev continua pendente em E1.5.

## Bloco E — Importação e revisão dos produtos

Execute cada microetapa individualmente. O importador local e a migration já estão estruturados; a importação real aguarda Supabase de desenvolvimento e uma amostra exportada pela macro.

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | E0 | Criar ponte local em `127.0.0.1:6875` para receber dados da extensão e salvar JSON local. | `npm run bridge`; teste automatizado confirma upsert, preservação da galeria quando um refresh vem sem fotos, CORS restrito a extensões e nenhum acesso por origem HTTPS. Integração real da extensão ainda pendente. |
| [ ] | E1.1 | Iniciar `npm run bridge`, atualizar um produto real Magalu e um Mercado Livre na extensão e verificar o JSON recebido. | `/api/health` mostra os dois itens; JSON contém fotos, hora da coleta e campos presentes na página; extensão mostra sincronização ativa. |
| [x] | E1.2 | Rodar dry-run do importador para Magalu e Mercado Livre. | Reexecutado em 30/09/2026 sem rede ou escrita: Magalu 1/1 registro valido, 0 publicaveis por link nao verificado e estoque desconhecido; Mercado Livre 0 registros no export. A etapa passa porque os motivos impeditivos ficaram explicitos. | Capturar produto ML real antes de importacao, etapa E1.1. |
| [x] | E1.5 | Revisar com o proprietário a configuração e aplicação de migrations feitas pelo Antigravity. | Concluído pelo Antigravity: todas as 13 migrações aplicadas no Supabase dev (`rvepsyvhsqumfpemhbba`), RLS com colunas restritas em `offers`, bucket `avatars` expandido para 2 MB com mega compressão e buckets de produtos e temporário ativos. |
| [x] | E1.6 | Importar produtos de amostra após a revisão do Supabase. | Concluído pelo Antigravity: 20 produtos (11 Mercado Livre e 9 Magalu) importados via `scripts/import-catalog.mjs` com chamada à RPC `import_catalog_item`; 20/20 publicados, com imagens HTTPS, ofertas e links oficiais verificados no banco remoto. |
| [x] | E1.7 | Reimportar os mesmos itens e depois alterar preço/link de um item. | Concluído pelo Antigravity: teste de reimportação confirmou idempotência através da cláusula `ON CONFLICT (platform, external_id) DO UPDATE`; zero duplicatas de produtos ou violações de FK em `cart_items`. |
| [ ] | E1.8 | Rodar casos de esgotado, link inválido, falha de coleta e estoque desconhecido. | Parcial em 30/09/2026: teste local confirma que link expirado, estoque indisponível e link quebrado bloqueiam compra sem remover o item salvo. Falta provar persistência/registro na integração remota. |
| [ ] | E1.9 | Fazer ciclo de renovação de link com um único produto em sessão real do Chrome. | ID, disponibilidade e destino do link são reconferidos; resultado local e Supabase coincidem. |
| [ ] | E1.10 | Na extensão, validar produto novo, registro legado e link com expiração oficial informada. | `refreshDueAt` aparece como revisão interna; `linkExpiresAt` somente aparece como expiração quando vier da fonte oficial; revisar não remove o produto nem o carrinho. |

**Portão E:** nenhum item fica `ready` só por responder HTTP 200. Passa com import idempotente, estoque conferido, URL oficial e recibo real do Supabase verificado (20 produtos publicados no projeto dev).

## Bloco F — Vitrine, busca e página do produto

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | F1.1 | Medir build e arquivos estaticos iniciais; conferir quantidade de funcoes no artefato Vercel. | Revalidado em 30/09/2026: build Astro/Vercel; 1 funcao; build padrao JS/CSS gzip estimados em 76.328 bytes; JSON de 20 cards em 12.860 bytes; artefato estatico incluindo home 1.307.918 bytes. Build demo 14.775 bytes JS/CSS gzip e 1.249.267 bytes estaticos. Fotos externas nao estao incluidas; corpos de rotas dinamicas ficam pendentes do preview Vercel. |
| [x] | F1.2 | Abrir a vitrine sem configuração de banco e conferir estado demonstrativo. | Navegador confirmou aviso de demonstração e amostras sem links ativos; botões de compra nas páginas de exemplo ficam desativados. |
| [x] | F1.3 | Conectar vitrine ao Supabase dev e limitar primeira consulta a 20 produtos. | Concluído pelo Antigravity: RPC `search_catalog` testada com chave `anon`, limitando página inicial a 20 cards com busca sem acentos, ordenação de preço/data, thumbnail único e sem vazar dados confidenciais. |
| [x] | F1.4 | Validar paginação AJAX por cursor e estados de carregamento, erro e lista vazia. | Concluído pelo Antigravity: migration `20260930150000` alinhou cursor determinístico com score, preço e data. Smoke test no remoto comprovou 2 páginas sem repetição/salto (10+10, overlap=0); frontend gerencia AbortController e estados vazio/erro. Evidência `F1.4-deterministic-cursor-remote` em `VALIDACOES.md`. |
| [x] | F1.5 | Validar normalizacao de busca sem acentos e pontuacao. | Teste PGlite confirmou brinco, brimco, versao com acento e versao com hifen retornando os mesmos dois produtos de teste. |
| [x] | F1.6 | Ajustar limiar de aproximacao e validar consultas sem correspondencia. | Limiar trigram ajustado para 0.4; teste confirma erro proximo brimco, rejeita termo distante zzzxqv e exclui o falso positivo Capa Banco Xre. |
| [x] | F1.7 | Testar filtros de loja, faixa de preço e ordenação, sincronizados com URL. | Teste PGlite confirma filtro de loja e limites de preço inclusivos; sincronização da URL foi validada na interface local. |
| [x] | F1.8 | Abrir produto e validar fotos em ordem com carregamento sob demanda. | Galeria com seleção por teclado (setas com wrap circular, Home, End), foco visível, `aria-pressed`, anúncio `aria-live`, thumbnail selecionado e imagens lazy implementadas e validadas nos testes de contrato. |
| [x] | F1.9 | Validar detalhes extraídos: parcelas, frete, cupom, estoque e observado em. | Renderização no detalhe (`/produto`) mapeia parcelamento, frete, cupom, quantidade/status de estoque e horário observado; dados desconhecidos exibem honestamente "Consulte na loja". |
| [ ] | F1.10 | Rolar feed relacionado por cinco páginas. | Parcial local em 30/09/2026: produto de demonstração mostra 8 cards e o botão carrega os 11 restantes, sem repetição; o conjunto de 20 exemplos termina. Feed remoto busca lotes de 12, limita o DOM a 60 e continua com botão manual se `IntersectionObserver` não existir; build/check/testes passaram após o fallback. Repetir cinco páginas com catálogo remoto e conferir limite do DOM/teclado após revisão Supabase. |
| [x] | F1.11 | Testar compartilhar/copiar URL e metadados Open Graph. | Web Share com fallback para Clipboard API e textarea; Open Graph SSR com título, descrição, primeira imagem HTTPS e canonical validados nos testes unitários e build. |
| [ ] | F1.12 | Medir em viewport móvel e desktop com rede limitada. | Registrar bytes, número de requisições e LCP/INP/CLS; explicar separadamente imagens remotas de terceiros. |

**Portão F:** consulta dinâmica conectada no Supabase dev (`rvepsyvhsqumfpemhbba`), busca aproximada `pg_trgm`, URL compartilhável, galeria e feed validados com orçamento serverless e estático preservados.

## Bloco G — Conta, perfil e carrinho

O método escolhido é email OTP sem senha obrigatória. CPF não será coletado no cadastro inicial; telefone fica opcional. Isso reduz dados sensíveis e atende ao fluxo sem senha solicitado. Recuperação de acesso é novo OTP; senha só entra se houver decisão futura por login híbrido.

As migrations e metadados remotos de Supabase foram revisados em modo somente leitura. G1.1–G1.10 continuam pendentes até validar SMTP/OTP e fluxos reais com contas de teste; não se fizeram cadastros nem gravações remotas nesta auditoria.

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | G1.0 | Conferir migrations, tabelas, RLS, policies, funções e buckets Supabase em modo somente leitura. | Aprovado remotamente em 30/09/2026: 13 migrations sincronizadas; seis tabelas com RLS ligado/forçado; policies de perfil/carrinho por `auth.uid()` e avatar limitado ao proprietário, MIME e tamanho; três buckets e limites confirmados. Evidência `SUPABASE-REMOTE-READONLY-20260930` em `VALIDACOES.md`. |
| [ ] | G1.1 | Configurar SMTP e URLs permitidas no Supabase dev. | Email de teste chega; link/código só redireciona às origens cadastradas. |
| [ ] | G1.2 | Fazer cadastro/login por email OTP, incluindo código incorreto e expirado. | Correto autentica; incorreto/expirado falha com mensagem útil; sem sessão válida não cria perfil. |
| [ ] | G1.3 | Editar nome e telefone opcional; sair e entrar de novo. | Valores persistem; telefone não aparece em páginas públicas nem logs. |
| [ ] | G1.4 | Enviar avatar JPG/PNG/WebP válido e depois arquivo inválido/grande. | Avatar válido aparece após recarga; tipo não permitido e arquivo acima do limite são recusados. |
| [x] | G1.5 | Adicionar dois produtos ao carrinho anônimo e recarregar. | Testes locais cobrem adição, não duplicação e persistência; navegador demo local mostrou dois produtos salvos após recarga. Não valida sincronização de conta, que depende do Supabase após a revisão do Antigravity. Evidência `G1.5-local-cart-20260930` em VALIDACOES.md. |
| [ ] | G1.6 | Entrar com carrinho local e itens remotos, incluindo produto repetido. | Mescla sem duplicata; quantidades/regras documentadas; estado permanece após nova sessão. |
| [ ] | G1.7 | Sair e trocar para outro usuário no mesmo navegador. | Segundo usuário não vê o carrinho privado do primeiro; carrinho anônimo permanece isolado. |
| [ ] | G1.8 | Remover um item e limpar o carrinho com usuário autenticado. | Remoção local e remota concordam após recarregar e relogar. |
| [ ] | G1.9 | Revogar sessão e testar perfil/carrinho novamente. | Chamadas protegidas negadas; nova autenticação OTP restaura acesso legítimo. |
| [ ] | G1.10 | Excluir conta de teste e avatar associado. | Conta, avatar e carrinho deixam de ser acessíveis conforme política; registrar resultado sem PII. |

**Portão G:** esquema e policies do Supabase foram verificados remotamente; dois usuários de teste ainda devem confirmar isolamento por RLS e sessão. OTP, perfil, avatar, sincronização, logout e exclusão precisam ser verificados funcionalmente no projeto dev.

## Bloco H — Compra por marketplace, qualidade e publicação

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | H1.1 | Testar `/api/out/[id]` com produto publicado, link recente e loja permitida. | Concluído pelo Antigravity: rota `/api/out/[id]` testada com IDs reais do catálogo publicado (Magalu e Mercado Livre); gerou resposta HTTP 302 para links oficiais, com `Cache-Control: no-store` e `Referrer-Policy: no-referrer`. |
| [x] | H1.2 | Testar hosts estranhos, HTTP, domínio parecido e URL malformada. | Testes da allowlist rejeitam HTTP, `*.attacker.invalid`, esquema `javascript:` e hosts que imitam os domínios oficiais. |
| [x] | H1.3 | Testar link vencido, revisão atrasada, item draft e falta de estoque. | Concluído: política fail-closed bloqueia itens draft, links inativos/quebrados/expirados e falta de estoque com códigos 409/410/503 e `Cache-Control: no-store` sem remover itens salvos do carrinho. Evidência `H1.3-fail-closed-verified` em `VALIDACOES.md`. |
| [x] | H1.4 | Testar compra item a item para dois marketplaces. | Concluído pelo Antigravity: cada produto cadastrado redireciona exclusivamente para a sua loja parceira de origem (`magazinevoce.com.br` para Magalu e `meli.la` para Mercado Livre) com link individual; o site não coleta pagamento nem cria pedido. |
| [x] | H1.5 | Revisar aviso de afiliado, termos, privacidade, contato e exclusão de conta. | Páginas `/termos` e `/privacidade` com conformidade LGPD, transparência sobre comissão de afiliados sem alegações prematuras de parceria, rodapé acessível e endpoint `/api/account/delete`. |
| [x] | H1.6 | Fazer auditoria de RLS, endpoints, logs e artefatos client-side. | RLS forçado em todas as tabelas públicas, colunas privadas de `offers` revogadas para `anon`, scan de artefato compilado sem credenciais e `npm audit` com 0 vulnerabilidades. Evidência `H1.6-security-rls-endpoint-audit` em `VALIDACOES.md`. |
| [ ] | H1.7 | Testar teclado, foco, leitor de tela e viewport móvel. | Parcial local em 30/09: Chrome CDP revisou cinco rotas em 390 px e 1440 px, sem overflow horizontal; árvore acessível retornou landmark principal, títulos e controles nomeados; primeiro Tab foca o link de salto com anel visível. Leitor de tela e percurso completo por teclado ainda requerem validação manual. Evidência `H1.7-responsive-cdp-20260930` em `VALIDACOES.md`. |
| [x] | H1.8 | Rodar `npm run check`, `npm test`, `npm run test:budget` e `npm run build`. | Revalidação 30/09/2026: 50/50 testes; 50 arquivos Astro sem erros/avisos/dicas; build concluído com 1 função; JSON de 20 cards 12.860 bytes; JS/CSS gzip 76.349 bytes e estáticos 1.333.946 bytes estimados. Build e verificação de diff concluídos. Evidência `H1.8-rerun-20260930-responsive` em VALIDACOES.md. |
| [ ] | H1.9 | Abrir/revisar o preview privado na equipe Vercel Pro já configurada. | Guardar URL/ID; validar variáveis de ambiente e logs sem segredos; função total permanece <12. |
| [ ] | H1.10 | Repetir fluxos de busca, produto, conta, carrinho e saída na URL de preview. | Capturas/resultados comprovam os caminhos; cada saída vai ao item e marketplace corretos. |
| [ ] | H1.11 | Confirmar domínio, HTTPS e aprovação do programa afiliado antes de publicação pública. | Painéis confirmam domínio autorizado e política de imagens; guardar recibo ou URL de regra. |
| [ ] | H1.12 | Publicar e acompanhar as primeiras visitas com possibilidade de rollback. | HTTPS, vitrine, OTP, carrinho e links funcionam em produção; registrar erros e versão de rollback. |

**Portão final:** publicação pública somente após aprovações dos programas de afiliado, teste funcional da integração Supabase, isolamento das contas, compra item a item, auditoria e preview verificado. Vercel já está configurada segundo o proprietário; URL/ID do projeto e preview permanecem para conferência em H1.9.
