# Instruções para Agentes Autônomos e IAs (AGENTS.md)

Este repositório possui regras rigorosas de integridade arquitetural, orçamento de performance e sincronização de documentação.

## ⚠️ REGRA INEGOCIÁVEL: PROTOCOLO DE DOCUMENTAÇÃO

Antes de realizar **qualquer alteração de código**, a IA **DEVE**:
1. **LER OBRIGATORIAMENTE O README DA PASTA/MÓDULO ALVO**:
   - Cada pasta (`src/modules/*`, `src/pages/*`, `src/components/*`, `supabase/*`, `scripts/*`, `tests/*`, etc.) possui um `README.md` que dita seus contratos, segurança e testes.
2. **CONSULTAR O HUB CENTRAL**:
   - Leia [docs/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/README.md) para visão sistêmica e contratos de produto.
3. **ATUALIZAR A DOCUMENTAÇÃO NO FINAL**:
   - Toda alteração em um módulo exige a atualização imediata do `README.md` da respectiva pasta e, se aplicável, dos índices centrais em `docs/`.
4. **VALIDAR A INTEGRIDADE**:
   - Execute: `npx astro check && npm test && npm run test:budget && npm run build`.

Para detalhes completos sobre o protocolo, consulte [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).
