# Módulo de Autenticação e Perfis (`src/modules/auth/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Este módulo implementa a experiência de autenticação moderna e segura do **Achados Radar**:
- **Login sem senha (Passwordless OTP)** via email usando Supabase GoTrue Auth.
- **Processamento de Avatar no Cliente**: Decodificação, validação de limites (máx 2MB, resolução segura), corte centralizado e conversão para WebP de 320px via Canvas antes de qualquer upload.
- **Armazenamento Seguro de Fotos**: Upload no bucket `avatars` sob `userId/avatar.webp` com políticas RLS restritas por proprietário.
- **LGPD & Exclusão de Conta**: O fluxo de exclusão de conta chama o endpoint serverless dedicado e só limpa a sessão e o carrinho local após confirmação formal do banco de dados.

---

## 2. Estrutura de Arquivos

| Arquivo | Descrição |
| :--- | :--- |
| [client.ts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/client.ts) | Cliente principal de autenticação: gerencia login OTP, escuta mudanças de sessão (`onAuthStateChange`), carrega e atualiza o perfil em `public.profiles`. |
| [avatar.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/avatar.mjs) | Pipeline de pré-processamento de avatar: validação MIME/tamanho, corte 1:1, redimensionamento para 320x320px WebP e upload autenticado no Supabase Storage. |
| [avatar.d.mts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/avatar.d.mts) | Declarações de tipos estritos para preparação e upload de avatar. |
| [account-deletion.js](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/account-deletion.js) | Lógica de exclusão de conta em conformidade com LGPD; dispara a exclusão e limpa chaves locais apenas após resposta 200. |
| [phone.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/phone.mjs) | Normalização estrita de números telefônicos brasileiros (DDD + 8 ou 9 dígitos com prefixo internacional `+55`). |
| [phone.d.mts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/phone.d.mts) | Tipos para normalização e validação de telefones. |
| [pending-account-name.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/pending-account-name.mjs) | Armazenamento temporário e seguro do nome do usuário em `localStorage` associado ao hash do email durante a espera do código OTP. |
| [persist-initial-profile-name.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/persist-initial-profile-name.mjs) | Garante que o nome informado na inscrição seja salvo na tabela `profiles` após o primeiro login bem-sucedido. |
| [otp-options.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/otp-options.mjs) | Configurações do payload para envio de OTP do Supabase (URLs de redirecionamento autorizadas). |
| [run-action.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/run-action.mjs) | Envoltório para execução de ações assíncronas de formulário com estados de carregamento e captura de erros amigáveis. |

---

## 3. Segurança e Regras do Módulo

1. **Privacidade de Dados**: Não exigimos nem armazenamos CPF. Senhas não são utilizadas no MVP (autenticação estritamente via OTP por email).
2. **Avatar Seguro**: O upload do avatar NUNCA envia o arquivo original cru para o Supabase. A imagem é sanitizada via Canvas da API do navegador, eliminando metadados EXIF e forçando MIME `image/webp`.
3. **Limpeza de Parâmetros na URL**: Sessões confirmadas removem tokens e parâmetros de callback da barra de endereços do navegador para evitar vazamento em histórico.

---

## 4. Testes Associados

Ao realizar modificações nesta pasta, execute:
```bash
node --test tests/account_deletion.test.cjs
node --test tests/account_session_visibility.test.cjs
node --test tests/auth_form_action.test.cjs
node --test tests/auth_phone.test.cjs
node --test tests/avatar_processing.test.cjs
node --test tests/avatar_upload_contract.test.cjs
node --test tests/pending_account_name.test.cjs
node --test tests/persist_initial_profile_name.test.cjs
```
