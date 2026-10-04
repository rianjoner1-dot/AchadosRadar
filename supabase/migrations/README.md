# Supabase migrations

These SQL files are the append-only schema history for the application. A file in this folder does not prove that it was applied to any hosted project; check the project migration history before applying it elsewhere.

`20261001130000_catalog_sectors_and_search_v2.sql` adds stable sector taxonomy and product assignments, a title/category classifier refreshed by catalog imports, and the `search_catalog_v2` RPC. It keeps `search_catalog` in place for frontend rollback. See [BUSCA_E_SETORES.md](../../docs/BUSCA_E_SETORES.md) for the API contract, matching behavior, security boundaries, and staged activation/rollback.

The local database suite in `tests/database_block_d.test.cjs` applies this migration after the current schema and validates classification, public RLS, search behavior, relevance, offer consistency, and five cursor pages. No hosted migration or deployment is implied by those tests.

## Correções de importação de 04/10/2026

`20261004135000_idempotent_offer_import.sql` impede que retries insiram novamente a mesma observação de oferta. Não remove observações antigas.

`20261004135500_restore_offer_cursor_grant.sql` preserva a leitura pública de offer.id necessária ao cursor depois que a migration de preços redefine permissões por coluna. seller_id continua privado.

20261004133000_supported_import_platforms.sql amplia a RPC para as cinco lojas suportadas e mantém a permissão exclusiva de service_role. 20261004134500_merge_gaming_sector.sql une gaming/hardware em eletronicos, migra vínculos e remove pc-gamer. Corrige a referência a uma categoria já removida que causava erro de chave estrangeira nas importações. Ambas foram aplicadas e registradas no projeto remoto nesta execução.
