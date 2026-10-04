# Módulo de Busca e Setores (`src/modules/search/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Este módulo descreve e centraliza os conceitos e regras do motor de busca e classificação por setores do **Achados Radar**:
- **Trigramas (`pg_trgm`)**: Suporte a buscas aproximadas, tolerando pequenos erros de digitação (typos), variações de plural e acentuação brasileira (ex: `air fryer` / `airfryer`, `tenis` / `tênis`, `blazer`).
- **Filtro de Setores Independentes**: Slugs padronizados (`eletronicos`, `moda`, `moveis`, `pc-gamer`, `eletro`, `jardim`, `bebes`, `beleza`, `pet`, `casa`). A classificação por setor não substitui a query digitada pelo usuário.
- **Normalização de Entrada**: Remoção de diacríticos e caracteres especiais com preservação de palavras significativas.
- **Log Anônimo de Buscas**: Registro agregado das buscas mais frequentes para retroalimentar sugestões e tendências.

---

## 2. Relação com Outros Arquivos do Sistema

- Utilitários de busca no frontend: [src/modules/catalog/search-utils.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/search-utils.js)
- Mapeamento de requisição: [src/modules/catalog/search-request.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/search-request.js)
- Função RPC no banco: `supabase/migrations/20261001130000_catalog_sectors_and_search_v2.sql`
- Migração de agregação anônima: `supabase/migrations/20261002150000_aggregate_anonymous_searches.sql`

---

## 3. Documentação Detalhada

Para especificações completas de relevância, planos de indexação PostgreSQL e testes comparativos, consulte:
- [docs/BUSCA_E_SETORES.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/BUSCA_E_SETORES.md)
- [busca-setores-plano.md](file:///c:/Users/joner/Documents/associados/site-afiliados/busca-setores-plano.md)
- [docs/VALIDACOES_BUSCA_SETORES.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/VALIDACOES_BUSCA_SETORES.md)

---

## 4. Testes Associados

```bash
node --test tests/search_utils.test.cjs
node --test tests/catalog_search_request.test.cjs
node --test tests/anonymous_search_migration.test.cjs
```
