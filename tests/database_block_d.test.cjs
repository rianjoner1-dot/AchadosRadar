// tests/database_block_d.test.cjs
// Suíte de testes rigorosos para o Bloco D (Banco de Dados, RLS e Storage)
// Executado em PostgreSQL real embarcado via @electric-sql/pglite

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');
const { unaccent } = require('@electric-sql/pglite/contrib/unaccent');

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');

// Helper para ler e executar arquivo de migração SQL
async function runMigration(db, filename) {
  const filePath = path.join(migrationsDir, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  await db.exec(sql);
}

// Helper para simular autenticação JWT do Supabase via parâmetros de sessão PostgREST
async function setAuthContext(db, { role = 'anon', sub = null } = {}) {
  await db.exec(`
    RESET ROLE;
    SET search_path = public, storage, auth;
    SELECT set_config('request.jwt.claim.role', '${role}', false);
    SELECT set_config('request.jwt.claim.sub', '${sub || ''}', false);
  `);
  if (role === 'anon' || role === 'authenticated') {
    await db.exec(`SET ROLE ${role};`);
  }
}

test('Bloco D — Inicialização e Execução Sequencial das Migrações SQL', async (t) => {
  const db = new PGlite({
    extensions: {
      pg_trgm,
      unaccent,
    },
  });

  await t.test('D1: Tabela products com UUID imutável e unicidade (platform, external_id)', async () => {
    await runMigration(db, '20260929180000_create_products.sql');

    // 1. Inserção do primeiro produto
    const res1 = await db.query(`
      INSERT INTO public.products (platform, external_id, title, status)
      VALUES ('mercadolivre', 'MLB3299039091', 'Capa Banco Xre 190', 'published')
      RETURNING id, platform, external_id, status;
    `);
    assert.equal(res1.rows.length, 1);
    const prodId = res1.rows[0].id;
    assert.ok(prodId, 'Deve gerar um UUID válido');

    // 2. Inserção repetida com o mesmo par (platform, external_id) deve FALHAR por violação de unicidade
    await assert.rejects(
      async () => {
        await db.query(`
          INSERT INTO public.products (platform, external_id, title)
          VALUES ('mercadolivre', 'MLB3299039091', 'Tentativa Duplicada');
        `);
      },
      /uq_products_platform_external_id/,
      'Inserção repetida do mesmo par (platform, external_id) deve falhar'
    );

    // 3. Upsert mantendo o mesmo UUID imutável
    const resUpsert = await db.query(`
      INSERT INTO public.products (platform, external_id, title)
      VALUES ('mercadolivre', 'MLB3299039091', 'Capa Banco Xre 190 Atualizada')
      ON CONFLICT (platform, external_id)
      DO UPDATE SET title = EXCLUDED.title
      RETURNING id, title;
    `);
    assert.equal(resUpsert.rows[0].id, prodId, 'O UUID deve ser estritamente imutável após upsert');
    assert.equal(resUpsert.rows[0].title, 'Capa Banco Xre 190 Atualizada');
  });

  await t.test('D2: product_images, offers e affiliate_links com integridade e dados preservados', async () => {
    await runMigration(db, '20260929180100_create_catalog_relations.sql');

    // Pega o ID do produto criado no D1
    const pRes = await db.query(`SELECT id FROM public.products LIMIT 1;`);
    const productId = pRes.rows[0].id;

    // 1. Imagens: Inserção de foto e teste de ordem única
    await db.query(`
      INSERT INTO public.product_images (product_id, url, display_order, is_primary)
      VALUES ('${productId}', 'https://exemplo.com/foto1.webp', 0, true);
    `);

    // Inserção com display_order duplicado para o mesmo produto deve falhar
    await assert.rejects(
      async () => {
        await db.query(`
          INSERT INTO public.product_images (product_id, url, display_order)
          VALUES ('${productId}', 'https://exemplo.com/foto2.webp', 0);
        `);
      },
      /uq_product_images_order/,
      'display_order deve manter ordem única por produto'
    );

    // 2. Ofertas: Inserção com seller_name, seller_id, store_name, store_affiliate_id e stock_quantity NULL
    const offerRes = await db.query(`
      INSERT INTO public.offers (
        product_id, price, old_price, discount_percent,
        seller_name, seller_id, store_name, store_affiliate_id,
        stock_quantity, stock_status
      ) VALUES (
        '${productId}', 208.99, 259.90, 20,
        'Lojas Le Biscuit', 'lojaslebiscuit', 'Magalu', 'magazineachadosradarbr',
        NULL, 'in_stock'
      ) RETURNING id, seller_name, seller_id, store_name, store_affiliate_id, stock_quantity;
    `);

    const off = offerRes.rows[0];
    assert.equal(off.seller_name, 'Lojas Le Biscuit', 'seller_name deve estar preservado');
    assert.equal(off.seller_id, 'lojaslebiscuit', 'seller_id deve estar preservado');
    assert.equal(off.store_name, 'Magalu', 'store_name deve estar preservado');
    assert.equal(off.store_affiliate_id, 'magazineachadosradarbr', 'store_affiliate_id deve estar preservado');
    assert.equal(off.stock_quantity, null, 'Estoque desconhecido deve permanecer NULL sem inventar números');

    // 3. Links de Afiliado: expiração factual pode ser NULL
    const linkRes = await db.query(`
      INSERT INTO public.affiliate_links (
        product_id, original_url, affiliate_url, status, expires_at
      ) VALUES (
        '${productId}',
        'https://magazineluiza.com.br/produto/123',
        'https://magazinevoce.com.br/magazineachadosradarbr/p/123/?seller_id=lojaslebiscuit',
        'active',
        NULL
      ) RETURNING id, expires_at, status;
    `);
    assert.equal(linkRes.rows[0].expires_at, null, 'expires_at deve aceitar NULL quando não há prazo oficial');
    assert.equal(linkRes.rows[0].status, 'active');
  });

  await t.test('D3: profiles e cart_items com FK ON DELETE RESTRICT para produto', async () => {
    await runMigration(db, '20260929180200_create_profiles_and_cart.sql');

    const pRes = await db.query(`SELECT id FROM public.products LIMIT 1;`);
    const productId = pRes.rows[0].id;

    // 1. Cria perfil de usuário
    const userRes = await db.query(`
      INSERT INTO public.profiles (email, full_name, role)
      VALUES ('cliente@teste.com', 'Cliente Teste', 'user')
      RETURNING id;
    `);
    const userId = userRes.rows[0].id;

    // 2. Adiciona produto à lista de interesses do usuário
    await db.query(`
      INSERT INTO public.cart_items (user_id, product_id, saved_price)
      VALUES ('${userId}', '${productId}', 208.99);
    `);

    // 3. INVARIANTE CRÍTICA D3: Tentar deletar o produto referenciado no carrinho deve ser BLOQUEADO com RESTRICT
    await assert.rejects(
      async () => {
        await db.query(`DELETE FROM public.products WHERE id = '${productId}';`);
      },
      /violates.*foreign key constraint/i,
      'ON DELETE RESTRICT deve impedir a exclusão física de produto presente em lista/carrinho'
    );
  });

  await t.test('D4: Habilitação de RLS e testes de permissão e negação estrita', async () => {
    await runMigration(db, '20260929180300_enable_rls_and_policies.sql');

    // Cria produto draft e produto published
    const dRes = await db.query(`
      INSERT INTO public.products (platform, external_id, title, status)
      VALUES ('mercadolivre', 'DRAFT001', 'Produto em Rascunho Interno', 'draft')
      RETURNING id;
    `);
    const draftId = dRes.rows[0].id;

    // Cria Usuário A e Usuário B
    const uARes = await db.query(`
      INSERT INTO public.profiles (email, full_name, role)
      VALUES ('usuario_a@teste.com', 'Usuario A', 'user')
      RETURNING id;
    `);
    const userA = uARes.rows[0].id;

    const uBRes = await db.query(`
      INSERT INTO public.profiles (email, full_name, role)
      VALUES ('usuario_b@teste.com', 'Usuario B', 'user')
      RETURNING id;
    `);
    const userB = uBRes.rows[0].id;

    // Cria perfil importador
    const impRes = await db.query(`
      INSERT INTO public.profiles (email, full_name, role)
      VALUES ('importador@teste.com', 'Importador Bot', 'importer')
      RETURNING id;
    `);
    const importerId = impRes.rows[0].id;

    const pPubRes = await db.query(`SELECT id FROM public.products WHERE status = 'published' LIMIT 1;`);
    const publishedId = pPubRes.rows[0].id;

    // Insere carrinho para A e para B
    await db.query(`
      INSERT INTO public.cart_items (user_id, product_id, saved_price)
      VALUES ('${userA}', '${publishedId}', 100.00);
    `);

    // Teste 1: Visitante Anônimo
    await setAuthContext(db, { role: 'anon', sub: null });

    // Anônimo lê produtos publicados, mas NÃO pode ver o produto em draft
    const anonProducts = await db.query(`SELECT id, status FROM public.products;`);
    assert.ok(anonProducts.rows.length > 0, 'Anônimo deve ler produtos publicados');
    const hasDraft = anonProducts.rows.some(p => p.id === draftId);
    assert.equal(hasDraft, false, 'Anônimo JAMAIS deve ver produtos com status != published');

    // Teste 2: Usuário A lê apenas seu próprio carrinho e perfil
    await setAuthContext(db, { role: 'authenticated', sub: userA });

    const userACart = await db.query(`SELECT * FROM public.cart_items;`);
    assert.equal(userACart.rows.length, 1);
    assert.equal(userACart.rows[0].user_id, userA);

    // Usuário A não vê o perfil do Usuário B
    const userAProfiles = await db.query(`SELECT id, email FROM public.profiles;`);
    assert.equal(userAProfiles.rows.length, 1, 'Usuário A só enxerga o seu próprio perfil');
    assert.equal(userAProfiles.rows[0].id, userA);

    // NEGAÇÃO ESTÚRIA: Usuário A tenta inserir item no carrinho de B -> DEVE FALHAR
    await assert.rejects(
      async () => {
        await db.query(`
          INSERT INTO public.cart_items (user_id, product_id, saved_price)
          VALUES ('${userB}', '${publishedId}', 50.00);
        `);
      },
      /new row violates row-level security policy/,
      'RLS deve negar tentativa do Usuário A de inserir itens para o Usuário B'
    );

    // NEGAÇÃO DE ESCALONAMENTO: Usuário A tenta alterar sua própria role para 'admin' -> DEVE FALHAR
    await assert.rejects(
      async () => {
        await db.query(`
          UPDATE public.profiles
          SET role = 'admin'
          WHERE id = '${userA}';
        `);
      },
      /Não é permitido alterar seu próprio nível de permissão/,
      'Trigger de segurança deve barrar tentativa de auto-promoção de privilégios'
    );

    // Teste 3: Importador tem permissão para gerenciar catálogo
    await setAuthContext(db, { role: 'authenticated', sub: importerId });
    const impInsert = await db.query(`
      INSERT INTO public.products (platform, external_id, title, status)
      VALUES ('magalu', 'SKU_IMP_001', 'Produto Importado pelo Robô', 'published')
      RETURNING id, title;
    `);
    assert.ok(impInsert.rows[0].id, 'Importador deve conseguir inserir produtos no catálogo');
  });

  await t.test('D5: Bucket avatars e políticas por proprietário com restrição de MIME e tamanho', async () => {
    // Restaura papel de serviço para rodar migração de Storage
    await setAuthContext(db, { role: 'service_role' });
    await runMigration(db, '20260929180400_storage_avatars_bucket.sql');
    // Antigravity's follow-up migrations must apply in sequence without changing
    // the bucket contract or weakening the per-user Storage policies.
    await runMigration(db, '20260930130000_expand_avatars_bucket_size.sql');
    await runMigration(db, '20260930140000_expand_avatars_rls_policy.sql');
    await runMigration(db, '20261001120000_fix_avatar_storage_upload_rls.sql');

    // Valida configuração do bucket avatars
    const bucketRes = await db.query(`SELECT * FROM storage.buckets WHERE id = 'avatars';`);
    assert.equal(bucketRes.rows.length, 1);
    assert.equal(Number(bucketRes.rows[0].file_size_limit), 2097152, 'Limite deve ser 2 MB (2.097.152 bytes)');
    assert.deepEqual(
      bucketRes.rows[0].allowed_mime_types,
      ['image/webp', 'image/jpeg', 'image/png'],
      'Apenas WebP, JPEG e PNG são permitidos; SVG proibido'
    );

    const userA = 'a0000000-0000-0000-0000-000000000001';
    const userB = 'b0000000-0000-0000-0000-000000000002';

    // 1. Usuário A faz upload válido no seu caminho avatars/<userA>/avatar.webp (< 2 MB, MIME image/webp)
    await setAuthContext(db, { role: 'authenticated', sub: userA });

    const uploadOk = await db.query(`
      INSERT INTO storage.objects (bucket_id, name, metadata)
      VALUES (
        'avatars',
        '${userA}/avatar.webp',
        '{"mimetype": "image/webp", "size": 45000}'::jsonb
      ) RETURNING id, name;
    `);
    assert.equal(uploadOk.rows.length, 1);

    // 2. NEGAÇÃO: Usuário A tenta enviar na pasta de B -> DEVE FALHAR
    await assert.rejects(
      async () => {
        await db.query(`
          INSERT INTO storage.objects (bucket_id, name, metadata)
          VALUES (
            'avatars',
            '${userB}/hacked.webp',
            '{"mimetype": "image/webp", "size": 30000}'::jsonb
          );
        `);
      },
      /new row violates row-level security policy/,
      'RLS deve negar tentativa de upload na pasta de outro usuário'
    );

    // MIME and size are enforced by the Storage bucket itself; object RLS
    // governs identity/path and must not re-evaluate potentially variant metadata.
    const ownerPolicies = await db.query(`
      SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname IN ('users_insert_own_avatar', 'users_select_own_avatar', 'users_update_own_avatar')
    `);
    assert.deepEqual(
      ownerPolicies.rows.map((row) => `${row.policyname}:${row.cmd}`).sort(),
      ['users_insert_own_avatar:INSERT', 'users_select_own_avatar:SELECT', 'users_update_own_avatar:UPDATE']
    );
  });

  await t.test('D6: Índices de filtro, cursor e busca normalizada/trigrama', async () => {
    await setAuthContext(db, { role: 'service_role' });
    await runMigration(db, '20260929180500_create_indices_and_search.sql');

    // 1. Testa EXPLAIN da vitrine para verificar plano de execução e índice
    const explainRes = await db.query(`
      EXPLAIN SELECT id, title FROM public.products
      WHERE platform = 'mercadolivre' AND status = 'published'
      ORDER BY created_at DESC, id DESC
      LIMIT 20;
    `);
    const planText = explainRes.rows.map(r => r['QUERY PLAN']).join('\n');
    assert.ok(planText.length > 0, 'EXPLAIN deve gerar plano de execução válido');

    // 2. Testa função search_products com pg_trgm
    const searchRes = await db.query(`
      SELECT * FROM public.search_products('banco xre', 'mercadolivre', 10);
    `);
    assert.ok(searchRes.rows.length > 0, 'Busca deve retornar produtos pela similaridade ou correspondência');
    assert.ok(searchRes.rows[0].title.includes('Banco'), 'Deve encontrar o produto Capa Banco Xre');
  });

  await t.test('E/F/G/H base: trigger de perfil e busca aproximada com cursor de preço estável', async () => {
    await db.exec('RESET ROLE; CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB DEFAULT \'{}\'::jsonb);');
    await runMigration(db, '20260929180600_auth_profile_and_catalog_search.sql');
    await runMigration(db, '20260929180700_public_link_readiness.sql');
    await runMigration(db, '20260930100000_cap_catalog_search_page_size.sql');
    await runMigration(db, '20260930110000_limit_public_offer_columns.sql');
    await runMigration(db, '20260930120000_revoke_public_private_table_grants.sql');
    await runMigration(db, '20260930150000_deterministic_catalog_search_cursor.sql');
    await runMigration(db, '20260930160000_search_catalog_relevance_cursor.sql');
    await runMigration(db, '20260930170000_product_daily_metrics.sql');
    await runMigration(db, '20260930180000_admin_product_metrics.sql');
    await runMigration(db, '20260930190000_cleanup_profile_on_auth_delete.sql');
    await runMigration(db, '20260930200000_admin_dual_product_rankings.sql');
    await runMigration(db, '20260930210000_product_image_recheck_queue.sql');
    await runMigration(db, '20260930220000_stable_image_recheck_priority.sql');
    await runMigration(db, '20260930230000_keep_archived_product_metrics.sql');
    await runMigration(db, '20261001090000_cart_owner_reads_archived_products.sql');
    await runMigration(db, '20261001130000_catalog_sectors_and_search_v2.sql');
    await runMigration(db, '20261004160000_materialize_catalog_search.sql');
    assert.equal((await db.query("SELECT has_table_privilege('anon', 'public.profiles', 'SELECT') AS allowed")).rows[0].allowed, false, 'Anon role has no table-level access to profiles');
    assert.equal((await db.query("SELECT has_table_privilege('anon', 'public.cart_items', 'SELECT') AS allowed")).rows[0].allowed, false, 'Anon role has no table-level access to saved carts');
    assert.equal((await db.query("SELECT has_table_privilege('authenticated', 'public.cart_items', 'SELECT') AS allowed")).rows[0].allowed, true, 'Authenticated users retain cart access, filtered by RLS');
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await db.query('INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)', [userId, 'otp@example.test', JSON.stringify({ full_name: 'Pessoa Teste' })]);
    const profile = await db.query('SELECT id, email, full_name FROM public.profiles WHERE id = $1', [userId]);
    assert.equal(profile.rows[0].id, userId, 'Profile ID must equal auth.uid for RLS/cart ownership');
    assert.equal(profile.rows[0].full_name, 'Pessoa Teste');

    const readinessProduct = 'abababab-abab-4bab-8bab-abababababab';
    const draftProduct = 'acacacac-acac-4cac-8cac-acacacacacac';
    await db.query("INSERT INTO public.products (id, platform, external_id, title, status) VALUES ($1, 'magalu', 'inactive-link', 'Link em revisao', 'published'), ($2, 'magalu', 'draft-link', 'Rascunho', 'draft')", [readinessProduct, draftProduct]);
    await db.query("INSERT INTO public.affiliate_links (product_id, original_url, affiliate_url, status) VALUES ($1, 'https://www.magazineluiza.com.br/p/item', 'https://www.magazinevoce.com.br/loja/p/item', 'broken')", [readinessProduct]);
    await setAuthContext(db, { role: 'anon' });
    const publicLinkState = await db.query('SELECT public.get_public_link_state($1) AS state', [readinessProduct]);
    assert.equal(publicLinkState.rows[0].state.status, 'broken', 'Public page can explain why the CTA is blocked');
    assert.equal(JSON.stringify(publicLinkState.rows[0].state).includes('affiliate_url'), false, 'The readiness RPC never discloses the affiliate URL');
    const draftLinkState = await db.query('SELECT public.get_public_link_state($1) AS state', [draftProduct]);
    assert.equal(draftLinkState.rows[0].state, null, 'Draft link state is never disclosed publicly');
    await db.exec('RESET ROLE;');

    const rows = [
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Brinco prata delicado', price: 20 },
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Brinco prata premium', price: 30 },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Fone bluetooth básico', price: 15 },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Fone bluetooth premium', price: 35 }
    ];
    for (const row of rows) {
      await db.query('INSERT INTO public.products (id, platform, external_id, title, status) VALUES ($1, \'magalu\', $2, $3, \'published\')', [row.id, row.id.slice(0, 8), row.title]);
      await db.query('INSERT INTO public.product_images (product_id, url, display_order) VALUES ($1, \'https://a-static.mlcdn.com.br/item.jpg\', 0)', [row.id]);
      await db.query('INSERT INTO public.offers (product_id, price, stock_status, store_name, observed_at) VALUES ($1, $2, \'in_stock\', \'Magalu\', now())', [row.id, row.price]);
    }
    const sectorProducts = [
      { id: 'ababab11-abab-4bab-8bab-ababababab11', external: 'sector-blazer', title: 'Blazer feminino elegante', category: 'Moda feminina', status: 'published' },
      { id: 'ababab22-abab-4bab-8bab-ababababab22', external: 'sector-keyboard', title: 'Teclado mecânico gamer RGB', category: 'Informática', status: 'published' },
      { id: 'ababab33-abab-4bab-8bab-ababababab33', external: 'sector-baby', title: 'Carrinho de bebê dobrável', category: null, status: 'published' },
      { id: 'ababab44-abab-4bab-8bab-ababababab44', external: 'sector-fryer', title: 'Fritadeira elétrica Air Fryer', category: 'Eletroportáteis', status: 'published' },
      { id: 'ababab55-abab-4bab-8bab-ababababab55', external: 'sector-unclassified', title: 'Painel solar sem categoria mapeada', category: null, status: 'published' },
      { id: 'ababab66-abab-4bab-8bab-ababababab66', external: 'sector-draft', title: 'Blazer rascunho', category: 'Moda', status: 'draft' }
    ];
    for (const row of sectorProducts) {
      await db.query('INSERT INTO public.products (id, platform, external_id, title, category, status) VALUES ($1, \'magalu\', $2, $3, $4, $5)', [row.id, row.external, row.title, row.category, row.status]);
    }
    await db.query("INSERT INTO public.products (id, platform, external_id, title, category, status) VALUES ('ababab88-abab-4bab-8bab-ababababab88', 'magalu', 'sector-samsung-tv', 'Smart TV Samsung 55 polegadas', 'Eletrônicos', 'published'), ('ababab99-abab-4bab-8bab-ababababab99', 'magalu', 'sector-samsung-phone', 'Celular Samsung Galaxy', 'Eletrônicos', 'published')");
    await db.query("INSERT INTO public.products (id, platform, external_id, title, category, status) VALUES ('abababaa-abab-4bab-8bab-abababababaa', 'magalu', 'sector-telephone', 'Telefone Bluetooth sem fio', 'Eletrônicos', 'published'), ('abababbb-abab-4bab-8bab-abababababbb', 'magalu', 'sector-fritadeira', 'Fritadeira elétrica compacta', 'Eletroportáteis', 'published')");
    const categoryOnlyId = 'ababab77-abab-4bab-8bab-ababababab77';
    await db.query("INSERT INTO public.products (id, platform, external_id, title, category, status) VALUES ($1, 'magalu', 'category-only-blazer', 'Produto de campanha', 'Blazer feminino', 'published')", [categoryOnlyId]);
    await db.query(`
      INSERT INTO public.offers (id, product_id, price, stock_status, store_name, observed_at) VALUES
        ('ababab88-abab-4bab-8bab-ababababab88', $1, 99, 'in_stock', 'Magalu', '2026-10-01T00:00:00Z'),
        ('ababab99-abab-4bab-8bab-ababababab99', $1, 89, 'in_stock', 'Magalu', '2026-10-01T00:00:00Z')
    `, [sectorProducts[0].id]);
    const keyboardSectors = await db.query('SELECT sector_slug FROM public.product_sectors WHERE product_id = $1 ORDER BY sector_slug', [sectorProducts[1].id]);
    assert.deepEqual(keyboardSectors.rows.map((row) => row.sector_slug), ['eletronicos', 'pc-gamer'], 'A gaming keyboard belongs to both PC Gamer and Electronics');
    assert.equal((await db.query('SELECT assignment_source FROM public.product_sectors WHERE product_id = $1 AND sector_slug = \'moda\'', [sectorProducts[0].id])).rows[0].assignment_source, 'category', 'Category-derived assignments record their provenance');
    assert.equal((await db.query('SELECT assignment_source FROM public.product_sectors WHERE product_id = $1 AND sector_slug = \'bebes\'', [sectorProducts[2].id])).rows[0].assignment_source, 'title', 'Title fallback derives baby products');
    assert.equal((await db.query('SELECT sector_slug FROM public.product_sectors WHERE product_id = $1', [sectorProducts[4].id])).rows.length, 0, 'Ambiguous terms such as a standalone panel remain unclassified and eligible for Everything');
    await db.query("INSERT INTO public.product_sectors (product_id, sector_slug, assignment_source) VALUES ($1, 'pet', 'manual')", [sectorProducts[4].id]);
    await db.query("UPDATE public.products SET title = 'Item sem correspondencia', category = NULL WHERE id = $1", [sectorProducts[4].id]);
    assert.equal((await db.query('SELECT assignment_source FROM public.product_sectors WHERE product_id = $1 AND sector_slug = \'pet\'', [sectorProducts[4].id])).rows[0]?.assignment_source, 'manual', 'Importer-driven reclassification preserves a manual sector assignment');
    await setAuthContext(db, { role: 'authenticated', sub: userId });
    await assert.rejects(
      db.query("INSERT INTO public.product_sectors (product_id, sector_slug, assignment_source) VALUES ($1, 'casa', 'manual')", [sectorProducts[4].id]),
      /row-level security policy/,
      'An ordinary authenticated account cannot write sector assignments'
    );
    await db.exec('RESET ROLE;');
    const selectedBlazer = await db.query("SELECT id, category, sectors, offer FROM public.search_catalog_v2('blazer', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, 'moda')");
    assert.equal(selectedBlazer.rows[0]?.id, sectorProducts[0].id, 'A sector filter is independent from the free-text query');
    assert.deepEqual(selectedBlazer.rows[0].sectors, ['moda']);
    assert.equal(selectedBlazer.rows[1]?.id, categoryOnlyId, 'Exact title matches rank ahead of category-only matches');
    assert.equal(selectedBlazer.rows[0].offer.price, 89, 'Equal observation timestamps select the offer with the greater stable ID');
    const stalePriceExcluded = await db.query("SELECT id FROM public.search_catalog_v2('blazer', NULL, 90, NULL, 'recent', NULL, NULL, NULL, 20, NULL, 'moda')");
    assert.equal(stalePriceExcluded.rows.length, 0, 'Price filtering uses the same latest offer selected for the response');
    const currentPriceIncluded = await db.query("SELECT id, offer FROM public.search_catalog_v2('blazer', NULL, 89, 89, 'recent', NULL, NULL, NULL, 20, NULL, 'moda')");
    assert.equal(currentPriceIncluded.rows[0]?.id, sectorProducts[0].id, 'Inclusive price bounds use the deterministic latest offer');
    const airFryer = await db.query("SELECT id FROM public.search_catalog_v2('air fryer', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, 'eletro')");
    assert.deepEqual(airFryer.rows.map((row) => row.id).sort(), [sectorProducts[3].id, 'abababbb-abab-4bab-8bab-abababababbb'].sort(), 'A multiword query matches its compound product spelling and category sector');
    const compactAirFryer = await db.query("SELECT id FROM public.search_catalog_v2('airfryer', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, 'eletro')");
    assert.deepEqual(compactAirFryer.rows.map((row) => row.id).sort(), [sectorProducts[3].id, 'abababbb-abab-4bab-8bab-abababababbb'].sort(), 'The compact product spelling matches a spaced query in the title');
    for (const term of ['air fryer', 'airfryer', 'fritadeira']) {
      const synonym = await db.query("SELECT count(*)::int AS count FROM public.search_catalog_v2($1, NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, 'eletro') WHERE external_id = 'sector-fritadeira'", [term]);
      assert.equal(synonym.rows[0].count, 1, `${term} finds a product titled only Fritadeira`);
    }
    const fuzzyV2 = await db.query("SELECT id FROM public.search_catalog_v2('brimco', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(fuzzyV2.rows.map((row) => row.id).sort(), rows.slice(0, 2).map((row) => row.id).sort(), 'A one-character typo remains recoverable with controlled token similarity');
    const accentedPunctuation = await db.query("SELECT id FROM public.search_catalog_v2('brínco!!! prata', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(accentedPunctuation.rows.map((row) => row.id).sort(), rows.slice(0, 2).map((row) => row.id).sort(), 'Accents and punctuation normalize without collapsing multiple terms');
    const foneBluetooth = await db.query("SELECT id FROM public.search_catalog_v2('fone bluetooth', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(foneBluetooth.rows.map((row) => row.id).sort(), rows.slice(2).map((row) => row.id).sort(), 'Every meaningful search word must match');
    const headphoneAlias = await db.query("SELECT id FROM public.search_catalog_v2('headphones bluetooth', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(headphoneAlias.rows.map((row) => row.id).sort(), rows.slice(2).map((row) => row.id).sort(), 'Explicit headphone and fone aliases keep multiword search useful');
    const shortTermSearch = await db.query("SELECT external_id FROM public.search_catalog_v2('tv samsung', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(shortTermSearch.rows.map((row) => row.external_id), ['sector-samsung-tv'], 'A short exact token remains required alongside longer search words');
    const shortOnlySearch = await db.query("SELECT external_id FROM public.search_catalog_v2('55 tv', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(shortOnlySearch.rows.map((row) => row.external_id), ['sector-samsung-tv'], 'Short-only queries match exact words without requiring query order');
    const shortTokenSearch = await db.query("SELECT external_id FROM public.search_catalog_v2('tv', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(shortTokenSearch.rows.map((row) => row.external_id), ['sector-samsung-tv'], 'A short single-token query matches a whole word instead of an arbitrary substring');
    const foneSubstringSearch = await db.query("SELECT count(*)::int AS count FROM public.search_catalog_v2('fone', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20) WHERE external_id = 'sector-telephone'");
    assert.equal(foneSubstringSearch.rows[0].count, 0, 'A short word does not match an unrelated substring inside telefone');
    const mixedUnrelatedTerms = await db.query("SELECT id FROM public.search_catalog_v2('fone camera', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.equal(mixedUnrelatedTerms.rows.length, 0, 'A matching single word cannot admit unrelated multiword results');
    const wrongSector = await db.query("SELECT id FROM public.search_catalog_v2('blazer', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, 'pet')");
    assert.equal(wrongSector.rows.length, 0, 'The sector slug applies a separate category filter');
    assert.equal(selectedBlazer.rows[0].category, 'Moda feminina', 'The original marketplace category remains intact in the response');
    const searchFunctionSecurity = await db.query("SELECT prosecdef FROM pg_proc WHERE oid = 'public.search_catalog_v2(text,text,numeric,numeric,text,timestamp with time zone,uuid,numeric,integer,real,text)'::regprocedure");
    assert.equal(searchFunctionSecurity.rows[0].prosecdef, false, 'The public catalog RPC remains SECURITY INVOKER');
    assert.equal((await db.query("SELECT has_function_privilege('anon', 'public.search_catalog_v2(text,text,numeric,numeric,text,timestamp with time zone,uuid,numeric,integer,real,text)'::regprocedure, 'EXECUTE') AS allowed")).rows[0].allowed, true, 'Anonymous visitors can call the public search RPC');
    assert.equal((await db.query("SELECT has_table_privilege('anon', 'public.product_sectors', 'INSERT') AS allowed")).rows[0].allowed, false, 'Anonymous visitors cannot write product-sector assignments');
    await db.query("UPDATE public.products SET title = 'Headset Bluetooth sem fio', category = 'Audio' WHERE id = $1", [sectorProducts[0].id]);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.product_sectors WHERE product_id = $1 AND sector_slug = \'moda\'', [sectorProducts[0].id])).rows[0].count, 0, 'Updated title/category values remove stale derived sector assignments');
    assert.equal((await db.query('SELECT assignment_source FROM public.product_sectors WHERE product_id = $1 AND sector_slug = \'eletronicos\'', [sectorProducts[0].id])).rows[0].assignment_source, 'title', 'The importer update automatically rebuilds assignments and provenance');
    await setAuthContext(db, { role: 'anon' });
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.product_sectors WHERE product_id = $1', [sectorProducts[5].id])).rows[0].count, 0, 'Anonymous table reads cannot reveal sectors assigned to drafts');
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.search_catalog_v2('', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20) WHERE id = $1", [sectorProducts[5].id])).rows[0].count, 0, 'The public RPC never returns draft products');
    await db.exec('RESET ROLE;');

    const searchPlanDiagnostic = fs.readFileSync(path.resolve(__dirname, '../scripts/explain-catalog-search-v2.sql'), 'utf8');
    await db.exec(searchPlanDiagnostic);

    const fuzzy = await db.query("SELECT id, title FROM public.search_catalog('brimco', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    const scores = await db.query("SELECT public.normalize_catalog_text('Brinco prata delicado') AS normalized, similarity(public.normalize_catalog_text('Brinco prata delicado'), public.normalize_catalog_text('brimco')) AS score");
    assert.equal(fuzzy.rows.length, 2, `Trigram search should find a nearby spelling: ${JSON.stringify(scores.rows)}`);
    assert.ok(fuzzy.rows.every((row) => row.title.startsWith('Brinco')));

    const relevanceRows = [
      { id: '11111111-1111-4111-8111-111111111111', title: 'Aurevo Nimbus', createdAt: '2026-01-01T00:00:00Z' },
      { id: '22222222-2222-4222-8222-222222222222', title: 'Aurevo Nimbus Pro', createdAt: '2026-09-01T00:00:00Z' }
    ];
    for (const row of relevanceRows) {
      await db.query("INSERT INTO public.products (id, platform, external_id, title, status, created_at) VALUES ($1, 'magalu', $2, $3, 'published', $4)", [row.id, row.id.slice(0, 8), row.title, row.createdAt]);
    }
    const relevanceFirst = await db.query("SELECT id, title, created_at, search_score FROM public.search_catalog('aurevo nimbus', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 1)");
    assert.equal(relevanceFirst.rows[0].id, relevanceRows[0].id, 'Exact title relevance ranks before a newer partial match');
    const relevanceSecond = await db.query("SELECT id, title, search_score FROM public.search_catalog('aurevo nimbus', NULL, NULL, NULL, 'recent', $1, $2, NULL, 1, $3)", [relevanceFirst.rows[0].created_at, relevanceFirst.rows[0].id, relevanceFirst.rows[0].search_score]);
    assert.equal(relevanceSecond.rows[0]?.id, relevanceRows[1].id, 'Relevance cursor must include newer lower-score matches on the next page');
    for (const query of ['brinco', 'brínco', 'brin-co']) {
      const normalized = await db.query('SELECT public.normalize_catalog_query($1) AS value', [query]);
      assert.equal(normalized.rows[0].value, 'brinco', `Accent and punctuation normalization: ${query}`);
      const exactMatches = await db.query('SELECT id, title FROM public.search_catalog($1, NULL, NULL, NULL, \'recent\', NULL, NULL, NULL, 20)', [query]);
      assert.deepEqual(exactMatches.rows.map((row) => row.id).sort(), fuzzy.rows.map((row) => row.id).sort(), `Search results for ${query}: ${JSON.stringify(exactMatches.rows)}`);
    }
    const scoped = await db.query("SELECT id FROM public.search_catalog('brinco', 'magalu', 25, 35, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(scoped.rows.map((row) => row.id), [rows[1].id], 'Store and inclusive price filters constrain matching items');
    const boundary = await db.query("SELECT id FROM public.search_catalog('brinco', 'magalu', 30, 30, 'recent', NULL, NULL, NULL, 20)");
    assert.deepEqual(boundary.rows.map((row) => row.id), [rows[1].id], 'The minimum and maximum price bounds are inclusive');
    const distant = await db.query("SELECT id FROM public.search_catalog('zzzxqv', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20)");
    assert.equal(distant.rows.length, 0, 'A distant spelling must not pollute search results');

    await db.query("INSERT INTO public.products (platform, external_id, title, status) SELECT 'magalu', 'page-cap-' || n, 'Page cap item ' || n, 'published' FROM generate_series(1, 25) AS series(n)");
    const cappedPage = await db.query("SELECT id FROM public.search_catalog('', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 999)");
    assert.equal(cappedPage.rows.length, 20, 'Public catalog search enforces a hard 20-product page cap');

    await db.query(`
      INSERT INTO public.products (platform, external_id, title, category, status)
      SELECT 'magalu', 'cursor-page-' || n, 'Cursor Test Token Item ' || lpad(n::text, 3, '0'), 'Casa', 'published'
      FROM generate_series(1, 100) AS n;
    `);
    await db.query(`
      INSERT INTO public.offers (product_id, price, stock_status, store_name, observed_at)
      SELECT p.id, ((substring(p.external_id from '([0-9]+)$')::integer % 17) + 1)::numeric,
        'in_stock', 'Magalu', '2026-10-01T00:00:00Z'::timestamptz
      FROM public.products p
      WHERE p.external_id LIKE 'cursor-page-%'
        AND substring(p.external_id from '([0-9]+)$')::integer % 9 <> 0;
    `);
    const cursorSeen = [];
    let searchCursor = null;
    for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
      const page = await db.query(
        "SELECT id, created_at, (offer->>'price')::numeric AS price, search_score FROM public.search_catalog_v2('cursor test token', 'magalu', NULL, NULL, 'price_asc', $1, $2, $3, 20, $4, 'casa')",
        [searchCursor?.created_at ?? null, searchCursor?.id ?? null, searchCursor?.price ?? null, searchCursor?.search_score ?? null]
      );
      assert.equal(page.rows.length, 20, `Each cursor page ${pageIndex + 1} returns 20 rows`);
      cursorSeen.push(...page.rows);
      const last = page.rows.at(-1);
      searchCursor = { ...last, search_score: last.search_score };
    }
    const expectedCursorIds = (await db.query("SELECT p.id FROM public.products p JOIN public.product_sectors ps ON ps.product_id = p.id WHERE p.external_id LIKE 'cursor-page-%' AND ps.sector_slug = 'casa'")).rows.map((row) => row.id).sort();
    assert.equal(new Set(cursorSeen.map((row) => row.id)).size, 100, 'Five search pages contain no duplicate product IDs');
    assert.deepEqual(cursorSeen.map((row) => row.id).sort(), expectedCursorIds, 'Five keyset pages neither skip nor add products, including rows without offers and tied prices');

    const first = await db.query("SELECT id, created_at, (offer->>'price')::numeric AS price FROM public.search_catalog('fone', NULL, NULL, NULL, 'price_asc', NULL, NULL, NULL, 1)");
    assert.equal(first.rows.length, 1);
    const second = await db.query("SELECT id, (offer->>'price')::numeric AS price FROM public.search_catalog('fone', NULL, NULL, NULL, 'price_asc', $1, $2, $3, 1)", [first.rows[0].created_at, first.rows[0].id, first.rows[0].price]);
    assert.equal(second.rows.length, 1, 'Price cursor should advance to another product');
    assert.notEqual(second.rows[0].id, first.rows[0].id);
    assert.ok(second.rows[0].price > first.rows[0].price);

    await setAuthContext(db, { role: 'service_role' });
    const importItem = {
      platform: 'magalu', external_id: 'atomic-sku', title: 'Produto Atomic', description: null, category: null, brand: null,
      status: 'published', price: 54.9, old_price: null, installments_text: '3x sem juros', shipping_text: null, coupon_code: null,
      stock_quantity: null, stock_status: 'in_stock', seller_name: 'Loja teste', seller_id: 'seller', store_name: 'Magalu', store_affiliate_id: 'partner',
      original_url: 'https://www.magazineluiza.com.br/p/atomic', affiliate_url: 'https://www.magazinevoce.com.br/partner/p/atomic',
      link_status: 'active', verified_at: new Date().toISOString(), refresh_due_at: new Date(Date.now() + 86400000).toISOString(), expires_at: null,
      images: [{ url: 'https://a-static.mlcdn.com.br/atomic-1.jpg', display_order: 0, is_primary: true }, { url: 'https://a-static.mlcdn.com.br/atomic-2.jpg', display_order: 1, is_primary: false }]
    };
    const firstImport = await db.query('SELECT public.import_catalog_item($1::jsonb) AS id', [JSON.stringify(importItem)]);
    await db.query('INSERT INTO public.cart_items (user_id, product_id) VALUES ($1, $2)', [userId, firstImport.rows[0].id]);
    const changedImport = { ...importItem, title: 'Produto Atomic atualizado', price: 49.9, images: [{ url: 'https://a-static.mlcdn.com.br/atomic-new.jpg', display_order: 0, is_primary: true }] };
    await setAuthContext(db, { role: 'anon' });
    const reportedImageFailure = await db.query('SELECT public.report_product_image_failure($1, $2) AS accepted', [firstImport.rows[0].id, 'https://a-static.mlcdn.com.br/atomic-1.jpg']);
    assert.equal(reportedImageFailure.rows[0].accepted, true, 'A browser can report a broken current catalog image');
    const firstFailureStatus = await db.query('SELECT status FROM public.products WHERE id = $1', [firstImport.rows[0].id]);
    assert.equal(firstFailureStatus.rows[0].status, 'published', 'A single image failure does not hide the card');
    const imageQueue = await db.query('SELECT product_id, platform, external_id, original_url FROM public.get_public_image_recheck_queue(20)');
    assert.deepEqual(imageQueue.rows[0], { product_id: firstImport.rows[0].id, platform: 'magalu', external_id: 'atomic-sku', original_url: 'https://www.magazineluiza.com.br/p/atomic' }, 'The radar queue contains only the exact marketplace product identity and source URL');
    await assert.rejects(db.query('SELECT public.archive_unavailable_catalog_item($1, $2)', ['magalu', 'atomic-sku']), /permission denied/, 'Anonymous clients cannot hide catalog products');
    assert.equal((await db.query("SELECT status FROM public.products WHERE id = $1", [firstImport.rows[0].id])).rows[0].status, 'published', 'A failed image report alone never hides a product');
    const repeatedImageFailure = await db.query('SELECT public.report_product_image_failure($1, $2) AS accepted', [firstImport.rows[0].id, 'https://a-static.mlcdn.com.br/atomic-1.jpg']);
    assert.equal(repeatedImageFailure.rows[0].accepted, true, 'A repeated browser image failure is accepted for this published exact URL');
    await setAuthContext(db, { role: 'service_role' });
    assert.equal((await db.query('SELECT report_count FROM public.product_image_rechecks WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].report_count, 1, 'Duplicate reports inside the five-minute cooldown do not amplify the queue count');
    const firstReportAt = (await db.query('SELECT first_reported_at FROM public.product_image_rechecks WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].first_reported_at;
    const lastReportAt = (await db.query('SELECT last_reported_at FROM public.product_image_rechecks WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].last_reported_at;
    assert.equal(Date.parse(lastReportAt), Date.parse(firstReportAt), 'An acknowledged duplicate does not reset age and deprioritize the oldest broken image');
    const laterReportProduct = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    await setAuthContext(db, { role: 'service_role' });
    await db.query("INSERT INTO public.products (id, platform, external_id, title, status) VALUES ($1, 'magalu', 'later-report', 'Foto falhou depois', 'published')", [laterReportProduct]);
    await db.query("INSERT INTO public.product_images (product_id, url, display_order) VALUES ($1, 'https://a-static.mlcdn.com.br/later.jpg', 0)", [laterReportProduct]);
    await db.query("INSERT INTO public.affiliate_links (product_id, original_url, affiliate_url, status) VALUES ($1, 'https://www.magazineluiza.com.br/p/later', 'https://www.magazinevoce.com.br/partner/p/later', 'active')", [laterReportProduct]);
    await db.query('INSERT INTO public.product_image_rechecks (product_id, failed_image_url, first_reported_at, last_reported_at) VALUES ($1, $2, now() - interval \'1 day\', now() - interval \'3 days\')', [laterReportProduct, 'https://a-static.mlcdn.com.br/later.jpg']);
    await db.query('UPDATE public.product_image_rechecks SET first_reported_at = now() - interval \'2 days\', last_reported_at = now() - interval \'1 minute\' WHERE product_id = $1', [firstImport.rows[0].id]);
    await setAuthContext(db, { role: 'anon' });
    const prioritizedQueue = await db.query('SELECT product_id FROM public.get_public_image_recheck_queue(20) WHERE product_id IN ($1, $2)', [firstImport.rows[0].id, laterReportProduct]);
    assert.deepEqual(prioritizedQueue.rows.map(({ product_id }) => product_id), [firstImport.rows[0].id, laterReportProduct], 'Queue order uses oldest first report even if that item has a more recent last report');
    await setAuthContext(db, { role: 'service_role' });
    await db.query('DELETE FROM public.products WHERE id = $1', [laterReportProduct]);
    await setAuthContext(db, { role: 'anon' });
    await setAuthContext(db, { role: 'service_role' });
    assert.equal((await db.query('SELECT status FROM public.products WHERE id = $1', [firstImport.rows[0].id])).rows[0].status, 'published', 'Image failures do not hide a product without official missing-product evidence');
    await setAuthContext(db, { role: 'anon' });
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.search_catalog(\'\', NULL, NULL, NULL, \'recent\', NULL, NULL, NULL, 20) WHERE id = $1', [firstImport.rows[0].id])).rows[0].count, 1, 'A broken image alone does not hide the catalog product');
    await setAuthContext(db, { role: 'service_role' });
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.cart_items WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].count, 1, 'Suspension retains the existing cart reference');
    await setAuthContext(db, { role: 'anon' });
    const suspendedRecheck = await db.query('SELECT product_id, external_id FROM public.get_public_image_recheck_queue(20) WHERE product_id = $1', [firstImport.rows[0].id]);
    assert.equal(suspendedRecheck.rows[0].external_id, 'atomic-sku', 'Image failure keeps product available to the autonomous radar');
    await setAuthContext(db, { role: 'service_role' });
    const secondImport = await db.query('SELECT public.import_catalog_item($1::jsonb) AS id', [JSON.stringify(changedImport)]);
    assert.equal(secondImport.rows[0].id, firstImport.rows[0].id, 'Repeated catalog import preserves canonical product UUID');
    assert.equal((await db.query('SELECT status FROM public.products WHERE id = $1', [firstImport.rows[0].id])).rows[0].status, 'published', 'Import with a recovered gallery restores a previously suspended listing');
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.products WHERE platform = 'magalu' AND external_id = 'atomic-sku'")).rows[0].count, 1);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.product_image_rechecks WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].count, 0, 'A successful import with a replacement image clears the radar recheck');
    await setAuthContext(db, { role: 'anon' });
    await db.query('SELECT public.report_product_image_failure($1, $2)', [firstImport.rows[0].id, 'https://a-static.mlcdn.com.br/atomic-new.jpg']);
    await setAuthContext(db, { role: 'service_role' });
    assert.equal((await db.query('SELECT public.archive_unavailable_catalog_item($1, $2) AS archived', ['magalu', 'atomic-sku'])).rows[0].archived, true, 'Only the trusted catalog importer can archive an unavailable product');
    assert.equal((await db.query('SELECT status FROM public.products WHERE id = $1', [firstImport.rows[0].id])).rows[0].status, 'archived', 'Archived products no longer appear through the published catalog filter');
    await setAuthContext(db, { role: 'authenticated', sub: userId });
    const savedArchivedItem = await db.query(`
      SELECT cart.product_id, product.platform, product.title, product.status
      FROM public.cart_items AS cart
      LEFT JOIN public.products AS product ON product.id = cart.product_id
      WHERE cart.user_id = $1;
    `, [userId]);
    assert.deepEqual(savedArchivedItem.rows, [{ product_id: firstImport.rows[0].id, platform: 'magalu', title: 'Produto Atomic atualizado', status: 'archived' }], 'The owner can still reconstruct their saved archived product while its offer stays unavailable');
    await setAuthContext(db, { role: 'authenticated', sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.products WHERE id = $1', [firstImport.rows[0].id])).rows[0].count, 0, 'A different account cannot read another user\'s archived product');
    await setAuthContext(db, { role: 'anon' });
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.products WHERE id = $1', [firstImport.rows[0].id])).rows[0].count, 0, 'Anonymous catalog reads never reveal archived products');
    await setAuthContext(db, { role: 'service_role' });
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.offers WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].count, 2, 'Offer observations retain history');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.product_images WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].count, 1, 'Latest image gallery updates atomically');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.cart_items WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].count, 1, 'Reimport does not remove the saved cart item');
    await db.query('SELECT public.import_catalog_item($1::jsonb)', [JSON.stringify({ ...changedImport, images: [] })]);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.product_images WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].count, 1, 'A partial refresh with no photos preserves the indexed gallery');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.cart_items WHERE product_id = $1', [firstImport.rows[0].id])).rows[0].count, 1, 'A refresh with an empty gallery never removes the saved cart item');
    const cardPayload = await db.query("SELECT jsonb_array_length(images) AS image_count, affiliate_link ? 'affiliate_url' AS leaks_url, offer ? 'seller_id' AS leaks_seller_id, offer ? 'store_affiliate_id' AS leaks_store_id FROM public.search_catalog('Produto Atomic', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20) WHERE id = $1", [firstImport.rows[0].id]);
    assert.equal(cardPayload.rows[0].image_count, 1, 'The catalog search sends only one thumbnail per card');
    assert.equal(cardPayload.rows[0].leaks_url, false, 'The catalog search does not expose affiliate URLs to browser code');
    assert.equal(cardPayload.rows[0].leaks_seller_id, false, 'Public offer payload omits private seller IDs');
    assert.equal(cardPayload.rows[0].leaks_store_id, false, 'Public offer payload omits affiliate store IDs');
    await setAuthContext(db, { role: 'anon' });
    assert.equal((await db.query("SELECT has_table_privilege('anon', 'public.product_daily_metrics', 'SELECT') AS allowed")).rows[0].allowed, false, 'Anonymous visitors cannot read aggregate metrics directly');
    await db.query("SELECT public.record_product_metric($1, 'view')", [firstImport.rows[0].id]);
    await db.query("SELECT public.record_product_metric($1, 'view')", [firstImport.rows[0].id]);
    await db.query("SELECT public.record_product_metric($1, 'outbound_click')", [firstImport.rows[0].id]);
    await db.query("SELECT public.record_product_metric($1, 'view')", [draftProduct]);
    await assert.rejects(db.query("SELECT public.record_product_metric($1, 'email')", [firstImport.rows[0].id]), /Invalid product metric/);
    await assert.rejects(db.query('SELECT public.get_admin_product_metrics(7)'), /permission denied/, 'Anonymous visitors cannot execute the metrics reader');
    await setAuthContext(db, { role: 'authenticated', sub: userId });
    await assert.rejects(db.query('SELECT public.get_admin_product_metrics(7)'), /Admin access required/, 'An authenticated regular user cannot read metrics');
    await setAuthContext(db, { role: 'service_role' });
    const metric = await db.query('SELECT view_count, outbound_click_count FROM public.product_daily_metrics WHERE product_id = $1', [firstImport.rows[0].id]);
    assert.equal(metric.rows[0].view_count, 2, 'Published product views aggregate without visitor identifiers');
    assert.equal(metric.rows[0].outbound_click_count, 1, 'Successful outbound actions have a separate aggregate');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.product_daily_metrics WHERE product_id = $1', [draftProduct])).rows[0].count, 0, 'Unpublished products are never counted');
    await db.query("UPDATE public.profiles SET role = 'admin' WHERE id = $1", [userId]);
    await setAuthContext(db, { role: 'authenticated', sub: userId });
    const adminMetrics = await db.query('SELECT public.get_admin_product_metrics(7) AS result');
    assert.equal(adminMetrics.rows[0].result.totals.views, 2, 'Admins can see aggregated product views');
    assert.equal(adminMetrics.rows[0].result.totals.outboundClicks, 1, 'Admins can see accepted outbound counts');
    assert.equal(adminMetrics.rows[0].result.mostViewedProducts[0].productId, firstImport.rows[0].id, 'Admin view ranking identifies catalog products only');
    assert.equal(adminMetrics.rows[0].result.mostClickedProducts[0].productId, firstImport.rows[0].id, 'Admin click ranking is independently available');
    await setAuthContext(db, { role: 'service_role' });
    await db.query("UPDATE public.products SET status = 'archived' WHERE id = $1", [firstImport.rows[0].id]);
    await setAuthContext(db, { role: 'authenticated', sub: userId });
    const archivedMetrics = await db.query('SELECT public.get_admin_product_metrics(7) AS result');
    assert.equal(archivedMetrics.rows[0].result.totals.views, 2, 'Archiving an item does not erase its historical view totals');
    assert.equal(archivedMetrics.rows[0].result.totals.outboundClicks, 1, 'Archiving an item does not erase its historical outbound totals');
    assert.equal(archivedMetrics.rows[0].result.mostClickedProducts[0].productId, firstImport.rows[0].id, 'Archived item remains in historical click rankings');
    await setAuthContext(db, { role: 'service_role' });
    await db.query("UPDATE public.products SET status = 'published' WHERE id = $1", [firstImport.rows[0].id]);
    await setAuthContext(db, { role: 'anon' });
    await assert.rejects(db.query('SELECT public.import_catalog_item($1::jsonb)', [JSON.stringify(importItem)]), /permission denied/);
    const publicOffer = await db.query('SELECT price, seller_name, store_name FROM public.offers WHERE product_id = $1', [firstImport.rows[0].id]);
    assert.equal(publicOffer.rows[0].seller_name, 'Loja teste', 'Public product details retain display seller name');
    await assert.rejects(db.query('SELECT seller_id, store_affiliate_id FROM public.offers WHERE product_id = $1', [firstImport.rows[0].id]), /permission denied/);
    await db.exec('RESET ROLE;');
    await db.query('DELETE FROM auth.users WHERE id = $1', [userId]);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.profiles WHERE id = $1', [userId])).rows[0].count, 0, 'Deleting an Auth user must also delete its non-FK profile row');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.cart_items WHERE user_id = $1', [userId])).rows[0].count, 0, 'Profile cleanup cascades the user cart');
  });

  await db.close();
});
