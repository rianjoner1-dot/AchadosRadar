# Hub Central de Documentação Técnica — Achados Radar

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer código no repositório, localize e leia a documentação específica do módulo/pasta a ser alterado. Após concluir sua tarefa, você DEVE atualizar o respectivo README com as mudanças realizadas. Veja o protocolo em [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral do Sistema

A revisão da coleta em segundo plano está registrada em [RELATORIO_COLETA_2026-10-04.md](RELATORIO_COLETA_2026-10-04.md). Consulte também [scripts/README.md](../scripts/README.md) para os comandos do pipeline KaBuM/Awin.

O **Achados Radar** é uma vitrine inteligente de produtos e ofertas de alto valor e giro rápido dos maiores marketplaces do Brasil (Mercado Livre, Magazine Luiza, Amazon e Shopee).
- **Sem intermediação financeira**: O usuário salva produtos no carrinho local ou sincronizado, mas cada compra é finalizada no próprio marketplace por meio de links de afiliado auditados e validados.
- **Stack**: Astro v7 (SSR via `@astrojs/vercel`), TypeScript estrito, PostgreSQL Supabase com RLS rigoroso e PGlite em testes.
- **Ponte e Robô de Coleta**: Extensão Chrome Manifest V3 comunicando com ponte local (`scripts/local-catalog-bridge.mjs` na porta `6876`) para upsert atômico e importação controlada via service role isolado.

---

## 2. Mapa Temático da Documentação Central (`docs/`)

| Área | Arquivo | Descrição |
| :--- | :--- | :--- |
| **Arquitetura Geral** | [ARQUITETURA.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/ARQUITETURA.md) | Fluxo de dados ponta a ponta, isolamento de chaves, modelo de segurança e responsabilidades. |
| **Contrato de Produto** | [CONTRATO_PRODUTO.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/CONTRATO_PRODUTO.md) | Estrutura de dados obrigatória, validação de URLs, fotos, preços, estoque e integridade de links. |
| **Busca & Setores** | [BUSCA_E_SETORES.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/BUSCA_E_SETORES.md) | Engenharia da busca textual, trigramas `pg_trgm`, categorização e filtros por setor. |
| **Plano de Setores** | [busca-setores-plano.md](file:///c:/Users/joner/Documents/associados/site-afiliados/busca-setores-plano.md) | Plano de implementação da RPC `search_catalog_v2` e classificação de produtos. |
| **Carrosséis & Categorias** | [IMPLEMENTACAO_BUSCA_CATEGORIA_CARROSSEL.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/IMPLEMENTACAO_BUSCA_CATEGORIA_CARROSSEL.md) | Destaques da vitrine, trilhas dinâmicas por categoria e seleção de ofertas em destaque. |
| **Roteiro Procedural** | [ETAPAS_PROCEDURAIS.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/ETAPAS_PROCEDURAIS.md) | Checklist de 100% dos portões de qualidade, status de entrega e validações de produção. |
| **Histórico de Validações** | [VALIDACOES.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/VALIDACOES.md) | Registro histórico e detalhado de todas as baterias de testes e evidências executadas. |
| **Validações de Busca** | [VALIDACOES_BUSCA_SETORES.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/VALIDACOES_BUSCA_SETORES.md) | Evidências dos testes do motor de busca, acentuação, tolerância a typos e paginação por cursor. |
| **Status Codex** | [CHECKPOINT_EFGH_20261001.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/CHECKPOINT_EFGH_20261001.md) | Status dos blocos de produto, carrinho autenticado, redirecionamento e analytics. |
| **Memória Operacional** | [.agents/rules/project-operational-memory.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/project-operational-memory.md) | Guardrails arquiteturais, armadilhas de testes por regex e diretrizes de cache. |
| **Design System** | [paleta-principal.svg](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/paleta-principal.svg) | Especificação visual e paleta de cores primárias, neutras e de contraste da interface. |
| **Prioridades Site e Macro** | [PRIORIDADES_SITE_MACRO_E_COLETA.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/PRIORIDADES_SITE_MACRO_E_COLETA.md) | Escopo atual de coleta, ofertas, integração Awin e dependências de validação externa. |

---

## 3. Atalhos para os Documentos das Pastas e Módulos

Antes de alterar qualquer código, clique no atalho da respectiva pasta e leia seu README específico:

### 🧩 Módulos Core (`src/modules/`)
- [src/modules/catalog/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/catalog/README.md): Consumo do catálogo via Supabase RPC v2, carrosséis de destaque, paginação estável por cursor, fallback de fotos e alternância entre lojas.
- [src/modules/auth/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/auth/README.md): Autenticação OTP por email, recorte e compressão WebP de avatar no cliente, normalização telefônica e sincronização de perfil.
- [src/modules/cart/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/cart/README.md): Gerenciamento da lista de interesses local (`localStorage`), fusão com Supabase no login e verificação de prontidão de ofertas.
- [src/modules/outbound/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/README.md): Camada de segurança para saída de compras: allowlist de domínios parceiros, timestamps criptográficos anti-adulteração e verificação de estoque ativo.
- [src/modules/analytics/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/analytics/README.md): Métricas administrativas, contagem de visualizações com desduplicação por aba e painel gerencial.
- [src/modules/search/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/search/README.md): Normalização de strings, remoção de diacríticos e regras de aproximação por palavras.
- [src/modules/shared/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/shared/README.md): Configurações compartilhadas de ambiente (Supabase URL/Anon Key) e modo de demonstração.

### 🖥️ Interface e Apresentação (`src/`)
- [src/components/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/components/README.md): Componentes reutilizáveis Astro (`Header`, `Footer`, `ProductCard`), acessibilidade (WAI-ARIA) e semântica.
- [src/pages/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/README.md): Páginas públicas e administrativas (`index`, `produto`, `carrinho`, `conta`, `painel-admin`) e endpoints de API serverless.
- [src/styles/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/src/styles/README.md): Tokens CSS, paleta neutra com dark mode, tipografia moderna e classes utilitárias.

### 🗄️ Infraestrutura, Scripts e Qualidade
- [supabase/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/supabase/README.md): Esquema de banco de dados, inventário de 24 migrações, políticas RLS, triggers e bucket de avatars.
- [scripts/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/README.md): Manual dos utilitários de automação, incluindo bridge local, importador de catálogo, orquestrador do robô, sessão Awin visível, auditoria de imagens e orçamento de payload.
- [tests/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/tests/README.md): Guia de testes automatizados com Node test runner e PGlite, cobrindo 100% dos fluxos críticos.
- [public/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/public/README.md): Assets estáticos, marcas de marketplaces, SVG mark do radar e página legal de exclusão de dados da Meta/LGPD.

---

## 4. Fluxo Arquitetural de Dados

```text
[Marketplaces: ML / Magalu / Amazon / Shopee]
                     │
         (Robô Autônomo / Extensão MV3)
                     │
          HTTP POST  ▼
    [Ponte Local 127.0.0.1:6876] (scripts/local-catalog-bridge.mjs)
                     │
                     ├─► Grava atomicamente em data/catalogo_macro.json
                     │
          Service Role Isolated
                     ▼
  [Importador Local com Validações] (scripts/import-catalog.mjs)
                     │
                     ├─► Valida formato de fotos, domínio de afiliado e estoque
                     │
          RPC Seguro  ▼
       [Supabase PostgreSQL] (Tabelas com RLS + Storage Avatars)
                     ▲
          Chave Anon │ (Apenas leitura de dados publicados e RPCs)
                     ▼
      [Frontend Astro v7 / SSR Vercel] (src/)
```

---

## 5. Comandos de Validação Geral

Revisão da vitrine de 04/10: distribuição por tipo de produto na home, ocultação de cards com foto ausente confirmada e otimização de `search_catalog_v2` para eliminar timeout observado em buscas públicas. Os contratos estão nos READMEs de catálogo, páginas e Supabase.

A revisão de `RELATORIO_MELHORIAS_TOPICOS_3_E_4.md` corrigiu redirecionamentos, encerramento do circuito, retenção/recuo das falhas e validação de campos opcionais. O adendo no relatório distingue as correções aplicadas das propostas adiadas.

Para verificar se nenhuma alteração quebrou contratos ou regras:

```bash
# Diagnóstico estático e validação de tipos
npx astro check

# Execução da suíte completa de testes (189 testes)
npm test

# Auditoria de orçamento Vercel (limite de funções <= 4 e payload estático <= 5 MiB)
npm run test:budget

# Compilação completa para produção
npm run build
```
