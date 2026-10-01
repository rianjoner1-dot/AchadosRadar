import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedDevelopmentRef = 'rvepsyvhsqumfpemhbba';

if (!supabaseUrl || !serviceRoleKey || !supabaseKey || !projectRef) {
  console.error('Faltam variáveis de ambiente do Supabase para a integração de desenvolvimento.');
  process.exit(1);
}
if (projectRef !== expectedDevelopmentRef || new URL(supabaseUrl).hostname !== `${expectedDevelopmentRef}.supabase.co`) {
  throw new Error('Integração recusada: este script só pode acessar o projeto Supabase de desenvolvimento configurado.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const userClient = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    fetch: async (input, init) => {
      const requestUrl = typeof input === 'string' ? input : input?.url;
      if (requestUrl?.includes('/storage/v1/object/avatars/')) {
        const headers = new Headers(init?.headers ?? (typeof input === 'object' ? input.headers : undefined));
        const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
        const payload = token?.split('.')[1];
        const claims = payload ? JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) : null;
        console.log(`    Storage request JWT: role=${claims?.role ?? 'ausente'}, subject=${claims?.sub ? 'presente' : 'ausente'}`);
      }
      return fetch(input, init);
    }
  }
});

async function runBackendIntegration() {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = `PassWord#${Date.now()}!`;
  let userId = null;
  let runError = null;
  let avatarObjectPath = null;
  console.log('[1] Criando usuário temporário de teste via admin.');
  const { data: adminAuthData, error: createErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Usuario Teste' }
  });
  if (createErr) throw createErr;
  
  const user = adminAuthData.user;
  userId = user.id;
  console.log('    Usuário temporário criado.');

  try {
  console.log(`[2] Realizando login com senha...`);
  const { data: sessionData, error: loginErr } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  if (loginErr) throw loginErr;
  if (!sessionData.session?.access_token) throw new Error('Login de teste não retornou uma sessão.');
  console.log('    Sessão obtida via JWT; token omitido dos logs.');

  console.log(`[3] Testando Perfil (G1.3)`);
  const { data: profile, error: profErr } = await userClient.from('profiles').select('*').eq('id', user.id).single();
  if (profErr && profErr.code !== 'PGRST116') throw profErr; // PGRST116 = not found
  console.log(`    Perfil inicial criado pelo trigger de Auth: ${profile ? profile.full_name : 'Não encontrado'}`);
  
  const { error: updErr } = await userClient.from('profiles').update({ full_name: 'Novo Nome' }).eq('id', user.id);
  if (updErr) throw updErr;
  console.log(`    Perfil atualizado com nome.`);

  console.log('[4] Testando upload autenticado no bucket avatars.');
  const { data: sessionDataForStorage, error: storageSessionError } = await userClient.auth.getSession();
  if (storageSessionError) throw storageSessionError;
  const storageTokenPayload = sessionDataForStorage.session?.access_token?.split('.')[1];
  const storageClaims = storageTokenPayload
    ? JSON.parse(Buffer.from(storageTokenPayload, 'base64url').toString('utf8'))
    : null;
  console.log(`    Sessao Storage: role=${storageClaims?.role ?? 'ausente'}, uid_confere=${storageClaims?.sub === user.id}`);
  const avatarBytes = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64');
  const policyCheckPath = `${user.id}/avatar-policy-check.webp`;
  const { error: seedError } = await adminClient.storage.from('avatars').upload(policyCheckPath, avatarBytes, {
    contentType: 'image/webp',
    cacheControl: '0',
    upsert: true
  });
  if (seedError) throw seedError;
  let policyList = null;
  let policyListError = null;
  try {
    const result = await userClient.storage.from('avatars').list(user.id, { search: 'avatar-policy-check.webp' });
    policyList = result.data;
    policyListError = result.error;
  } finally {
    const { error: seedCleanupError } = await adminClient.storage.from('avatars').remove([policyCheckPath]);
    if (seedCleanupError) {
      avatarObjectPath = policyCheckPath;
      throw seedCleanupError;
    }
  }
  if (policyListError) throw policyListError;
  const visibleSeed = policyList?.find((item) => item.name === 'avatar-policy-check.webp');
  console.log(`    Política SELECT do usuário: ${visibleSeed ? 'aprovada' : 'objeto nao visivel'}; metadata=${JSON.stringify(visibleSeed?.metadata ?? null)}`);

  avatarObjectPath = `${user.id}/avatar.webp`;
  const { error: avatarUploadError } = await userClient.storage.from('avatars').upload(avatarObjectPath, avatarBytes, {
    contentType: 'image/webp',
    cacheControl: '0',
    upsert: false
  });
  if (avatarUploadError) throw avatarUploadError;
  console.log('    Upload inicial do usuário autenticado aceito.');
  const { error: avatarReplaceError } = await userClient.storage.from('avatars').upload(avatarObjectPath, avatarBytes, {
    contentType: 'image/webp',
    cacheControl: '0',
    upsert: true
  });
  if (avatarReplaceError) throw avatarReplaceError;
  console.log('    Substituição do avatar existente com upsert aceita.');

  console.log(`[5] Testando Carrinho (G1.5/G1.6/G1.8)`);
  const { data: prodList, error: productErr } = await adminClient.from('products').select('id').eq('status', 'published').limit(1);
  if (productErr) throw productErr;
  if (!prodList || !prodList.length) {
     console.log('    Nenhum produto publicado para testar o carrinho...');
  } else {
     const prodId = prodList[0].id;
     console.log(`    Adicionando produto ${prodId} ao carrinho...`);
     const { error: cartErr } = await userClient.from('cart_items').insert({
       user_id: user.id,
       product_id: prodId,
       saved_price: 100
     });
     if (cartErr) throw cartErr;
     console.log(`    Produto adicionado com sucesso.`);
     
     const { error: delCartErr } = await userClient.from('cart_items').delete().eq('user_id', user.id).eq('product_id', prodId);
     if (delCartErr) throw delCartErr;
     console.log(`    Carrinho limpo.`);
  }

  } catch (error) {
    runError = error;
  } finally {
    let cleanupFailed = false;
    if (userId && avatarObjectPath) {
      const { error: avatarCleanupError } = await adminClient.storage.from('avatars').remove([avatarObjectPath]);
      if (avatarCleanupError) {
        cleanupFailed = true;
        console.error('Não foi possível remover o arquivo avatar temporário:', avatarObjectPath);
        if (!runError) runError = avatarCleanupError;
      } else {
        console.log('[6a] Avatar temporário removido.');
      }
    }
    if (userId) {
      if (cleanupFailed) {
        console.error('Conta temporária preservada para permitir limpeza manual segura:', userId);
      } else {
      console.log('[6] Limpando usuário temporário de teste.');
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error('Não foi possível remover o usuário temporário; exclua-o manualmente no Supabase:', userId);
        if (!runError) runError = cleanupError;
      } else {
        console.log('    Usuário temporário removido.');
      }
      }
    }
  }
  if (runError) throw runError;

  console.log(`[7] Verificando Cascade`);
  const { data: profCheck, error: profCheckErr } = await adminClient.from('profiles').select('id').eq('id', userId);
  if (profCheckErr) throw profCheckErr;
  if (profCheck && profCheck.length > 0) throw new Error("Perfil não foi deletado via cascade!");
  console.log(`    Cascade do Perfil verificado com sucesso.`);

  console.log("Integração do backend validada com sucesso!");
}

runBackendIntegration().catch(err => {
  console.error("Erro no teste de integração:", err);
  process.exit(1);
});
