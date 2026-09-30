# Saída para marketplace

Uma rota protegida por lista de domínios permitidos verifica o produto publicado, o estado do link, a validade da revisão e a disponibilidade recente antes de redirecionar para a loja. `redirect-policy.mjs` mantém essa decisão sem efeitos de rede e concentra os status/motivos usados pela rota; `allowlist.mjs` valida HTTPS e host da plataforma. Nunca usar URL arbitrária recebida do cliente nem prometer compra dentro deste site. A rota só redireciona depois do clique em um item específico e responde com `no-store`.
