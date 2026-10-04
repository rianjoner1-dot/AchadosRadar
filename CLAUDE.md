# Instruções do Workspace para Claude Code (CLAUDE.md)

## Protocolo Obrigatório de Documentação
⚠️ **Antes de fazer qualquer alteração em arquivos de um módulo ou diretório:**
1. Leia o `README.md` localizado dentro da pasta alvo da modificação.
2. Consulte os contratos e arquitetura em [docs/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/docs/README.md).
3. Após codificar e validar com `npm test`, atualize o `README.md` da respectiva pasta refletindo as alterações.

## Comandos do Projeto (use RTK diretamente)
- `npm test`: Executa os testes automatizados com Node test runner.
- `npx astro check`: Diagnóstico estático e validação de tipos TypeScript.
- `npm run test:budget`: Auditoria de orçamento de payload e contagem de funções serverless Vercel.
- `npm run build`: Build de produção com Astro e adaptador Vercel.
- `npm run validate:local`: Validação local integrada (check + build + test + budget).
- `npm run bridge`: Inicia o bridge local de catálogo na porta 6876.

## Restrições Críticas
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no código do cliente ou navegador.
- Mantenha o teto de funções serverless Vercel <= 4 próprias (limite < 12).
- Mantenha links de redirecionamento restritos aos domínios permitidos (`mercadolivre.com.br`, `magazinevoce.com.br`, etc.).
