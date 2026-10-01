# Smoke da produção — 01/10/2026

URL conferida: `https://achadosradar.vercel.app/` (domínio de produção, não preview).

## Evidências

- `GET /` e `GET /carrinho`: HTTP 200. O HTML da home veio com `Age: 53560` e `Last-Modified: Wed, 30 Sep 2026 12:16:37 GMT`; a produção não representa o build local validado em 01/10.
- `scripts/verify-responsive.mjs` contra a produção, cinco rotas e viewports 390/1440 px: 10 combinações; zero overflow horizontal, landmark principal presente e zero headings/controles sem nome. A página de produto reportou `related_cards_unstyled` nos dois viewports (ajuste visual pendente para a fase de layout).
- Os IDs de teste usados foram ML `be76e9bd-a772-402e-8789-0a75d74b71ce` e Magalu `0b7435b7-987a-46aa-a31f-75efc64f08a3`.

## Ressalva sobre métricas de produção

Durante a verificação, foram feitas duas requisições GET a `/api/out/{id}`. Ambas responderam HTTP 302 com a URL de afiliado correspondente e `Cache-Control: no-store`. O handler de sucesso registra cliques; portanto, essas requisições podem ter entrado nas métricas do site. A navegação não seguiu o redirect, não abriu o marketplace e não houve compra. O script responsivo bloqueia chamadas a `record_product_metric` e `report_product_image_failure`, então o smoke visual não registra esses eventos. Não foi feita tentativa de apagar ou alterar registros de produção.

## Limites

- Não foi fornecida URL de preview. Este ambiente não tem vínculo `.vercel`, CLI nem credenciais locais da Vercel.
- Não testamos login/OTP, perfil autenticado, carrinho remoto, troca de contas ou leitura do painel admin na produção.
- O resultado confirma o estado publicado acessível neste horário; não valida o build local ainda não publicado.
