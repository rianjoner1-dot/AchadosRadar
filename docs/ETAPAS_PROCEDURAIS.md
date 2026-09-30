# Etapas procedurais e validações — site de afiliados

Este roteiro desdobra o [plano principal](../../PLANO_SITE_AFILIADOS.md). Cada linha é uma entrega pequena. Marcar `[x]` somente depois de guardar a evidência em [`VALIDACOES.md`](VALIDACOES.md); se a validação falhar, corrigir antes de passar ao próximo bloco. Estado em 29/09/2026: preparação local. O proprietário já possui Vercel Pro; ainda não há deploy deste site nem projeto Supabase conectado.

## Como executar cada etapa

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
| [ ] | B1 | Verificar nos painéis Magalu e ML se esta conta pode divulgar links no domínio próprio. | Registrar texto/URL da regra aplicável e o status real da conta; sem presumir elegibilidade por link gerado. |
| [ ] | B2 | Confirmar uso das fotos originais e condição de atualização automatizada para cada programa. | Decisão por loja: URL direta, cópia autorizada ou bloqueio de publicação; anexar fonte da decisão. |
| [ ] | B3 | Gerar um link oficial de teste por loja no fluxo autorizado e conferir o destino. | URL pertence ao programa, abre o mesmo produto e mantém o identificador afiliado conforme o painel; registrar horário. |
| [ ] | B4 | Escolher domínio/nome e vincular `site-afiliados/` à equipe Vercel Pro existente. | Projeto associado à equipe correta no painel; registrar ID/URL de preview; sem publicação pública ainda. |
| [ ] | B5 | Criar projeto Supabase de desenvolvimento e configurar variáveis localmente. | URL/chave publicável funcionam; chave secreta só em ambiente confiável; nenhum segredo em Git ou bundle. |
| [ ] | B6 | Definir SMTP para email OTP e domínios de retorno de autenticação. | Email de teste chega e volta apenas para URL permitida; limites de envio observados. |

**Portão B:** se a divulgação no domínio ou as fotos não forem permitidas, ajustar o canal antes de montar a vitrine pública. B4–B6 exigem recibos dos painéis; não inferir sucesso por arquivo `.env`.

## Bloco C — Aplicação mínima e orçamento

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | C1 | Criar o projeto Astro/TypeScript dentro de `site-afiliados/`, sem importar código da Rozi por cópia cega. | `npm run build` gerou `dist/` com 22 páginas em 5s; varredura confirmou zero segredos no artefato. |
| [x] | C2 | Configurar layout, roteamento e componentes base acessíveis. | Navegação por teclado, foco visível e 0 elementos transbordando em 360 px (`preview_mobile_360px_1790716798740.png`); rotas `/carrinho` (sem checkout) e `/produto/:id` (`preview_desktop_product_1790716854407.png`) validadas. |
| [x] | C3 | Criar verificador de quantidade de funções no artefato Vercel. | `scripts/verify-functions.cjs` implementado: 0 funções no momento (meta ≤ 4, limite rígido < 12). |
| [x] | C4 | Criar verificador do JSON da vitrine e de todo o artefato estatico local. | `scripts/verify-payload.cjs` exige JSON dos 20 cards <=100 KB e soma todos os arquivos locais em `.vercel/output/static` <=5 MiB; texto usa estimativa gzip e binarios contam em tamanho bruto. Fotos externas e HTML da rota SSR dinamica exigem medicao no preview. |

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
| [ ] | E1.2 | Rodar `node scripts/import-catalog.mjs data/catalogo_macro.json --dry-run --summary --platform=magalu --limit=1` e repetir para `mercadolivre`. | Cada amostra avaliada sem rede/escrita; export mostra motivo claro se link/estoque ainda não permitem publicação. |
| [ ] | E1.3 | Conferir mapeamento das fotos, estoque, parcela, frete, cupom e timestamps. | Comparar JSON de entrada com relatório normalizado; ausência vira `null`, sem inventar valores. |
| [ ] | E1.4 | Corrigir mapeamentos ausentes da macro e repetir dry-run. | Magalu/ML preservam todas as URLs de imagem permitidas em ordem e os campos financeiros observados. |
| [ ] | E1.5 | Criar Supabase dev e aplicar migrations em ordem, sem usar produção. | Migration history limpa; tabelas, RLS, RPC e bucket aparecem no projeto dev. |
| [ ] | E1.6 | Importar somente os dois itens de amostra. | Consulta ao banco mostra IDs externos, UUIDs, imagens ordenadas, oferta e link; nenhum segredo no log. |
| [ ] | E1.7 | Reimportar os mesmos itens e depois alterar preço/link de um item. | Não duplica produto; UUID e itens do carrinho persistem; nova observação/oferta fica registrada. |
| [ ] | E1.8 | Rodar casos de esgotado, link inválido, falha de coleta e estoque desconhecido. | Item permanece no catálogo/carrinho; estado impede redirecionamento e registra motivo/horário. |
| [ ] | E1.9 | Fazer ciclo de renovação de link com um único produto em sessão real do Chrome. | ID, disponibilidade e destino do link são reconferidos; resultado local e Supabase coincidem. |
| [ ] | E1.10 | Na extensão, validar produto novo, registro legado e link com expiração oficial informada. | `refreshDueAt` aparece como revisão interna; `linkExpiresAt` somente aparece como expiração quando vier da fonte oficial; revisar não remove o produto nem o carrinho. |

**Portão E:** nenhum item fica `ready` só por responder HTTP 200. Passa com import idempotente, estoque conferido, URL oficial e recibo real do Supabase.

## Bloco F — Vitrine, busca e página do produto

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [x] | F1.1 | Medir build e arquivos estaticos iniciais; conferir quantidade de funcoes no artefato Vercel. | Build Astro/Vercel revalidado em 29/09/2026: 1 funcao; assets JS/CSS gzip estimados em 75.357 bytes; JSON da fixture de 20 cards em 12.860 bytes; artefato estatico local estimado em 152.913 bytes. Fotos externas e HTML SSR nao estao incluidos. |
| [x] | F1.2 | Abrir a vitrine sem configuração de banco e conferir estado demonstrativo. | Navegador confirmou aviso de demonstração e amostras sem links ativos; botões de compra nas páginas de exemplo ficam desativados. |
| [ ] | F1.3 | Conectar vitrine ao Supabase dev e limitar primeira consulta a 20 produtos. | Network mostra só primeira página e um thumbnail por card; registrar tempo e bytes transferidos. |
| [ ] | F1.4 | Validar paginação AJAX por cursor e estados de carregamento, erro e lista vazia. | Duas páginas sem repetição/salto; resposta antiga abortada não sobrescreve filtro novo. |
| [x] | F1.5 | Validar normalizacao de busca sem acentos e pontuacao. | Teste PGlite confirmou brinco, brimco, versao com acento e versao com hifen retornando os mesmos dois produtos de teste. |
| [x] | F1.6 | Ajustar limiar de aproximacao e validar consultas sem correspondencia. | Limiar trigram ajustado para 0.4; teste confirma erro proximo brimco, rejeita termo distante zzzxqv e exclui o falso positivo Capa Banco Xre. |
| [x] | F1.7 | Testar filtros de loja, faixa de preço e ordenação, sincronizados com URL. | Teste PGlite confirma filtro de loja e limites de preço inclusivos; sincronização da URL foi validada na interface local. |
| [ ] | F1.8 | Abrir produto e validar fotos em ordem com carregamento sob demanda. | Galeria completa é alcançável; imagem fora da primeira dobra só baixa ao solicitar/rolar. |
| [ ] | F1.9 | Validar detalhes extraídos: parcelas, frete, cupom, estoque e observado em. | Dado desconhecido informa consulta na loja; frete condicionado a CEP não aparece como universal. |
| [ ] | F1.10 | Rolar feed relacionado por cinco páginas. | Sem repetição, rajada ou crescimento ilimitado do DOM; carregamento também é acionável por teclado. |
| [ ] | F1.11 | Testar compartilhar/copiar URL e metadados Open Graph. | Link abre o mesmo produto; imagem está autorizada; metadados não prometem preço fixo. |
| [ ] | F1.12 | Medir em viewport móvel e desktop com rede limitada. | Registrar bytes, número de requisições e LCP/INP/CLS; explicar separadamente imagens remotas de terceiros. |

**Portão F:** consulta dinâmica, busca aproximada, URL compartilhável, galeria e feed passam em dev; transferência medida e orçamento Vercel documentados.

## Bloco G — Conta, perfil e carrinho

O método escolhido é email OTP sem senha obrigatória. CPF não será coletado no cadastro inicial; telefone fica opcional. Isso reduz dados sensíveis e atende ao fluxo sem senha solicitado. Recuperação de acesso é novo OTP; senha só entra se houver decisão futura por login híbrido.

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [ ] | G1.1 | Configurar SMTP e URLs permitidas no Supabase dev. | Email de teste chega; link/código só redireciona às origens cadastradas. |
| [ ] | G1.2 | Fazer cadastro/login por email OTP, incluindo código incorreto e expirado. | Correto autentica; incorreto/expirado falha com mensagem útil; sem sessão válida não cria perfil. |
| [ ] | G1.3 | Editar nome e telefone opcional; sair e entrar de novo. | Valores persistem; telefone não aparece em páginas públicas nem logs. |
| [ ] | G1.4 | Enviar avatar JPG/PNG/WebP válido e depois arquivo inválido/grande. | Avatar válido aparece após recarga; tipo não permitido e arquivo acima do limite são recusados. |
| [ ] | G1.5 | Adicionar dois produtos ao carrinho anônimo e recarregar. | Os dois IDs persistem; preço/link alterados não removem itens salvos. |
| [ ] | G1.6 | Entrar com carrinho local e itens remotos, incluindo produto repetido. | Mescla sem duplicata; quantidades/regras documentadas; estado permanece após nova sessão. |
| [ ] | G1.7 | Sair e trocar para outro usuário no mesmo navegador. | Segundo usuário não vê o carrinho privado do primeiro; carrinho anônimo permanece isolado. |
| [ ] | G1.8 | Remover um item e limpar o carrinho com usuário autenticado. | Remoção local e remota concordam após recarregar e relogar. |
| [ ] | G1.9 | Revogar sessão e testar perfil/carrinho novamente. | Chamadas protegidas negadas; nova autenticação OTP restaura acesso legítimo. |
| [ ] | G1.10 | Excluir conta de teste e avatar associado. | Conta, avatar e carrinho deixam de ser acessíveis conforme política; registrar resultado sem PII. |

**Portão G:** dois usuários de teste confirmam isolamento por RLS e sessão; OTP, perfil, avatar, sincronização, logout e exclusão verificados no Supabase dev.

## Bloco H — Compra por marketplace, qualidade e publicação

| Feito | Passo | Procedimento | Validação / evidência |
| --- | --- | --- | --- |
| [ ] | H1.1 | Testar `/api/out/[id]` com produto publicado, link recente e loja permitida. | Redireciona ao produto afiliado correto; resposta não fica em cache compartilhado. |
| [x] | H1.2 | Testar hosts estranhos, HTTP, domínio parecido e URL malformada. | Testes da allowlist rejeitam HTTP, `*.attacker.invalid`, esquema `javascript:` e hosts que imitam os domínios oficiais. |
| [ ] | H1.3 | Testar link vencido, revisão atrasada, item draft e falta de estoque. | Saída bloqueada com estado explicativo; produto continua no carrinho. |
| [ ] | H1.4 | Testar compra item a item para dois marketplaces. | Cada botão abre o marketplace correspondente; site não coleta pagamento nem cria pedido. |
| [ ] | H1.5 | Revisar aviso de afiliado, termos, privacidade, contato e exclusão de conta. | Rodapé acessível; conteúdo corresponde aos dados e integrações ativas. |
| [ ] | H1.6 | Fazer auditoria de RLS, endpoints, logs e artefatos client-side. | Acesso cruzado negado; service role/segredos ausentes de bundles, respostas e logs. |
| [ ] | H1.7 | Testar teclado, foco, leitor de tela e viewport móvel. | Busca, cartões, galeria, perfil e carrinho operáveis sem mouse e com rótulos compreensíveis. |
| [x] | H1.8 | Rodar `npm run check`, `npm test`, `npm run test:budget` e `npm run build`. | Todos passam; evidência H1.8-privacy-build em VALIDACOES.md: 1 função, 153.104 bytes estimados e build concluído. |
| [ ] | H1.9 | Criar preview privado na equipe Vercel Pro existente. | Guardar URL/ID; validar variáveis de ambiente e logs sem segredos; função total permanece <12. |
| [ ] | H1.10 | Repetir fluxos de busca, produto, conta, carrinho e saída na URL de preview. | Capturas/resultados comprovam os caminhos; cada saída vai ao item e marketplace corretos. |
| [ ] | H1.11 | Confirmar domínio, HTTPS e aprovação do programa afiliado antes de publicação pública. | Painéis confirmam domínio autorizado e política de imagens; guardar recibo ou URL de regra. |
| [ ] | H1.12 | Publicar e acompanhar as primeiras visitas com possibilidade de rollback. | HTTPS, vitrine, OTP, carrinho e links funcionam em produção; registrar erros e versão de rollback. |

**Portão final:** publicação pública somente após aprovações dos programas de afiliado, dados reais de dev, isolamento das contas, compra item a item, auditoria e preview verificado. Vercel Pro já está disponível; B4 limita-se a conferir a equipe/projeto correto.

**Portão final:** publicar só quando A–H estiverem validados. Se um programa restringir domínio, imagens ou coleta, adequar esse canal antes da publicação correspondente. O Pro já foi informado pelo proprietário; no passo B4 basta conferir a equipe correta no painel.
