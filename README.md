# Achados Radar

A coleta HTTP em lote da KaBuM pode ser executada com `npm run collect:once` ou `npm run collect:background`. Configure `AWIN_FEED_LIST_URL` no `.env`; detalhes, limites e checkpoints estão em [scripts/README.md](scripts/README.md).

> ⚠️ **PROTOCOLO OBRIGATÓRIO PARA AGENTES DE IA (REGRA DE OURO)**:  
> Antes de realizar qualquer alteração neste projeto, todo agente de IA **DEVE OBRIGATORIAMENTE LER** a documentação específica da respectiva pasta/módulo a ser modificado e consultar o [Hub Central em docs/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/README.md). Após concluir a tarefa, **DEVE ATUALIZAR** a documentação da pasta refletindo as modificações realizadas. Veja a diretiva completa em [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

Vitrine de alta performance para produtos e ofertas do Mercado Livre, Magazine Luiza, Amazon e Shopee. O usuário organiza sua lista de interesses, mas cada compra é finalizada individualmente no marketplace parceiro via links de afiliado auditados. O site não cobra valores, não reserva estoque e não processa pagamentos.

---

## 🌳 Árvore de Diretórios do Projeto

```text
site-afiliados/
├── .agents/                      # Regras e estratégias para agentes autônomos de IA
│   └── rules/                    # Regras específicas (ex: protocolo de documentação, high-ticket)
├── .env.example                  # Template das variáveis de ambiente necessárias
├── astro.config.mjs              # Configuração do framework Astro v7 e adaptador Vercel
├── AGENTS.md / CLAUDE.md / GEMINI.md # Diretivas para diferentes motores de IA
├── package.json                  # Dependências, engines e scripts operacionais
├── tsconfig.json                 # Configuração TypeScript estrita com exclusões de build
│
├── docs/                         # 📖 HUB CENTRAL DE DOCUMENTAÇÃO (docs/README.md)
│   ├── README.md                 # Índice mestre e navegação sistêmica
│   ├── ARQUITETURA.md            # Diagramas de arquitetura e isolamento de chaves
│   ├── CONTRATO_PRODUTO.md       # Estrutura obrigatória de produtos, ofertas e imagens
│   ├── BUSCA_E_SETORES.md        # Engenharia da busca textual e trigramas pg_trgm
│   ├── ETAPAS_PROCEDURAIS.md     # Checklist dos portões de qualidade e entregas
│   └── VALIDACOES.md             # Registro histórico e detalhado de testes e evidências
│
├── public/                       # 🌐 Assets estáticos servidos diretamente (public/README.md)
│   ├── exclusao.html             # Instruções de exclusão de dados (LGPD / Meta Platform)
│   ├── icon.png                  # Ícone de verificação de aplicativo Meta Developers
│   ├── achados-radar-mark.svg    # Vetor oficial da marca Radar
│   └── images/marketplaces/      # Logos dos marketplaces (Amazon, Magalu, ML, Shopee)
│
├── src/                          # 💻 Código-fonte da aplicação
│   ├── components/               # Componentes reutilizáveis Astro (src/components/README.md)
│   │   ├── Header.astro          # Topbar com busca, setores, carrinho e login
│   │   ├── Footer.astro          # Rodapé institucional, links e avisos legais
│   │   └── ProductCard.astro     # Card de produto resiliente com preço e botão de salvar
│   ├── layouts/                  # Layouts base (Layout.astro) com metatags e Speed Insights
│   ├── pages/                    # Rotas públicas e APIs serverless (src/pages/README.md)
│   │   ├── index.astro           # Vitrine inicial com carrosséis e paginação contínua
│   │   ├── produto.astro         # Página de detalhe dinâmico (/produto?id=...)
│   │   ├── produto/[id].astro    # Rotas pré-renderizadas para SEO (/produto/MLB...)
│   │   ├── carrinho.astro        # Lista salva (anônima + sincronizada com Supabase)
│   │   ├── conta.astro           # Painel de perfil, login OTP e upload de avatar WebP
│   │   ├── painel-admin.astro    # Dashboard protegido de métricas agregadas
│   │   ├── privacidade.astro     # Política de Privacidade (LGPD)
│   │   ├── termos.astro          # Termos de Uso e declaração de afiliação
│   │   └── api/                  # Endpoints serverless (outbound, account/delete, admin/metrics)
│   ├── styles/                   # Design system e folhas de estilo (src/styles/README.md)
│   │   ├── global.css            # Reset, grid responsivo e micro-animações
│   │   └── neutral-theme.css     # Paleta neutra dark mode, tokens HSL e glassmorphism
│   └── modules/                  # Módulos de lógica de negócio e domínio
│       ├── catalog/              # Catálogo, RPC v2, carrosséis e fotos (src/modules/catalog/README.md)
│       ├── auth/                 # OTP, perfis e avatar WebP (src/modules/auth/README.md)
│       ├── cart/                 # Estado do carrinho e sincronização (src/modules/cart/README.md)
│       ├── outbound/             # Redirecionamento e allowlist (src/modules/outbound/README.md)
│       ├── analytics/            # Telemetria sem cookies e métricas (src/modules/analytics/README.md)
│       ├── search/               # Normalização e classificação (src/modules/search/README.md)
│       └── shared/               # Configuração Supabase e modo demo (src/modules/shared/README.md)
│
├── supabase/                     # 🗄️ Banco de dados e migrações (supabase/README.md)
│   ├── config.toml               # Configuração local da CLI Supabase
│   └── migrations/               # 24 migrações SQL com tabelas, RLS, triggers e RPCs
│
├── scripts/                      # 🤖 Automação, bridge, testes e importação (scripts/README.md)
│   ├── local-catalog-bridge.mjs  # Ponte HTTP local na porta 6876 para a extensão
│   ├── orchestrate-radar.mjs     # Orquestrador do robô Chromium em background
│   ├── import-catalog.mjs        # Importador controlado com dry-run e service role
│   ├── verify-functions.cjs      # Auditoria do teto de funções serverless Vercel (<= 4)
│   └── verify-payload.cjs        # Auditoria de orçamento de payload estático (< 5 MiB)
│
└── tests/                        # 🧪 Suíte de 45 testes automatizados (tests/README.md)
    ├── database_block_d.test.cjs # Teste das migrações SQL completas via PGlite
    ├── fixtures/                 # Dados de teste (sample_20_cards.json)
    └── *.test.cjs                # Testes unitários e de integração de 100% dos módulos
```

---

## 🚀 Atalhos para Documentação por Pasta

| Pasta | Atalho para Documentação | Escopo Principal |
| :--- | :--- | :--- |
| **docs/** | [docs/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/README.md) | **Hub Central**: Arquitetura, Contrato de Produto, Planos e Validações. |
| **src/modules/catalog/** | [catalog/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/README.md) | Consumo da RPC v2, carrosséis, paginação por cursor e fotos. |
| **src/modules/auth/** | [auth/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/README.md) | Login OTP por email, avatar WebP no cliente e LGPD. |
| **src/modules/cart/** | [cart/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/cart/README.md) | Carrinho local (`localStorage`), fusão remota e prontidão de ofertas. |
| **src/modules/outbound/** | [outbound/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/README.md) | Allowlist de lojas, prova anti-adulteração e redirecionamento seguro. |
| **src/modules/analytics/** | [analytics/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/analytics/README.md) | Visualizações desduplicadas por aba e métricas do administrador. |
| **src/modules/search/** | [search/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/search/README.md) | Busca textual com trigramas `pg_trgm` e setores independentes. |
| **src/modules/shared/** | [shared/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/shared/README.md) | Configurações públicas do Supabase e fallback de modo demonstrativo. |
| **src/components/** | [components/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/components/README.md) | Blocos Astro reutilizáveis: Header, Footer e ProductCard. |
| **src/pages/** | [pages/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/README.md) | Rotas do site, renderização SSR/SSG e endpoints de API. |
| **src/styles/** | [styles/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/styles/README.md) | Tema dark neutro, tokens CSS e acessibilidade. |
| **supabase/** | [supabase/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/supabase/README.md) | Esquema relacional, 24 migrações, políticas RLS e Storage. |
| **scripts/** | [scripts/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/README.md) | Ponte do robô (6876), importador, orquestrador e orçamentos. |
| **tests/** | [tests/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/tests/README.md) | Suíte de 179 testes automatizados com Node test runner e PGlite. |
| **public/** | [public/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/public/README.md) | Assets estáticos, logos dos marketplaces e página legal da Meta. |

---

## ⚡ Comandos Rápidos

```bash
# Instalação de dependências
npm install

# Desenvolvimento local
npm run dev

# Iniciar ponte local para a extensão coletora (:6876)
npm run bridge

# Diagnóstico de tipagem (deve retornar 0 erros)
npx astro check

# Suíte de testes automatizados (179 testes)
npm test

# Validação de orçamentos Vercel (funções <= 4 e payload < 5 MiB)
npm run test:budget

# Compilação de produção
npm run build

# Validação completa local integrada (check + build + test + budget)
npm run validate:local
```

---

## 🔒 Princípios de Segurança e Boas Práticas

1. **Nunca Exponha Chaves Privadas**: `SUPABASE_SERVICE_ROLE_KEY` só existe no `.env` local para scripts confiáveis (`import-catalog.mjs`, `local-catalog-bridge.mjs`). Jamais passe essa chave para o cliente Astro ou extensão.
2. **Orçamento Rigoroso**: Mantenha o teto de até 4 funções serverless próprias no deploy da Vercel.
3. **Redirecionamento Confiável**: Todas as saídas de compra devem passar obrigatoriamente por `/api/out/[id]` e serem validadas pela allowlist de domínios permitidos.
4. **Registro de Validações**: Acompanhe o roteiro em [docs/ETAPAS_PROCEDURAIS.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/ETAPAS_PROCEDURAIS.md) e documente novos marcos em [docs/VALIDACOES.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/VALIDACOES.md).
