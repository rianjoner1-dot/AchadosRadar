# Módulo Compartilhado (`src/modules/shared/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Contém utilitários globais e de configuração compartilhados por toda a aplicação cliente e servidora:
- [config.ts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/shared/config.ts): Lê as variáveis públicas do Supabase (`PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY`). Se as variáveis não estiverem definidas ou `PUBLIC_CATALOG_DEMO=true`, ativa transparentemente o **Modo Demo Seguro**.
- [marketplace-image-url.mjs](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/shared/marketplace-image-url.mjs): Normalização e resolução de URLs de imagens dos marketplaces.

---

## 2. Regras Rígidas de Segurança

- **NUNCA injete variáveis privadas aqui**: Este módulo é importado tanto em SSR quanto em código executado no navegador. NUNCA adicione `SUPABASE_SERVICE_ROLE_KEY` ou qualquer segredo neste arquivo.

---

## 3. Testes Associados

```bash
node --test tests/budget_and_contracts.test.cjs
node --test tests/check_images_in_chrome.test.cjs
```
