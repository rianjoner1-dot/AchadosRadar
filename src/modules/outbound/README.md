# Módulo de Redirecionamento e Segurança Externa (`src/modules/outbound/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Este módulo é a camada crítica de segurança e conformidade do **Achados Radar** para links de afiliados:
- **Redirecionamento Seguro**: Todas as saídas de compra passam pelo endpoint centralizado `/api/out/[id]`.
- **Allowlist Rígida de Domínios**: Nenhum usuário é redirecionado para domínios fora dos marketplaces oficiais aprovados.
- **Portão de Prontidão (Readiness Gate)**: O link de afiliado é bloqueado imediatamente se o produto estiver despublicado, o estoque for `unknown` ou esgotado, ou o link estiver expirado/quebrado.
- **Auditoria de Cliques Sem Travar o Usuário**: Registra o clique de saída em `product_daily_metrics` via Supabase RPC de forma não-bloqueante (falhas de telemetria não impedem o redirecionamento).

---

## 2. Estrutura de Arquivos

| Arquivo | Descrição |
| :--- | :--- |
| [allowlist.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/allowlist.mjs) | Validador estrito de domínios permitidos por marketplace (ML, Magalu, Amazon, Shopee, Lojas Benoit e KaBuM! via Awin). Rejeita IPs, URLs com credenciais, protocolos não-HTTPS e subdomínios não reconhecidos. |
| [allowlist.d.mts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/allowlist.d.mts) | Definições de tipo para a allowlist. |
| [freshness.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/freshness.mjs) | Checagem de validade temporal da observação de preços e prazos de expiração fornecidos pelos programas de afiliados. |
| [freshness.d.mts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/freshness.d.mts) | Definições de tipo para expiração e frescura. |
| [readiness.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/readiness.mjs) | `evaluateOfferReadiness`: Avalia se uma oferta atende todos os critérios para permitir a saída (estoque confirmado, link ativo, status publicado). |
| [redirect-handler.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/redirect-handler.mjs) | Manipulador da rota `/api/out/[id]`: consulta o Supabase, confere a allowlist e emite HTTP 307 com headers estritos de privacidade (`no-referrer`, `no-store`). |
| [redirect-policy.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/redirect-policy.mjs) | Geração e validação de tokens de prova de redirecionamento para evitar manipulação de saída por terceiros. |
| [redirect-policy.d.mts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/outbound/redirect-policy.d.mts) | Definições de tipo para a política de redirecionamento. |

---

## 3. Diretrizes de Segurança

1. **Anti-Open-Redirect**: NUNCA receba uma URL arbitrária via query param para redirecionamento. O endpoint `/api/out/[id]` recebe exclusivamente o UUID do produto e busca o link de afiliado oficial direto no banco de dados.
2. **Proteção de Privacidade**: Todas as respostas de redirecionamento utilizam:
   - `Cache-Control: no-store, private`
   - `Referrer-Policy: no-referrer`
3. **Fail-Closed**: Em caso de produto inexistente, erro de integridade ou link expirado, o sistema retorna status de erro e bloqueia o redirecionamento, protegendo a reputação e a experiência do usuário.

---

## 4. Testes Associados

Ao realizar modificações nesta pasta, execute:
```bash
node --test tests/outbound_allowlist.test.cjs
node --test tests/outbound_freshness.test.cjs
node --test tests/outbound_redirect_policy.test.cjs
node --test tests/offer_readiness.test.cjs
node --test tests/redirect_handler.test.cjs
node --test tests/link_timing.test.cjs
```
