# Achados Radar

Vitrine de ofertas do Mercado Livre e da Magalu. O usuário pode salvar produtos, mas cada compra é concluída individualmente no marketplace. O site não cobra, não reserva estoque e não cria pedidos.

## Arquitetura

- Astro 5 com adaptador Vercel: rotas de catálogo e saída dinâmicas, com páginas de demonstração pré-renderizadas.
- Supabase Postgres, RLS, Auth por email OTP e Storage para avatar. A chave service role fica somente no importador executado em ambiente local confiável.
- Busca, filtros, paginação e feed relacionados usam `fetch`/AJAX. A primeira consulta é limitada a 20 itens e as imagens vêm das URLs de origem permitidas.
- Meta de até 4 funções serverless; limite rígido do projeto abaixo de 12. O artefato local atual contém uma função.
- Orçamento local: JSON inicial de 20 cards até 100 KB e conjunto de assets JS/CSS abaixo de 5 MiB estimados com gzip. As imagens externas dos marketplaces são medidas separadamente. O limite de payload de função Vercel é distinto desse orçamento de transferência.

## Estrutura

- `src/pages/`: vitrine, produto, conta, lista salva, rotas API, termos e privacidade.
- `src/modules/catalog/`: consulta ao catálogo, busca e tipos.
- `src/modules/cart/`: armazenamento local do carrinho/lista de interesse.
- `src/modules/auth/`: OTP, perfil, avatar e sincronização de carrinho.
- `src/modules/outbound/`: validação de domínio e validade de links de saída.
- `supabase/migrations/`: esquema, políticas RLS, busca e RPC de importação.
- `scripts/import-catalog.mjs`: dry-run e importação controlada.
- `scripts/verify-functions.cjs` e `scripts/verify-payload.cjs`: orçamento do build Vercel.
- `docs/`: arquitetura, contrato de produto, etapas e evidências de validação.

## Comandos

```bash
npm install
npm run dev
npm run bridge
npm run check
npm test
npm run build
npm run test:budget
```

Em outra janela, `npm run bridge` inicia a ponte local em `127.0.0.1:6875`. A extensão já usa esse endereço para enviar observações. A ponte grava/atualiza somente `data/catalogo_macro.json` e não conecta ao Supabase nem publica produtos.

Para conferir uma amostra sem rede nem escrita:

```bash
node scripts/import-catalog.mjs <catalogo.json> --dry-run --summary --platform=magalu --limit=1
node scripts/import-catalog.mjs <catalogo.json> --dry-run --summary --platform=mercadolivre --limit=1
```

Após iniciar a ponte e receber produtos, use `data/catalogo_macro.json` como `<catalogo.json>`.

A importação real requer `PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em ambiente local confiável. Nunca coloque a chave secreta na extensão, no site ou no chat.

## Estado

- Base, migrations, RLS e testes locais estão implementados.
- Importador validado com export existente: 175 registros analisados; 64 registros Magalu/Mercado Livre aceitos pelo contrato, nenhum publicável até confirmar link e estoque.
- Vitrine, produto, carrinho, OTP e saída têm implementação local. Auth real, sincronização com Supabase, preview/deploy e autorização de uso de links/imagens ainda precisam de validação nos serviços e portais reais.
- Vercel Pro já está disponível; ainda falta vincular o projeto à equipe. Supabase, SMTP e URLs autorizadas de autenticação ainda não foram conectados.

Use o [roteiro procedural](docs/ETAPAS_PROCEDURAIS.md) e registre cada resultado em [VALIDACOES.md](docs/VALIDACOES.md). Não marque um portão como concluído apenas porque o código compila.
