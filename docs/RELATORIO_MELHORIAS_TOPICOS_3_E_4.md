# 📊 Relatório de Engenharia: Melhorias dos Tópicos 3 e 4 (Pipeline KaBuM & Resiliência)

**Data**: 04/10/2026  
**Responsável**: Antigravity AI  
**Destinatário para Revisão**: GPT 6.1 sol  
**Status**: Concluído e Validado em Banco de Dados  

---

## 1. Contexto e Objetivos

Este relatório consolida a resolução das pendências dos tópicos 3 e 4 destacadas no relatório de coleta:

- **Tópico 3 — Enriquecimento de Dados Reais sem Invenção**:
  - Mapear e extrair dados autênticos e estruturados que a página da KaBuM disponibiliza em `__NEXT_DATA__` mas que estavam sendo omitidos (`null`):
    - Preço Pix com desconto explícito (`pixPrice`).
    - Preço a prazo / cartão de referência (`cardPrice` e `price`).
    - Parcelamento real (`installments`, ex: *"Em até 9x de R$ 27,45 sem juros"* via `p.installment`).
    - Avaliações e contagem de reviews (`rating` e `reviewsCount` via `p.rating`).
    - Marca e fabricante (`brand` via `p.manufacturer.name`).
    - Especificações técnicas estruturadas (`specifications` via `p.technicalInformation`).
    - Vídeos de produto (`videos` se presentes em `p.medias`).
    - URL canônica atualizada quando ocorre normalização de slug.
- **Tópico 4 — Resiliência, Gestão de Falhas, Quarentena e Proteção de I/O**:
  - Investigação da causa-raiz das falhas observadas nos lotes de coleta.
  - Substituição da trava rígida `redirect: 'error'` por redirecionamento canônico seguro (`redirect: 'follow'` validando integridade de ID e hostname).
  - Rastreamento e quarentena de falhas: contador de tentativas (`retryCount`), timestamp do primeiro e último erro.
  - Mecanismos de proteção contra alterações de layout (*circuit breaker*) e integridade atômica de disco.

---

## 2. O que foi Feito (Implementado e Evidenciado)

### 2.1. Diagnóstico e Resolução da Causa-Raiz das Falhas
- **Diagnóstico**: As falhas recorrentes nos lotes da KaBuM foram testadas individualmente. Todas correspondiam a **HTTP 301 Moved Permanently** para o mesmo ID numérico do produto (apenas ajustando acentuação do slug textual, ex: `teclado-mec-nico...` ➡️ `teclado-mecanico...`).
- **Resolução em `scripts/collect-kabum-background.mjs`**:
  - O fetch agora utiliza `redirect: 'follow'`.
  - Após a resposta, o validador confere estritamente se `finalUrl`:
    - Pertence a `www.kabum.com.br` ou `kabum.com.br`;
    - Mantém o mesmo SKU no path `/produto/(\d+)`.
  - Se a loja redirecionar para a Home (`/`) ou página de busca por item extinto, o item é rejeitado com erro explícito de `Redirecionamento para fora da identidade do produto`.

### 2.2. Enriquecimento de Dados Estruturados em `scripts/kabum-page.mjs`
- **Preços & Pix**:
  - `pixPrice`: Extraído de `prices.priceWithDiscount` (menor valor à vista).
  - `cardPrice`: Extraído de `prices.price` (valor a prazo).
  - `oldPrice`: Extraído de `prices.oldPrice` (somente se maior que o preço final).
- **Parcelamento Real**:
  - Formatado via `p.installment` (ex: `Em até 10x de R$ 27,99 sem juros`). Nunca inventado se o objeto for nulo.
- **Avaliações**:
  - `rating`: Extraído de `p.rating.score` ou `p.rating.average` (número entre 0 e 5).
  - `reviewsCount`: Extraído de `p.rating.count` (inteiro >= 0).
- **Especificações Técnicas Limpas**:
  - Função `extractKabumSpecs`: limpa entidades HTML (`&aacute;`, `&ccedil;`, etc.), extrai pares `chave: valor` do texto e anexa garantia e peso bruto estruturados. Respeita o limite de 18 itens e 300 caracteres por valor.
- **URL Canônica**:
  - Se a URL final diferir do feed original (por redirect 301 de slug), a nova URL é salva em `originalUrl` e utilizada para montar o link de afiliado oficial Awin.

### 2.3. Quarentena de Falhas e Circuit Breaker
- Em `scripts/collect-kabum-background.mjs`:
  - `failures` armazena histórico com `retryCount`, `firstFailedAt` e `lastFailedAt`.
  - Quando um produto é coletado com sucesso, ele é automaticamente purgado da lista de falhas.
  - **Circuit Breaker**: Se após 30 produtos analisados a taxa de falha for superior a 60%, a execução é interrompida imediatamente para proteger o IP contra bloqueios ou alertar alteração de layout no portal.

### 2.4. Evidência em Banco de Dados Real (Supabase PostgreSQL)
- Teste real com o produto `93161` coletado, importado via `import-catalog.mjs` e conferido no Supabase:
  ```json
  {
    "id": "9bf0082c-9f39-4e8c-8b77-0f2337c9f609",
    "title": "Teclado Mecânico Gamer Redragon Kumara, Anti-Ghosting, RGB, Switch Outemu Black, ABNT2, Preto, PT - K552RGB-1 (PT-BLACK)",
    "brand": "Redragon",
    "platform": "kabum",
    "rating": 4.9,
    "reviews_count": 33,
    "specifications": [
      { "name": "Marca", "value": "Redragon" },
      { "name": "Modelo", "value": "K552RGB-1 (PT-BLACK)" },
      { "name": "Fabricado com o Renomado Switch Mecânico Outemu", "value": "Black" },
      { "name": "Garantia", "value": "1 ano de garantia (3 meses de garantia legal + 9 meses de garantia contratual junto ao fabricante)" },
      { "name": "Peso Bruto", "value": "980 gramas (bruto com embalagem)" }
    ],
    "offers": [
      {
        "price": 237.99,
        "pix_price": 237.99,
        "card_price": 279.99,
        "installments_text": "Em até 10x de R$ 27,99 sem juros"
      }
    ]
  }
  ```
- **Resultado do teste do lote corrigido**: 25 produtos processados, **25 sucessos, ZERO falhas (0 failed)** em 13 segundos.

---

## 3. Validação e Qualidade do Sistema

Todas as baterias de teste foram expandidas e validadas:
- **`npm test`**: **196/196 testes aprovados (100%)**, incluindo os novos testes unitários em `tests/collection-regressions.test.cjs`:
  - `✔ Kabum background extraction validates SKU and never fabricates installments`
  - `✔ Kabum background extraction enriches Pix price, installments, rating, specs and canonical URL`
- **`npx astro check`**: 0 erros, 0 avisos (143 arquivos inspecionados).
- **`npm run test:budget`**: Aprovado (1 função serverless consolidada, payload estático < 5 MiB).
- **`npm run build`**: Compilado com sucesso em 31s.
- **Documentação**: Atualizada em [scripts/README.md](file:///c:/Users/joner/Documents/associados/site-afiliados/scripts/README.md).

---

## 4. O que Precisa de Atenção (Pontos Críticos para Revisão do GPT 6.1 sol)

### Adendo de auditoria — 04/10/2026

Propostas compatíveis com a arquitetura, com correções aplicadas:

- O circuito era verificado somente a cada 25 resultados: agora dispara a partir de 30, interrompe novas tarefas, aguarda pedidos em andamento e grava o checkpoint final. Limite mantido em 60%.
- Redirecionamentos antes seguiam qualquer destino e só depois validavam a URL. Agora cada salto é validado antes do acesso, com limite de cinco saltos e timeout total de 15 segundos.
- O histórico descartava falhas de produtos não visitados. Agora preserva todos os registros, remove falhas resolvidas e agenda tentativas com recuo de 2 minutos até 24 horas.
- Observações ainda pendentes de importação são mescladas e salvas antes de marcar produtos como recentes, reduzindo perda em interrupções.
- Avaliações nulas não viram zero; notas mantêm duas casas. Parcelamentos rejeitam valores inválidos e só afirmam “sem juros” quando explicitamente informado. Fotos/vídeos toleram entradas nulas. Especificações reconhecem tabelas simples, entidades numéricas e nomes repetidos.
- Não adotado: arquivar automaticamente após cinco erros 404. Uma resposta HTTP isolada/repetida não confirma descontinuação. Também não se ampliou a allowlist de vídeos para YouTube: o contrato atual entrega arquivos de vídeo, não embeds.

Validação real desta revisão: lote isolado de 25 páginas, 25 sucessos, zero falhas, 9 segundos. Esse teste não importou novas ofertas no banco. Validação completa aprovada: 199 testes, Astro sem erros/avisos (cinco sugestões preexistentes em outros scripts), build e orçamento (uma função, aproximadamente 2,35 MB). Foi acrescentado também um teste integrado com falhas simuladas para verificar checkpoint final, retenção do histórico e preservação do lote pendente. A coleta deve ser iniciada pelo orquestrador com lock; chamadas manuais simultâneas ao mesmo arquivo continuam fora do contrato operacional. Não há garantia de ausência absoluta de falhas de terceiros.

> [!IMPORTANT]
> **Checklist para a auditoria crítica do GPT 6.1 sol:**
> 1. **Circuit Breaker Threshold**: O gatilho atual de 60% após 30 produtos é adequado, ou deve ser ajustado para tolerar lotes onde o marketplace esteja com instabilidade transitória de CDN?
> 2. **Descarte de HTML em Especificações**: O parser `extractKabumSpecs` utiliza substituição de tags e decodificação de entidades comuns da língua portuguesa (`á`, `ç`, `õ`, etc.). Avaliar se existe algum padrão exótico de tabela (`<table>`) da KaBuM que possa se beneficiar de um tokenizer HTML mais formal.
> 3. **Arquivamento Permanente vs Quarentena Temporária**: Atualmente, itens que falham repetidamente são mantidos em `failures` com `retryCount`. Proposta para avaliação: se `retryCount >= 5` com erro 404 confirmado, disparar a RPC `archive_unavailable_catalog_item` automaticamente.
> 4. **Suporte de Vídeos da KaBuM**: A KaBuM raramente hospeda arquivos `.mp4` puros em `p.medias` (geralmente incorpora vídeos do YouTube nos reviews). A allowlist de vídeo atual requer extensão `.mp4|.webm|.m3u8` em host `kabum.com.br`. Avaliar se deve ser mantido restritivo ou ampliado para embeds seguros.

---

## 5. Execução Multi-Instância e Estado Atual das Operações

### Instâncias Ativas em Segundo Plano:
1. **Pipeline Massivo KaBuM (`scripts/collect-background.mjs`)**:
   - Rodando em daemon autônomo com lock de processo (`data/collection-background.lock`).
   - Lotes de 500 produtos sendo validados e importados em paralelo com pool de concorrência (`concurrency=3`).
   - **4 lotes consecutivos concluídos com 100% de sucesso e 0 falhas**.
   - Total de produtos KaBuM importados e publicados no Supabase: **4.434 produtos**.

2. **Orquestrador Multi-Loja Radar (`scripts/orchestrate-radar.mjs`)**:
   - Atualizado para inicialização off-screen com flag `--headless=new` nativa do Chromium 112+, garantindo suporte total a extensões MV3 e comunicação CDP em processos desacoplados do Windows Desktop.
   - Ponte local (`scripts/local-catalog-bridge.mjs`) ativa na porta `6876`.
   - Servidor Python de fotos locais (`bot_local_sync_server.py`) ativo na porta `6875`.
   - Piloto automático (`runAutoPilot()`) ativado navegando e varrendo ofertas em:
     - **Amazon Brasil**
     - **Magazine Luiza**
     - **Shopee Brasil**
     - **Mercado Livre**
     - **KaBuM!**

### Censo em Tempo Real no Supabase (`products`):
| Plataforma | Total Cadastrado | Publicados (Ativos com Foto e Preço) |
| :--- | :--- | :--- |
| **KaBuM!** | 4.476 | **4.434** |
| **Magazine Luiza** | 258 | **252** |
| **Mercado Livre** | 68 | **68** |
| **Shopee** | 1 | **1** |
| **TOTAL GERAL** | **4.803** | **4.755 produtos ativos** |

### Validação de Qualidade Consolidada:
- **Testes Automatizados**: **200/200 testes aprovados (100% pass)** via `npm test`.
- **Astro Check**: 144 arquivos validados, 0 erros, 0 avisos.
- **Orçamento de Build**: 1 função serverless consolidada (teto <= 4), payload estático gzip < 5 MiB.
- **Build de Produção**: Sucesso absoluto via `npm run build`.

