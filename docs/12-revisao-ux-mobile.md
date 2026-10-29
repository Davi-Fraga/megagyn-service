# 12 — Revisão de UX no celular

> F6.4 do plano. Feita em 26/10/2026 com navegador emulando um Pixel 7 (412 × 915), rede 3G simulada e processador 4× mais lento, contra o build de produção. **Não houve teste em aparelho real** (Android ou iOS): isso continua pendente para o piloto com a equipe.

## Perfis de rede

| Perfil | Download | Upload | Latência |
|---|---|---|---|
| 3G | 1,6 Mbit/s | 750 kbit/s | 150 ms |
| 3G lento | 400 kbit/s | 400 kbit/s | 400 ms |

## Medições (funcionário de campo)

| Tela | 3G | 3G lento | Dados transferidos |
|---|---|---|---|
| Login, primeira carga | 2,8 s | 6,6 s | 251 KB |
| Entrar até a tela Hoje | 1,8 s | 1,6 s | até 28 KB |
| Lista de chamados | 1,1 s | 1,2 s | até 26 KB |
| Detalhe do chamado | 0,7 s | 1,3 s | até 15 KB |
| Registrar o que foi feito | 1,0 s | 1,4 s | até 22 KB |
| Enviar 1 foto de celular | 25 s | 44 s | foto de 4000 × 3000 px, reduzida no aparelho para 2560 px |

A foto do teste é ruído aleatório, o pior caso para compressão JPEG. Foto real de obra comprime melhor e tende a levar menos tempo. As fotos sobem uma por vez, em fila, com "Tentar de novo" em caso de falha, e a pessoa pode continuar preenchendo o registro enquanto elas sobem.

## Ajustes feitos

| Problema | Ajuste |
|---|---|
| Filtros da lista de chamados com 38 px de altura | 44 px |
| Link "voltar" do cabeçalho com 36 px | 44 px |
| Campos de seleção com 43 px | altura mínima de 44 px em todos os campos |
| Botão de remover foto do envio com 28 × 28 px | canto de 44 × 44 px sobre a miniatura |
| Legenda da foto com 20 px de altura | 44 px |
| Logotipo do cabeçalho (link para Hoje) com 35 px | 44 px |
| Caixa de seleção avulsa (ex.: "Nota interna") só com o quadrado de 20 px | o rótulo inteiro responde ao toque, com 44 px |

Depois dos ajustes, nenhuma das telas medidas tem alvo de toque menor que 44 px nem rolagem lateral.

## Observações para o piloto

- **Fotos em rede fraca:** se a equipe reclamar da espera, reduzir o tamanho máximo no aparelho de 2560 px para 2048 px corta perto de um terço do envio. O PDF usa a versão de 1600 px, então a mudança não afeta os relatórios. Fica como decisão da Megagyn, porque o original arquivado perde resolução.
- **Primeira carga do login:** 251 KB, quase tudo do próprio Next.js e da fonte. Nas visitas seguintes, o navegador usa o cache.
- **A verificar em aparelho real:** câmera abrindo direto pelo botão de foto, teclado cobrindo campos, brilho de tela ao sol e uso com luva.
