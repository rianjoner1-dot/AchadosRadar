# Plano de implantação — Achados Radar (vitrine de afiliados)

Atualizado em 29/09/2026. Estado: estrutura e implementação local em andamento. A conta Vercel Pro já está disponível; este site ainda não foi vinculado a um projeto Vercel nem a um projeto Supabase.

Execução em tarefas pequenas com validação: [etapas procedurais](site-afiliados/docs/ETAPAS_PROCEDURAIS.md).

## 1. Escopo e regra da compra

O site reúne ofertas de Magalu e Mercado Livre, com busca, página de produto, perfil e carrinho persistente. O carrinho é uma lista de interesse; não cobra, não reserva estoque e não cria pedido. O botão de cada item abre o checkout do marketplace correspondente com o link de afiliado conferido. Cada item é concluído separadamente. Uma futura operação própria com pagamento e dropshipping exigirá outro projeto de checkout, contratos e regras fiscais.

O robô fornece candidatos e observações. Só produtos com origem identificável, link de afiliado comprovado e permissão de divulgação entram na vitrine. Os dados observados são instantâneos; preço, frete, cupom e estoque finais são os mostrados pelo marketplace ao concluir a compra.

## 2. Decisões técnicas

| Área | Decisão inicial | Motivo / verificação |
| --- | --- | --- |
| Frontend | Astro com SSR para rotas dinâmicas, páginas de amostra pré-renderizadas e ilhas interativas em TypeScript | Busca, filtros, carrinho e feed usam `fetch`/AJAX sem recarregar a página; o bundle inicial deve permanecer pequeno. |
| Hospedagem | Vercel Pro existente; pasta `site-afiliados/` isolada | Adaptador Vercel e funções consolidadas; meta operacional ≤4 e limite rígido <12 funções no artefato final. |
| Banco | Supabase Postgres (Plano Gratuito), Auth e Storage leve | Catálogo e carrinho sincronizado com RLS. O banco armazena SOMENTE texto/metadados e URLs (zero arquivos ou binários no Postgres). |
| Login | Email com OTP ou magic link; senha dispensável | Telefone opcional no perfil, verificável se virar canal de login. Senha opcional fica para etapa futura; recuperação via email. SMTP próprio antes de abrir cadastro público. |
| CPF | Não solicitar no MVP | O site não fatura o pedido. CPF é informado ao marketplace se ele exigir. |
| Imagens e Mídia | URLs originais comprimidas ao máximo (WebP), carregamento sob demanda | Máxima compressão em toda a mídia exibida ao usuário para poupar tráfego e banco. Vitrine consome miniaturas otimizadas; galeria carrega sob demanda. Storage (avatares) limitado a <100 KB em WebP. |
| Busca | Postgres: texto normalizado sem acentos/pontuação + `pg_trgm` | Índices para aproximação; limites para consultas vagas e paginação por cursor. |
| Link | ID estável do produto, oferta e link versionados | Atualizar URL e status sem apagar o item do carrinho. Prazo de revisão não será anunciado como expiração comprovada. |

Fontes para limites e autenticação: [uso comercial na Vercel](https://vercel.com/docs/limits/fair-use-guidelines), [Vercel runtimes](https://vercel.com/docs/functions/runtimes), [limite de payload 4,5 MB](https://vercel.com/docs/functions/limitations), [Supabase Auth sem senha](https://supabase.com/docs/guides/auth/auth-email-passwordless), [limites de Auth](https://supabase.com/docs/guides/auth/rate-limits), [SMTP para produção](https://supabase.com/docs/guides/auth/auth-smtp).

## 3. Navegação e comportamento

1. **Início/vitrine:** categorias, cards com foto principal, preço observado, loja, horário da coleta, disponibilidade e selo de cupom apenas se confirmado. Primeira carga com 12–20 cards; novas páginas por cursor, `AbortController` e cache curto. Nada de baixar galeria inteira na vitrine.
2. **Busca e filtros:** aceitar palavras com acentos, hífens e pontuação; normalizar `brinco`/`brínco`, usar prefixo e trigramas com limiar medido. Filtros loja, faixa de preço, disponibilidade e ordenação por relevância/preço/recência. Debounce de ~250 ms, URL compartilhável e estado vazio claro.
3. **Produto:** foto principal → galeria sob demanda → preço, parcelas, cupom, frete condicionado ao CEP e estoque observado → aviso de atualização → botão da loja → feed infinito abaixo das informações. O feed usa cursor, `IntersectionObserver`, cancelamento de requisição e teto de elementos renderizados para não degradar o navegador.
4. **Carrinho:** guardar IDs estáveis e quantidade desejada apenas como anotação; sem soma de frete ou total de compra enganoso. Visitante usa `localStorage`; ao entrar, mescla com `cart_items` do Supabase. Produto esgotado ou link pendente permanece no carrinho com botão desativado, motivo e opção de revisar/abrir a página original.
5. **Saída para comprar:** uma rota `/api/out/[id]` lê a oferta atual, valida domínio permitido e estado do link, registra clique mínimo e redireciona. Se o link está pendente, apresentar página de revisão; nunca substituir link afiliado por URL comum silenciosamente. Abrir item por item, com aviso explícito de que a compra acontece fora do site.
6. **Compartilhar:** Web Share API quando disponível, senão copiar URL canônica do produto. Metadados Open Graph com foto autorizada e preço sem promessa de atualidade.
7. **Conta/perfil:** email verificado, nome público e avatar; telefone opcional e não público. Editar dados, sair, revogar sessões, excluir conta e dados associados. Se senha for habilitada depois, usar Supabase Auth e fluxo de redefinição oficial.

## 4. Modelo de dados proposto

- `products`: `id` UUID imutável, `platform`, `external_id`, `slug`, `title`, `brand`, `description`, `category`, `status`; `unique(platform, external_id)`.
- `product_images`: `product_id`, `position`, `source_url`, `source_host`, `alt`, `last_checked_at`; preservar ordem e todas as imagens válidas observadas na página de produto, sem download obrigatório.
- `offers`: `product_id`, `price numeric(12,2)`, `old_price`, `currency`, `installments_text`, `shipping_text`, `shipping_context`, `coupon_text`, `seller_name`, `seller_id`, `store_name`, `store_affiliate_id`, `stock_quantity integer null`, `stock_status`, `observed_at`, `source_url`. `null` significa quantidade desconhecida. Preservar `seller_id` e identificação da loja parceira.
- `affiliate_links`: `product_id`, `url`, `status` (`ready`, `review_due`, `invalid`, `pending_conversion`), `created_at`, `checked_at`, `refresh_due_at`, `expires_at null`, `verification_method`, `failure_reason`, `version`. `expires_at` só com prova da plataforma.
- `profiles`: `user_id` ligado a `auth.users`, `display_name`, `avatar_path`, `phone_e164 null`, `phone_verified_at null`. CPF ausente.
- `cart_items`: `user_id`, `product_id`, `added_at`, `note` e índice único `(user_id, product_id)`; FK de produto com `ON DELETE RESTRICT`.
- `import_runs`/`product_observations`: proveniência, horário, resultado, erro e amostra de campos para auditoria; sem credenciais e sem dados pessoais.
- `outbound_clicks`: contagem agregada/pseudônima, sem gravar CPF, telefone ou IP bruto.

Migrações versionadas em `site-afiliados/supabase/migrations/`. RLS: catálogo público apenas para leitura; escrita exclusivamente por importador confiável; perfil/carrinho só do proprietário; avatares graváveis só pelo dono, com MIME e tamanho controlados. Testar acesso permitido e negado para `anon`, usuário A, usuário B e importador. Índices: `(platform, external_id)`, `(status, observed_at)`, preço, categoria, busca normalizada/trigrama e cursores estáveis.

## 5. Robô, atualização e validade

Fluxo: coleta autorizada → extrai ID, todas as URLs de fotos da página interna, preço, parcelas, frete, cupom e disponibilidade → valida formato/proveniência → gera ou renova link pelo fluxo oficial disponível → grava observação local → importador idempotente atualiza Supabase pelo par `(platform, external_id)`.

O robô deve distinguir `stock_quantity = null` de zero; só registrar número visto explicitamente. Frete deve guardar contexto de CEP/localização ou ser exibido como estimativa sem CEP. Cupom recebe prazo quando a fonte informa. Produto de busca sem detalhes suficientes vai para revisão, sem inventar dados.

O prazo legado de sete dias do robô vira `refresh_due_at`, nunca `expires_at` factual. Verificar preferencialmente 48 horas antes, em lote pequeno e com limites por plataforma. Checar a página do produto, estoque e destino do link; uma resposta HTTP isolada não prova comissão. Se houver estoque e geração oficial possível, renovar e gravar versão; se faltar estoque, credencial ou verificação, marcar status e manter o produto/carrinho. Exibir contador **“próxima revisão em...”** quando o prazo é interno. Exibir **“link expira em...”** somente quando houver data de expiração informada pela plataforma. A janela de atribuição de comissão é diferente da validade do URL.

Até haver prova em sessão real de cada portal, o estado `ready` exige link gerado/confirmado e amostra de redirecionamento revisada. A extensão instalada precisa ser recarregada no Chrome após alteração local. As operações dos programas de afiliados e o uso das fotos no domínio próprio precisam de confirmação nas contas/termos antes de publicar.

## 6. Orçamento Vercel Pro e desempenho
 
- Meta operacional: até **4 funções serverless**, com limite rígido inferior a 12 no artefato final. SSR e rotas server-side devem ser agrupados pelo adaptador Vercel quando possível.
- **Orçamento de payload e transferência:** 4,5 MB é o limite documentado para payload de função, não um teto global de transferência do site. O objetivo do produto é manter cada resposta inicial abaixo de 5 MB, medir assets e imagens remotas separadamente e acompanhar cotas reais no painel Pro/Supabase:
  - **Zero binários no Postgres:** fotos e vídeos nunca são gravados no banco; apenas URLs e metadados leves.
  - **Compressão Máxima no Cliente:** miniaturas da vitrine servidas em formato comprimido WebP/AVIF (idealmente ≤ 30-50 KB por imagem de card).
  - Vitrine inicial consome ≤ 100 KB de JSON de dados brutos.
- Upload de avatares direto ao Supabase Storage (comprimidos no frontend antes do envio para WebP < 100 KB).
- Limitar polling: atualização apenas após foco da janela ou ação intencional do usuário, sem consultas em loop contínuo.

## 7. Etapas e aceite

| Etapa | Entrega | Aceite observável |
| --- | --- | --- |
| 0 — agora | Plano, pasta isolada, contrato e robô local ajustado | Arquivos no lugar; testes locais do extrator; sem deploy nem alteração de conta. |
| 1 | Confirmar permissões de Magalu/ML, domínio, identidade visual e projeto Supabase/Vercel | Evidência de elegibilidade do site e fotos; credenciais configuradas fora do Git. |
| 2 | Migrações, RLS e importador idempotente | Reimportar mesmo produto não duplica; usuário A não lê carrinho de B; produto inativo continua referenciável. |
| 3 | Vitrine, busca e produto | Busca `brimco` encontra variações pertinentes; paginação estável; fotos e detalhes com fonte/horário. |
| 4 | Auth, perfil e carrinho | Email OTP real, SMTP, upload avatar, mescla de carrinho e exclusão testados. |
| 5 | Saída item a item e ciclo de revisão | Link oficial validado em teste real; esgotado e link inválido permanecem no carrinho, sem redirecionamento enganoso. |
| 6 | Medição e publicação | Build/deploy com <12 funções, payload <4,5 MB, RLS validada, responsividade/acessibilidade e recibo de deploy/URL. |

## 8. Pendências externas para publicação

- Confirmar se as contas Magalu e Mercado Livre permitem divulgação em domínio próprio, uso das imagens e renovação automatizada; validar os links na conta efetivamente usada. Não presumir adesão ou comissão pelo formato de URL.
- Definir domínio e nome final; vincular este repositório à equipe Vercel Pro existente e conferir cotas no painel; configurar projeto Supabase e SMTP.
- Política de privacidade/LGPD, termos do site, aviso de links de afiliado, canal de contato e processo de exclusão de dados. Revisão jurídica antes da abertura pública.
- Definir frequência de coleta por loja com base na permissão e no custo, e amostras reais de produtos para calibrar os seletores da extensão.
