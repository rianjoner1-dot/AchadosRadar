# Checkpoint de encerramento — EFGH

Data: 01/10/2026  
Estado: checkpoint validado; objetivo geral ainda não concluído.

## Resultado confirmado neste checkpoint

- A revisão local da parte entregue pelo Gemini preservou as alterações existentes. O script de integração exige o ref e a URL exatos do projeto Supabase de desenvolvimento, omite tokens dos logs e remove o usuário temporário em `finally`.
- A integração com o Supabase de desenvolvimento foi executada com um usuário temporário: o trigger criou o perfil, `full_name` foi atualizado com cliente autenticado, um item foi inserido e removido para um produto publicado, e a conta temporária foi excluída. A consulta posterior confirmou a remoção do perfil em cascata. Nenhum pedido foi concluído.
- A leitura de configuração do Auth foi somente leitura: o SMTP não está configurado (`smtp_configured=false`, `smtp_sender_configured=false`), `site_url` aponta para produção e a allow list observada contém localhost:4321 e :3000. OTP por email segue sem validação de entrega.
- Produção passou em 12/12 combinações de rota/largura, incluindo produto real, galeria com foco visível e anúncio acessível. A galeria real observada tinha uma imagem; várias imagens foram cobertas por teste automatizado.
- Validação local final: Astro check em 111 arquivos, zero erros/avisos; build Astro/Vercel aprovado; 167/167 testes; 1 função serverless; artefato estático estimado em 1.351.560 bytes, abaixo de 5 MiB.
- Sem deploy nesta rodada. As alterações locais de apresentação precisam de revisão/publicação próprias antes de serem tratadas como aparência atual de produção.

## Pendências para retomar o objetivo integral

1. E: amostra real do Mercado Livre no Chrome, ciclo supervisionado de renovação, contador da extensão com registros reais e execução controlada do radar.
2. G: configurar SMTP/redirects no Supabase; testar OTP real; validar perfil, prévia e persistência/reload do avatar pela interface autenticada; validar sincronização/troca/limpeza do carrinho no navegador; testar remoção real do avatar ao excluir conta. O upload e substituição no Storage via API autenticada agora passaram em ambiente dev após a correção RLS de 01/10.
3. H: leitor de tela real; revisar preview privado da Vercel Pro; repetir fluxos no preview; confirmar autorização/divulgação de afiliados; deploy/observação final.
4. Aparência: revisar o tema neutro em desktop/tablet no preview e publicar a versão visual aprovada.

O checklist detalhado continua em `ETAPAS_PROCEDURAIS.md`; evidências e limites de cada execução estão em `VALIDACOES.md`. Este checkpoint encerra somente esta rodada de trabalho, não certifica 100% do objetivo EFGH.

## Correção posterior: upload de foto de perfil

Em 01/10 foi reproduzido o erro `new row violates row-level security policy` no Storage com usuário temporário autenticado. A migration `20261001120000_fix_avatar_storage_upload_rls.sql` foi aplicada ao projeto Supabase ligado de desenvolvimento; mantém RLS por pasta do proprietário e deixa tipo/tamanho sob as restrições nativas do bucket. O teste real passou para primeiro upload e substituição (`upsert`), e removeu objeto e conta temporários. A leitura remota confirmou as 24 migrations aplicadas e RLS ativo. A suíte local final passou 168/168, com Astro check limpo, build Vercel aprovado, 1 função e ~1,35 MB de ativos estáticos.

O fluxo pela tela autenticada do proprietário, incluindo seleção, preview, recarga e foto JPEG original, ainda precisa de confirmação no Chrome. A mensagem técnica do Storage foi substituída por orientação amigável no código; essa melhoria de texto exige publicar o frontend, enquanto a correção da policy já está no Supabase. Nenhum deploy frontend ocorreu nesta correção.
