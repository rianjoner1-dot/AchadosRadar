# Implementação visual após as funcionalidades

Este backlog começa depois dos fluxos funcionais dos blocos E, F, G e H. Nesta fase, não alterar a aparência da vitrine, do produto, da conta ou do carrinho por preferência visual; corrigir apenas problemas que impeçam uso, leitura ou acessibilidade das funções prioritárias.

## Itens visuais adiados

- Revisar a diferença de estabilidade visual observada entre local e produção em desktop. O registro `H1.9-H1.10-live-production-verified` em `VALIDACOES.md` mediu CLS 0,2849 em produção contra 0,0002 no artefato local. A causa precisa ser reproduzida no preview atual antes de qualquer correção.
- Fazer uma revisão visual completa do tema neutro em larguras móvel, tablet e desktop, mantendo o padrão simples de marketplace solicitado pelo proprietário.
- Corrigir espaçamentos, alinhamento, hierarquia tipográfica e acabamento visual encontrados nessa revisão. Não reabrir lógica de busca, estoque, carrinho ou saída de compra sem um defeito funcional reproduzível.

## Validação da etapa visual

1. Capturar a mesma rota e viewport no preview Vercel e local.
2. Revisar `/`, `/produto`, `/carrinho`, `/conta` e rodapé em 390, 768 e 1440 px.
3. Registrar cada ajuste visual e comprovar ausência de overflow ou regressão de navegação por teclado.
4. Repetir a medição de CLS no preview depois de localizar a causa; não usar a diferença antiga como prova de um defeito atual.

## Dependência de entrada

Iniciar somente após validação funcional de carrinho, identidade da conta e redirecionamento por item. O teste de prévia com leitor de tela e as verificações funcionais continuam no checklist principal; não são substituídos por esta etapa visual.
