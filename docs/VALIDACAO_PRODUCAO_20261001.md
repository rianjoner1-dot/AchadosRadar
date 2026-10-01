# Smoke da produção — 01/10/2026

URL conferida: `https://achadosradar.vercel.app/` (domínio de produção Vercel).

## Deploy Realizado

- **Branch:** `main`
- **Commit publicado:** `dd527dc` (e posteriores)
- **Data/Hora do Deploy:** 01/10/2026 03:28:27 GMT
- **Pipeline:** GitHub Actions / Vercel Git Integration automático

## Evidências de Produção

- `GET /`: HTTP 200 (`Last-Modified: Thu, 01 Oct 2026 03:28:27 GMT`, `Age: 0`, cache renovado).
- `GET /painel-admin`: HTTP 200 OK (rota administrativa SSR ativa).
- `GET /carrinho`: HTTP 200 OK (vitrine e carrinho com neutral theme ativo).
- `GET /conta`: HTTP 200 OK (área de perfil e gerenciamento de conta ativa).
- `scripts/verify-responsive.mjs` executado contra `https://achadosradar.vercel.app` nos viewports 390 px e 1440 px:
  - 8 combinações de rotas/viewports auditadas.
  - Zero overflow horizontal (`overflowElements: []`).
  - Landmark principal presente em 100% das páginas (`mainLandmark: true`).
  - Zero controles ou cabeçalhos sem nome acessível (`unnamedHeadings: 0`, `unnamedControls: 0`).
  - Navegação por teclado, skip-links e foco visível validados.

