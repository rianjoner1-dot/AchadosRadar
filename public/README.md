# Arquivos Estáticos Públicos (`public/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo novos assets criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

Os arquivos nesta pasta são servidos diretamente na raiz da aplicação pelo Astro e pelo CDN da Vercel sem passar pelo bundler de scripts/estilos.

---

## 2. Inventário de Arquivos

| Arquivo / Pasta | Finalidade |
| :--- | :--- |
| [exclusao.html](file:///c:/Users/joner/Documents/associados/site-afiliados/public/exclusao.html) | **Página Legal Obrigatória**: Instruções claras de exclusão de dados do usuário e conformidade com a LGPD e as políticas de desenvolvedores da Meta / Facebook. |
| [icon.png](file:///c:/Users/joner/Documents/associados/site-afiliados/public/icon.png) | Ícone oficial de alta resolução utilizado na verificação de aplicativo do Meta Developers. |
| [achados-radar-mark.svg](file:///c:/Users/joner/Documents/associados/site-afiliados/public/achados-radar-mark.svg) | Vetor SVG oficial do símbolo do radar utilizado no cabeçalho e na interface. |
| [favicon.svg](file:///c:/Users/joner/Documents/associados/site-afiliados/public/favicon.svg) | Favicon vetorial do site. |
| [product-placeholder.svg](file:///c:/Users/joner/Documents/associados/site-afiliados/public/product-placeholder.svg) | Imagem de substituição exibida quando um produto não possui fotos ou quando a URL original falha. |
| [robots.txt](file:///c:/Users/joner/Documents/associados/site-afiliados/public/robots.txt) | Instruções de indexação para rastreadores (Search Engines). |
| `images/marketplaces/` | Logos oficiais dos parceiros (`amazon.png`, `magalu.png`, `mercadolivre.png`, `shopee.png`). |

---

## 3. Diretrizes de Orçamento

Qualquer novo asset adicionado aqui afeta o limite de transferência estática de 5 MiB medido pelo script `verify-payload.cjs`. Sempre otimize arquivos SVG e comprima imagens rasterizadas antes de incluí-las.
