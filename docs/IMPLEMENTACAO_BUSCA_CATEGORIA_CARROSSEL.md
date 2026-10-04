# Busca, categorias, destaques e privacidade

## O que mudou

- A vitrine da página inicial pode exibir até três carrosséis, com até cinco produtos classificados em cada um. Cada produto aparece em uma categoria diferente na seleção dos destaques.
- Cada carrossel troca de oferta a cada três segundos. Inclui pausa, anterior/próximo, pausa enquanto recebe foco ou ponteiro, e respeita a preferência de movimento reduzido do sistema.
- O filtro de setor fica separado do campo de texto. Selecionar “Móveis” não escreve “sofá rack painel cama” na busca.
- Os extratores de Magalu, Mercado Livre, Amazon e Shopee passam a preencher `category` pelo breadcrumb oficial da página ou por uma classificação conservadora do título. O tópico da coleta segue disponível para orientar o robô, mas não é usado como categoria. Quando não houver sinal confiável, o campo fica vazio.
- O banco já possui `products.category` e o classificador de setores. A migration nova não duplica esse campo.
- O registro de buscas mantém apenas contagens agregadas por dia, termo normalizado e setor. Não armazena usuário, sessão, endereço IP ou agente de navegador. Padrões de email, URL, telefone, consultas vazias/curtas e textos acima do limite são ignorados. A tabela agregada não é legível por usuários anônimos/autenticados.

## Validação local

- `npm run validate:local`: Astro check passou sem erros/avisos (duas dicas preexistentes), build Vercel concluído e 179/179 testes passaram.
- Orçamentos Vercel: 1 função serverless; transferência estática estimada em 1.538.920 bytes, abaixo de 5 MiB.
- Testes direcionados de carrossel, migration/inventário e agregação anônima: 9/9 passaram; a migration foi executada em PostgreSQL efêmero PGlite, incluindo filtros de email/telefone e contagem de termos.
- Sintaxe dos quatro crawlers de marketplace e do utilitário compartilhado: passou.
- Teste do classificador de categoria do robô: 1/1 passou, incluindo o cenário de vestido com categoria antiga de móveis e rack com categoria antiga de moda.

## Pendente

- A migration de log anônimo ainda precisa ser revisada e aplicada no Supabase de desenvolvimento por quem está responsável pela camada remota.
- O classificador precisa ser conferido com produtos reais depois de uma nova rodada do radar. Nenhuma coleta real, alteração remota ou publicação foi executada aqui.

## Portão de publicação

1. No Supabase vinculado, conferir o histórico antes de aplicar qualquer coisa. O estado registrado em `docs/VALIDACOES.md` é de 23 migrations aplicadas em 01/10; o catálogo local agora inclui também as migrations `20261002140000` e `20261002150000`. Se ambas ainda estiverem pendentes, aplicar em ordem e executar `scripts/verify-remote-schema.sql`. O relatório precisa mostrar a migration completa, a RPC disponível, a tabela agregada protegida e a tabela bruta removida.
2. Revisar o diff local e incluir os arquivos do site e do robô no fluxo de publicação do repositório. Os arquivos desta rodada ainda estão como alterações locais; não foram enviados ao GitHub.
3. Gerar preview Vercel a partir desse estado e validar busca livre + setor separado, troca do carrossel, página do produto, conta e carrinho. Só depois do preview, promover o build para produção e acompanhar as primeiras visitas conforme H1.12 em `docs/ETAPAS_PROCEDURAIS.md`.

Neste ambiente não há CLIs Supabase/Vercel disponíveis no PATH nem vínculo local `.vercel/project.json`; portanto o estado remoto e o preview não puderam ser verificados por esta rodada. O portão local (`npm run validate:local`) está aprovado, mas o portão de publicação segue aberto até completar os três passos acima.
