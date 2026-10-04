# Componentes Reutilizáveis da Interface (`src/components/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Contém os blocos visuais e componentes estruturais reutilizáveis da aplicação desenvolvidos em Astro.
Seguem rigorosamente as diretrizes de acessibilidade (WAI-ARIA), semântica HTML5 e orçamento estático da Vercel.

---

## 2. Componentes

| Componente | Responsabilidade |
| :--- | :--- |
| [Header.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/components/Header.astro) | Cabeçalho do site: barra de busca integrada, atalhos para os setores do catálogo, botão da lista de compras (com contador reativo) e link para a conta do usuário. |
| [Footer.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/components/Footer.astro) | Rodapé institucional: links legais ([Privacidade](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/privacidade.astro), [Termos](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/termos.astro)), aviso de transparência de afiliados e direitos reservados. |
| [ProductCard.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/components/ProductCard.astro) | Card individual de produto da vitrine: imagem responsiva com fallback resiliente, badge do marketplace, preço parcelado e à vista, porcentagem de desconto real e botão de salvar no carrinho. |

---

## 3. Diretrizes de Acessibilidade e Estilo

1. **Semântica HTML**: Todos os botões e links utilizam atributos ARIA adequados (`aria-label`, `aria-pressed`, `aria-live`).
2. **Orçamento de Assets**: Estilos de componentes devem reutilizar as classes e tokens do tema neutro ([src/styles/neutral-theme.css](file:///c:/Users/joner/Documents/associados/site-afiliados/src/styles/neutral-theme.css)). Evite adicionar seletores CSS pesados que inflem o payload.
3. **Links de Saída**: O `ProductCard` NUNCA aponta direto para o link de afiliado externo para evitar bypass da validação de segurança; ele sempre navega para a rota de detalhe do produto `/produto?id=...` ou `/produto/:id`.

---

## 4. Testes Associados

```bash
node --test tests/landmark_structure.test.cjs
node --test tests/product_card_checkout.test.cjs
node --test tests/privacy_disclosure.test.cjs
```
