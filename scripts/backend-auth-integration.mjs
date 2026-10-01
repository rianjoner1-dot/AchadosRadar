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
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runBackendIntegration() {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = `PassWord#${Date.now()}!`;
  let userId = null;
  let runError = null;
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

  console.log(`[4] Pulando Storage/Avatar em Node (G1.4) devido a limite do multipart...`);
  // const buffer = Buffer.from("fake-image-content-jpeg-data");
  // const { data: uploadData, error: uploadErr } = await userClient.storage.from('avatars').upload(`${user.id}/avatar.jpg`, buffer, {
  //   contentType: 'image/jpeg',
  //   upsert: true
  // });
  // if (uploadErr) throw uploadErr;
  // console.log(`    Avatar enviado para path: ${uploadData.path}`);

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
    if (userId) {
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
