# Supabase migrations

These SQL files are the append-only schema history for the application. A file in this folder does not prove that it was applied to any hosted project; check the project migration history before applying it elsewhere.

`20261001130000_catalog_sectors_and_search_v2.sql` adds stable sector taxonomy and product assignments, a title/category classifier refreshed by catalog imports, and the `search_catalog_v2` RPC. It keeps `search_catalog` in place for frontend rollback. See [BUSCA_E_SETORES.md](../../docs/BUSCA_E_SETORES.md) for the API contract, matching behavior, security boundaries, and staged activation/rollback.

The local database suite in `tests/database_block_d.test.cjs` applies this migration after the current schema and validates classification, public RLS, search behavior, relevance, offer consistency, and five cursor pages. No hosted migration or deployment is implied by those tests.
