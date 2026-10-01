# Validação funcional da macro e extensão — 30/09/2026

## Executado nesta rodada

- `node --test tests/*.test.cjs` em `C:\Users\joner\Documents\associados\robo-afiliados-autonomo`: 75/75 aprovados.
- `python -m unittest discover -s tests -p test_unavailable_reports.py`: 3/3 aprovados.
- Cobertura relevante: extração de estoque e quantidade sem inventar valores, frete, parcelas, cupons, galeria completa do Magalu, expiração oficial separada do prazo de revisão, preservação do link quando a coleta falha, prioridade e retry da fila de fotos, exigência de prova oficial antes de arquivar produto.
- Não foram abertas páginas autenticadas de marketplace nem disparado o radar real nesta rodada. Os testes foram locais e não escreveram no Supabase.

## Próxima prova necessária

Recarregar a extensão no Chrome do proprietário, coletar uma oferta real de cada loja, testar um ciclo de renovação com link/estoque observáveis e conferir o JSON da ponte `127.0.0.1:6875`. Só então fechar E1.1, E1.8, E1.9, E1.10 e E1.11.
# Revalidação de continuidade — 01/10/2026

- `node --test tests/*.test.cjs`: 75/75 aprovados no diretório `robo-afiliados-autonomo`.
- `python -m unittest discover -s tests -p test_unavailable_reports.py`: 3/3 aprovados.
- Esta execução valida os testes automatizados atuais da macro/extensão. Não foi aberto Chrome autenticado nem executado radar real, portanto as etapas E1.1/E1.9/E1.10/E1.11 continuam pendentes de verificação operacional.

