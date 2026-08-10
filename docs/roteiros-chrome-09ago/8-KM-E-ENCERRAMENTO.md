# 8 · KM da rota, encerramento e uma rota por vez (ponto 1)

**Valida:** commit `d52d34c4`. **Tempo:** ~25 min. **É o roteiro mais longo** — a
mudança tem seis regras e mexe no que alimenta custo por km e manutenção preventiva.
**Usuários:** `admin`/`admin123` · `condutor_ind`/`123456`.
**Filial:** 01. **Pré-voo:** containers rebuildados + **Ctrl+Shift+R**.

> **O relato que originou tudo.** *"Com o login do ENTREGADOR o sistema deixa iniciar as
> entregas sem registrar o KM inicial."* Verdade — e o app até travava a baixa, mas só
> na TELA. Qualquer outro caminho passava ao largo, e a rota rodava inteira sem
> hodômetro: o trecho sumia do KM rodado e o custo por km saía inflado.

---

## Preparação (4 passos, todos desfeitos no fim)

A filial 01 tem **2 entregas livres** e **1 veículo disponível**, mas **nenhum
entregador** — por isso o passo 1.

- [ ] 1. `admin` → Configurador → `condutor_ind` → **trocar** o papel de Logística de
      *Operador de Entregas* para **Entregador** (editar a linha existente, não
      adicionar outra).

> ⚠️ **É troca, não acúmulo.** A plataforma guarda **um papel por departamento**, e os
> dois cairiam no mesmo (T.I.). Tentar adicionar uma 2ª linha ali **substitui** o papel
> anterior — na 1ª execução deste roteiro (09/08) foi o que aconteceu: o `condutor_ind`
> perdeu o acesso ao desktop e parecia regressão do multi-role. **Não era**: multi-role é
> por DEPARTAMENTO. A tela agora **barra** o perfil duplicado em vez de sobrescrever
> calada (`0bd7d4c0`..).
>
> Ele **não precisa logar** neste roteiro — é só o motorista atribuído à rota. Tudo é
> feito pelo `admin`. O desfazer devolve o papel de Operador de Entregas.
- [ ] 2. **Entregas → Nova**: criar **2 entregas** para a rota B (a rota A usa as duas
      que já existem). Endereço qualquer da filial 01.
- [ ] 3. **Veículos → Novo**: cadastrar um 2º veículo da filial 01 (ex.: placa
      `TST8K88`) — o teste de "uma rota por vez" precisa de dois carros.
- [ ] 4. **Rotas → Montar rota**: montar a **rota A** com as 2 entregas antigas,
      motorista **condutor_ind**, o veículo que já estava disponível → **Despachar**.

## 8.1 O despacho NÃO pede KM — e não grava

- [ ] Na confirmação do despacho, a mensagem diz que **o KM é registrado pelo motorista
      no app**. Não há campo de hodômetro em lugar nenhum do desktop.
- [ ] Abrindo a rota recém-despachada, o **KM de saída aparece vazio**.

> KM é leitura do PAINEL. O despacho é no escritório, às vezes com antecedência — pedir
> hodômetro ali só produziria número inventado, e número inventado em KM contamina
> custo por km e manutenção preventiva.

## 8.2 ⭐ Sem KM de saída, o SERVIDOR recusa a baixa

A regra existia só no app. Aqui se prova que ela agora vale para qualquer caminho.

- [ ] Na rota A, tentar **dar baixa** numa entrega pela web. Deve recusar com
      **"Registre o KM de saída da rota #N antes de dar baixa nas entregas."**
- [ ] A entrega **continua EM VIAGEM** (nada foi baixado pela metade).
- [ ] Tentar **recusar** (não-entrega) a outra: **também recusado** — senão bastaria
      recusar tudo para fugir da regra.

## 8.3 Registrado o KM, a baixa libera

O KM de saída é ato do app. Pela web, use o endpoint que o app usa (DevTools →
console), que é a simulação honesta desse passo:

```js
await fetch('/api/v1/logistica/viagens/<ID_DA_ROTA>/iniciar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json',
             Authorization: 'Bearer ' + localStorage.getItem('accessToken') },
  body: JSON.stringify({ kmInicial: 60500 })   // maior que o KM atual do veículo
}).then(r => r.json())
```

- [ ] A rota passa a exibir o **KM de saída**.
- [ ] Agora a **baixa funciona** — baixe **uma** das entregas (com foto, assinatura ou
      o nome de quem recebeu) e deixe a outra pendente.

## 8.4 ⭐ Encerrar exige KM de retorno E todas as paradas resolvidas

- [ ] Tentar encerrar **sem KM final** (mesmo endpoint, `/concluir` com `{}`) →
      recusado por validação do campo.
- [ ] Tentar encerrar **com KM final** e a entrega ainda pendente → recusado com
      **"1 entrega(s) ainda sem baixa. Registre a entrega ou a recusa de cada uma
      antes de encerrar a rota."**
- [ ] **Resolver** a última entrega (baixar ou recusar) e encerrar de novo → **conclui**,
      o veículo volta a **Disponível** e o odômetro do veículo passa a ser o KM final.

> **Era aqui o buraco maior.** Antes, encerrar marcava as pendentes como **ENTREGUE sem
> comprovante** — o app até avisava, mas deixava. Fabricava entrega sem prova justamente
> nas paradas que ficaram sem baixa, e anulava o cofre da Fase 1b.

## 8.5 O desktop não conclui mais — e o gestor continua tendo saída

- [ ] Numa rota EM_CURSO, o botão **"Concluir" não existe mais** no desktop.
- [ ] O botão **"Forçar encerramento"** continua lá (gestor): pede o **KM do painel**,
      deixa escolher o destino das entregas não baixadas e grava quem forçou.

> Encerrar é ato do condutor, no app, onde o hodômetro é lido. O desktop mantém só a
> exceção auditada.

## 8.6 ⭐ Uma rota por vez — por veículo E por motorista

- [ ] Montar a **rota B** com as 2 entregas novas, o **mesmo motorista** (`condutor_ind`)
      e o **veículo novo** (`TST8K88`) → **Despachar**.
- [ ] Recusa: **"O motorista já está na rota #N, ainda em curso. Encerre-a antes de
      despachar outra."** — citando o número da rota A.
- [ ] Encerrar a rota A (8.4) e despachar a B de novo → **passa**.

> A mensagem diz **qual** rota está aberta. "Veículo indisponível" mandaria o operador
> procurar sozinho.

## 8.7 A entrega entra no KM da frota

> ⚠️ **Olhe `kmRodadoMes`, não o ranking por departamento.** Na 1ª execução o item foi
> dado como PASS lendo `rankingDepartamento` — e ele **não** mudou: continua contando só
> viagens de FROTA, de propósito (ele mede o departamento **solicitante**, que a rota de
> entrega não tem). O indicador que passou a incluir a entrega é o **KM rodado**.

- [ ] **Frota → Monitor** (mês corrente), ou `GET /frota/painel?mes=&ano=` →
      `indicadores.kmRodadoMes` e `indicadores.custoPorKm`.
- [ ] O KM da rota que você encerrou **está somado** — antes o painel contava só FROTA,
      embora a rota de entrega mova o **mesmo odômetro**.
- [ ] **Sanidade:** o valor tem de ser da ordem das distâncias rodadas (dezenas/centenas
      de km), **não** da ordem da leitura do odômetro (dezenas de milhares). Se aparecer
      um número enorme, é rota entrando na conta **sem KM de saída** — foi o defeito
      achado nesta execução (`kmFinal - 0` = leitura inteira do hodômetro).

> Medido por API em 09/08: **29 → 41 km** ao incluir a entrega. Depois da correção das
> duas pontas, com as rotas do próprio roteiro encerradas: **61 km** e custo por km
> **R$ 27,55**.

---

## Desfazer

- [ ] Encerrar (ou forçar o encerramento de) as rotas A e B, deixando os veículos livres.
- [ ] Cancelar as entregas de teste criadas na preparação.
- [ ] **Inativar** o veículo `TST8K88`.
- [ ] **Devolver o papel de `condutor_ind` para *Operador de Entregas*** (editando a
      linha, como no passo 1). *(Papel trocado e esquecido contamina roteiro seguinte.)*
