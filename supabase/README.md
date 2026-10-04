# Banco de Dados e Migrações Supabase (`supabase/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas tabelas, colunas, RPCs ou RLS criadas. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Contém a infraestrutura como código (IaC) do banco de dados relacional PostgreSQL do **Achados Radar**, hospedado no Supabase:
- **Tabelas Core**: `products`, `product_images`, `offers`, `affiliate_links`.
- **Área do Usuário**: `profiles`, `cart_items` (com `ON DELETE RESTRICT` para integridade referencial).
- **Segurança Rigorosa**: Row Level Security (RLS) ativado em todas as tabelas públicas.
- **Funções Armazenadas (RPCs)**:
  - `search_catalog_v2`: Busca rápida com trigramas e filtros de setor.
  - `import_catalog_item`: Inserção/atualização atômica exclusiva para `service_role`.
  - `archive_missing_product`: Arquivamento seguro de produtos confirmados como inexistentes.
  - `get_admin_metrics`: Leitura restrita de telemetria por papel administrativo.

---

## 2. Inventário de Migrações (`supabase/migrations/`)

O inventário local contém 29 migrações. A migração `20261003100000_product_observed_ratings_and_specs.sql` adiciona `products.rating`, `products.reviews_count` e `products.specifications` com constraints e estende `import_catalog_item` para persistir fatos observados, preservando os valores existentes em atualizações parciais. Ela ainda precisa ser aplicada e verificada no projeto remoto antes de os novos campos aparecerem em produção.

Todas as migrações são estritamente versionadas por timestamp `YYYYMMDDHHMMSS`:
- `20260929180000_create_products_and_images.sql`: Criação das tabelas centrais de catálogo.
- `20260929180100_create_offers_and_links.sql`: Tabela de ofertas, histórico de preços e links de afiliados.
- `20260929180200_create_profiles_and_cart.sql`: Tabela de usuários e lista de compras.
- `20260929180300_enable_rls_and_policies.sql`: Habilitação e regras estritas de RLS.
- `20260929180400_storage_avatars_bucket.sql`: Configuração do bucket `avatars` no Storage.
- `20260929180500_create_indices_and_functions.sql`: Índices e normalização de texto.
- `20260929180600_auth_profile_and_cart_triggers.sql`: Triggers de perfil e integridade de carrinho.
- `20260930100000` a `20260930230000`: Refinamento de busca aproximada, métricas diárias, fotos estáveis e arquivamento de ofertas.
- `20261001130000_catalog_sectors_and_search_v2.sql`: Implementação oficial dos setores de vitrine e RPC `search_catalog_v2`.
- `20261002140000_search_logs.sql`: Registro de logs anônimos de busca.
- `20261002150000_aggregate_anonymous_searches.sql`: Agregação de termos mais populares de pesquisa.

---

## 3. Regras de Ouro de Segurança

1. **Service Role Isolado**: Funções com `SECURITY DEFINER` e escrita no catálogo exigem verificação `IF auth.role() <> 'service_role' THEN RAISE EXCEPTION ...`.
2. **Nenhuma Chave no Frontend**: Apenas a chave pública `anon` é permitida no Astro.
3. **Auditoria de Migrações**: Ao criar uma nova migração SQL em `supabase/migrations/`, atualize também [scripts/verify-remote-schema.sql](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/verify-remote-schema.sql), pois ele audita a contagem exata de migrações e é testado em `tests/migration_inventory.test.cjs`.

---

## 4. Testes de Banco de Dados

`20261004160000_materialize_catalog_search.sql` evita recalcular os ranks de palavras e os escores repetidamente. Preserva assinatura, permissões, RLS, relevância e paginação. Aplicada no projeto remoto: buscas públicas por monitor/teclado passaram de HTTP 500 (timeout 57014) para HTTP 200.

Todas as migrações são executadas em memória via **PGlite** para validação instantânea sem precisar de rede:
```bash
node --test tests/database_block_d.test.cjs
node --test tests/migration_inventory.test.cjs
node --test tests/anonymous_search_migration.test.cjs
```
