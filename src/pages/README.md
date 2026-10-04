# Rotas e Páginas da Aplicação (`src/pages/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Contém a estrutura de roteamento da aplicação Astro v7 com o adaptador `@astrojs/vercel`:
- **Páginas de Apresentação**: Roteamento baseado em arquivos para a vitrine principal, detalhes de produto, carrinho, autenticação e painéis.
- **Endpoints de API Serverless**: Handlers sob `api/` para operações protegidas e seguras (redirecionamento de saída, exclusão de conta e métricas administrativas).

---

## 2. Mapa de Páginas e Rotas

| Rota / Arquivo | Tipo | Descrição |
| :--- | :--- | :--- |
| [index.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/index.astro) | SSR / Híbrido | Página inicial (Vitrine): arquitetura de seções ordenada estrategicamente (Hero -> Explore por loja -> Categorias em destaque -> Seleção do Radar sem espaços vazios -> Buscar ofertas com busca e filtragem in-place). Lojas ativas: Magalu, Mercado Livre, Amazon, Shopee e KaBuM! (Lojas Benoit removida). Produtos sem fotos são classificados como esgotados/indisponíveis e omitidos da vitrine. Alertas de revisão/observação são mascarados para usuários públicos e exibidos com telemetria administrativa exclusivamente para o Admin Master (`rianjonerparceiros@gmail.com`). |
| [busca.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/busca.astro) | SSR / Feed Dinâmico | Página dedicada de busca e descoberta estilo feed: carregamento suave e progressivo, paginação por cursor, filtros rápidos por loja (Magalu, KaBuM!, Mercado Livre, Shopee, Amazon) e setor, chips de ordenação e busca por aproximação fonética/trigramas com omissão estrita de produtos sem imagem válida. |
| [produto.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/produto.astro) | SSR | Página de produto por query param (`/produto?id=...`): renderização sob demanda com metatags OpenGraph dinâmicas, galeria, especificações da loja e botão "Continuar na [Loja]" que preserva o fluxo de compra. Banners de revisão interna e telemetria de auditoria de estoque são restritos ao Admin Master, enquanto usuários comuns visualizam status limpo e amigável. |
| [produto/[id].astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/produto/[id].astro) | Prerender (SSG) | Rotas amigáveis para SEO (`/produto/MLB...`) pré-renderizadas durante o build para os produtos mais populares. |
| [carrinho.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/carrinho.astro) | Client / SSR | Lista de produtos salvos: suporte híbrido (anônimo via `localStorage` e autenticado via Supabase), checagem de estoque em tempo real e redirecionamento de saída seguro com suporte a todas as lojas parceiras. |
| [conta.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/conta.astro) | Client / SSR | Gestão de conta e perfil: envio de código OTP por email, edição de nome/telefone, upload de avatar e solicitação de exclusão. |
| [painel-admin.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/painel-admin.astro) | SSR Protegido | Painel de controle de métricas diárias, cliques de afiliados e conversões agregadas. |
| [privacidade.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/privacidade.astro) | Estático | Política de Privacidade em conformidade estrita com LGPD e políticas de desenvolvedor Meta. |
| [termos.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/termos.astro) | Estático | Termos e Condições de Uso da plataforma e transparência sobre links de afiliados. |
| [404.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/404.astro) | Estático | Página amigável para recursos ou produtos não encontrados. |

---

## 3. Endpoints de API (`src/pages/api/`)

| Endpoint | Método | Descrição |
| :--- | :--- | :--- |
| `api/out/[id].ts` | `GET` | **Redirecionamento Seguro**: Valida prontidão da oferta no Supabase, confere allowlist de domínios parceiros, emite log de clique diário e emite HTTP 307 para o link de afiliado. |
| `api/account/delete.ts` | `POST` | **Exclusão de Conta**: Verifica sessão autenticada do usuário e executa a exclusão de perfil e dados pessoais conforme a LGPD. |
| `api/admin/metrics.ts` | `GET` | **Métricas do Admin**: Retorna agregações de visualizações e cliques para administradores autenticados. |

A página `produto.astro` também apresenta preço Pix e cartão/parcelas em campos separados, galeria/vídeo permitido e, quando o banco fornece, avaliação observada, quantidade de avaliações e especificações da loja escapadas para exibição segura. O fallback global de imagem na `Layout.astro` não altera imagens decorativas sem alternativa textual nem trata uma imagem ainda sem `src` como quebrada.

---

## 4. Orçamento de Performance Vercel

O adaptador Vercel agrupa essas rotas em **1 função serverless consolidada** (dentro da meta rigorosa do projeto de <= 4 funções próprias).
Antes de criar qualquer nova rota em `src/pages/api/`, verifique se ela não ultrapassa esse orçamento executando:
```bash
npm run test:budget
```

## Correção da paginação

A página inicial diversifica tipos de produto com amostra temática limitada e mantém um conjunto de IDs apresentados por carregamento. A apresentação aleatória não altera os cursores do banco nem a ordenação solicitada por preço. Home e busca ocultam cards com imagem indisponível confirmada; não removem produtos do banco.

Home e busca preservam a última página parcial e avançam pelo cursor bruto mesmo quando imagens inválidas reduzem a quantidade visível. Antes de remover uma imagem quebrada, reportam a falha ao catálogo remoto.
