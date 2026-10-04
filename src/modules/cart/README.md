# Módulo de Carrinho e Lista de Interesses (`src/modules/cart/`)

> ⚠️ **REGRA OBRIGATÓRIA PARA AGENTES DE IA**: Antes de alterar qualquer arquivo nesta pasta, leia este documento na íntegra. Após concluir suas alterações, atualize este README refletindo as novas funções, tipos ou contratos criados. Veja [.agents/rules/ai-documentation-protocol.md](file:///c:/Users/joner/Documents/associados/site-afiliados/.agents/rules/ai-documentation-protocol.md).

---

## 1. Visão Geral

O módulo de carrinho gerencia a lista de produtos salvos pelo visitante ou usuário autenticado:
- **Modelo Híbrido**: Usuários anônimos salvam produtos em `localStorage` sob a chave `achados_radar_cart`.
- **Sincronização no Login**: Quando o usuário realiza login, os itens salvos localmente como visitante são fundidos (`merge`) com os itens remotos da conta em `public.cart_items` no Supabase.
- **Isolamento de Contas**: Ao trocar de conta, os itens da conta anterior não vazam para a nova conta.
- **Caráter Informativo**: O carrinho do Achados Radar NÃO processa pagamento, NÃO reserva estoque e NÃO cria pedidos. Ele serve como organizador pessoal de ofertas.

---

## 2. Estrutura de Arquivos

| Arquivo | Descrição |
| :--- | :--- |
| [store.ts](file:///c:/Users/joner/Documents/associados/site-afiliados/src/modules/cart/store.ts) | Gerenciador completo de estado do carrinho: leitura/escrita em `localStorage`, contadores reativos, listeners de eventos `storage`, fusão de itens, remoção atômica e limpeza. |

---

## 3. Regras de Negócio e Contratos

1. **FK ON DELETE RESTRICT**: No banco de dados, `cart_items` possui chave estrangeira com `ON DELETE RESTRICT` para produtos. Um produto que esteja no carrinho de alguém nunca é deletado fisicamente do banco de dados; se o produto for descontinuado, ele é arquivado (`status = 'archived'`), e o carrinho continua exibindo o item arquivado de forma amigável ao usuário.
2. **Atualização de Estado de Oferta**: Ao abrir a página do carrinho ([carrinho.astro](file:///c:/Users/joner/Documents/associados/site-afiliados/src/pages/carrinho.astro)), cada item consulta a frescura da oferta e a disponibilidade de estoque antes de habilitar o botão de checkout.
3. **Resiliência a Falhas de Conexão**: Se a API do Supabase estiver indisponível no momento da sincronização, os itens do carrinho continuam intactos e utilizáveis localmente no navegador, sem loops infinitos de renderização.

---

## 4. Testes Associados

Ao realizar modificações nesta pasta, execute:
```bash
node --test tests/cart_store.test.cjs
node --test tests/auth_cart_sync.test.cjs
node --test tests/product_card_checkout.test.cjs
```
