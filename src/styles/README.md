# Sistema de Estilos e Design System (`src/styles/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas variáveis ou classes criadas. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Define a identidade visual e o design system do **Achados Radar**:
- **Vanilla CSS Puro**: Máxima flexibilidade, sem dependência de pré-processadores ou frameworks como Tailwind (salvo solicitação expressa).
- **Tema Escuro Moderno (Neutral Theme)**: Base de alta fidelidade visual, com paleta neutra, tons de slate/zinc e destaque em ciano vibrante.
- **Micro-animações**: Transições suaves de hover, feedback tátil e loaders orbitais.

---

## 2. Arquivos

| Arquivo | Descrição |
| :--- | :--- |
| [global.css](file:///c:/Users/joner/Documents/associados/site-afiliados/src/styles/global.css) | Reset CSS, tipografia, grid de produtos, botões utilitários, loaders reativos (`.orb-loader`) e layout base. |
| [neutral-theme.css](file:///c:/Users/joner/Documents/associados/site-afiliados/src/styles/neutral-theme.css) | Variáveis de cores HSL/Hex, superfícies em glassmorphism, badges de marketplaces e contraste acessível. |

---

## 3. Diretrizes de Design

- **Consistência de Cores**: Utilize as variáveis CSS declaradas em `:root` (ex: `--bg-primary`, `--text-primary`, `--accent-color`).
- **Acessibilidade**: Sempre garanta contraste mínimo WCAG AA para textos informativos e preços.
- **Orçamento**: A folha de estilo deve permanecer compacta para cumprir a meta de transferência cumulativa (< 5 MiB com gzip).
