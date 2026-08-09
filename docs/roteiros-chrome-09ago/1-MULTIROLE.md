# 1 · Multi-role — papel por DEPARTAMENTO

**Valida:** commits `e60108e8` (Logística) e `a93aab21` (Configurador).
**Telas:** `https://localhost/configurador/` e `https://localhost/entregas/`.
**Tempo:** ~15 min. **Pré-requisito:** nenhum — este é o pré-requisito dos outros.

> **O que está em jogo.** A permissão da plataforma sempre foi *(usuário × módulo ×
> **departamento** × papel)*, mas a Logística lia um campo denormalizado que só
> enxergava o papel do **primeiro** departamento. Dar uma 2ª permissão a alguém
> **apagava o papel anterior**, calado. Era isso que impedia a mesma pessoa de ser
> Gestor de Entrega e Supervisor de Departamento — o contorno tinha sido criar um
> segundo usuário.

---

## 1.1 O Configurador passou a oferecer o departamento na Logística

**Usuário:** `admin` → Configurador → Usuários → editar **`supdeptb`** → aba **Perfis**.

- [ ] Na linha do módulo **Logística**, a coluna **Departamento** **aparece** (antes
      era escondida e o sistema gravava o departamento do próprio usuário).
- [ ] O seletor lista os **departamentos reais da filial** do usuário — nomes como
      "Tecnologia da Informacao", "Supermercado", "Agroveterinaria". **Não** deve
      listar a relação global de deptos-workspace.
- [ ] Numa linha de módulo **Workspace**, o seletor continua com a lista **global**
      (é outro conceito: lá o departamento diz qual T.I. a pessoa pode acionar).

## 1.2 A segunda permissão de Logística agora é possível

Ainda em `supdeptb` (hoje **GESTOR_ENTREGA** no T.I.):

- [ ] **+ Adicionar perfil** → módulo **Logística** → papel **Supervisor de
      Departamento (SUPERVISOR_FROTA)** → departamento **Supermercado** → **Salvar**.
- [ ] Salvou **sem erro**. Antes isto colidia: o banco tem UNIQUE em
      (usuário, módulo, departamento) e a Logística gravava sempre o mesmo depto.
- [ ] Reabrir o usuário: as **duas** linhas de Logística estão lá, cada uma com seu
      departamento.

## 1.3 ⭐ O bug que dormia — os dois papéis convivem

**Usuário:** `supdeptb` (senha `123456`) → `https://localhost/entregas/`.

- [ ] No rodapé/cabeçalho do menu, o rótulo do perfil mostra **os dois papéis**
      (ex.: `GESTOR_ENTREGA · SUPERVISOR_FROTA`), não só um.
- [ ] O menu tem **Entregas** (papel de gestor de entrega) **e** os itens de frota
      que dependem de SUPERVISOR_FROTA. Antes, ganhar o 2º papel **removia** o 1º.
- [ ] Abrir **Entregas → Rotas**: carrega normalmente (403 aqui seria a regressão).

> **Como isto se comportava antes:** ao conceder a 2ª permissão, o módulo passava a
> usar só o papel do primeiro departamento da lista — a pessoa **perdia** o acesso a
> Entregas sem nenhum aviso. Verificado ao vivo: a mesma rota dava **403 antes** e
> **200 depois** da correção.

## 1.4 Sessão antiga não quebra

- [ ] Com a aba já aberta e logada **antes** de qualquer mudança, navegar pelo
      sistema: nada de erro nem de logout inesperado. Token sem a lista de
      departamentos cai no campo antigo e se comporta como antes.

---

## Desfazer (deixar o DEV como estava)

- [ ] Configurador → `supdeptb` → **remover** a permissão de Supermercado, mantendo
      só GESTOR_ENTREGA no T.I.

*(Se preferir manter, o roteiro 7 — Travessia — reaproveita este acúmulo de papéis.)*
