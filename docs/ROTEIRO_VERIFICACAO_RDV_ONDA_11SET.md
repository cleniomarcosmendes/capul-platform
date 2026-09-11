# Roteiro de VERIFICAÇÃO — onda de correções do RDV / aba Equipe (Logística)

> Ambiente: **DEV local** — `https://localhost/entregas/`
> Escrito em **11/09/2026**, depois de fechar os 6 defeitos + 4 arestas do roteiro de
> descoberta (`ROTEIRO_CHROME_RDV_EQUIPE_DEPARTAMENTO.md`).
>
> **Este roteiro é de VERIFICAÇÃO, não de descoberta.** Cada passo tem uma previsão
> escrita. O resultado que interessa é **divergência da previsão** — isso significa que a
> correção não pegou, e é informação, não erro de execução.

---

## 0. CONFIRMAR A IDENTIDADE DO BUILD — antes de qualquer coisa

Testar o build errado devolve a resposta trocada com cara de verdade. **Se não bater,
PARE e avise** — não prossiga "para ver no que dá".

```bash
curl -sk https://localhost/api/v1/logistica/health | grep -o '"versao":{[^}]*}'
```

| O que | Tem de ser |
|---|---|
| `commit` do backend | **`5a8271ba-sujo`** |
| `buildEm` | 2026-09-11T19:17:21Z |
| Bundle do frontend | **`index-BDQ-DlfN.js`** (ver no DevTools → Network, ou `ls` no container) |

> O sufixo **`-sujo`** é esperado: vem de arquivos não commitados do módulo
> **gestão-pessoas**, que não tem nada a ver com a Logística. O código da Logística está
> exatamente no commit `5a8271ba`.

```bash
docker compose exec -T logistica-frontend sh -c 'ls /usr/share/nginx/html/assets/*.js'
```

---

## 1. Estado do banco no início

```sql
-- Equipe da filial 18
SELECT s.matricula, s.nome, d.nome AS depto, COALESCE(uc.nome,'—') AS coordenador
FROM logistica.supervisor s
LEFT JOIN core.departamentos d ON d.id=s.departamento_id
LEFT JOIN core.usuarios uc ON uc.id=s.coordenador_id
WHERE s.filial_id='d764d838-e177-421f-a79d-cb71abdbda83';
```

| matrícula | nome | departamento | coordenador |
|---|---|---|---|
| 003448 | Fabricio Silva Neiva | Vendas Internas e Externas (FBR) | — (é coordenador) |
| 005274 | Kelver Eduardo | Vendas Internas e Externas (FBR) | Fabricio |

Amarração: *Vendas Internas e Externas (FBR)* → **Lidyane**.

**⚠️ Divergência ARMADA de propósito** (é o caso de teste da Parte 2):

| Régua | Aponta para |
|---|---|
| FROTA — lotação de `KELVER` e `LIDYANE` | **Produção e Qualidade (FBR)** |
| RDV — amarração da Lidyane | **Vendas Internas e Externas (FBR)** |

Ids úteis:

| O quê | Id |
|---|---|
| Filial 18 | `d764d838-e177-421f-a79d-cb71abdbda83` |
| Depto *Vendas Internas e Externas (FBR)* | `ffaabe83-c038-4db4-8944-6b19926e8e94` |
| Depto *Produção e Qualidade (FBR)* | `5f597542-d39b-4a8a-baa3-6db25cb56835` |
| Depto *Adminstrativo (FBR)* | `328b295a-42c7-4a63-b4b2-5b53334bf299` |
| "Agroveterinaria" da **filial 21** (para o teste de integridade) | `64c42da8-b042-4559-bfa8-9eabd4d6b3c3` |

Contas: `admin` (ADMIN, vinculado **só à filial 18**) · `lidyanerocha` (SUPERVISOR_FROTA)
· `fabricioneiva` (COORDENADOR) · `kelvereduardo` (SUPERVISOR).

---

## 2. Regras de execução

1. **Nenhum deploy, rebuild, `docker compose build/up` ou `npm run build`** do começo ao
   fim. O passo 0 fixou o build; mudá-lo invalida tudo que veio antes.
2. **O desempate é o rastro no banco, não o print.**
3. **Anotar o status HTTP** de cada chamada relevante (DevTools → Network).
4. **Passo que falha INTERROMPE o roteiro** e é reportado na hora.
5. Relogar de verdade ao trocar de usuário (token de 60 min carrega papel e filial).
6. **Não corrigir nada.** Este roteiro observa.
7. A **Parte 2 tem de vir antes da Parte 3**: a Parte 3 reverte a divergência armada.

---

# PARTE 1 — Defeito 0: o ADMIN alcança qualquer filial

Login **`admin`** → menu **Supervisores** → aba **Equipe (supervisores)**.

### 1.1 O seletor existe e traz o catálogo

| O que | Previsão |
|---|---|
| Existe um seletor "Filial:"? | **Sim** — antes não aparecia para ADMIN de filial única |
| Quantas opções? | **35** (catálogo `/core/filiais`, não as filiais vinculadas) |
| Qual está selecionada ao abrir? | **18 · INDUSTRIA DE RACAO…**, marcada **"(sua filial)"** |
| Texto ao lado | *"A filial da sua sessão não muda."* |

> Antes da correção a tela pulava sozinha para a **filial 09 (Fazenda Experimental)**, que
> o admin nem possui, e sem seletor não havia volta. Se ela pular de novo, é regressão.

### 1.2 Uma filial ZERADA é alcançável — a trava original

No seletor, trocar para **21 · AGROVETERINARIA NATALANDIA** (não tem nada de RDV).

| O que | Previsão |
|---|---|
| Tarja ao lado do seletor | âmbar: **"Você está vendo outra filial — a da sua sessão é 18 · …"** |
| Bloco "Supervisores de Departamento" | *"Nenhum departamento participa do RDV nesta filial ainda. Comece **abaixo**: escolha o departamento e defina quem responde por ele…"* |
| Rótulo do seletor de adicionar | **"Adicionar o primeiro departamento desta filial"** (não "outro") |
| Opções desse seletor | as da **filial 21**, não o catálogo global |

### 1.3 O subtítulo não mente mais

| O que | Previsão |
|---|---|
| Subtítulo da página | *"Prestação de contas mensal (RDV) e catálogos das visitas."* — **sem** "— Indústria de Ração" |

**Voltar o seletor para a filial 18 antes de seguir.**

---

# PARTE 2 — Defeitos 1 e 2: a tela usa a régua do RDV, não a da FROTA

**Esta é a verificação mais importante da onda** — é o defeito que originou tudo, e é a
única que a rodada 2 não conseguiu fazer. A divergência está armada: o veículo da Lidyane
está em *Produção e Qualidade*, a amarração dela em *Vendas Internas e Externas*.

Login **`lidyanerocha`** → **Supervisores** → aba **Equipe** → **Novo cadastro** → abrir
o select **"Departamento *"**.

| O que | Previsão (CORRIGIDO) | Se aparecesse isto, é REGRESSÃO |
|---|---|---|
| Opções no select | **1 — *Vendas Internas e Externas (FBR)*** | *Produção e Qualidade (FBR)* (régua da frota) |
| Chamada de rede | `GET /supervisor/departamentos-gerenciaveis?filialId=…` → **200** | `GET /frota/departamentos-filtro` |

Agora cadastrar: qualquer representante disponível + *Vendas Internas e Externas (FBR)* →
**Cadastrar**.

| O que | Previsão |
|---|---|
| `POST /supervisor/supervisores` | **201** |
| Antes da correção | **403** *"Departamento fora do seu escopo"* — a tela oferecia o que a API recusava |

```sql
SELECT s.nome, d.nome AS depto FROM logistica.supervisor s
JOIN core.departamentos d ON d.id=s.departamento_id
WHERE s.filial_id='d764d838-e177-421f-a79d-cb71abdbda83';
```

> **Se o cadastro der 201 com o departamento da AMARRAÇÃO enquanto o veículo aponta para
> outro, os defeitos 1 e 2 estão provados corrigidos.** É o único cenário em que as duas
> réguas discordam, por isso a divergência foi armada.

### 2.1 Reverter a divergência (obrigatório antes da Parte 3)

```sql
UPDATE logistica.veiculo SET departamento_lotacao_id='ffaabe83-c038-4db4-8944-6b19926e8e94'
WHERE placa IN ('KELVER','LIDYANE');

SELECT placa, departamento_lotacao_id FROM logistica.veiculo WHERE placa IN ('KELVER','LIDYANE');
-- os dois em ffaabe83…
```

---

# PARTE 3 — Defeito 3: departamento de outra filial

### 3.1 Pela tela: a opção nem é mais oferecida

Login **`admin`**, filial **18**, **Novo cadastro**, abrir **"Departamento *"**.

| O que | Previsão | Antes |
|---|---|---|
| Nº de opções | **3** — só as FBR da filial 18 | **56**, catálogo global |
| Quantas "Agroveterinaria" | **0** | 16, sem dizer de qual filial |

### 3.2 Pela API: a recusa existe mesmo quando a tela é contornada

A metade de tela sozinha não basta — quem chama a API direto tem de ser barrado também.

```bash
TOK=$(curl -sk -X POST https://localhost/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"login":"admin@capul.com","senha":"<SENHA_ADMIN>"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

curl -sk -w "\nHTTP %{http_code}\n" -X POST -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  "https://localhost/api/v1/logistica/supervisor/supervisores?filialId=d764d838-e177-421f-a79d-cb71abdbda83" \
  -d '{"matricula":"009111","nome":"Teste Guarda","departamentoId":"64c42da8-b042-4559-bfa8-9eabd4d6b3c3"}'
```

| O que | Previsão |
|---|---|
| Status | **400** |
| Mensagem | *"Este departamento é de outra filial — escolha um departamento desta filial."* |
| Linhas gravadas | **0** (`SELECT count(*) FROM logistica.supervisor WHERE matricula='009111';`) |

**Controle (para o 400 não ser "agora tudo falha"):** repetir com
`departamentoId = ffaabe83…` (o correto da filial 18) e matrícula **inédita** — tem de
dar **201**. Apagar o registro de teste depois (Parte 5 testa exatamente isso).

---

# PARTE 4 — Defeito 4: falha de carga tem voz

Login **`admin`**, aba **Equipe**.

**Como bloquear** (qualquer um dos dois):
- DevTools → Network → botão direito na chamada → **Block request URL**; ou
- no console, interceptar `fetch`/`XHR` para a URL e forçar rejeição.

### 4.1 O seletor de departamento

Bloquear `**/supervisor/departamentos-gerenciaveis*`, recarregar, abrir **Novo cadastro**.

| O que | Previsão |
|---|---|
| Banner no topo | **"Parte da tela não carregou — o que estiver vazio abaixo pode ser efeito disto, não ausência de dado."**, listando *"Não foi possível carregar os departamentos que você pode escolher."* |
| Select "Departamento *" | vazio e **desabilitado** |
| Antes | select vazio, **sem nenhuma mensagem** — indistinguível de "não há departamento" |

### 4.2 A frase que mentia

Desbloquear a anterior; bloquear `**/supervisor/departamentos-responsavel*` e recarregar.

| O que | Previsão |
|---|---|
| Texto do bloco | *"Não deu para saber quais departamentos participam do RDV nesta filial — a consulta falhou (veja o aviso acima). Recarregue antes de concluir que não há nenhum."* |
| **Não pode aparecer** | *"Nenhum departamento participa do RDV nesta filial ainda"* — seria uma afirmação FALSA sobre o banco |

### 4.3 Some sozinho

Desbloquear tudo e recarregar → **o banner tem de desaparecer** sem precisar de outra ação.

---

# PARTE 5 — Defeito 5: exclusão de representante

Login **`admin`** (ou `lidyanerocha`), aba **Equipe**, olhar a coluna de ações da lista.

### 5.1 Sem movimento: exclui, e a matrícula fica livre

| O que | Previsão |
|---|---|
| Botão **Excluir** aparece? | **Sim** — antes não existia exclusão nenhuma |
| Ao clicar | diálogo dizendo que **a matrícula fica livre** e que **não mexe** no usuário nem na permissão do Configurador |
| Confirmando | **200**, a linha some |
| **Recadastrar a mesma matrícula em seguida** | **201** — é isto que a inativação nunca permitiu |

### 5.2 Com movimento: recusa, e oferece a saída

Primeiro criar movimento pela tela: logar `lidyanerocha` (ou `kelvereduardo`) e criar
**um planejamento** para o Kelver na aba Planejamentos. Voltar à Equipe como `admin`.

| O que | Previsão |
|---|---|
| Botão Excluir do Kelver | **cinza / desabilitado**, e o `title` diz *"Não pode ser excluído: já tem 1 registro no RDV. Use Inativar — ele sai das telas e o histórico fica."* |
| Se forçar por API (`DELETE`) | **400** com a mesma explicação |
| Antes | `DELETE` → **404**, rota inexistente; só dava para inativar, e a matrícula ficava presa |

---

# PARTE 6 — As 4 arestas da aba Equipe

Login **`admin`**, aba **Equipe**.

### 6.1 Linha pendente se anuncia

Em "Adicionar … departamento desta filial", escolher um departamento → **Adicionar**.

| O que | Previsão |
|---|---|
| A linha nova | fundo **âmbar** + tarja **"não salvo — escolha o responsável e confirme"** |

### 6.2 Cancelar cancela de verdade

Na mesma linha pendente, clicar no **✕**.

| O que | Previsão |
|---|---|
| A linha | **some da tabela** |
| Antes | ficava ali como fantasma, idêntica a um departamento real sem responsável, até recarregar |

### 6.3 O toast chama cada um pelo seu papel

**Novo cadastro** → escolher o **Fabricio (coordenador)** → cadastrar.

| O que | Previsão |
|---|---|
| Toast | ***"Coordenador cadastrado."*** |
| Antes | *"Supervisor de área cadastrado."* também para coordenador |
| Campo "Coordenador" | **some** ao escolher um coordenador (comportamento antigo, conferir que não quebrou) |

### 6.4 Quem já tem cadastro não é oferecido como novo

**Novo cadastro** → abrir o select de representante.

| O que | Previsão |
|---|---|
| Quem já está na equipe | **visível e desabilitado**, com **"— já cadastrado"** no rótulo |
| Antes | escolhível; o erro de matrícula duplicada só aparecia depois do clique |
| Não pode | sumir da lista (faria procurar um nome que se sabe existir) |

---

# PARTE 7 — Regressão nas 7 telas que mudaram na varredura

⚠️ **Estas telas não foram abertas no navegador depois da alteração.** O compilador está
limpo, o que não é o mesmo que ter visto funcionar. O objetivo aqui é só confirmar que
**abrem e funcionam como antes** — a mudança foi mecânica (trocar `.catch` mudo pelo
mecanismo que fala).

Para cada uma: abrir, confirmar que **carrega sem erro no console** e que **o banner
âmbar NÃO aparece** (nada falhou), e que os seletores listados vêm preenchidos.

| # | Tela | Onde | Conferir que estão preenchidos |
|---|---|---|---|
| 1 | **Montar rota** | Rotas de Entrega → Montar | seletor de **motorista** |
| 2 | **Cadastro de veículo** | Frota → Veículos → Novo/Editar | **departamento**, **Supervisor Responsável**, **representante** |
| 3 | **Viagem (detalhe, RASCUNHO)** | Rotas → abrir uma em rascunho | **veículos**, **motoristas**, **entregas a incluir** |
| 4 | **Indicadores** | menu Indicadores | filtros de **filial** e **usuário**; rótulos com **nome**, não id |
| 5 | **Romaneio** | imprimir um romaneio | nomes de filial/usuário no cabeçalho |
| 6 | **Painel** | menu Painel | filtros de filial/usuário |
| 7 | **Veículos (lista)** | Frota → Veículos | coluna de responsável com **nome**, não id |

**Teste do mecanismo em uma delas** (basta uma — escolher a nº 2): bloquear
`**/veiculos/representantes*` e recarregar. Tem de aparecer o banner com *"Não foi
possível carregar a equipe do RDV desta filial."*

---

# Fechamento — preencher e devolver

| # | Pergunta | Resposta |
|---|---|---|
| 0 | Build confere? (`5a8271ba-sujo` / `index-BDQ-DlfN.js`) | |
| 1.1 | O seletor de filial aparece? Quantas opções? | |
| 1.2 | A filial 21 (zerada) é alcançável? A tarja âmbar apareceu? | |
| 1.3 | O subtítulo ainda nomeia "Indústria de Ração"? | |
| **2** | **Lidyane vê o departamento da AMARRAÇÃO ou o do VEÍCULO?** | |
| **2** | **O cadastro dela deu 201?** | |
| 2.1 | Divergência revertida e conferida no banco? | |
| 3.1 | Quantas opções o ADMIN vê na filial 18? | |
| 3.2 | O `POST` com departamento da filial 21 deu 400? O controle deu 201? | |
| 4.1 | Banner apareceu com o seletor bloqueado? | |
| 4.2 | A frase "Nenhum departamento participa…" foi suprimida? | |
| 4.3 | O banner sumiu sozinho ao desbloquear? | |
| 5.1 | Excluiu sem movimento? Recadastrou a mesma matrícula? | |
| 5.2 | Com movimento, botão desabilitado com motivo? API deu 400? | |
| 6.1–6.4 | As quatro arestas | |
| 7 | As 7 telas abriram sem erro e sem banner? | |
| — | **O que divergiu da previsão** | |

---

# Restaurar, se precisar

```bash
docker compose exec -T postgres psql -U capul_user -d capul_platform \
  -c "DROP SCHEMA logistica CASCADE;"
docker compose exec -T postgres psql -U capul_user -d capul_platform \
  < backup_logistica_20260911_0838.sql
```

> O backup é de **antes** da onda (08:38) e traz a filial 18 com os 27 planejamentos
> originais. Restaurar desfaz também a limpeza e a equipe remontada.
