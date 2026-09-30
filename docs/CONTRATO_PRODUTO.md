# Contrato de produto entre robô e importador

Exemplo ilustrativo, sem link real:

```json
{
  "platform": "mercadolivre",
  "id": "MLB123456789",
  "title": "Produto de exemplo",
  "originalUrl": "https://produto.mercadolivre.com.br/MLB123456789",
  "affiliateUrl": null,
  "isOfficialShortLink": false,
  "linkStatus": "pending_conversion",
  "linkExpiresAt": null,
  "refreshDueAt": "2026-10-06T12:00:00Z",
  "price": 89.9,
  "images": ["https://http2.mlstatic.com/exemplo.jpg"],
  "installments": "até 3x conforme anúncio",
  "shipping": "consulte seu CEP",
  "coupon": "",
  "sellerName": "Lojas Exemplo",
  "sellerId": "lojasexemplo",
  "storeName": "Magalu",
  "storeAffiliateId": "magazineachadosradarbr",
  "stockQuantity": null,
  "stockStatus": "unknown",
  "stockEvidence": "",
  "offerObservedAt": "2026-09-29T12:00:00Z"
}
```

Regras: `platform` e `id` obrigatórios e estáveis; preço positivo quando exibido; `sellerName` e `sellerId` preservados para garantir que a oferta mantenha a correspondência com o vendedor original no marketplace; `storeName` e `storeAffiliateId` registram a loja parceira de origem; `images` em ordem e sem URLs de ícones; URLs apenas HTTPS e domínios aprovados; parâmetros essenciais de vendedor (como `seller_id`) NUNCA devem ser truncados das URLs canônicas ou de saída; `stockQuantity = null` significa quantidade não observada. `stockStatus` aceita `in_stock`, `out_of_stock` ou `unknown`. `linkExpiresAt` exige fonte verificável. `refreshDueAt` é agenda interna. `shipping` precisa de contexto de CEP quando a página o usa. O importador registra a amostra bruta e os campos rejeitados, sem quebrar o ID do produto.

O robô legado também produz `expiresAt` presumindo sete dias. O importador deve lê-lo apenas como prazo interno de revisão até a migração terminar. Nunca exibi-lo como validade comprovada de link.
