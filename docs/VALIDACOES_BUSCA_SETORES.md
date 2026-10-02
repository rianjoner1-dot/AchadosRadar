# Evidências locais — busca e setores

**Data:** 01/10/2026  
**Escopo:** checkout local, banco efêmero PGlite e Chrome local com `PUBLIC_CATALOG_DEMO=true`.

**Revalidação do navegador (02/10/2026):** com Astro dev em `http://127.0.0.1:4352` e `PUBLIC_CATALOG_DEMO=true`, `verify-responsive.mjs` aprovou a rota `/` em 390, 768 e 1440 px, sem falhas de overflow ou diagnóstico. Em 390 px, busca por texto, loja, ordenação, preços mínimo/máximo, limpeza dos filtros e combinações setor + texto + loja + preço passaram; setor e busca permaneceram independentes, botão “Tudo” limpou apenas o setor e a seleção foi restaurada pela URL. Os viewports 768/1440 foram checados para layout/overflow sem repetir os fluxos interativos.

**Orçamento local (02/10/2026):** revalidação `npm run validate:local` concluiu Astro check (118 arquivos, 0 erros/avisos, 2 dicas preexistentes), build Vercel, testes 175/175, 1 função serverless e estimativa de transferência estática de 1.536.506 bytes (<5 MiB). Imagens remotas não entram nessa estimativa.

## Resultado

- Migration `20261001130000_catalog_sectors_and_search_v2.sql` aplicada pelo teste a um banco PostgreSQL efêmero.
- Cobertura de classificação: categoria original preservada; fallback pelo título; teclado gamer em `pc-gamer` e `eletronicos`; produto sem classificação mantido em “Tudo”; alteração posterior de título/categoria atualiza as atribuições derivadas.
- Cobertura da busca: acentos e pontuação; `air fryer`/`airfryer`; aliases fone/headphone; `brimco`; todas as palavras relevantes; negação de combinação sem relação; preferência de título sobre categoria.
- Segurança: associação de rascunho invisível por RLS anon; RPC só retorna produtos publicados; assinatura `SECURITY INVOKER` validada.
- Consistência: oferta mais recente por `observed_at DESC, id DESC`; preço e cursor seguem a mesma oferta; cinco páginas de vinte produtos, sem duplicatas nem omissões, com preços empatados e itens sem oferta.
- Navegador Chrome 390 px: `node scripts/verify-responsive.mjs http://127.0.0.1:4349 --routes=/ --viewports=390 --smoke-search --smoke-sectors --summary-only` aprovou busca, filtro de loja, mínimo/máximo, ordenação, combinação de setor/texto/loja/preço, botão “Tudo” e restauração da URL. Zero falhas de overflow/acessibilidade nesta rota.
- `npm run validate:local` em 02/10/2026: Astro check com 0 erros/0 avisos (2 dicas existentes); build Vercel aprovado; 175/175 testes; 1 função serverless; transferência estática estimada de 1.536.298 bytes, abaixo de 5 MiB.

### Revisao adicional do contrato de busca

- Paridade de sinônimos: `air fryer`, `airfryer` e `fritadeira` localizam produtos mesmo quando o título usa apenas uma dessas formas. Busca curta por `fone` não aceita a substring dentro de `telefone`; aliases fuzzy não ampliam palavras curtas sem correspondência exata/prefixo.
- Teste direcionado após esse ajuste: `node --test tests/database_block_d.test.cjs tests/search_utils.test.cjs tests/catalog_search_request.test.cjs` passou (11/11).

- Tokens curtos: `tv samsung` exige que `tv` apareca como palavra exata; consultas so com tokens curtos, como `55 tv` e `tv`, tambem usam palavras exatas e nao casam substrings arbitrarias.
- Classificacao: `painel solar` permanece sem setor de moveis tanto na migration quanto no catalogo de demonstracao; termos manuais sobrevivem a reclassificacao e uma conta autenticada comum nao pode gravar setores.
- A chamada AJAX valida o corpo nomeado da RPC v2: consulta, setor, loja, precos, ordenacao e cursor estavel, alem dos defaults para todos os setores.
- Validacao: `node --test tests/database_block_d.test.cjs` passou (8/8 suites de banco, incluindo migration v2, RLS, oferta empatada e cinco paginas).
- Desempenho remoto continua pendente: o roteiro [explain-catalog-search-v2.sql](../scripts/explain-catalog-search-v2.sql) executou em transação somente leitura no PGlite sintético, validando a sintaxe. Os planos, buffers e tempos representativos ainda precisam ser registrados no Supabase de desenvolvimento.
- O preflight remoto [preflight-catalog-search-v2.sql](../scripts/preflight-catalog-search-v2.sql) passou na verificação estática de leitura e cobertura de schema; não foi executado contra Supabase.

## Limites da evidência

O navegador foi forçado ao modo de demonstração e não acessou Supabase remoto. O teste de banco usa dados sintéticos efêmeros; não representa latência/carga do catálogo hospedado. Nenhuma migration remota ou publicação ocorreu. Nenhum índice de busca textual foi criado; medir em desenvolvimento com `EXPLAIN (ANALYZE, BUFFERS)` antes de adicionar esses índices. A nova RPC e o frontend precisam ser ativados em Supabase dev primeiro, após revisar os grants e a migration.
