# PROMPT MESTRE DEFINITIVO — PLATAFORMA DE PLACAS INTELIGENTES COM QR CODE DINÂMICO E NFC

**Versão:** 4.0 — Revisão do modelo comercial, perfis e logística  
**Versão:** 5.0 — Inclusão dos requisitos de cadastro e gestão individual das placas  
**Projeto:** Plataforma de comercialização, fabricação sob demanda, gestão, distribuição e ativação de placas com QR Code dinâmico e NFC.  
**Tecnologias inicialmente previstas:** Google AI Studio, React, TypeScript, Supabase, PostgreSQL, Vercel, Asaas e Gemini API, conforme validação técnica e disponibilidade das ferramentas.

---

## 1. OBJETIVO GERAL

Desenvolver uma plataforma web profissional para administrar a venda, a fabricação sob demanda, a distribuição, a configuração e a ativação de placas físicas com QR Code dinâmico e NFC.

A plataforma deverá atender à empresa administradora e aos seus revendedores, incluindo os vendedores que fazem parte da equipe comercial interna.

O sistema deverá centralizar:
- Cadastro e gerenciamento de revendedores.
- Cadastro administrativo de vendedores internos utilizando o mesmo perfil de revendedor.
- Cadastro público de novos revendedores.
- Preços globais e preços individuais de aquisição.
- Pedidos e confirmação de pagamentos.
- Solicitações de fabricação e reservas comerciais.
- Fabricação física sob demanda.
- Inspeção e aprovação das placas.
- Atribuição e liberação das unidades produzidas.
- Escolha entre retirada e envio pelos Correios.
- Registro dos dados necessários à retirada ou à postagem.
- Acompanhamento dos pedidos e da logística.
- Geração de QR Codes dinâmicos.
- Ativação e gerenciamento dos destinos digitais.
- Registro operacional do NFC.
- Gestão administrativa, relatórios, auditoria e segurança.

O sistema deverá ser construído por etapas, com documentação atualizada, validação dos requisitos e aprovação explícita do proprietário antes do início de cada nova etapa.

---

## 2. REGRAS INEGOCIÁVEIS DE GOVERNANÇA

### 2.1. Auditoria antes da implementação
Na primeira resposta, realize somente a auditoria do projeto.  
Não comece a desenvolver telas, componentes, banco de dados, migrações ou integrações antes de concluir a auditoria e receber autorização.  
Inspecione os arquivos e os recursos que estiverem realmente disponíveis.  
Não presuma que o Google AI Studio tenha acesso automático a todos os arquivos do GitHub, Supabase ou Vercel.  
Informe o que conseguiu acessar e o que depende de intervenção manual.

### 2.2. Perguntas obrigatórias
Identifique as decisões de negócio e as informações técnicas ainda pendentes.  
Classifique-as em:
- Bloqueadoras.
- Não bloqueadoras.
- Dependências externas.

Apresente as perguntas bloqueadoras com alternativas e recomendações.  
Não invente regras comerciais, preços, percentuais de comissão, critérios de inspeção ou procedimentos logísticos.  
Não faça perguntas que já tenham sido respondidas neste documento ou em documentos acessíveis e atualizados.

### 2.3. Aprovação por etapas
Ao concluir cada etapa, apresente:
1. O que foi realizado.
2. Os arquivos criados ou modificados.
3. Os testes efetivamente executados.
4. Os resultados reais.
5. As pendências.
6. Os riscos.
7. A próxima etapa proposta.

Aguarde minha autorização explícita antes de iniciar a próxima etapa. Não interprete silêncio como aprovação.

### 2.4. Ações externas
Não execute sem autorização específica:
- Migrações destrutivas.
- Exclusão de arquivos ou dados.
- Alterações em produção.
- Cobranças ou transações financeiras reais.
- Envio de mensagens reais.
- Publicações em produção.
- Contratação de serviços pagos.
- Alterações de credenciais, DNS ou permissões.
- Operações irreversíveis em serviços externos.

---

## 3. DOCUMENTAÇÃO E ARQUIVOS DO PROJETO

A IA deverá assumir a responsabilidade de propor, criar, manter e atualizar a documentação necessária, sempre que houver capacidade real para operar no sistema de arquivos.

Antes de criar documentos, verifique o que já existe e preserve o conteúdo relevante.

Considere a seguinte estrutura:
- **PROMPT_MESTRE.md:** regras gerais, requisitos inegociáveis e governança.
- **PRD.md:** requisitos funcionais, perfis, regras de negócio e critérios de aceitação.
- **GEMINI.md:** instruções para o ambiente de desenvolvimento, se reconhecido pela ferramenta.
- **ARCHITECTURE.md:** arquitetura e módulos.
- **DATABASE.md:** entidades, relacionamentos, estados e integridade.
- **SECURITY.md:** autenticação, autorização, RLS e segurança.
- **IMPLEMENTATION_PLAN.md:** etapas, dependências e critérios de conclusão.
- **DECISIONS.md:** decisões aprovadas e pendências.
- **TEST_PLAN.md:** testes e cenários de aceitação.
- **CHANGELOG.md:** alterações relevantes.
- **DEPLOYMENT.md:** implantação e configuração dos ambientes.
- **RUNBOOK.md:** procedimentos de operação e recuperação.

Após a autorização da etapa documental, crie ou atualize os arquivos no ambiente, se possível.  
Informe o caminho exato de cada arquivo e confirme que foi salvo.  
Se não houver acesso direto ao sistema de arquivos, informe a limitação e forneça o conteúdo para salvamento manual.  
Não afirme que um arquivo foi criado, uma migração foi executada ou uma integração foi ativada sem comprovação.  
A documentação deverá refletir o modelo comercial unificado descrito neste documento.

---

## 4. MODELO COMERCIAL UNIFICADO: TODOS SÃO REVENDEDORES

Esta é uma regra central da plataforma.

**Não criar dois sistemas comerciais separados, um para revendedores independentes e outro para vendedores internos.**

Todos deverão utilizar o mesmo modelo de perfil comercial, a mesma estrutura de pedidos, os mesmos controles de fabricação, a mesma gestão de placas e o mesmo fluxo logístico.

Um vendedor interno será cadastrado administrativamente como um revendedor, utilizando o mesmo tipo de perfil e as mesmas funcionalidades comerciais.

### 4.1. Cadastro de revendedores
Deverão existir duas maneiras de criar um perfil comercial:

**Cadastro público:**
- O interessado acessa o formulário de cadastro.
- Preenche os dados exigidos.
- Cria suas credenciais.
- Recebe o perfil de revendedor conforme as regras de cadastro aprovadas.
- Pode acessar o painel comercial autorizado.

**Cadastro administrativo:**
- O administrador acessa o painel.
- Seleciona a opção de cadastrar revendedor.
- Preenche os dados da pessoa.
- Define as condições comerciais individuais, quando necessárias.
- Registra se a pessoa pertence à equipe comercial interna, caso seja útil para identificação e relatórios.
- Cria ou convida o usuário por procedimento seguro.
- O revendedor recebe as instruções para acessar sua conta e definir sua senha.

O cadastro administrativo de um vendedor interno deverá utilizar o mesmo formulário ou estrutura de cadastro dos demais revendedores, acrescentando apenas os campos administrativos realmente necessários.

Não criar uma tabela comercial completamente separada para vendedores internos.

### 4.2. Identificação de vendedor interno
O sistema poderá utilizar um campo administrativo, como `tipo_parceiro`, para identificar:
- Revendedor independente.
- Integrante da equipe comercial interna.
- Parceiro especial ou influenciador, quando aplicável.

Esse campo servirá para classificação, relatórios e regras comerciais expressamente aprovadas.  
A classificação não deverá criar automaticamente um sistema de permissões incompatível com o perfil comercial comum.  
O vendedor interno não precisará comprar placas em nome próprio para solicitar a fabricação de unidades destinadas às suas vendas.  
Entretanto, a condição de vendedor interno deverá ser respeitada nas regras comerciais e operacionais aprovadas, sem confundir sua atividade com uma compra de atacado.

### 4.3. Painel comercial único
Todos os revendedores deverão utilizar o mesmo painel, incluindo:
- Resumo.
- Pedidos.
- Preços aplicáveis.
- Pagamentos, quando houver.
- Acompanhamento da fabricação.
- Acompanhamento logístico.
- Placas atribuídas.
- Ativação e configuração.
- Histórico.
- Perfil.
- Suporte.

Não criar um segundo painel independente para vendedores internos.  
Não exibir a opção de comprar placas como requisito para um vendedor interno solicitar fabricação destinada às suas vendas.  
O sistema deverá apresentar as ações pertinentes à operação do usuário sem duplicar toda a arquitetura comercial.

### 4.4. Pedidos comerciais e solicitações internas
A plataforma deverá distinguir a origem e a autorização da fabricação, mesmo que todos os usuários compartilhem o mesmo perfil comercial.

**Para um revendedor que compra placas da empresa:**
1. O revendedor seleciona a quantidade.
2. O sistema calcula o preço de aquisição aplicável.
3. O pedido é registrado.
4. O Asaas processa a cobrança.
5. O backend confirma o pagamento.
6. A fabricação é autorizada.
7. A produção, a inspeção, a atribuição e a logística são realizadas.

**Para uma venda realizada por um integrante da equipe comercial interna, quando o modelo aprovado permitir fabricação sem compra antecipada pelo vendedor:**
1. O vendedor registra a solicitação vinculada à venda ou ao cliente.
2. A solicitação é encaminhada ao administrador.
3. O administrador aprova ou rejeita.
4. A aprovação autoriza a fabricação, mesmo que o cliente final ainda não tenha pago.
5. A produção, a inspeção, a atribuição e a logística são realizadas.

A segunda operação deverá ser identificada como solicitação ou reserva comercial interna, e não como pedido de compra de atacado do vendedor.  
Os dois fluxos utilizarão os mesmos módulos de fabricação, inspeção, atribuição, placas e logística.  
O sistema deverá registrar a origem de cada solicitação e aplicar a autorização correta.  
Não exigir que o vendedor interno compre placas para que uma solicitação interna aprovada possa entrar em fabricação.

---

## 5. PERFIS E PERMISSÕES

Considerar os seguintes papéis técnicos:
- Visitante.
- Usuário comercial, com perfil de revendedor.
- Administrador.
- Outros perfis administrativos, se aprovados.

A classificação comercial de uma pessoa não deverá ser confundida com seu papel de autorização.  
O campo de perfil comercial não poderá conceder privilégios administrativos.  
Um usuário não poderá alterar seu próprio papel por meio de requisições, formulários ou manipulação do navegador.  
A autorização deverá ser validada no backend e no banco de dados.

### 5.1. Permissões do revendedor
Poderá:
- Consultar seu perfil e suas condições comerciais.
- Fazer pedidos de compra, quando aplicável.
- Consultar pagamentos de seus próprios pedidos.
- Registrar solicitações comerciais internas, se estiver autorizado pela classificação e pelas regras aprovadas.
- Acompanhar fabricação.
- Acompanhar envio ou retirada.
- Consultar placas atribuídas e liberadas.
- Configurar os destinos autorizados.
- Consultar seu histórico.

Não poderá:
- Alterar preços de aquisição.
- Confirmar pagamentos.
- Aprovar suas próprias solicitações que dependam de aprovação administrativa.
- Atribuir placas sem autorização.
- Consultar dados privados de outros revendedores.
- Alterar seu próprio papel.
- Liberar placas bloqueadas.
- Modificar históricos administrativos.

### 5.2. Permissões do administrador
O administrador poderá:
- Cadastrar e gerenciar revendedores.
- Cadastrar integrantes da equipe comercial como revendedores.
- Definir a classificação administrativa do parceiro.
- Configurar preços globais e individuais.
- Consultar pedidos e solicitações.
- Aprovar ou rejeitar solicitações internas.
- Administrar fabricação, inspeção e atribuições.
- Gerenciar retirada e envio.
- Alterar a modalidade de entrega selecionada, com registro de auditoria.
- Gerenciar pagamentos e integrações conforme suas permissões.
- Administrar placas, configurações e bloqueios.
- Consultar relatórios e histórico.

---

## 6. PRECIFICAÇÃO GLOBAL E INDIVIDUAL

O administrador deverá definir o preço padrão de aquisição das placas.  
Também poderá definir um preço específico para cada revendedor.  
O preço individual ativo prevalecerá sobre o preço global.  
Se o preço individual for removido ou desativado, as compras futuras utilizarão o preço global vigente.  
Alterações de preços não poderão modificar pedidos anteriores.

Cada pedido deverá registrar uma fotografia das condições comerciais utilizadas, incluindo:
- Preço unitário.
- Quantidade.
- Descontos autorizados, se houver.
- Valor total.
- Regra de precificação aplicada.
- Referência da configuração utilizada.

O backend deverá calcular os valores. Não confiar em preços enviados pelo navegador.  
Poderão existir preços especiais para parceiros de marketing ou influenciadores, utilizando o mesmo cadastro comercial e o mecanismo de preço individual.  
Não inventar preços, faixas de quantidade, descontos ou condições comerciais.  
Se forem utilizados preços por volume, suas faixas e valores deverão ser definidos e documentados.

---

## 7. LIMITES DA GESTÃO FINANCEIRA

A plataforma deverá controlar pedidos, pagamentos à empresa e registros operacionais de placas.

Não criar um módulo de fluxo de caixa próprio do revendedor, contas a pagar, contas a receber de clientes finais, despesas ou gestão financeira completa do negócio do revendedor.

O revendedor será responsável por definir seu próprio preço de venda ao cliente final.  
Para vendas internas, o sistema poderá registrar as informações comerciais e comissões que forem aprovadas, sem criar um segundo sistema financeiro completo.

---

## 8. PEDIDOS E FABRICAÇÃO SOB DEMANDA

Não presumir que existem placas acabadas em estoque apenas porque há registros no banco.  
A produção será sob demanda, mantendo-se apenas o estoque físico de placas acabadas que for efetivamente produzido e registrado, caso essa operação seja adotada.  
Uma unidade só poderá ser marcada como produzida depois de sua fabricação física ser registrada.

### 8.1. Fluxo de compra do revendedor
1. O revendedor seleciona a quantidade.
2. O backend calcula o preço aplicável.
3. O sistema registra o pedido.
4. O backend cria a cobrança no Asaas.
5. O pagamento é validado no backend.
6. A confirmação financeira válida autoriza a fabricação.
7. O pedido entra na fila de produção.
8. As unidades são produzidas.
9. As unidades passam por inspeção.
10. As unidades aprovadas são atribuídas.
11. A entrega é preparada conforme a modalidade escolhida.
12. O pedido é disponibilizado para retirada ou enviado pelos Correios.

Não iniciar a fabricação de um pedido de compra antes da confirmação válida do pagamento.

### 8.2. Fluxo de venda interna
1. O vendedor interno registra a venda ou solicitação.
2. A solicitação identifica o cliente, a quantidade e o responsável.
3. O administrador aprova ou rejeita.
4. A aprovação autoriza a fabricação conforme as regras internas.
5. As unidades são produzidas e inspecionadas.
6. As unidades aprovadas são atribuídas.
7. A entrega é organizada conforme a modalidade registrada.

Não exigir pagamento antecipado do vendedor interno para autorizar a fabricação de uma solicitação interna aprovada.

### 8.3. Fabricação parcial
O sistema deverá permitir que parte das unidades seja produzida, inspecionada, atribuída ou enviada antes das demais, quando operacionalmente permitido.  
Os quantitativos deverão ser controlados individualmente.  
Impedir duplicidade de fabricação lógica, atribuição simultânea, liberação indevida e envio duplicado.

---

## 9. ESTADOS DA FABRICAÇÃO E DAS PLACAS

Manter separados os estados de pedido, pagamento, fabricação, inspeção, atribuição, logística e ativação digital.

**Estados possíveis da fabricação:**
- Aguardando autorização.
- Aguardando produção.
- Em produção.
- Produção parcial.
- Produção concluída.
- Aguardando inspeção.
- Inspeção parcial.
- Inspeção concluída.
- Aguardando atribuição.
- Atribuição parcial.
- Atribuição concluída.
- Aguardando entrega.
- Entrega parcial.
- Entrega concluída.
- Cancelada.

**Estados físicos da placa:**
- Planejada.
- Em produção.
- Produzida.
- Aguardando inspeção.
- Aprovada.
- Reprovada.
- Aguardando atribuição.
- Atribuída.
- Liberada.
- Bloqueada.
- Perdida.
- Cancelada.

As transições deverão ser validadas no backend.  
Não permitir a liberação de placas reprovadas, inexistentes, bloqueadas ou não atribuídas corretamente.

---

## 10. INSPEÇÃO E APROVAÇÃO

Permitir que usuários autorizados registrem a inspeção física das unidades.  
Registrar:
- Placa.
- Solicitação de fabricação.
- Resultado.
- Data e hora.
- Responsável.
- Critérios verificados.
- Observações.
- Motivo de reprovação.
- Evidências, quando necessárias.

Os critérios definitivos de inspeção deverão ser definidos pelo proprietário antes da implementação.  
Não inventar padrões físicos como se já tivessem sido aprovados.

---

## 11. QR CODE DINÂMICO E IDENTIDADE DA PLACA

Cada placa deverá possuir:
- Identificador interno único.
- Número sequencial visível, quando aprovado.
- Token aleatório e imprevisível.
- URL permanente.
- Estado físico.
- Estado digital.
- Histórico de atribuições.
- Histórico de destinos.
- Configuração NFC.
- Relação com fabricação, pedido ou solicitação.

Gerar QR Codes por biblioteca apropriada, não por inteligência artificial.

Prever:
- Geração individual e em lote.
- PNG e SVG, quando compatíveis.
- Folhas A4 para impressão.
- Exportação ZIP.
- Número visível da placa.
- Margens de segurança e contraste adequados.
- Testes reais de leitura.

A URL deverá utilizar um domínio definitivo configurado para o projeto.  
A rota pública deverá consultar o destino atual no backend e redirecionar o visitante.  
Alterar o destino não deverá exigir reimpressão.  
Bloquear destinos perigosos e validar os URLs no backend.  
Registrar destino anterior, novo destino, responsável, data e hora.

---

## 12. ATIVAÇÃO E CONFIGURAÇÃO

O revendedor poderá configurar apenas placas atribuídas a ele e liberadas.  
Validar sessão, propriedade, autorização, situação física e situação digital.

Os campos poderão incluir:
- Estabelecimento.
- Categoria.
- Contato.
- Telefone.
- Data da venda.
- Tipo de destino.
- URL.
- Situação NFC.
- Observações.

Não coletar dados desnecessários.  
Registrar alterações críticas e preservar o histórico.

---

## 13. NFC

O NFC deverá utilizar a mesma URL permanente do QR Code, sempre que essa for a configuração aprovada.  
Registrar os estados operacionais:
- Não instalado.
- Instalado.
- Gravado.
- Testado.
- Com problema.

Não afirmar que a etiqueta foi gravada fisicamente sem confirmação operacional.  
Não presumir que o sistema web consegue gravar etiquetas sem hardware e integração adequados.  
A versão inicial poderá utilizar gravação física manual, desde que o procedimento seja documentado e aprovado.

---

## 14. ENTREGA: RETIRADA OU ENVIO PELOS CORREIOS

Esta regra é obrigatória para todos os perfis comerciais, inclusive os integrantes da equipe de vendas interna cadastrados como revendedores.

Todo revendedor deverá poder escolher como deseja receber suas placas.  
As duas modalidades iniciais serão:
1. Retirada.
2. Envio pelos Correios.

A seleção será registrada no cadastro do revendedor e poderá ser utilizada como preferência inicial nos pedidos futuros.  
A escolha no cadastro não deverá impedir que o revendedor selecione outra modalidade em um pedido específico, caso essa flexibilidade seja aprovada na configuração do sistema.

### 14.1. Seleção no cadastro
No formulário de cadastro, incluir a pergunta:  
*Como você prefere receber suas placas?*  
Opções:
- Retirada.
- Envio pelos Correios.

A seleção deverá ser armazenada no perfil como modalidade de entrega preferencial.  
O formulário deverá apresentar os campos adicionais pertinentes à modalidade selecionada:
- Se for retirada, solicitar os dados necessários para identificar o responsável pela retirada, quando aplicável.
- Se for envio, solicitar os dados necessários para preparar a postagem.

Os campos obrigatórios exatos deverão ser definidos após avaliar o processo operacional real. Não inventar um endereço de retirada ou dados comerciais da empresa.

### 14.2. Retirada
Quando a modalidade selecionada for retirada, o sistema deverá registrar os dados necessários para organizar a entrega física.  
Considerar, conforme o procedimento aprovado:
- Nome de quem realizará a retirada.
- Nome do titular do pedido.
- Telefone de contato.
- Número do pedido.
- Data ou período previsto para retirada.
- Situação da autorização de retirada.
- Data e hora da entrega efetiva.
- Responsável da empresa que liberou as placas.
- Identificação de quem recebeu, quando necessária.
- Observações e comprovantes, se exigidos.

O sistema deverá distinguir:
- Retirada selecionada.
- Aguardando produção.
- Aguardando liberação.
- Pronta para retirada.
- Retirada agendada, se aplicável.
- Retirada realizada.
- Retirada cancelada.
- Com ocorrência.

A placa só poderá ser marcada como entregue após o registro da retirada efetiva por usuário autorizado.  
Não marcar o pedido como entregue apenas porque a modalidade de retirada foi selecionada.  
O endereço e o procedimento de retirada deverão ser configurados pelo administrador.  
Não inventar local, horário ou prazo de retirada.

### 14.3. Envio pelos Correios
Quando a modalidade selecionada for envio, o sistema deverá coletar e armazenar os dados necessários à postagem.  
Considerar:
- Nome do destinatário.
- CEP.
- Logradouro.
- Número.
- Complemento, quando houver.
- Bairro.
- Cidade.
- Estado.
- Telefone de contato, quando necessário.
- Referência do pedido.
- Peso e dimensões do pacote, quando necessários.
- Serviço de envio.
- Código de rastreamento.
- Data efetiva da postagem.
- Referência da etiqueta.
- Comprovante de postagem.
- Estado logístico.

Os campos obrigatórios deverão ser validados no backend.  
A empresa deverá poder configurar os dados do remetente e os procedimentos de postagem.  
A geração de etiqueta oficial deverá utilizar um procedimento válido do serviço postal. Não criar uma etiqueta interna e apresentá-la como etiqueta postal oficial.  
A versão inicial poderá permitir o registro manual do código de rastreamento e da postagem.  
O código de rastreamento não comprova, por si só, que a encomenda foi postada ou entregue.

### 14.4. Seleção visível no painel administrativo
No painel administrativo, cada revendedor deverá apresentar de forma clara a modalidade de entrega selecionada.  
Exemplos:
- Preferência de entrega: Retirada.
- Preferência de entrega: Correios.

Na tela de detalhes do pedido, exibir também a modalidade efetivamente selecionada para aquele pedido.  
A preferência cadastrada no perfil e a modalidade de entrega do pedido deverão ser armazenadas separadamente.  
Isso permitirá que:
- O revendedor tenha uma preferência padrão.
- Um pedido utilize uma modalidade específica.
- A alteração da preferência não modifique pedidos anteriores.
- O administrador veja a preferência geral e a modalidade do pedido atual.

### 14.5. Alteração da modalidade pelo administrador
O administrador deverá poder alterar a modalidade de entrega selecionada, tanto no perfil do revendedor quanto no pedido, conforme o contexto.  
A interface deverá diferenciar:
1. Alterar a preferência padrão do revendedor.
2. Alterar a modalidade de entrega de um pedido específico.

Quando a alteração ocorrer no pedido, atualizar a operação logística correspondente e registrar:
- Modalidade anterior.
- Modalidade nova.
- Data e hora.
- Administrador responsável.
- Motivo, quando necessário.
- Situação logística no momento da alteração.
- Consequências operacionais.

Não alterar silenciosamente dados de pedidos já enviados ou retirados.  
Se a postagem já tiver ocorrido, a mudança de modalidade não poderá apagar o histórico nem simular uma retirada.  
Se o pedido estiver pronto para retirada, mas ainda não tiver sido entregue, o administrador poderá avaliar a conversão para envio, desde que os dados necessários estejam disponíveis e a operação seja permitida.  
Se um pedido estiver em produção ou aguardando liberação, a mudança deverá atualizar a preparação logística conforme as regras aprovadas.  
Se a alteração gerar custos, cobrança adicional ou reembolso, solicitar a definição da regra comercial antes de automatizar essa operação.

### 14.6. Alteração pelo próprio revendedor
O revendedor poderá consultar sua preferência de entrega.  
A possibilidade de alterar a preferência diretamente no perfil poderá ser habilitada.  
A alteração de uma preferência geral não deverá modificar automaticamente pedidos já existentes.  
A alteração da modalidade de um pedido específico deverá respeitar as regras de negócio e o estado logístico.  
Se o pedido já estiver em preparação avançada, postado ou pronto para retirada, o sistema poderá bloquear a alteração direta e orientar o revendedor a solicitar assistência administrativa.  
Não permitir que um revendedor altere o destinatário ou a modalidade de um envio já realizado de forma que comprometa a segurança ou a integridade do histórico.

### 14.7. Acompanhamento no painel comercial
O painel do revendedor deverá exibir:
- Modalidade de entrega.
- Estado da fabricação.
- Estado da inspeção.
- Estado da liberação.
- Estado da entrega ou postagem.
- Dados de retirada, quando aplicáveis.
- Endereço de envio, quando aplicável e autorizado.
- Código de rastreamento, quando existente.
- Link de rastreamento oficial, quando aplicável.
- Histórico das atualizações.

Para retirada, mostrar quando o pedido estiver efetivamente pronto, utilizando os dados reais do sistema.  
Para Correios, exibir os dados de postagem e rastreamento quando efetivamente registrados.  
Não inventar datas de disponibilidade, postagem ou entrega.

---

## 15. PAINEL ADMINISTRATIVO

O painel deverá consolidar a operação.  
Prever:
- Cadastro e gerenciamento de revendedores.
- Classificação administrativa de parceiros.
- Preços globais e individuais.
- Pedidos.
- Pagamentos.
- Solicitações internas.
- Fabricação.
- Inspeção.
- Atribuição de placas.
- Liberação.
- QR Codes.
- Ativação.
- NFC.
- Retiradas.
- Envios pelos Correios.
- Etiquetas.
- Rastreamento.
- Histórico de alterações.
- Relatórios.
- Logs.
- Auditoria.
- Configurações operacionais.

Os indicadores deverão ser calculados a partir de dados reais.

### 15.1. Tela de revendedores
A listagem deverá permitir consultar:
- Nome.
- E-mail.
- Telefone, se aplicável.
- Classificação administrativa.
- Estado da conta.
- Preço individual, se existir.
- Preço efetivo aplicável.
- Preferência de entrega.
- Quantidade de pedidos.
- Solicitações em andamento.
- Placas atribuídas.
- Última atividade, quando necessária e permitida.

Na ficha do revendedor, o administrador deverá poder:
- Editar os dados permitidos.
- Alterar a classificação administrativa.
- Definir ou remover o preço individual.
- Alterar a preferência padrão de entrega.
- Consultar pedidos e solicitações.
- Consultar fabricação e logística.
- Bloquear ou reativar a conta, conforme as permissões.
- Consultar o histórico de alterações.

Alterações críticas deverão gerar registros de auditoria.

### 15.2. Tela de pedidos
Cada pedido deverá exibir:
- Identificador.
- Revendedor.
- Origem comercial.
- Quantidade.
- Valores.
- Estado do pagamento, quando aplicável.
- Estado da fabricação.
- Estado da inspeção.
- Estado da atribuição.
- Modalidade de entrega.
- Dados logísticos pertinentes.
- Histórico.
- Ações permitidas.

### 15.3. Fila unificada de fabricação
A fila deverá reunir as solicitações de fabricação originadas de pedidos pagos e reservas internas aprovadas.  
Cada registro deverá informar sua origem e os critérios que autorizaram a fabricação.  
O sistema não deverá exigir que todas as solicitações tenham o mesmo evento de autorização.

### 15.4. Tela de logística
Criar uma área administrativa para organizar retiradas e envios.  
Filtros sugeridos:
- Aguardando produção.
- Em produção.
- Aguardando inspeção.
- Aguardando liberação.
- Pronto para retirada.
- Retirada agendada.
- Aguardando etiqueta.
- Aguardando postagem.
- Postado.
- Entregue.
- Com ocorrência.

A tela deverá permitir atualizar a modalidade, preencher os dados logísticos, registrar a retirada e consultar o histórico.  
As ações deverão ser condicionadas ao estado real do pedido.

---

## 16. ASAAS E PAGAMENTOS

Utilizar a documentação oficial atual do Asaas.  
Não inventar endpoints, eventos ou parâmetros.  
Implementar:
- Criação de cobrança no backend.
- Associação entre pedido e cobrança.
- Validação de webhooks.
- Idempotência.
- Tratamento de eventos repetidos.
- Tratamento de eventos fora de ordem.
- Registro de logs.
- Reconciliação de divergências.
- Separação entre pagamento confirmado e outros estados financeiros.

Não expor credenciais no frontend.  
O retorno do navegador não confirma pagamento.  
A fabricação de uma compra de revendedor somente será autorizada após confirmação financeira válida.  
Uma solicitação interna aprovada seguirá a regra própria de fabricação interna.  
Não permitir que a seleção de retirada ou Correios altere automaticamente o estado financeiro.  
Se o custo do frete for cobrado, sua regra de cálculo, pagamento e eventual reembolso deverá ser definida antes da implementação.

---

## 17. GEMINI OCR PARA COMPROVANTES DE POSTAGEM

Avaliar a utilização do Gemini para extrair informações de comprovantes de postagem.  
O fluxo deverá incluir:
1. Upload pelo administrador.
2. Validação do arquivo.
3. Envio seguro pelo backend.
4. Extração de dados.
5. Validação do código de rastreamento.
6. Verificação de duplicidade.
7. Revisão manual quando houver ambiguidade.
8. Registro do resultado.
9. Associação ao envio correto.
10. Auditoria.

Não aceitar resultados ambíguos sem revisão.  
Não presumir que o OCR comprova postagem ou entrega.  
Verificar a documentação, os custos e os limites vigentes antes da implementação.

---

## 18. BANCO DE DADOS

Utilizar Supabase/PostgreSQL, caso aprovado.  
Avaliar entidades como:
- `profiles`
- `clients`
- `opportunities`
- `sales`
- `orders`
- `order_items`
- `reservations`
- `manufacturing_orders`
- `production_events`
- `plates`
- `inspections`
- `plate_assignments`
- `destination_history`
- `payments`
- `webhook_events`
- `shipments`
- `shipment_files`
- `commissions`
- `state_history`
- `audit_logs`
- `pricing_history`, quando necessária.

A modelagem deverá preservar o perfil comercial unificado.  
Não criar tabelas duplicadas para revendedores independentes e vendedores internos sem justificativa técnica demonstrada.  
O campo de classificação administrativa não deverá ser usado como substituto de controles de autorização.

### 18.1. Dados logísticos
A estrutura deverá distinguir:
- Preferência padrão de entrega do revendedor.
- Modalidade selecionada no pedido.
- Dados de retirada.
- Endereço utilizado no envio.
- Estado da preparação.
- Estado da postagem ou retirada.
- Histórico de alterações.
- Responsável pelas alterações.

A alteração da preferência padrão não poderá sobrescrever dados históricos de pedidos anteriores.  
Dados logísticos poderão ser organizados em tabelas próprias, caso isso melhore a integridade e o histórico.

### 18.2. Integridade
Implementar:
- Chaves estrangeiras.
- Restrições de unicidade.
- Índices.
- Transações.
- Validação de estados.
- Proteção contra atribuição duplicada.
- Idempotência.
- Histórico.
- Controles de concorrência.

Não depender exclusivamente de validações do frontend.

---

## 19. SEGURANÇA E LGPD

Implementar, conforme aplicável:
- Supabase Auth.
- RLS.
- Autorização no backend.
- Privilégio mínimo.
- Gestão segura de segredos.
- Validação de entradas.
- Proteção contra XSS e SQL injection.
- Proteção de arquivos.
- Limites de requisição.
- Auditoria.
- Backups.
- Plano de recuperação.
- Separação entre desenvolvimento e produção.

Não expor chaves privilegiadas do Supabase no frontend.  
Não permitir elevação de privilégios pelo navegador.  
Coletar apenas os dados necessários para cadastro, entrega, produção e atendimento.  
Restringir o acesso a endereços, telefones, comprovantes e demais dados pessoais.  
Estabelecer regras adequadas de retenção e exclusão.  
Não afirmar conformidade legal automática sem avaliação adequada.

---

## 20. UX/UI E RESPONSIVIDADE

A interface deverá ser clara, profissional, acessível e responsiva.  
Priorizar:
- Navegação simples.
- Formulários intuitivos.
- Estados claramente identificados.
- Mensagens de erro compreensíveis.
- Confirmação para ações importantes.
- Indicadores baseados em dados reais.
- Filtros úteis.
- Histórico de alterações.
- Feedback após operações.
- Compatibilidade com dispositivos móveis.

No cadastro do revendedor, a escolha entre retirada e Correios deverá ser clara.  
Os campos deverão se adaptar à opção selecionada.  
No painel administrativo, a preferência padrão e a modalidade efetiva do pedido deverão estar visíveis sem ambiguidade.  
Evitar telas duplicadas desnecessariamente.

---

## 21. TESTES OBRIGATÓRIOS

Testar, no mínimo:
1. Cadastro público cria um perfil comercial autorizado.
2. Administrador consegue cadastrar um vendedor interno usando o mesmo modelo de perfil de revendedor.
3. O vendedor interno não recebe automaticamente privilégios administrativos.
4. O painel comercial utiliza a estrutura unificada.
5. O preço individual prevalece sobre o global.
6. A alteração de preço não modifica pedidos históricos.
7. Compra de revendedor não autoriza fabricação antes da confirmação do pagamento.
8. Webhook inválido não autoriza fabricação.
9. Reserva interna aprovada autoriza fabricação segundo a regra interna.
10. Uma placa não pode ser atribuída duas vezes.
11. Placa reprovada não pode ser liberada.
12. Revendedor não pode consultar dados de outro revendedor.
13. Revendedor consegue selecionar retirada no cadastro.
14. Revendedor consegue selecionar Correios no cadastro.
15. A preferência de entrega aparece corretamente no painel administrativo.
16. O administrador consegue alterar a preferência padrão.
17. O administrador consegue alterar a modalidade de um pedido quando permitido.
18. Alterar a preferência padrão não altera pedidos anteriores.
19. Alterar um pedido já postado não apaga o histórico de postagem.
20. Retirada só é marcada como realizada após confirmação operacional.
21. Código de rastreamento não comprova automaticamente postagem ou entrega.
22. Dados de retirada e endereço de envio são validados.
23. Usuários não autorizados não conseguem alterar a modalidade de entrega de terceiros.
24. A alteração de destino do QR Code preserva o histórico.
25. O fluxo de recuperação de senha preserva a conta e suas permissões.
26. O OCR trata resultados ambíguos com revisão manual.

Executar também testes unitários, de integração, RLS, concorrência, autorização, responsividade e build.  
Não declarar testes aprovados sem executá-los.

---

## 22. PLANO DE IMPLEMENTAÇÃO

O plano definitivo deverá ser ajustado após a auditoria.  
A sequência inicial recomendada é:
1. Auditoria do projeto.
2. Esclarecimento das regras pendentes.
3. Criação e validação da documentação.
4. Aprovação da arquitetura.
5. Modelagem do banco e segurança.
6. Autenticação e perfis comerciais unificados.
7. Cadastro público e administrativo de revendedores.
8. Cadastro de clientes, vendas e solicitações internas.
9. Precificação e pedidos.
10. Integração com Asaas.
11. Fabricação e inspeção.
12. Atribuição e liberação de placas.
13. QR Code dinâmico.
14. Ativação e NFC.
15. Escolha entre retirada e Correios.
16. Gestão administrativa de logística.
17. Integração OCR.
18. Painéis, relatórios e auditoria.
19. Testes e homologação.
20. Implantação autorizada.

Essa lista não autoriza a execução automática das etapas.  
Cada etapa depende de conclusão, documentação e aprovação explícita.

---

## 23. CRITÉRIO DE CONCLUSÃO

Uma funcionalidade somente será considerada concluída quando:
- Os requisitos estiverem implementados.
- As regras de negócio estiverem respeitadas.
- As permissões estiverem testadas.
- A validação ocorrer no backend.
- Os estados estiverem coerentes.
- Os dados estiverem protegidos.
- Os testes pertinentes tiverem sido executados.
- Os resultados forem documentados.
- A documentação estiver atualizada.
- Não houver defeitos bloqueadores conhecidos.

Diferenciar claramente:
- Implementado.
- Parcialmente implementado.
- Testado e aprovado.
- Testado e reprovado.
- Não testado.
- Bloqueado por dependência externa.

Não afirmar que uma integração está ativa se apenas foi descrita.  
Não afirmar que uma placa foi produzida apenas porque existe no banco.  
Não afirmar que uma encomenda foi enviada apenas porque existe um código de rastreamento.  
Não afirmar que um arquivo foi criado ou salvo sem comprovação.

---

## 24. INSTRUÇÃO PARA A PRIMEIRA RESPOSTA

Ao receber este documento, execute somente a auditoria inicial.

Apresente:
1. O que compreendeu sobre a plataforma.
2. Os arquivos que conseguiu acessar.
3. Os documentos existentes e ausentes.
4. As funcionalidades encontradas.
5. As lacunas, riscos e contradições.
6. As perguntas bloqueadoras.
7. As pendências não bloqueadoras.
8. As dependências externas.
9. Os documentos que deverão ser criados ou atualizados.
10. O plano de execução proposto.
11. O que dependerá de minha intervenção manual.

Não programe, não crie telas, não execute migrações e não altere integrações nessa primeira resposta.  
Finalize solicitando minha autorização para iniciar a próxima etapa.  
Aguarde minha resposta. Não avance automaticamente.

---

# ADENDO OBRIGATÓRIO — VERSÃO 5.0
### Cadastro de revendedores e gestão individual das placas QR Code dinâmico + NFC

**Vinculação:** Este adendo integra o Prompt Mestre Definitivo da Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC, versão 4.0. As 27 páginas originais foram preservadas. Em caso de complementaridade, este adendo detalha os requisitos individuais de cadastro, propriedade, configuração e ativação das placas; não elimina os demais requisitos já definidos.

### 1. Cadastro de revendedores por dois caminhos
#### 1.1. Cadastro autônomo
- Disponibilizar no site uma opção pública para cadastro de revendedor.
- Após preencher os dados obrigatórios e concluir o cadastro conforme o mecanismo de autenticação aprovado, o usuário recebe acesso imediato ao portal comercial autorizado, sem depender de aprovação manual, conforme a regra comercial definida.
- O perfil comercial deverá seguir o modelo unificado já estabelecido no Prompt Mestre. O cadastro não poderá conceder privilégios administrativos.

#### 1.2. Cadastro pelo administrador
- O administrador poderá cadastrar um revendedor pelo painel, preencher os dados necessários e, quando aplicável, definir condições comerciais individuais e classificação administrativa.
- A criação da conta deverá utilizar procedimento seguro de convite ou definição de senha pelo próprio usuário. O administrador não deverá definir nem conhecer a senha permanente do usuário.
- O revendedor criado administrativamente deverá utilizar o mesmo portal comercial e a mesma estrutura de perfil dos demais revendedores.
- Integrantes da equipe comercial interna continuam usando o mesmo modelo de perfil e portal, identificados por classificação administrativa quando necessário. Não criar um sistema comercial paralelo.

### 2. Identificação, propriedade e acesso às placas
- Cada placa deverá possuir identificador interno único e relação explícita com o proprietário comercial atual, além do histórico de atribuições.
- O revendedor só poderá visualizar, configurar ou administrar placas compradas e liberadas para ele, ou formalmente atribuídas a ele por processo autorizado.
- A autorização deverá ser verificada no backend e no banco de dados, incluindo políticas RLS quando aplicáveis. Não confiar apenas em filtros ou controles de interface.
- Tentativas de acesso ou alteração por manipulação de IDs, URLs, requisições ou parâmetros deverão ser negadas quando o usuário não tiver autorização.
- Atribuições, transferências, liberações, bloqueios e mudanças relevantes deverão gerar histórico de auditoria com responsável, data/hora e dados pertinentes.

### 3. Configuração individual de cada placa
Cada placa deverá ter configuração independente. Alterar uma placa não poderá modificar o destino, o estado ou os dados de outra placa.
- Permitir identificar o estabelecimento/cliente associado à placa.
- Permitir informar e salvar o URL de destino autorizado, incluindo link válido de Perfil da Empresa no Google ou página de avaliações, conforme o uso pretendido.
- Validar o formato e a segurança do URL no backend. Não aceitar esquemas ou destinos perigosos. A interface poderá oferecer uma ação de teste do endereço antes da ativação.
- Salvar a configuração não significa ativar a placa. A configuração deverá poder ser salva enquanto a placa permanece inativa.
- Preservar o destino anterior e o novo destino no histórico, com autor e data/hora, quando houver alteração.

### 4. Ativação e desativação individual
A interface deverá apresentar um único controle alternável, cujo rótulo e ação correspondam ao estado atual da placa:
- Placa inativa: exibir “Ativar placa”.
- Placa ativa: exibir “Desativar placa”.
- A ativação deverá ser permitida somente após validar autenticação, autorização do usuário, atribuição/liberação da placa, estado físico e configuração válida.
- Ao ativar, registrar a mudança de estado, o responsável e a data/hora. O QR Code e o NFC deverão encaminhar para a URL permanente configurada, desde que utilizem o mecanismo de redirecionamento central definido no Prompt Mestre.
- Ao desativar, bloquear o redirecionamento público da placa e apresentar uma mensagem não privada e apropriada. Não revelar dados pessoais nem o destino configurado.
- A desativação não poderá apagar a configuração, URL, dados NFC, associação com estabelecimento, atribuição ou histórico.
- Ao reativar, reutilizar a configuração salva, sem exigir novo cadastro de destino, salvo se a configuração tiver se tornado inválida ou a placa estiver bloqueada por motivo administrativo.
- O estado digital deverá ser persistido no banco e validado no backend em cada solicitação de redirecionamento. Não depender de estado somente no navegador nem de cache que permita continuar redirecionando uma placa desativada.

### 5. URL permanente compartilhada pelo QR Code e NFC
- Cada placa deverá possuir URL permanente e única, com token aleatório e imprevisível, conforme os requisitos gerais do Prompt Mestre.
- Sempre que o desenho técnico aprovado permitir, QR Code e NFC deverão utilizar a mesma URL permanente de redirecionamento. Assim, desativar a placa centralmente poderá bloquear ambos.
- Se uma etiqueta NFC for gravada diretamente com a URL final externa, o sistema não poderá garantir que a desativação central bloqueie esse destino. Portanto, não apresentar essa configuração como equivalente ao redirecionamento dinâmico.
- O endpoint público deverá verificar o estado atual da placa, distinguindo pelo menos: ativa, inativa, bloqueada administrativamente, não configurada e não liberada. A resposta pública não deverá expor informações privadas.

### 6. Integridade, concorrência e auditoria
- As mudanças de estado deverão ser seguras diante de solicitações repetidas ou simultâneas; a operação não poderá produzir estados contraditórios.
- Validar no backend as transições de estado permitidas. Uma placa não liberada, bloqueada, inexistente ou não atribuída ao usuário não poderá ser ativada por requisição direta.
- Registrar, no mínimo, eventos de ativação, desativação, bloqueio administrativo, alteração de URL/destino e atribuição/transferência de placa, com usuário responsável e data/hora.
- O histórico deverá ser preservado e não poderá ser alterado pelo revendedor para ocultar ações anteriores.

### 7. Critérios obrigatórios de aceitação
Os testes abaixo deverão ser executados e documentados. Não declarar que foram aprovados antes de executar testes reais:
1. Cadastro público cria uma conta comercial e libera acesso ao portal autorizado conforme a regra definida.
2. Administrador consegue criar um revendedor por fluxo seguro de convite/definição de senha.
3. Revendedor cadastrado por qualquer caminho usa o mesmo modelo de perfil e portal comercial.
4. Integrante interno da equipe comercial não recebe privilégios administrativos automaticamente.
5. Um revendedor visualiza e administra apenas placas compradas e liberadas ou formalmente atribuídas a ele.
6. Backend e banco de dados negam acesso indevido, inclusive tentativas com IDs ou parâmetros manipulados.
7. Usuário autorizado consegue salvar uma URL válida para Perfil da Empresa no Google/página de avaliações, sem que salvar ative a placa.
8. Placa ativa encaminha o QR Code para o destino salvo por meio da URL permanente.
9. Desativar a placa bloqueia o redirecionamento público sem apagar URL, configuração, dados NFC ou histórico.
10. Reativar a placa restaura o uso da configuração salva e da mesma URL permanente.
11. Ativar, desativar ou alterar o destino de uma placa não afeta outras placas.
12. Placa bloqueada administrativamente, não configurada ou não liberada não pode ser ativada pelo revendedor.
13. Alterações de ativação, desativação, destino e atribuição ficam registradas com responsável e data/hora.
14. Solicitações repetidas ou concorrentes não geram estados contraditórios nem liberam acesso indevido.

### 8. Regras de implementação e comprovação
- Antes de implementar, auditar o projeto e os arquivos realmente acessíveis, identificar lacunas e esclarecer as decisões bloqueadoras, conforme a governança já definida na versão 4.0.
- Não começar alterações de código, banco, telas, migrações ou integrações sem autorização explícita para a etapa correspondente.
- Executar testes unitários, integração, autorização/RLS, concorrência, redirecionamento e comportamento de ativação/desativação conforme aplicável.
- Ao concluir cada etapa, informar o que foi realizado, arquivos modificados, testes realmente executados, resultados, pendências, riscos e próxima etapa. Aguardar aprovação antes de avançar.
- Distinguir claramente requisitos documentados de funcionalidades implementadas e de testes efetivamente aprovados. Este adendo, por si só, não comprova implementação.
