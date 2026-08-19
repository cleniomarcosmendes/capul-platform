# Roteiro de teste — app offline (HLG)

Valida o que foi corrigido depois do relato de 18/08 ("desliguei o WiFi, cliquei
na carga e o app disse que não localizou a entrega").

**Onde:** homologação, no aparelho, com um APK que já tenha o bundle novo.
**Como desligar a rede:** use o **modo avião**, não só o WiFi — desligar o WiFi
com dados móveis ligados NÃO deixa o aparelho offline, e o teste passa por
engano.

Antes de começar, no desktop: criar entregas, montar a carga e despachar.

---

## 1. O caso relatado — reabrir a carga sem sinal

| # | Passo | Esperado |
|---|---|---|
| 1.1 | Login com sinal | Entra no lançador |
| 1.2 | Entregas → abrir a carga | Rota com as paradas |
| 1.3 | Voltar para a lista | Lista das rotas |
| 1.4 | **Modo avião** | — |
| 1.5 | Tocar na carga de novo | ⭐ **A rota abre**, com a faixa cinza `📴 Sem sinal — dados do aparelho, de HH:MM` |
| 1.6 | Voltar e entrar mais 2×  | Abre sempre; nada de "não foi possível carregar" |

## 2. App fechado sem sinal (o caso que ninguém testou)

| # | Passo | Esperado |
|---|---|---|
| 2.1 | Ainda em modo avião, **fechar o app** (deslizar da lista de recentes) | — |
| 2.2 | Abrir o app | ⭐ **Continua logado** — não pode cair na tela de login |
| 2.3 | Entregas | A lista das rotas aparece, com a faixa cinza |
| 2.4 | Abrir a carga | Abre com as paradas |
| 2.5 | Sair do modo avião e puxar a lista para baixo | A faixa cinza some (dado ao vivo) |

> 🔴 Se em 2.2 cair no login: **pare e avise**. Antes da correção isso apagava a
> credencial do aparelho, e sem rede não dava para entrar de novo.

## 3. Rodar a rota inteira sem sinal

| # | Passo | Esperado |
|---|---|---|
| 3.1 | Modo avião · abrir a carga · informar o **KM de saída** | "Salvo offline"; a rota destrava |
| 3.2 | Sair da rota e entrar de novo | ⭐ O KM **continua lá** (não volta a pedir) |
| 3.3 | Dar baixa numa entrega (foto + assinatura) | Vai para "Concluídas"; faixa laranja "1 baixa aguardando sinal" |
| 3.4 | Lançar uma **despesa** | ⭐ O seletor de **tipo de despesa** tem opções (não pode estar vazio) |
| 3.5 | Encerrar a rota (KM de retorno) | Aceita offline |
| 3.6 | Sair do modo avião, abrir o app e tocar na faixa laranja | Tudo sobe: KM de saída → baixas → despesa → encerramento |
| 3.7 | Conferir no desktop | Rota concluída, baixas com foto, despesa lançada |

## 4. Frota sem sinal (o que você pediu)

| # | Passo | Esperado |
|---|---|---|
| 4.1 | Com sinal: registrar a **saída** de um veículo | Viagem em curso |
| 4.2 | Modo avião · Frota | ⭐ O veículo aparece na lista (faixa cinza) |
| 4.3 | Abrir a viagem | Abre — não pode dizer "Viagem não está mais em curso" |
| 4.4 | Registrar uma **parada** | "Salvo offline" e aparece em **"Feitas sem sinal"** |
| 4.5 | **Cheguei aqui** numa parada planejada | ⭐ Sai de "planejadas" e entra em "Feitas sem sinal" — **não pode continuar oferecendo o botão** |
| 4.6 | Lançar **despesa** com foto do cupom | Seletor de tipo preenchido; salva offline |
| 4.7 | Registrar o **retorno** (KM final) | ⭐ "Retorno salvo offline… com a hora de agora"; a aba vira **🏁 Fechado** |
| 4.8 | Sair do modo avião e sincronizar | Tudo sobe na ordem; a viagem fecha |
| 4.9 | No desktop, conferir a **hora de chegada** | ⭐ Tem de ser a hora do passo 4.7, **não** a da sincronização |

> A **saída** de veículo continua exigindo rede de propósito: ela valida a senha
> no Protheus e é o que reserva o carro. Se o teste 4.1 for feito em modo avião,
> a recusa é o comportamento correto.

## 5. RDV (supervisor) sem sinal

| # | Passo | Esperado |
|---|---|---|
| 5.1 | Com sinal: abrir o planejamento em curso | Visitas listadas |
| 5.2 | Modo avião · voltar e reabrir | Abre com faixa cinza |
| 5.3 | Apontar uma visita como **Realizada** | ⭐ Muda para "Realizada · sem sinal" e os botões somem |
| 5.4 | Lançar despesa | Tipo de despesa preenchido |
| 5.5 | Sair do avião e sincronizar | Sobe; o "· sem sinal" some |

## 6. Contagem (inventário) sem sinal

| # | Passo | Esperado |
|---|---|---|
| 6.1 | Com sinal: baixar uma lista | Lista no aparelho |
| 6.2 | Modo avião · voltar ao lançador · Contagem | ⭐ A lista aparece (antes a home vinha vazia e a lista já baixada ficava inalcançável) |

## 7. Troca de usuário no mesmo aparelho

| # | Passo | Esperado |
|---|---|---|
| 7.1 | Com sinal, **Sair** | Volta ao login |
| 7.2 | Entrar com OUTRO usuário | ⭐ **Nenhuma rota/viagem do usuário anterior** aparece |
| 7.3 | Se o 1º usuário tinha pendências na fila | Elas continuam guardadas e sobem quando ele entrar de novo |

---

## O que reportar se falhar

Diga o **número do passo**, o que apareceu na tela e se o aparelho estava em
modo avião ou só sem WiFi. As duas coisas se comportam de formas diferentes, e
essa informação sozinha já separa metade das causas.
