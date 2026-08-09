# 6 · Data da entrega (ponto 2)

**Valida:** commit `42521540`.
**Telas:** `https://localhost/entregas/` → **Entregas → Nova** e **Rotas → Montar rota**.
**Tempo:** ~10 min. **Filial:** 02 (Supermercado) — é onde há entregas e entregador.

> ⚠️ **A filial 02 não tem veículo DISPONÍVEL.** Este roteiro só **monta** a rota (fila,
> ordem e alerta) e não precisa despachar — mas não tente concluir o despacho, que
> exige veículo e motorista.

> **O caso.** Há locais atendidos em **dias específicos** — a rota daquela região só
> passa em certos dias. A entrega só tinha `horario` (texto livre), que diz a *hora*
> preferida e nunca o *dia*.

---

## 6.1 O lançamento nasce com HOJE

**Usuário:** `raydeborges` (OPERADOR_ENTREGA, filial 02, senha `Temp@123`).

- [ ] **Entregas → Nova entrega**. Junto de "Volumes" há o campo **Data da entrega**,
      já preenchido com **o dia de hoje**.
- [ ] Registrar assim, sem tocar no campo (é o caso normal do balcão — quem lança não
      deveria ter de digitar isso).
- [ ] Lançar uma **segunda** entrega, agora escolhendo uma data **futura**. Ao mudar,
      aparece a marca **"Agendada para outro dia."**

## 6.2 O dia manda na fila de montagem

**Tela:** **Rotas → Montar rota** (filial 02).

- [ ] A fila de entregas pendentes vem ordenada por **data de entrega** (as de hoje
      primeiro, depois as futuras).
- [ ] As entregas **antigas**, lançadas antes desta mudança, **não têm data** e ficam
      **no fim** da fila — não podem encabeçá-la.
- [ ] Na linha de uma entrega de outro dia aparece o selo **📅 dd/mm**.

## 6.3 ⭐ Selecionar fora do dia AVISA — e deixa seguir

Foi o pedido: alerta, não bloqueio. Quem monta a rota é quem sabe se a exceção se
justifica.

- [ ] Clicar no **+** de uma entrega agendada para outro dia → aparece o aviso
      *"Entrega #N é para dd/mm/aaaa, não para hoje — incluída assim mesmo."*
- [ ] A entrega **entra na rota** mesmo assim (não pode travar).
- [ ] Usar **"adicionar todas"** com entregas de outros dias na fila → aviso
      consolidado: *"N entregas de outro dia entraram na rota."*
- [ ] Adicionar uma entrega **de hoje** → **nenhum** aviso (senão vira ruído).

## 6.4 A data sobrevive à edição

- [ ] Abrir uma entrega já lançada → **Editar** → o campo **Data da entrega** vem
      preenchido com o que foi gravado (não volta para hoje).
- [ ] Alterar a data e salvar → a fila de montagem reordena de acordo.

## 6.5 O fuso não empurra o dia

Este é o erro clássico deste tipo de campo: gravar meia-noite faz a entrega "pular"
para o dia anterior.

- [ ] Lançar uma entrega escolhendo explicitamente **uma data qualquer** e reabrir o
      cadastro: a data exibida é **exatamente** a escolhida.
- [ ] Conferir na fila de montagem: o selo mostra o **mesmo** dia.

---

## Desfazer

- [ ] Cancelar as entregas de teste (Entregas → abrir → **Cancelar**) e descartar a
      rota montada, se tiver salvado.
