# Módulo de Analytics e Métricas (`src/modules/analytics/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Este módulo concentra o rastreamento anônimo e as métricas gerenciais do **Achados Radar**:
- **Desduplicação de Visualizações**: O cliente só contabiliza uma visualização de produto por aba do navegador (`sessionStorage`), impedindo contagens duplicadas ao rolar a página ou alternar abas.
- **Painel Administrativo (`/painel-admin`)**: Exibe agregados de cliques de saída e visualizações divididos por loja e período (`today`, `7d`, `30d`).
- **Segurança e RBAC**: Apenas administradores autenticados com claim `role = 'admin'` têm acesso aos números completos; requisições não autorizadas falham imediatamente sem vazar informações.

---

## 2. Estrutura de Arquivos

| Arquivo | Descrição |
| :--- | :--- |
| [client.ts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/analytics/client.ts) | Cliente de telemetria anônima: invoca a RPC `record_product_view` no Supabase com desduplicação por aba. |
| [admin-metrics-handler.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/analytics/admin-metrics-handler.mjs) | Handler serverless para `/api/admin/metrics`: valida a sessão JWT do usuário, confere o período solicitado e consulta a RPC restrita. |
| [admin-metrics-loader.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/analytics/admin-metrics-loader.mjs) | Utilitário frontend para carregar dados de métricas com cabeçalhos anti-cache. |

---

## 3. Diretrizes de Privacidade e Performance

1. **Sem Rastreamento Invasivo**: Não usamos cookies de terceiros nem fingerprinting de dispositivos. Os registros em `product_daily_metrics` são puramente agregados numéricos diários por produto.
2. **Telemetria Silenciosa**: Se a requisição de analytics falhar (por exemplo, bloqueador de anúncios ou oscilação de rede), a navegação do usuário NÃO é interrompida e nenhum erro é exibido na tela.

---

## 4. Testes Associados

Ao realizar modificações nesta pasta, execute:
```bash
node --test tests/analytics_client.test.cjs
node --test tests/admin_metrics_handler.test.cjs
node --test tests/admin_metrics_loader.test.mjs
node --test tests/admin_dashboard_markup.test.cjs
```
