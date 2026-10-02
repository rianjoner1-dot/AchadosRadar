# Busca do catálogo e filtros por setor

## Contrato

A vitrine usa a RPC `public.search_catalog_v2`. Os filtros têm responsabilidades separadas:

- `search_query`: texto digitado pelo visitante;
- `target_sector`: um slug estável da tabela `catalog_sectors`;
- `target_platform`, `min_price`, `max_price` e `sort_by`: filtros de loja, preço e ordenação;
- `cursor_created_at`, `cursor_id`, `cursor_price` e `cursor_score`: cursor da página anterior;
- `page_size`: limite solicitado, sempre reduzido a no máximo 20.

A resposta inclui categoria original, setores atribuídos, no máximo uma imagem, a oferta mais recente e seu `search_score`. O link afiliado público retorna apenas estado e datas; o destino continua protegido pelo fluxo existente.

## Classificação

| Slug | Nome | Exemplos de classificação |
| --- | --- | --- |
| `eletronicos` | Eletrônicos | celulares, fones, TVs, computadores e periféricos |
| `moda` | Moda | roupas, bolsas e calçados |
| `moveis` | Móveis | sofá, rack, cama, mesa e armário |
| `pc-gamer` | PC Gamer | produtos gamer e periféricos gamer |
| `eletro` | Eletro | eletrodomésticos e portáteis, incluindo fritadeiras |
| `jardim` | Jardim | plantas, piscina e jardinagem |
| `bebes` | Bebês | carrinho, berço, fralda e acessórios infantis |
| `beleza` | Beleza | perfume, maquiagem e cuidados pessoais |
| `pet` | Pet | ração, itens para cães e gatos |
| `casa` | Casa | cozinha, limpeza, decoração e utilidades |

A classificação busca termos normalizados na categoria original e no título. Se ambos identificarem um setor, a categoria tem precedência na origem registrada. Produtos podem pertencer a vários setores; por exemplo, teclado gamer pode aparecer em `pc-gamer` e `eletronicos`. Produtos sem correspondência permanecem no catálogo e aparecem quando nenhum setor específico é aplicado. O gatilho atualiza atribuições derivadas após inserção ou alteração do título/categoria pelo importador; atribuições `manual` são preservadas.

## Semântica da busca

- A busca ignora caixa, acentos e pontuação.
- Para consultas com palavras relevantes (três ou mais caracteres), todas precisam corresponder ao título ou à categoria por palavra exata, prefixo ou aproximação de trigramas a partir de cinco caracteres. A aproximação exige pelo menos `0.4`; termos curtos não usam aproximação.
- A forma compacta permite que `air fryer` e `airfryer` encontrem a mesma oferta. Há equivalências explícitas para celular/smartphone, fone/headphone/headset/earbud, geladeira/refrigerador e airfryer/fritadeira.
- Tokens menores que tres caracteres nao aceitam aproximacao: em consultas mistas, cada um deve aparecer como palavra exata no titulo/categoria; em consultas compostas apenas por tokens curtos, todos devem aparecer exatamente, sem exigir a mesma ordem.
- A pontuação favorece a expressão exata no título, depois todos os termos exatos no título ou distribuídos entre título/categoria, resultados exatos apenas pela categoria e, por fim, prefixos e aproximações. Consultas com palavras diferentes exigem correspondência para cada palavra relevante.

## Ordenação, filtros e paginação

A mesma oferta mais recente (`observed_at DESC, id DESC`) alimenta preço, limites mínimo/máximo, ordenação e JSON. Em empate de preço, a página continua pela relevância, data e UUID; preço nulo fica no fim em ambas as ordenações. A vitrine mistura marketplaces somente no feed recente sem texto digitado. Uma busca textual usa a ordenação global de relevância. Qualquer mudança de filtro aborta o pedido anterior e reinicia cursores/buffers.

O parâmetro `setor` é mantido na URL (`/?setor=moda&q=blazer`), restaura o botão selecionado após recarga e não altera o texto da busca. A demonstração local aplica os mesmos slugs e combina os filtros no cliente.

## Segurança e implantação

`search_catalog_v2` é `SECURITY INVOKER`. A leitura pública das associações é limitada a produtos publicados por RLS. Apenas a classificação `manual` ou derivada feita por importadores/admins pode ser gravada por usuários autenticados; o importador confiável continua usando o `service_role`. A RPC anterior permanece disponível durante a transição.

Ordem de ativação: validar a migration num banco local/de desenvolvimento; aplicar a migration no Supabase de desenvolvimento; confirmar a assinatura e grants anon; publicar o frontend que chama `search_catalog_v2`; só então considerar produção. Esta implementação local não executou migration remota nem deploy.

Reversão de frontend: voltar a chamada para `search_catalog`, remover o campo de setor do request e ocultar os botões de setor até a próxima ativação. Não apagar as tabelas de setores como rollback automático: isso apagaria atribuições manuais que possam ser adicionadas depois. A RPC v1 não foi removida.

Resultados de teste local e limites da validação estão em [VALIDACOES_BUSCA_SETORES.md](VALIDACOES_BUSCA_SETORES.md) e registrados no índice [VALIDACOES.md](VALIDACOES.md).

Antes de aplicar no Supabase de desenvolvimento, use o preflight somente leitura [preflight-catalog-search-v2.sql](../scripts/preflight-catalog-search-v2.sql) para conferir as tabelas, assinatura RPC, migrações e cobertura das categorias. Depois, verifique as permissões/RLS e o número de setores com [verify-remote-schema.sql](../scripts/verify-remote-schema.sql), e meça v1/v2 com [explain-catalog-search-v2.sql](../scripts/explain-catalog-search-v2.sql). Esses roteiros são para desenvolvimento e não substituem aprovação nem deploy.
