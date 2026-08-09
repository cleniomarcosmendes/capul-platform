# Logística — pauta levantada pelo Clenio (08/08/2026)

Cinco pontos vindos dos **testes dos usuários**, registrados para detalhar e virar
plano na próxima sessão. **Nada foi analisado nem implementado** — o que está aqui
é o relato e o raciocínio dele, preservados.

⚠️ Os pontos **1, 3, 4 e 5 se cruzam**: todos tocam quem responde pelo veículo,
pela viagem e pelas despesas. Vale desenhar os quatro juntos antes de mexer em
qualquer um — mudar um isolado provavelmente contradiz outro.

---

## 1. KM inicial e final na Entrega + amarrar com a viagem do veículo

Ajustar o apontamento de KM inicial e final, **e amarrar as entregas à viagem do
veículo, para o controle de frota**.

➡️ O levantamento técnico já está feito em **`docs/ANALISE_ROTA_KM_ENTREGA.md`**
(KM opcional nas duas pontas, sem trava de rota simultânea, e a causa: o KM
"de verdade" nasceu na Frota e a Entrega ganhou campos próprios como opcionais).

**Novo aqui:** a amarração Entrega ↔ viagem de frota não estava naquele
levantamento. É o que fecha o KM para o custo de frota.

---

## 2. Data de entrega no lançamento

Há locais de entrega atendidos em **dias específicos** — a rota daquela região só
passa em certos dias.

- Campo **data de entrega** no lançamento, **preenchido com o dia atual** por padrão.
- Na **montagem da rota**, ordenar por data de entrega.
- Se o usuário selecionar uma entrega **fora do dia atual**, o sistema **alerta**
  (avisa, não bloqueia — o relato é de alerta).

---

## 3. "Saída de Veículo" pode não ter veículo

Os usuários fazem o **ACERTO DA VIAGEM** de viagens realizadas **sem o veículo da
empresa** — outro meio de transporte. Nesse caso o registro é só **prestação de
contas** (adiantamento e despesas).

**Sugestão do Clenio:** renomear **"Saída de Veículo" → "Registro de Viagem"**, e
nesse registro o **veículo passa a ser opcional**.

⚠️ Verificar o efeito no **custo de frota**: viagem sem veículo não pode entrar no
rateio por veículo. Há precedente — no RDV, `veiculoId = null` significa
INDIVÍDUO ([[project_despesa_rdv_vs_custos_frota]]).

---

## 4. 🐞 "Gestor de Entrega" como Supervisor Responsável não aprova despesa

**Relato:** usuário com papel **GESTOR_ENTREGA** estava como **"Supervisor
Responsável"** no cadastro do veículo — e **não conseguia acompanhar nem aprovar
as despesas** daquele veículo.

**Contorno que ele fez:** criou outro usuário com papel **SUPERVISOR_FROTA**
("Supervisor de Departamento"), pôs esse como Supervisor Responsável do veículo,
e então funcionou.

Ou seja: o campo aceita um usuário que **não tem o papel necessário** para exercer
a função — e não avisa. Ver [[project_supervisor_departamento_frota]].

---

## 5. Perfil PADRÃO sem acesso ao acerto — e QUEM aprova a despesa

### 5a. O acesso
Usuário com perfil **PADRÃO** usa o app e se identifica com **matrícula e senha**
do colaborador a cada viagem — isso está correto e é o desenho atual
([[feedback_entrega_registrador_padrao_tipo]]).

O problema: esse mesmo usuário **pode precisar fazer o acerto pelo DESKTOP**, em
"Saída de Veículo" → **ACERTO**, onde se registram despesas e adiantamento. Hoje
essa opção só existe para perfil **INDIVIDUAL**.

**Sugestão do Clenio:** liberar o acerto para o perfil PADRÃO **mediante matrícula
e senha**, com a trava de que **só quem digitou a matrícula/senha e o supervisor
do departamento** possam incluir/editar/excluir despesa e adiantamento — cabendo
ao supervisor aprovar.

### 5b. ⭐ A questão de fundo: o aprovador vem do VEÍCULO, não da pessoa

Observação dele, e é a mais importante da pauta:

> *"se o usuário sair com um veículo cujo chefe imediato não está como
> 'supervisor' no cadastro do veículo, será outro gerente — que não tem nenhuma
> relação com ele — que vai aprovar as despesas, simplesmente porque ele usou
> aquele veículo."*

O aprovador é derivado do **cadastro do veículo** (`veiculo.supervisorId`). Mas a
despesa é **da pessoa**, não do carro. Pegar um veículo de outro departamento
manda a aprovação para alguém sem relação hierárquica com quem gastou.

⚠️ **Já houve decisão análoga no RDV**: o responsável do departamento saiu do
cadastro do veículo para um **cadastro específico de aprovação**. O Clenio lembrou
disso sozinho ao escrever o ponto — vale recuperar como aquilo foi resolvido lá e
avaliar o mesmo caminho aqui.

---

## Como atacar (sugestão de ordem, a validar)

1. **Desenhar juntos os pontos 3, 4 e 5** — são o mesmo assunto: quem responde
   pela viagem e pela despesa. O 5b é a decisão-mãe; os outros dois dependem dela.
2. **Ponto 1** (KM) — levantamento pronto, mas a amarração com a viagem de frota
   depende do que sair do item anterior.
3. **Ponto 2** (data de entrega) — é o mais independente e o de menor risco.
   Pode sair antes, se quiser entrega rápida.
