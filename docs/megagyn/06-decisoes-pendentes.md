# 06 — Decisões pendentes

> Propósito: listar o que a Megagyn precisa decidir antes ou durante a evolução do sistema, com a proposta padrão de cada ponto, em linguagem não técnica. Data: 03/11/2026.

O caderno "Descrição do sistema - GPT" (02/11/2026) diz que suas regras são propostas para a Megagyn validar (p. 1 e p. 20). Este documento separa o que já funciona hoje do que muda, e propõe um caminho padrão para cada ponto. **A proposta padrão nunca amplia acesso nem muda o que já funciona sem a confirmação da Megagyn.** Enquanto um ponto não for decidido, o sistema segue como está hoje.

Detalhe técnico de cada ponto: `02-matriz-requisitos-T01-T14.md`, `04-fluxos-e-permissoes.md` e `05-backlog-priorizado.md`.

## 1. Quadro-resumo

| Id | Decisão | Proposta padrão | Quem decide |
|---|---|---|---|
| DP-01 | Os clientes vão entrar no sistema? Veem orçamentos e contratos? | Preparar com segurança e deixar desligado; quando autorizado, liberar para um cliente piloto acompanhar, abrir O.S., comentar e baixar relatórios. Orçamentos e contratos fora do acesso do cliente no começo | Megagyn |
| DP-02 | Quem pode abrir O.S.? | Megagyn sempre. Encarregado e funcionário só se autorizados. Cliente só com DP-01 | Megagyn |
| DP-03 | Encarregado pode aprovar serviço executado? | Só o administrador aprova | Megagyn |
| DP-04 | Ao reabrir, a O.S. volta para onde? Pode cancelar O.S. já executada? | Volta para nova programação, com motivo. Executada não se cancela: aprova ou devolve | Megagyn |
| DP-05 | Tarefas precisam de aprovação do administrador? Descrição e foto obrigatórias? | Sem aprovação; descrição e foto permitidas, não obrigatórias | Megagyn |
| DP-06 | Foto obrigatória ao abrir O.S.? | Opcional, como hoje, com a opção pronta para ligar | Megagyn |
| DP-07 | Pendência sem data de retorno? | Data obrigatória, como hoje; sem data só com justificativa, se aprovado | Megagyn |
| DP-08 | Orçamento só com valor total ou também com itens? | Valor total basta para emitir; itens continuam opcionais | Megagyn |
| DP-09 | Orçamento vencido pode ser aprovado? | Não: renova a validade em um passo e aprova | Megagyn |
| DP-10 | O que será configurável na primeira versão? | Nomes e textos de ajuda dos campos e listas de opções. Obrigatoriedade só nos campos que a Megagyn listar. Criar campos novos fica fora | Megagyn |
| DP-11 | Compras, rateio e reembolso continuam? | Ficam como estão, protegidos, sem novas funções; evolução orçada à parte | Megagyn |
| DP-12 | Contrato em Word: `.docx` basta? | `.docx` | Megagyn |
| DP-13 | Quem fornece os textos dos contratos? | A Megagyn fornece ou aprova todos os modelos | Megagyn |
| DP-14 | A assinatura no documento vale como aceite? | Não. A imagem é só visual; o aceite do cliente é registrado à parte | Megagyn |
| DP-15 | Quais são os dados oficiais da empresa? | Nada fixado no sistema; a Megagyn confere e preenche antes de emitir documento real | Megagyn |
| DP-16 | Limites de arquivos e usuários; onde o sistema vai rodar? | Limites atuais; mudar para hospedagem que permite uso comercial antes de operar de verdade | Megagyn e Davi |
| DP-17 | O fechamento mensal continua? Qual o critério de corte? | Continua; vale o momento do registro | Megagyn |
| DP-18 | Horas, diárias e demonstrativo continuam? | Continuam como estão | Megagyn |
| DP-19 | Formato dos números (O.S., orçamento, contrato)? | Manter o atual, com ano | Megagyn |
| DP-20 | Que dados pessoais dos colaboradores guardar? Pode haver colaborador sem login? | Só o que a Megagyn confirmar que precisa; acesso só da administração e da própria pessoa; todo colaborador continua tendo login | Megagyn |
| DP-21 | A equipe registra em qualquer O.S. do local ou só nas suas? | Como hoje: qualquer O.S. do local onde trabalha | Megagyn |
| DP-22 | Um contrato cobre uma ou várias O.S.? Pode existir sem O.S.? | Uma ou mais O.S. do mesmo cliente; sem O.S. não | Megagyn |

## 2. Decisões

### DP-01 — Acesso do cliente ao sistema

**Pergunta.** Os responsáveis dos clientes (síndico, gerente, encarregado do condomínio) vão entrar no sistema com login próprio? Se sim, o que eles podem fazer e ver? Inclusive orçamentos e contratos?

**Por que importa.** Hoje só a equipe da Megagyn entra. O cadastro do cliente pedido na Descrição (p. 1) já fala em "usuários do sistema" e "autorização dos menus", e o caderno prevê um perfil de cliente (p. 4, p. 5, p. 8). Abrir o sistema para clientes é a parte de maior risco: um cliente nunca pode ver dados de outro cliente, anotações internas, horas da equipe, despesas ou fotos removidas. Isso exige preparação e testes específicos.

**Opções.**

1. Sem acesso do cliente. A Megagyn recebe pedidos por telefone ou WhatsApp e envia os relatórios por fora, como hoje.
2. Cliente acompanha suas O.S. e baixa relatórios.
3. Cliente também abre O.S. e comenta, nos locais autorizados.
4. Opção 3, mais ver orçamentos e contratos.

**Proposta padrão.** O sistema é preparado com segurança na última fase, mas fica desligado. Com a autorização da Megagyn, liga a opção 3 para um cliente piloto. Orçamentos e contratos ficam fora do acesso do cliente no começo; a resposta do cliente ao orçamento continua registrada pela Megagyn (GPT p. 14).

**Se decidirem depois.** Nada se perde. Os pedidos continuam entrando pela Megagyn, e o restante do sistema evolui normalmente. Só a última fase espera.

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 1–2; GPT p. 4, p. 5, p. 8, p. 20; questão Q1 de `docs/07-questoes-de-negocio.md`.

### DP-02 — Quem pode abrir O.S.

**Pergunta.** Além da Megagyn, encarregados, funcionários ou clientes podem abrir O.S.?

**Por que importa.** Hoje só a administração abre O.S., registrando por qual canal o pedido chegou e quem pediu. O caderno propõe que encarregado, funcionário e cliente também abram, nos locais autorizados (p. 4). Quem está na obra percebe problemas antes; por outro lado, a Megagyn perde o filtro da triagem.

**Opções.**

1. Só a Megagyn (hoje).
2. Megagyn, mais encarregado e funcionário nos locais onde trabalham.
3. Opção 2, mais o cliente nos seus locais (depende de DP-01).

**Proposta padrão.** Megagyn sempre, com canal e solicitante registrados. Encarregado e funcionário só se a Megagyn autorizar. Até lá, eles continuam registrando "atividade avulsa", que entra no diário sem criar O.S.

**Se decidirem depois.** Liberar é uma configuração. Nenhum dado muda.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 2, p. 4, p. 10; `docs/07` Q4.

### DP-03 — Encarregado pode aprovar o serviço executado?

**Pergunta.** Quando o funcionário marca o serviço como executado, só o administrador pode aprovar e encerrar, ou o encarregado também, se autorizado?

**Por que importa.** O caderno se contradiz: a tabela de acesso diz "encarregado, se autorizado" (p. 4), mas o fluxo e a tela dizem "administrador valida" (p. 3, p. 11). A aprovação é o controle de qualidade antes de a O.S. sair no relatório como concluída.

**Opções.** Só o administrador (hoje). Encarregado com autorização individual.

**Proposta padrão.** Só o administrador. Se a Megagyn quiser, um encarregado específico pode receber essa autorização, que fica registrada no histórico.

**Se decidirem depois.** É uma configuração individual.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 3, p. 4, p. 11.

### DP-04 — Reabertura e cancelamento

**Pergunta.** Quando uma O.S. concluída é reaberta, ela volta para qual etapa? E pode cancelar uma O.S. que já foi marcada como executada e aguarda aprovação?

**Por que importa.** O caderno diz que a reabertura "retorna à programação" (p. 3). Hoje ela volta para "Aberta", e a Megagyn escolhe de novo responsável e data, o que na prática é voltar à programação. A conclusão anterior e o motivo sempre ficam no histórico.

**Opções.**

1. Volta para "Aberta", aguardando nova programação (hoje).
2. Volta para "Programada", com o mesmo responsável.
3. Volta direto para "Em execução".

Sobre cancelar executada: hoje não pode; a Megagyn aprova ou devolve para correção.

**Proposta padrão.** Opção 1, com atalho para reprogramar na mesma tela. Executada não se cancela.

**Se decidirem depois.** Ajuste pequeno na regra; o histórico não muda.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 3, p. 11; `docs/07` Q5 e Q11.

### DP-05 — Tarefas: aprovação e evidências

**Pergunta.** Ao finalizar uma tarefa, o responsável precisa descrever o que fez e enviar foto? A tarefa precisa ser aprovada pelo administrador?

**Por que importa.** Hoje a tarefa é finalizada sem pedir descrição nem foto (há um defeito: a observação de encerramento nunca é salva, e será corrigido). O caderno propõe descrição e foto, e deixa a aprovação "para ativar depois" (p. 16, p. 20).

**Opções.** Sem aprovação. Aprovação de todas as tarefas. Aprovação só de alguns tipos de tarefa.

**Proposta padrão.** Sem aprovação. O sistema passa a aceitar descrição e fotos ao finalizar; elas só ficam obrigatórias se a Megagyn decidir.

**Se decidirem depois.** A aprovação pode ser ligada depois sem perder dados.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 16, p. 20.

### DP-06 — Foto obrigatória ao abrir O.S.

**Pergunta.** Toda O.S. precisa ter foto já na abertura?

**Por que importa.** A Descrição pede "registro fotográfico" na abertura (p. 1), e o caderno propõe que seja obrigatório (p. 10). Mas, quando a O.S. é aberta a partir de uma ligação ou mensagem, nem sempre há foto na hora.

**Opções.** Obrigatória sempre. Obrigatória só quando quem abre está no local. Opcional (hoje).

**Proposta padrão.** Opcional, como hoje, com a opção pronta para ligar quando a Megagyn decidir.

**Se decidirem depois.** Ligar a obrigatoriedade vale para as O.S. novas; as antigas não mudam.

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 1; GPT p. 10.

### DP-07 — Pendência sem data de retorno

**Pergunta.** Quando o serviço para por um impedimento (falta de material, autorização, acesso), a previsão de retorno é sempre obrigatória?

**Por que importa.** Hoje o sistema exige motivo, explicação, providência, responsável e data prevista. O caderno propõe aceitar a falta de data, com justificativa, mantendo um alerta (p. 11). Sem data, o atraso fica menos visível; com data inventada, o alerta perde valor.

**Opções.** Data sempre obrigatória (hoje). Data ou justificativa.

**Proposta padrão.** Manter a data obrigatória até a Megagyn aprovar a mudança. Se aprovar, sem data só com justificativa, e a O.S. fica destacada no painel.

**Se decidirem depois.** Ajuste pequeno.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 11; `docs/02` R-15.

### DP-08 — Orçamento: valor total ou itens

**Pergunta.** O orçamento pode ser emitido só com o valor total? E quais campos são obrigatórios para emitir?

**Por que importa.** Hoje o orçamento é montado por itens (com valor global ou quantidade vezes preço), e a emissão exige ao menos um item. A Descrição pede "valor" (p. 2), e o caderno diz que itens detalhados são evolução futura (p. 13). Hoje a emissão não exige forma de pagamento, garantia nem período.

**Opções.** Só itens (hoje). Valor total ou itens, à escolha. Só valor total.

**Proposta padrão.** Valor total basta para emitir; itens continuam disponíveis. Para emitir, exigir os campos que a Megagyn confirmar. Sugestão do caderno: descrição, valor, período, forma de pagamento, garantia e data. A regra nova vale só para orçamentos emitidos depois da mudança.

**Se decidirem depois.** Os orçamentos já emitidos não mudam.

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 2; GPT p. 13.

### DP-09 — Orçamento vencido pode ser aprovado?

**Pergunta.** Se o cliente aprova depois da validade, a Megagyn registra a aprovação direto?

**Por que importa.** Hoje o sistema não deixa: é preciso "renovar" (nova validade, nova revisão) e então aprovar. O caderno propõe tratar o vencimento só como alerta (p. 13). A aprovação passa a apontar exatamente a revisão que o cliente aceitou; aprovar uma revisão vencida pode comprometer preço e prazo.

**Opções.** Renovar e aprovar (hoje). Aprovar com aviso.

**Proposta padrão.** Renovar e aprovar, num passo só na tela.

**Se decidirem depois.** Ajuste pequeno.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 13; `docs/02` R-64.

### DP-10 — O que será configurável na primeira versão

**Pergunta.** Quais textos, campos e listas a Megagyn quer poder mudar sozinha?

**Por que importa.** A Descrição pede "configurar todo o sistema (texto, campos que devem aparecer...)" (p. 2). O caderno propõe nome, ajuda, tipo, obrigatoriedade e visibilidade de cada campo (p. 18). Quanto mais configurável, maior o esforço e o risco de uma configuração esconder algo importante. O caderno pede definir isso antes de fechar o orçamento (p. 20).

**Opções.**

1. Nomes e textos de ajuda dos campos, e listas de opções (categorias, motivos, prioridades).
2. Opção 1, mais obrigatoriedade e visibilidade em campos escolhidos.
3. Opção 2, mais criar campos novos (como "Tipo de acabamento" no exemplo do caderno).

**Proposta padrão.** Opção 1 na fase de configurações. Obrigatoriedade e visibilidade só nos campos que a Megagyn listar. Criar campos novos fica fora da primeira versão. As prioridades continuam numa lista editável (hoje já é assim); os nomes "baixa, normal, alta, urgente" do caderno podem ser cadastrados nela.

**Se decidirem depois.** Cada campo novo configurável é um acréscimo, sem perder dados.

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 2; GPT p. 10, p. 18, p. 20.

### DP-11 — Compras, rateio e reembolso

**Pergunta.** O controle de compras, rateio entre obras e reembolsos continua?

**Por que importa.** Esse módulo foi pedido no escopo de outubro e já funciona. O caderno novo não o menciona e sugere tratá-lo como módulo separado, "se mantido" (p. 20). Ausência no documento novo não é ordem para apagar.

**Opções.** Manter como está. Manter e evoluir (orçado à parte). Desligar o acesso, mantendo o histórico.

**Proposta padrão.** Fica como está, com as correções de proteção (por exemplo, impedir pagamento de reembolso registrado em dobro), sem funções novas. Nenhum histórico financeiro é apagado. O cliente nunca vê esses dados.

**Se decidirem depois.** Qualquer evolução é orçada à parte.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 20; `docs/02` R-50 a R-57.

### DP-12 — Formato do contrato em Word

**Pergunta.** O arquivo `.docx` (Word 2007 em diante, abre também no LibreOffice) atende, ou é preciso o formato antigo `.doc`?

**Por que importa.** A Descrição pede "PDF e DOC para que caso eu queira alterar" (p. 2). O caderno propõe `.docx` e pede confirmação (p. 15, p. 20). Gerar Word exige incluir uma biblioteca no sistema, que passa por aprovação técnica.

**Opções.** `.docx`. `.docx` e `.doc`.

**Proposta padrão.** `.docx`. Alterações feitas no Word não voltam sozinhas para o sistema; o arquivo alterado pode ser anexado ao contrato (GPT p. 15).

**Se decidirem depois.** O formato antigo pode ser acrescentado depois, com esforço próprio.

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 2; GPT p. 15, p. 20.

### DP-13 — Textos dos contratos

**Pergunta.** Quais modelos de contrato o sistema terá, e quem fornece os textos?

**Por que importa.** O caderno diz que os textos "serão fornecidos ou aprovados pela Megagyn" (p. 15). O sistema não deve criar texto jurídico próprio.

**Opções.** A Megagyn envia os modelos que já usa. A Megagyn aprova modelos preparados por um advogado.

**Proposta padrão.** A Megagyn fornece ou aprova todos os modelos antes do uso real. Até lá, o sistema usa um modelo de teste marcado "MODELO DE TESTE — NÃO USAR".

**Se decidirem depois.** Os contratos ficam prontos tecnicamente, mas não são usados com clientes.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 15.

### DP-14 — Assinatura e aceite

**Pergunta.** A assinatura que aparece no orçamento é de quem? A "data" do orçamento é a de emissão? Como fica registrado que o cliente aceitou?

**Por que importa.** A Descrição lista "Assinatura" e "Data" no orçamento sem dizer de quem (p. 2). O caderno diz que a imagem de assinatura é só um elemento visual: não é assinatura eletrônica e não aprova nada (p. 14, p. 15). Exportar o contrato também não o torna assinado.

**Opções.** Imagem do responsável da Megagyn. Espaço em branco para assinatura à mão. Assinatura eletrônica (escopo e preço próprios).

**Proposta padrão.** A imagem é a assinatura do responsável da Megagyn, só visual, com nome e função. A data é a de emissão. O aceite do cliente é um registro separado, com pessoa, data, canal e comprovante (mensagem, e-mail ou documento assinado anexado). Assinatura eletrônica fica fora.

**Se decidirem depois.** Ajuste de texto no documento.

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 2; GPT p. 14, p. 15, p. 20.

### DP-15 — Dados oficiais da empresa

**Pergunta.** Quais são a razão social, o CNPJ, o endereço, o site, o responsável técnico e o CREA corretos?

**Por que importa.** Os documentos de referência trazem valores diferentes entre si para endereço, site, CNPJ (dígitos finais), CREA e razão social (divergências D-01 a D-05 em `docs/02-requisitos-rastreabilidade.md`). Esses dados saem em todos os relatórios, orçamentos e contratos.

**Opções.** Não há alternativa: é preciso conferir.

**Proposta padrão.** Nada fica fixado no sistema. A Megagyn confere e preenche em Configurações antes de emitir o primeiro documento real. O sistema passa a conferir o dígito verificador do CNPJ.

**Se decidirem depois.** Documentos reais ficam esperando; o desenvolvimento continua.

**Quem decide.** Megagyn.

**Fontes.** `docs/02` D-01 a D-05; `docs/07` Q2.

### DP-16 — Limites e hospedagem

**Pergunta.** Quais limites de arquivos e usuários a Megagyn precisa? Onde o sistema vai rodar quando passar a operar de verdade? Quem fica dono das contas e como os dados podem ser exportados?

**Por que importa.**

- **Limites atuais:** foto de até 15 MB (o celular reduz antes de enviar); PDF de comprovante de até 20 MB (4 MB enquanto o sistema estiver na hospedagem atual); até 20 arquivos por envio; sem limite de usuários no sistema.
- **Espaço:** o banco gratuito tem 500 MB de dados e 1 GB de arquivos. Pela estimativa de `docs/08-operacao.md` §3 (cerca de 0,5 a 1 GB de fotos por mês com 10 clientes), o espaço gratuito de arquivos dura poucos meses. Será preciso decidir um plano de armazenamento.
- **Hospedagem:** o plano atual do servidor do aplicativo (Vercel Hobby) **não permite uso comercial**, e o serviço gratuito de PDF (Render) pede para não ser usado em produção. O banco gratuito não tem cópia de segurança automática (hoje há uma rotina própria pronta, ainda desligada).
- **Entrega:** o caderno pede que a proposta informe hospedagem, espaço, backup, restauração, suporte, entrega do código e exportação dos dados (p. 19).

**Opções.** Servidor próprio gratuito (Oracle Always Free, já preparado; exige cadastrar um cartão para verificação). Planos pagos dos serviços atuais.

**Proposta padrão.** Manter os limites atuais. Antes de a Megagyn operar de verdade, mudar para o servidor próprio gratuito, com cópia de segurança diária ligada e teste mensal de restauração. Contas ficam com o Davi até o contrato dizer o contrário (`docs/14` D4). Espaço de arquivos acompanhado mês a mês.

**Se decidirem depois.** O piloto segue funcionando para demonstração, mas não deve ser usado na operação comercial.

**Quem decide.** Megagyn e Davi.

**Fontes.** GPT p. 4, p. 19, p. 20; `docs/08` §3–4; `docs/13` §5; `docs/14` D2 e D4.

### DP-17 — Fechamento mensal e critério de corte

**Pergunta.** O fechamento mensal (relatório "SETEMBRO / 2026", com versões) continua obrigatório? Um registro feito em 01/10 sobre um serviço de 30/09 entra no fechamento de setembro?

**Por que importa.** O caderno trata o fechamento como "proposta adicional" (p. 12), mas o escopo de outubro o exige e ele já funciona. Hoje vale o momento em que o registro foi feito, não a data do serviço.

**Opções.** Momento do registro (hoje). Data do serviço.

**Proposta padrão.** O fechamento continua. Vale o momento do registro. Sugestão operacional: emitir o fechamento alguns dias depois do fim do mês, após conferir os lançamentos.

**Se decidirem depois.** Trocar o critério muda o conteúdo dos fechamentos futuros; os já emitidos não mudam.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 12; `docs/02` R-91 a R-97; `docs/07` Q6.

### DP-18 — Horas, diárias e demonstrativo

**Pergunta.** O controle de horas por pessoa, as diárias cobradas e o demonstrativo no relatório mensal continuam?

**Por que importa.** Existem e funcionam, mas não aparecem nos documentos novos. Ausência não é ordem para retirar.

**Proposta padrão.** Continuam como estão.

**Se decidirem depois.** Nada muda até a decisão.

**Quem decide.** Megagyn.

**Fontes.** `docs/02` R-34, R-70 a R-74.

### DP-19 — Formato dos números

**Pergunta.** O número das O.S. continua como "2026-000123", e o do orçamento como "ORC-2026-0012"? Os exemplos do caderno ("OS-0042", "ORC-0012", "CON-0007") são só ilustrativos.

**Proposta padrão.** Manter o formato atual, que reinicia a cada ano. Contratos seguem o mesmo padrão: "CON-2026-0001".

**Se decidirem depois.** Trocar o formato vale para números novos; os antigos ficam.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 5–17 (imagens); `docs/07` Q17.

### DP-20 — Dados pessoais dos colaboradores

**Pergunta.** Quais dados pessoais dos colaboradores o sistema deve guardar (CPF, RG, endereço, documentos, foto)? Por quanto tempo? Pode existir colaborador sem acesso ao sistema (por exemplo, ajudante sem e-mail)? O cliente vê o nome de quem executou o serviço?

**Por que importa.** A Descrição pede esses campos (p. 1). São dados pessoais protegidos pela LGPD: é preciso saber para que servem, quem acessa e quando apagar. Hoje todo colaborador é um usuário com login.

**Proposta padrão.** Guardar só o que a Megagyn confirmar que precisa. Acesso só da administração e da própria pessoa; o cliente nunca vê. Todo colaborador continua tendo login. Nos relatórios ao cliente, manter o que já é mostrado hoje; no acesso do cliente, decidir junto com DP-01.

**Se decidirem depois.** A ficha do colaborador espera; o restante segue.

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 1; GPT p. 7, p. 8; `docs/08` §7.

### DP-21 — Em quais O.S. a equipe registra atendimento

**Pergunta.** O funcionário e o encarregado podem registrar atendimento em qualquer O.S. do local onde trabalham, ou só nas que foram atribuídas a eles?

**Por que importa.** Hoje é qualquer O.S. do local, decisão tomada em outubro a partir do escopo ("demandas da unidade autorizada"). O caderno propõe só as atribuídas (p. 4). Restringir dá mais controle; liberar ajuda quando um colega cobre o outro.

**Opções.** Qualquer O.S. do local (hoje). Só as atribuídas.

**Proposta padrão.** Como hoje. A matriz de permissões permite restringir depois, por pessoa.

**Se decidirem depois.** É uma configuração.

**Quem decide.** Megagyn.

**Fontes.** GPT p. 4; `docs/11-revisao-seguranca.md` §5.

### DP-22 — Contrato e O.S.

**Pergunta.** Um contrato cobre uma única O.S. ou pode cobrir várias? Pode existir contrato sem O.S.?

**Por que importa.** A Descrição pede "escolha da O.S." no contrato (p. 2). O caderno não define se pode haver mais de uma nem os estados do contrato (rascunho, emitido, cancelado).

**Opções.** Exatamente uma O.S. Uma ou mais O.S. do mesmo cliente. Também sem O.S.

**Proposta padrão.** Uma ou mais O.S. do mesmo cliente; pelo menos uma. O sistema impede O.S. de outro cliente (GPT p. 19).

**Se decidirem depois.** Ajuste antes de construir o módulo de contratos (Fase 4).

**Quem decide.** Megagyn.

**Fontes.** Descrição p. 2; GPT p. 15, p. 19.
