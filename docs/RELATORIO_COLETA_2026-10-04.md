# Revisão e coleta — 04/10/2026

## O que deu certo

- Auditoria inicial confirmou 457 produtos publicados no Supabase.
- Feed Awin atualizado: 4.818 linhas, 4.815 produtos aceitos e três rejeitados pela validação.
- Teste inicial: 20 páginas KaBuM, 20 sucessos, sete segundos.
- Lote maior: 500 páginas, 496 sucessos, quatro pendências, 166 segundos, três requisições simultâneas.
- Os 115 produtos restantes do CSV antigo foram revisados em 38 segundos, sem falhas; dados fictícios de parcelamento foram substituídos por valores ausentes quando não observados.
- Após corrigir o banco, 514 registros da primeira coleta e 115 revisões foram importados sem rejeições. Registros repetidos mantêm o mesmo produto; não representam 629 produtos novos.
- Contagem final confirmada: 940 publicados (619 KaBuM, 252 Magalu, 68 Mercado Livre, um Shopee), dez rascunhos e seis arquivados. Crescimento de 483 publicados.

## Erros encontrados e corrigidos

- Home e busca descartavam a última página parcial. A filtragem de imagens também podia encerrar a paginação cedo.
- Importador não reconhecia KaBuM como link pronto. A RPC remota ainda restringia importações a ML/Magalu.
- A categoria PC Gamer havia sido apagada, mas o classificador continuava retornando esse ID. Isso impediu 153 importações. A migration une hardware/gaming em Eletrônicos.
- CSV antigo inventava estoque disponível e “Até 10x”. Também ignorava descrições com quebras de linha e escrevia sobre o arquivo usado pela ponte. Novo leitor filtra anunciante/identidade, preserva campos desconhecidos e usa arquivo separado.
- Falhas da ponte não tinham fila persistente de reenvio. Agora o robô só reconhece a entrega após sucesso; mantém revisão mais nova e tenta novamente a cada minuto.
- Deduplicação por nomes parecidos podia excluir SKUs distintos e custava comparações sucessivas. Agora é opt-in; o padrão conserva identidade por ID.
- Conversor/allowlist Awin aceitavam validações fracas de domínio. Agora merchant, publisher e destino são conferidos.
- Orquestrador removia locks do perfil, iniciava outra ponte e aguardava indefinidamente o loop do robô. Agora preserva locks, reutiliza processos ativos e limita comandos CDP.
- Cards removidos por falha de imagem não notificavam o catálogo. Agora reportam antes da remoção.

## Decisão sobre o relatório de arquitetura

Aproveitados: coleta HTTP silenciosa, concorrência limitada, isolamento de falhas por item, timeout, checkpoint, recuperação de lock e importação por lote. O feed fornece candidatos; a página oficial confirma dados antes da publicação.

Não foi adotada a divisão fixa em dois novos navegadores. Os extratores existentes são específicos de cada loja e suas sessões; duplicar perfis não cria integrações oficiais. Amazon/Shopee/ML/Magalu continuam no robô atual. Não há comprovação de ganho de 4–6x em todas as lojas nem garantia contra CAPTCHA/bloqueio. Sub-IDs Shopee não comprovam afiliação. Foto ausente não comprova esgotamento. Dados de login/cache não devem ser apagados a cada ciclo.

## Operação

Configure AWIN_FEED_LIST_URL no .env com a URL privada da lista. Execute npm run collect:once para um lote ou npm run collect:background para continuar em lotes de 500. O pipeline mantém lock por processo e libera após encerramento normal; um PID morto permite recuperação. Observações recentes são puladas por seis horas. O arquivo de lote evita reinserir o histórico completo a cada ciclo.

Arquivos locais data/*.json, feeds, SQL de auditoria, locks e temporários não devem ser publicados no Git.

## Validação

- Site: 195 testes aprovados, Astro sem erros/avisos (cinco hints antigos), build aprovado e orçamento aprovado com uma função serverless e aproximadamente 2,35 MB estáticos.
- Robô: 97 testes aprovados, incluindo falha da ponte, retenção da fila e reenvio após recuperação.
- Navegador local: filtro KaBuM e busca “teclado” retornaram teclados reais no catálogo remoto, mantendo a busca na home.
- Migrations aplicadas e registradas no Supabase. Produtos não publicados continuam invisíveis para a role pública.

## Pendências

- Quatro páginas do lote maior falharam; ficam pendentes, sem arquivamento automático.
- A coleta massiva de todas as lojas ainda depende de suas integrações e sessões. Este pipeline massivo foi implementado e medido para KaBuM.
- Parcelamento, cupons, Pix explícito, avaliações, especificações e vídeos não são inventados pelo novo leitor HTTP. Campos ainda não mapeados ficam ausentes; o robô existente continua responsável por sua extração adicional.
- Testes não significam imunidade a alterações dos marketplaces, quedas de rede ou falta de disco. A fila, checkpoints e logs permitem recuperar e identificar falhas.
