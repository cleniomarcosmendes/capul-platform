# 6 · Data da entrega (ponto 2)

**Valida:** commit `42521540`. **Tempo:** ~10 min.
**Telas:** `https://localhost/entregas/` → **Entregas → Nova** e **Rotas → Montar rota**.
**Usuário:** `admin` / `admin123` — filial **01**.
**Pré-voo:** containers rebuildados + **Ctrl+Shift+R**.

> **Por que a filial 01.** Ela tem **2 entregas pendentes SEM data** (anteriores à
> mudança) — exatamente o que o item 6.2 precisa para provar que o legado vai para o
> fim da fila. A filial 02 tem mais entregas, mas exigiria trocar de filial e depende
> de credenciais que hoje devolvem 401.

> **O caso.** Há locais atendidos em **dias específicos** — a rota daquela região só
> passa em certos dias. A entrega só tinha `horario` (texto livre), que diz a *hora*
> preferida e nunca o *dia*.

---

## 6.1 O lançamento nasce com HOJE

- [ ] **Entregas → Nova entrega**. Junto de "Volumes" há o campo **Data da entrega**,
      já preenchido com **o dia de hoje**.
- [ ] Registrar assim, sem tocar no campo (é o caso normal do balcão — quem lança não
      deveria ter de digitar isso). Anote o número.
- [ ] Lançar uma **segunda** entrega, escolhendo uma data **futura** (ex.: daqui a 6
      dias). Ao mudar, aparece **"Agendada para outro dia."** Anote o número.

## 6.2 O dia manda na fila de montagem

**Tela:** **Rotas → Montar rota** (filial 01).

- [ ] A fila vem ordenada por **data de entrega**: a de hoje primeiro, depois a futura.
- [ ] As **2 entregas antigas** (sem data) ficam **no fim** — não podem encabeçar a fila.
- [ ] Na linha da entrega futura aparece o selo **📅 dd/mm**.

## 6.3 ⭐ Selecionar fora do dia AVISA — e deixa seguir

Foi o pedido: alerta, não bloqueio. Quem monta a rota é quem sabe se a exceção se
justifica.

- [ ] Clicar no **+** da entrega futura → aviso
      *"Entrega #N é para dd/mm/aaaa, não para hoje — incluída assim mesmo."*
- [ ] A entrega **entra na rota** mesmo assim.
- [ ] **"Adicionar todas"** com ela na fila → aviso consolidado:
      *"N entregas de outro dia entraram na rota."*
- [ ] Adicionar a entrega **de hoje** → **nenhum** aviso (senão vira ruído).

## 6.4 A data sobrevive à edição

- [ ] Abrir a entrega futura → **Editar** → o campo vem com a data gravada (não volta
      para hoje).
- [ ] Alterar para hoje e salvar → na montagem ela deixa de exibir o selo e o aviso.

## 6.5 O fuso não empurra o dia

Erro clássico deste tipo de campo: gravar meia-noite faz a entrega "pular" um dia.

- [ ] Reabrir o cadastro da entrega futura: a data exibida é **exatamente** a escolhida.
- [ ] O selo na fila de montagem mostra o **mesmo** dia.

> Medido por API em 09/08: lançamento sem data gravou `2026-08-09T15:00:00Z` e com data
> `2026-08-15T15:00:00Z` — os dois **meio-dia de Brasília**, que é a âncora.

---

## Desfazer

- [ ] **Entregas → abrir → Cancelar** nas duas entregas de teste.
- [ ] Descartar a rota montada (não salvar/despachar).

> ⚠️ Não tente **despachar** a rota: o despacho exige veículo e motorista, e o único
> entregador cadastrado é da filial 02. Este roteiro só monta.
