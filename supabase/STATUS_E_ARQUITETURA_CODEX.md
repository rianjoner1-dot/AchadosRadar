# Status da Infraestrutura Supabase e Arquitetura para o Codex

> **Documento gerado em:** 30/09/2026  
> **Destinatário:** Codex / Desenvolvedores de Backend  
> **Projeto Vinculado:** AchadosRadar (`rvepsyvhsqumfpemhbba`)  
> **Organização:** Rian Joner (`srfgmvukbuzkhdxqxjss`)  

---

## 1. Resumo Executivo para o Codex

Todas as tabelas principais, funções RPC, buckets de storage e políticas de segurança (RLS) já foram **criadas, testadas e sincronizadas no Supabase remoto via migrações declarativas**.

**NÃO execute `supabase db reset` nem tente recriar manualmente as tabelas existentes**, pois elas já estão operacionais e com integridade referencial testada.

---

## 2. Localização das Variáveis de Ambiente (.env)

As credenciais estão organizadas em dois locais fora do versionamento Git:

1. **Aplicação Web (Astro/Frontend):**
   - Caminho: [`c:\Users\joner\Documents\associados\site-afiliados\.env`](file:///c:/Users/joner/Documents/associados/site-afiliados/.env)
   - Contém:
     - `PUBLIC_SUPABASE_URL`: `https://rvepsyvhsqumfpemhbba.supabase.co`
     - `PUBLIC_SUPABASE_ANON_KEY`: Token JWT público (`eyJ...`)
     - `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Chave publishable moderna (`sb_publishable_...`)
     - `SUPABASE_SERVICE_ROLE_KEY`: Token administrativo de serviço (`eyJ...`)
     - `SUPABASE_SECRET_KEY`: Chave secreta moderna (`sb_secret_...`)
     - `SUPABASE_PROJECT_REF`: `rvepsyvhsqumfpemhbba`
     - `SUPABASE_ACCESS_TOKEN`: Personal Access Token CLI (`sbp_...`)

2. **Backend / Scripts de Postagem (Python):**
   - Caminho: [`c:\Users\joner\Documents\associados\.env`](file:///c:/Users/joner/Documents/associados/.env)
   - Contém:
     - `SUPABASE_URL`: Apontando para o projeto `rvepsyvhsqumfpemhbba`
     - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço para uploads diretos
     - `SUPABASE_STORAGE_BUCKET`: `produtos` (para fotos fixas)
     - `SUPABASE_STORAGE_BUCKET_TEMP`: `InstagranTemporario`

---

## 3. Schema do Banco de Dados (Tabelas Ativas no `public`)

| Tabela | Chave Primária | Principais Colunas | Propósito |
| :--- | :--- | :--- | :--- |
| **`products`** | `id UUID` | `platform`, `external_id`, `title`, `description`, `category`, `brand`, `status` | Cadastro unificado com restrição de unicidade `(platform, external_id)` |
| **`product_images`** | `id UUID` | `product_id (FK)`, `url`, `display_order`, `is_primary`, `width`, `height` | Galeria de imagens do produto (ordenadas por `display_order`) |
| **`offers`** | `id UUID` | `product_id (FK)`, `price`, `old_price`, `discount_percent`, `seller_name`, `observed_at` | Histórico de preços e condições comerciais observadas |
| **`affiliate_links`** | `id UUID` | `product_id (FK)`, `original_url`, `affiliate_url`, `status`, `verified_at` | Links de afiliação validados com checagem de domínio seguro |
| **`profiles`** | `id UUID (FK auth.users)` | `full_name`, `phone_e164`, `avatar_url`, `role`, `created_at` | Perfil do usuário com trigger automático vinculado ao Supabase Auth |
| **`cart_items`** | `id UUID` | `user_id (FK auth.users)`, `product_id (FK products)`, `saved_price`, `notes` | Itens salvos no carrinho / favoritos do usuário logado |

---

## 4. Funções RPC Declarativas Ativas

1. **`search_catalog(search_query, target_platform, min_price, max_price, sort_by, ...)`**
   - Busca em texto completo com normalização sem acentos (`unaccent`) e similaridade trigrama (`pg_trgm`).
   - Retorna os cards de produtos com thumbnail, menor preço e link ativo.
   - Concedida permissão de execução a `anon` e `authenticated`.

2. **`get_public_link_state(target_product_id UUID)`**
   - Valida a elegibilidade e saúde do link de afiliado antes do redirecionamento outbound.
   - Concedida permissão a `anon` e `authenticated`.

3. **`import_catalog_item(p_item JSONB)`**
   - Função transacional idempotente para importação e upsert seguro de produtos em lote.
   - **Acesso restrito:** Exclusiva para a `service_role` (segurança de escrita).

---

## 5. Storage & Estrutura de Buckets

| Bucket | Visibilidade | Limite de Tamanho | Tipos Permitidos | Finalidade |
| :--- | :--- | :--- | :--- | :--- |
| **`produtos`** | **Público** | 1 MB | `image/jpeg`, `image/png`, `image/webp` | **Fotos fixas do catálogo.** Utilizadas tanto na vitrine web quanto consumidas diretamente pela Meta Graph API para postagens no Instagram. |
| **`avatars`** | **Público** | 100 KB | `image/webp`, `image/jpeg`, `image/png` | Fotos de perfil dos usuários. Upload restrito por RLS (`auth.uid() = owner_id`). |
| **`InstagranTemporario`** | **Público** | 10 MB | `image/jpeg`, `image/png`, `image/webp` | Bucket para uploads de mídia transitória (posts avulsos) com exclusão imediata pós-publicação. |

### 5.1. Regra das Fotos Fixas vs Temporárias
- **Para produtos catalogados:** Não é necessário criar arquivos temporários. A Meta Graph API consome diretamente a URL pública permanente do bucket `produtos` (`https://rvepsyvhsqumfpemhbba.supabase.co/storage/v1/object/public/produtos/...`).
- **Para posts avulsos sem produto:** O pipeline utiliza `InstagranTemporario` com limpeza automática ao final do ciclo.

---

## 6. Pipeline de Compressão e Economia de Cota do Supabase

Devido ao uso compartilhado da cota do plano gratuito do Supabase (que já estava em ~30%), foi implementado um **filtro forte de compressão pré-upload** em Python (`PIL / Pillow`):

1. **Resolução Máxima:** 1080x1080 px (redimensionamento proporcional via `Image.Resampling.LANCZOS`).
2. **Compressão:** JPEG otimizado progressivo (`quality=82`, `optimize=True`) com remoção de metadados EXIF e conversão de transparência para fundo branco.
3. **Economia Medida:** Redução média de **80% a 95%** no peso das imagens (arquivos de 3~5 MB caem para 60~120 KB).
4. **Vídeos:** Vídeos acima de 15 MB passam por transcodificação via FFmpeg (`libx264`, `-crf 28`, escala 720p, áudio AAC 128k).

---

## 7. Diretrizes para o Codex ao Criar Novas Funcionalidades

1. **Novas Tabelas ou Alterações:**
   - Adicione uma nova migração em `site-afiliados/supabase/migrations/<YYYYMMDDHHMMSS>_<descricao>.sql`.
   - Aplique usando `npx supabase db push` a partir do diretório `site-afiliados`.
2. **Defensividade de Schemas:**
   - Nunca recrie `auth.uid()` ou modifique schemas internos sem `IF NOT EXISTS` e tratamento de exceção (`permission denied 42501`).
3. **Novas Chaves:**
   - Sempre consulte as variáveis já populadas no `.env`.
