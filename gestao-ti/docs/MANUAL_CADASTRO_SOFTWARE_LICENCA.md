# Manual — Cadastro de Software e Licenças (Gestão TI)

> Guia prático para a equipe lançar **softwares** e **licenças** no módulo Gestão de TI.
> Acesso: `https://localhost/gestao-ti/` (ou a URL de produção). Perfis: ações de cadastro são
> liberadas para **ADMIN** e **GESTOR_TI**; SUPORTE visualiza.

---

## 1. Conceitos antes de começar

| Conceito | O que é |
|---|---|
| **Software** | A aplicação em si (ex.: Office, SAP, AutoCAD). É o "item de portfólio". |
| **Licença** | O direito de uso adquirido — com modelo, quantidade, validade, valor, chave serial. |
| **Licença vinculada a Software** | Licença que pertence a um software cadastrado (ex.: licença do "Office"). |
| **Licença avulsa** | Licença que **não** é de um software de portfólio (ex.: Certificado Digital, Domínio). |
| **Usuário da licença** | A pessoa que usa aquela licença/assento (vínculo opcional, por controle). |

**Regra de ouro do lançamento** (decisão da equipe — ver §5): o jeito de lançar depende do **modelo da licença**.

---

## 2. Cadastrar um SOFTWARE

**Quando usar:** sempre que for controlar uma aplicação no portfólio (e depois pendurar licenças nela).

**Passo a passo:**
1. Menu lateral → **Softwares**.
2. Botão **"Novo Software"** (canto superior).
3. Preencha os campos:

| Campo | Obrigatório | Observação |
|---|---|---|
| **Departamento** | Não | Departamento ONDE o software está alocado (qualquer depto da empresa). |
| **Nome** | **Sim** | Ex.: "Microsoft Office", "AutoCAD". |
| **Fabricante** | Não | Ex.: Microsoft, Oracle, Autodesk. |
| **Versão Atual** | Não | Ex.: "2024.1". |
| **Tipo** | Não | ERP / CRM / Segurança / Colaboração / Infraestrutura / Operacional / Outros. |
| **Criticidade** | Não | Crítico / Alto / Médio / Baixo. |
| **Ambiente** | Não | On-Premise / Cloud / Híbrido. |
| **Equipe Responsável** | Não | Time de TI responsável. |
| **URL de Acesso** | Não | Para sistemas web. |
| **Observações** | Não | Informações adicionais. |

4. Clique em **"Cadastrar Software"**.

> Depois de criado, o software aparece na lista do portfólio. Clique nele para abrir o detalhe,
> onde ficam as abas **Módulos · Filiais · Licenças · Disponibilidade**.

---

## 3. Lançar uma LICENÇA

Há **dois caminhos** que dão no mesmo resultado — escolha o mais cômodo:

### Caminho A — pela tela "Licenças" (recomendado para o dia a dia)
1. Menu lateral → **Licenças**.
2. Botão **"Nova Licença"**.
3. Escolha o **tipo**:
   - ◉ **Vinculada a Software** → selecione o **Software** (obrigatório).
   - ◉ **Licença Avulsa** (Certificado, Domínio, etc.) → informe **Nome** (obrigatório) e, opcional, **Categoria**.
4. Preencha os demais campos (todos opcionais, mas quanto mais completo, melhor o controle):

| Campo | Para que serve |
|---|---|
| **Departamento** | Onde a licença está alocada. |
| **Modelo de Licença** | Subscrição / Perpétua / Por Usuário / Por Estação / OEM / Free-Open Source / SaaS / Outro. **Define a regra de lançamento — ver §5.** |
| **Quantidade** | Nº de licenças/assentos deste lançamento. **Vira o limite de usuários** (§4). |
| **Fornecedor (cadastro)** | Fornecedor já cadastrado (preferencial). |
| **Fornecedor (descrição livre)** | Só se o fornecedor não tem cadastro. |
| **Valor Total / Valor Unitário** | Valores da aquisição. |
| **Início / Vencimento** | Vigência (o vencimento gera alertas de licença vencendo). |
| **Chave Serial** | A chave/serial daquela licença. |
| **Observações** | Notas livres. |

5. Clique em **"Criar Licença"**.

### Caminho B — pela aba "Licenças" do Software
1. Menu **Softwares** → clique no software → aba **Licenças**.
2. Botão **"Nova Licença"** → preencha (mesmos campos, **sem** tipo/nome/categoria, pois já é do software) → **"Adicionar Licença"**.

---

## 4. Vincular USUÁRIOS à licença

> Serve para registrar **quem usa** cada licença/assento. Disponível tanto na tela **Licenças**
> quanto na aba **Licenças** do software.

Na tabela de licenças, a coluna **"Usuários"** mostra um indicador tipo **`2/10`** (atribuídos / quantidade)
ou **`0/∞`** (sem quantidade definida = ilimitado).

**Para gerenciar:**
1. Clique no indicador da coluna **Usuários** → abre o painel **"Usuários Atribuídos"**.
2. No seletor **"Selecione um usuário..."**, escolha a pessoa e clique em **"Atribuir"**.
3. Para remover, clique no ícone vermelho ao lado do usuário.

**Limite:** o sistema só deixa atribuir até a **Quantidade** da licença. Ex.: quantidade `1` → 1 usuário;
sem quantidade → ilimitado. A barrinha de progresso fica **vermelha** quando o limite é atingido.

---

## 5. ⭐ Regra de ouro: como lançar conforme o modelo

Escolha **um dos dois jeitos** conforme o tipo de licença:

### Jeito 1 — UM lançamento POR licença (cada uma com sua chave)
Use para **Perpétua / OEM / Por Estação** — quando **cada licença tem uma chave serial própria**.

> **Exemplo (Office perpétuo):** compramos 10 licenças, cada uma com sua chave.
> → Crie **10 lançamentos**, cada um com **Quantidade = 1**, sua **Chave Serial** própria
> e **1 usuário** vinculado.
> Assim você sabe exatamente **qual chave está com qual pessoa**.

### Jeito 2 — UM lançamento "pool" com N assentos
Use para **Subscrição / SaaS / Por Usuário** — quando é uma **conta/assinatura** com vários usuários
e **sem chave por assento** (ex.: Microsoft 365).

> **Exemplo (Microsoft 365, 50 assinaturas):**
> → Crie **1 lançamento** com **Quantidade = 50** e vincule até 50 usuários.
> A "Chave Serial" pode guardar a conta/tenant.

| Modelo da licença | Como lançar |
|---|---|
| Perpétua, OEM, Por Estação | **1 lançamento por licença** (qtd 1 + chave + 1 usuário) |
| Subscrição, SaaS, Por Usuário | **1 lançamento pool** (qtd N + N usuários) |
| Free/Open Source, Outro | Conforme o caso (geralmente 1 lançamento) |

---

## 6. Categorias de Licença (para licenças avulsas)

Para classificar licenças avulsas (ex.: "Certificado Digital", "Domínio"):
1. Menu lateral → **Cat. Licenças** (apenas ADMIN/GESTOR).
2. **"Nova Categoria"** → informe **Código** (ex.: `CERT_DIGITAL`), **Nome** (ex.: `Certificado Digital`) e **Descrição** → **"Salvar"**.
3. A categoria passa a aparecer no formulário de licença avulsa.

---

## 7. Manter as licenças (ações da lista)

Na tela **Licenças**, na coluna **Ações** (ADMIN/GESTOR):

| Ação | O que faz |
|---|---|
| **Editar** | Altera os dados do lançamento. |
| **Renovar** | Atualiza a vigência (use ao renovar a assinatura/contrato). |
| **Inativar** | Marca a licença como **Inativa** (não conta mais como ativa). |
| **Excluir** | Remove o lançamento (use com cuidado). |

**Status possíveis:** **Ativa** (verde) · **Inativa** (cinza) · **Vencida** (vermelha).
Licenças perto do vencimento aparecem destacadas e geram alerta.

**Filtros úteis** na lista: busca por licença/fornecedor, status, software, categoria,
vencimento (30/60/90 dias) e departamento.

---

## 8. Dúvidas frequentes

- **"Onde lanço o usuário da licença?"** → Na coluna **Usuários** da lista (clique no indicador `X/Y`).
  Vale para qualquer modelo, inclusive Perpétua/OEM.
- **"Tenho 10 Offices com 10 chaves diferentes — 1 ou 10 lançamentos?"** → **10 lançamentos** (Jeito 1, §5).
- **"É assinatura com 50 usuários?"** → **1 lançamento** com Quantidade 50 (Jeito 2, §5).
- **"O usuário não aparece no seletor?"** → Ele já está atribuído (a lista esconde quem já tem),
  ou a licença atingiu o limite de Quantidade.
- **"Licença sem software (certificado/domínio)?"** → Use **Licença Avulsa** e classifique por **Categoria**.

---

*Plataforma Capul — Módulo Gestão de TI · Manual de Cadastro de Software e Licenças.*
