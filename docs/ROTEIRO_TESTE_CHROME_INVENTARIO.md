# Roteiro de teste no Chrome — Inventário

Complementa o `inventario/backend/smoke_ciclo_completo.py`, que já cobre o ciclo
inteiro por API (**67 verificações**). Aqui está só o que a API **não alcança**:
o que aparece na tela, o que o papel do usuário esconde, e o que só quebra no
navegador.

**Rode o smoke antes.** Ele deixa o inventário `SMOKE_09AGO` pronto no DEV, já
encerrado e analisado — vários casos abaixo usam ele.

```bash
python3 inventario/backend/smoke_ciclo_completo.py
```

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

Abra um produto **com controle de lote** (badge roxo `LOTE`; no `SMOKE_09AGO` são
os códigos que começam com `000100`).

Como **clenio** (supervisor):
- [ ] Modal abre com a lista de lotes.
- [ ] Mostra **Saldo Sistema** por lote, **Sistema** no total e as **diferenças**.
- [ ] Mostra **Val.** (validade) ao lado do lote do fornecedor.

Como **jordana** (operador):
- [ ] Modal abre **sem quebrar** (era aqui que dava tela branca).
- [ ] **Não** mostra Saldo Sistema, nem Sistema, nem diferença.
- [ ] **Mostra** o número do lote, o lote do fornecedor e a validade.

Regras, nos dois:
- [ ] **Salvar fica desabilitado** enquanto algum lote estiver vazio.
- [ ] Digitar **0** num lote é válido e habilita — zero é "procurei e não achei".
- [ ] **"+ Informar outro lote"** acrescenta linha com número editável, marcada
      **"fora da lista"**.
- [ ] Linha nova **sem número** mantém o Salvar bloqueado.
- [ ] O **total** é a soma dos lotes e muda sozinho — não é digitável.

---

## 3. Fluxo do supervisor

Como **clenio**, num inventário novo (ou reabrindo o `SMOKE_09AGO`):

- [ ] **Criar inventário** — o seletor de armazém traz opções (já esteve vazio).
- [ ] **Adicionar produtos** — os 7 filtros de faixa funcionam; passar de 3.000
      itens mostra o aviso do teto.
- [ ] **Criar lista** e atribuir contador — `jordana` e `juliocesar` aparecem.
- [ ] **Liberar** com "mostrar contagens anteriores" **desmarcado** (cega) e,
      noutra lista, **marcado**.
- [ ] Lista entregue aparece como **AGUARDANDO_REVISAO**, e o contador some do
      caminho dela.
- [ ] **Devolver ao contador** — testar **total** e **parcial** (com busca e
      checkbox item a item).
- [ ] ⭐ Depois de devolver, as contagens **continuam lá** — devolução não zera.
- [ ] **Avançar ciclo**: ao liberar o 2º ciclo **sem atribuir contador do ciclo 2**,
      deve avisar *"Lista não tem contador atribuído para o ciclo 2"*. É regra —
      cada ciclo tem seu contador. **Confirme que a tela deixa isso óbvio antes
      do erro**; se não deixar, é melhoria de UX a anotar.
- [ ] 2º ciclo traz **só os divergentes**, não a lista toda.
- [ ] **Encerrar lista** ≠ **Encerrar inventário** — são dois atos.
- [ ] `/divergencias` — as 4 abas, com o esperado × contado.
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
> projeto). Ver `docs/RETOMAR_INVENTARIO_09AGO.md`.

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
