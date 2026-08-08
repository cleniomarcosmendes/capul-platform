# Roteiro de teste no Chrome — Inventário

Complementa o `inventario/backend/smoke_ciclo_completo.py`, que já cobre o ciclo
inteiro por API (**67 verificações**). Aqui está só o que a API **não alcança**:
o que aparece na tela, o que o papel do usuário esconde, e o que só quebra no
navegador.

## Preparação

São **dois** cenários, porque um inventário não pode estar encerrado e contável
ao mesmo tempo:

```bash
# 1) TESTE_CHROME — parado EM CONTAGEM, com produto COM LOTE. É o das seções 1-4.
python3 inventario/backend/preparar_teste_chrome.py

# 2) SMOKE_09AGO — ciclo inteiro até encerrar/analisar. Para a seção 5 (análise).
python3 inventario/backend/smoke_ciclo_completo.py
```

Os dois podem coexistir. Reexecutar qualquer um refaz só o dele.

### ⭐ O produto que vale mais que os outros

No `TESTE_CHROME`, o **`00010093`** exige lote e **não tem lote nenhum** no
recorte — os 5 lotes dele estão com saldo zero no Protheus. É o caso real que
justifica o "informar outro lote": sem ele, o produto seria **impossível de
contar**. Até 09/08 o desktop dava beco sem saída aqui.

Os outros com lote (`00010037`, `00010038`, `00010070`) têm 2, 3 e 1 lote — use
esses para o fluxo normal.

**Usuários** (https://localhost/inventario/):

| Login | Senha | Papel |
|---|---|---|
| `clenio` | `Cl123456` | SUPERVISOR |
| `jordana` | `Jo123456` | OPERATOR |
| `juliocesar` | `Ju123456` | OPERATOR |
| `admin` | `admin123` | ADMIN |

---

## 1. O que o OPERADOR não pode ver

> A contagem cega é a regra mais cara do módulo: se o operador chega ao saldo por
> **qualquer** caminho, ela deixa de existir. Já vazou duas vezes por endpoint.

Entre como **jordana** e confirme que **não aparece**:

- [ ] **Menu lateral** — sem "Cadastros" (Produtos/Armazéns), sem "Análise"
      (`/divergencias`), sem "Integração Protheus" (Importação/Integrações/Monitoramento).
- [ ] **Detalhe do inventário** — sem as abas Itens, Listas e Análise.
- [ ] **Tela de contagem** — nenhuma coluna de Saldo, Esperado ou Variação.
- [ ] Digite `/inventario/divergencias` **na barra de endereço**. Deve barrar —
      esconder o menu não basta.

Depois entre como **clenio** e confirme que **tudo isso aparece**. Se aparecer
igual para os dois, algo está errado.

---

## 2. O modal de LOTE — o caso que quebrava

> Foi introduzido em 08/08 e a máscara de saldo respingou nele: até `a9b410cb` a
> tela do operador quebrava (`.toFixed()` em campo ausente).

No **`TESTE_CHROME`**, lista da **jordana**, abra um produto com controle de lote
(badge roxo `LOTE`) — `00010037`, `00010038` ou `00010070`.

Como **clenio** (supervisor) — ⚠️ **na "Lista clenio"**, não na da jordana:

> Ninguém conta pela lista de outro, **nem ADMIN** ("Você não é o contador desta
> lista"). É regra de auditoria, correta. Portanto a única forma de ver o modal
> com saldo é o supervisor ser o contador de uma lista dele — por isso o cenário
> cria a "Lista clenio".

- [ ] Modal abre com a lista de lotes.
- [ ] Mostra **Saldo Sistema** por lote, **Sistema** no total e as **diferenças**.
- [ ] Mostra **Val.** (validade) ao lado do lote do fornecedor.

Como **jordana** (operador):
- [ ] Modal abre **sem quebrar** (era aqui que dava tela branca).
- [ ] **Não** mostra Saldo Sistema, nem Sistema, nem diferença.
- [ ] **Mostra** o número do lote, o lote do fornecedor e a **validade**
      (`Val. 30/01/2029`). Validade não é saldo — o operador vê.

Regras, nos dois:
- [ ] **Salvar fica desabilitado** enquanto algum lote estiver vazio.
- [ ] Digitar **0** num lote é válido e habilita — zero é "procurei e não achei".
- [ ] **"+ Informar outro lote"** acrescenta linha com número editável, marcada
      **"fora da lista"**.
- [ ] Linha nova **sem número** mantém o Salvar bloqueado.
- [ ] O **total** é a soma dos lotes e muda sozinho — não é digitável.

### ⭐ E agora o `00010093`, que não tem lote nenhum

- [ ] Abre com **aviso âmbar** dizendo que nenhum lote entrou no recorte — e que
      a causa é **saldo zero OU vencimento** (não pode afirmar só vencimento: os
      5 lotes deste produto estão com saldo zero, nenhum vencido).
- [ ] ⭐ O botão **"+ Informar outro lote" continua visível**. Era aqui o beco sem
      saída: até `5bab54b5` o modal caía em tela de erro e o produto ficava
      impossível de contar.
- [ ] Informar um lote à mão + quantidade → **salva**.
- [ ] Sem informar nada, **Salvar fica bloqueado** (não há contagem a registrar).

---

## 3. Fluxo do supervisor

Como **clenio**, no **`TESTE_CHROME`** (ou criando um novo):

- [ ] **Criar inventário** — o seletor de armazém traz opções (já esteve vazio).
- [ ] **Adicionar produtos** — os 7 filtros de faixa funcionam.
      ⚠️ Aqui **não** há teto: o de 3.000 é **por lista de contagem** e existe por
      causa do app. O aviso aparece ao **montar a lista** (`Atribuir produtos`) e
      como selo "acima do teto" na lista — é lá que se testa.
- [ ] **Criar lista** e atribuir contador — `jordana` e `juliocesar` aparecem.
- [ ] **Liberar** com "mostrar contagens anteriores" **desmarcado** (cega) e,
      noutra lista, **marcado**.
- [ ] Lista entregue aparece como **AGUARDANDO_REVISAO**, e o contador some do
      caminho dela.
- [ ] **Devolver ao contador** — testar **total** e **parcial** (com busca e
      checkbox item a item).
- [ ] ⭐ Depois de devolver, as contagens **continuam lá** — devolução não zera.
- [ ] **Avançar ciclo**: cada ciclo tem **contador próprio**. Liberar o 2º sem
      atribuir avisa *"Lista não tem contador atribuído para o ciclo 2"* —
      **comportamento correto e confirmado pelo Clenio (08/08)**: a lista precisa
      de contador atribuído. Conferir só que o aviso aparece e que atribuir o
      contador do ciclo 2 destrava.
- [ ] 2º ciclo traz **só os divergentes**, não a lista toda.
- [ ] **Encerrar lista** ≠ **Encerrar inventário** — são dois atos.
- [ ] `/divergencias` — as 4 abas, com o esperado × contado. Use o
      **`SMOKE_09AGO`**, que já está encerrado e tem 5 divergências reais.
- [ ] **Marcar analisado** só habilita com o inventário encerrado.

---

## 4. Contagem pelo operador

Como **jordana**, na lista dela:

- [ ] Só a **lista dela** aparece — não a do juliocesar.
- [ ] Contar produto simples; o valor persiste ao recarregar (F5).
- [ ] Produto com lote **não aceita** quantidade direta — abre o modal.
- [ ] **Liberar para supervisor** avisa **quantos itens virarão zero**.
- [ ] Depois de liberar, **não dá mais para alterar** contagem.

---

## 5. App (Expo Go)

> **Pré-requisito**: Expo Go **56.0.4** (a Play Store serve 57 e recusa o
> projeto). Ver `docs/RETOMAR_INVENTARIO_08AGO.md`.

- [ ] **Cabeçalho** mostra a lista, o **armazém** e o **ciclo**.
- [ ] **Localização** ao lado do código do produto.
- [ ] Item com lote traz o badge `LOTE` e abre a tela de lotes.
- [ ] ⭐ **Ciclo offline**: baixar → **modo avião** → contar alguns → voltar o
      sinal → **Sincronizar**.
- [ ] ⭐ Depois de sincronizar, o número **continua na tela** (fica verde com ✓) e
      o progresso **não volta atrás**. Era o defeito que originou toda a onda.
- [ ] **Liberar para supervisor** com contagem pendente → **deve abortar**.
- [ ] **Sair** ≠ **Liberar**: sair mantém a lista em contagem e avisa isso.
- [ ] Supervisor libera o selo da lista no desktop → o app **recusa** sincronizar.

---

## 6. Anote como defeito se

- Operador enxergar saldo, esperado, variação ou contagem de ciclo anterior por
  **qualquer** caminho — inclusive URL digitada à mão.
- Tela branca ou erro de console ao abrir o modal de lote.
- Número contado sumir da tela após sincronizar (app) ou recarregar (web).
- Progresso ("X de Y contados") diminuir depois de uma ação bem-sucedida.
- Devolução do supervisor apagar contagem.
- Produto com lote aceitar quantidade única em qualquer tela.

---

## 7. O que este roteiro NÃO cobre

- **Envio ao Protheus**: `DIGITACAO`/`TRANSFERENCIA`/`HISTORICO` apontam para
  **HOMOLOGAÇÃO ativa** — o envio cria registro real no Protheus HOM. Testar só
  com janela combinada.
- **Volume**: o smoke usa 9 produtos. O teto de 3.000 por lista e a performance
  do app com lista cheia continuam sem prova.
- **Multi-filial**: tudo roda na filial 01.
