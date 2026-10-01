# Arquitetura do Achados Radar

## Visão geral

```text
Extensão Chrome
   │ POST loopback apenas; produto, fotos, preço, estoque, parcelas, frete, cupom e estado do link
   ▼
Ponte local do site :6876 ──► data/catalogo_macro.json ──► importador local com service role ──► Supabase Postgres
Servidor legado da macro :6875 ──► produtos_coletados/ (preservado)
                                                              │ RLS + RPC de busca
                                      ┌───────────────────────┴──────────────────┐
                                      ▼                                          ▼
                                Astro/Vercel                              Supabase Auth/Storage
                          SSR + páginas de amostra                       OTP, perfil, avatar
                                      │
                                      ▼
                       lista salva → validação de saída → marketplace
```

A ponte escuta somente em `127.0.0.1`, valida origem `chrome-extension://`, limita corpo, normaliza os campos e faz upsert atômico no JSON local. O dry-run revisa os dados antes do importador. A chave service role fica somente no processo confiável do importador; a extensão e o navegador não a recebem. O site consulta o catálogo com a chave anon e as políticas RLS.

## Aplicação e hospedagem

- Astro 7.3.5 e adaptador oficial da Vercel. Rotas dinâmicas usam SSR; 20 páginas de amostra são pré-renderizadas sem links de compra ativos.
- O proprietário confirmou que a Vercel Pro e o projeto estão configurados. A URL de preview, variáveis de ambiente e respostas no runtime hospedado ainda precisam ser verificadas em H1.9/H1.10.
- O build local atual emite uma função de runtime. Meta operacional: até 4; limite rígido: menos de 12.
- Busca, filtros, cursor, compartilhamento e ofertas relacionadas são carregados no cliente via `fetch`/AJAX.
- Os cards pedem a primeira imagem; galeria do produto mantém as URLs em ordem e imagens secundárias carregam sob demanda.

## Catálogo e atualização

- A identidade canônica é `platform + external_id`; o UUID interno não muda durante atualizações.
- `offers` mantém observações históricas de preço e condição comercial. `product_images` preserva a ordem da galeria. `affiliate_links` registra URL, verificação, prazo interno de revisão e expiração oficial separadamente.
- Estoque desconhecido permanece `NULL`/`unknown`; quantidade só é gravada quando explicitamente capturada.
- Busca é normalizada para ignorar acentos e pontuação e usa similaridade trigramada com paginação por cursor.
- A macro só deve permitir publicação quando link oficial, destino do produto e estoque estiverem comprovados. Status HTTP isolado não valida destino.
- O ciclo atual do robô preserva o ID do produto e pode marcar revisão, falta de estoque ou conversão pendente. O servidor Python legado ocupa a porta `6875`; a ponte do site usa `6876` para evitar colisão. A extensão envia atualizações aos dois serviços sem substituir o arquivo legado. O primeiro envio real pela extensão ainda está pendente. A importação para Supabase exige validar link oficial e estoque em amostra recente.
- Fotos reportadas pelo site entram no início do ciclo autônomo. Erros temporários de abertura/extração tentam novamente após 15 minutos; produto reencontrado com foto válida ou inexistência explicitamente confirmada e registrada aguarda 12 horas antes de nova checagem. Só o sinal oficial de produto não encontrado, com ID exato e sem título/preço, aciona arquivamento; falha de imagem isolada nunca oculta o item. Arquivado sai da vitrine e continua no carrinho como indisponível, sem apagar o registro.

## Conta e lista salva

- Login inicial: código por email (OTP), sem senha obrigatória. Telefone é opcional; CPF não é coletado neste MVP.
- Perfil guarda nome, telefone E.164 e URL do avatar. O bucket valida formato/tamanho e políticas de proprietário.
- O processamento local do avatar aceita JPEG/PNG/WebP até 5 MiB, limita a imagem decodificada a 20 megapixels, recorta ao centro e converte para WebP 320×320 ou menor; a saída não pode ultrapassar o limite de 2 MiB do bucket.
- A lista salva funciona sem conta em `localStorage` e pode sincronizar em `cart_items` autenticado. Mudanças de preço/link não removem produtos. Remover/limpar uma lista autenticada deve atualizar tanto Supabase quanto o armazenamento local.
- Cada item abre uma saída própria para o marketplace correspondente. Não há pagamento nem pedido no Achados Radar.

## Segurança e evidência

- RLS isola perfil e lista; catálogo público só expõe itens publicados. RPC de importação requer role de serviço.
- `/api/out/[id]` confere publicação, estoque recente, timestamp do link, expiração/revisão e host HTTPS permitido antes de responder com redirect sem cache.
- O plano de transferência mede JSON dos 20 cards e JS/CSS locais comprimidos. Fotos originais carregadas de terceiros ficam fora dessa soma e precisam ser medidas no preview real.
- Ver testes e resultados datados em [`VALIDACOES.md`](VALIDACOES.md); seguir a sequência e os portões em [`ETAPAS_PROCEDURAIS.md`](ETAPAS_PROCEDURAIS.md).

## Dependências ainda externas

Projeto Supabase e migrations aplicadas em dev; SMTP para OTP; variáveis de ambiente; projeto/preview na equipe Vercel Pro; autorização do domínio, links afiliados e fotos pelas lojas. Até esses recibos existirem, os testes locais não comprovam integração de produção.
