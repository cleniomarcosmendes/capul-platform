# Roteiro de tela — montar a Equipe do RDV do ZERO (Logística / filial 18)

> Ambiente: **DEV local** — `https://localhost/entregas/` → menu **Supervisores** → aba **Equipe (supervisores)**
> Filial alvo: **18 — INDUSTRIA DE RACAO E SUPLEMENTO MINERAL**
> Escrito em **11/09/2026**, depois da limpeza do RDV da filial 18.

## Por que este roteiro existe

Duas perguntas ficaram em aberto na análise de 10–11/09:

1. Com `lidyanerocha` (Supervisor de Departamento), o select **"Departamento"** mostra
   **zero** opções ou **uma**? O código e o banco dizem **uma**; a observação dizia zero.
2. Os outros três defeitos levantados se confirmam na tela?

E há uma terceira, que só apareceu agora: **montar a equipe do zero é o caminho que
ninguém nunca percorreu inteiro neste módulo** — a equipe da filial 18 foi criada aos
pedaços em julho/agosto. É a etapa menos conhecida, que é onde os defeitos moram.

## Estado ZERO — conferido pelas APIs em 11/09/2026 08:42

A limpeza apagou, só na filial 18: 2 representantes · 1 amarração departamento→responsável ·
27 planejamentos RDV · 61 visitas · 26 despesas · 6 adiantamentos.
Backup em `backup_logistica_20260911_0838.sql` (schema `logistica` inteiro).

| Endpoint | Devolve hoje |
|---|---|
| `GET /supervisor/supervisores?filialId=18` | `[]` |
| `GET /supervisor/departamentos-responsavel?filialId=18` | `[]` |
| `GET /supervisor/departamentos-filial?filialId=18` | **3** — os da filial 18, corretos |
| `GET /frota/departamentos-filtro` (ADMIN) | **56** — catálogo global, todas as filiais |

**Preservado de propósito** (não apagar): os **2 veículos** da filial 18 (`KELVER`,
`LIDYANE`), ambos com a Lidyane como encarregada e lotados em *Vendas Internas e
Externas (FBR)*; os 11 representantes de seed da filial 01; a viagem de frota nº 63,
que perdeu só o vínculo `rdv_viagem_id`.

Departamentos da filial 18 — existem exatamente três:

| id | nome |
|---|---|
| `328b295a-…` | Adminstrativo (FBR) |
| `5f597542-…` | Produção e Qualidade (FBR) |
| `ffaabe83-…` | Vendas Internas e Externas (FBR) |

Contas para o teste:

| Login | Papel na Logística | Papel no RDV |
|---|---|---|
| `admin` | ADMIN | monta tudo |
| `lidyanerocha` | SUPERVISOR_FROTA | Supervisor de Departamento (aprova) |
| `fabricioneiva` | COORDENADOR | representante — aprova o Kelver |
| `kelvereduardo` | SUPERVISOR | representante — supervisor de área |

## Regras de execução

1. **Nenhum deploy, rebuild ou `docker compose up` do começo ao fim.** Build que muda
   no meio invalida todos os passos anteriores.
2. **O desempate é o rastro no banco, não o print.** Cada passo tem SQL de confirmação.
3. **Anotar o status HTTP** de cada chamada (DevTools → Network). A tela engole erro:
   `SupervisoresPage.tsx:486` transforma 401/403/429/timeout em lista vazia, calada.
4. **Passo que falha interrompe o roteiro.** Não seguir "para ver no que dá".
5. Relogar ao trocar de usuário (o token carrega papel e filial por 60 min).

---

## PASSO 0 — Lidyane no zero: a tela oferece o que a API recusa

**Por que agora:** com `supervisor_departamento` vazio, o select dela continua sendo
alimentado pelo **veículo** (`frota.service.ts:1279`), enquanto o salvamento valida
contra a **amarração do RDV** (`supervisor.service.ts:545`). As duas réguas estão,
hoje, garantidamente em desacordo.

1. Login `lidyanerocha` → **Supervisores** → aba **Equipe**.
2. DevTools → **Network**, filtro `departamentos`.
3. Clicar **Novo cadastro** e abrir o select **"Departamento *"**.

**Registrar:**

| O que | Observado |
|---|---|
| Nº de opções (sem contar `— selecione`) | |
| Nomes que aparecem | |
| `GET /frota/departamentos-filtro` → status / tamanho do array | |
| A tabela "Supervisores de Departamento" mostra o quê? | |
| Aparece toast vermelho? | |

**Previsão:** **1 opção** — *Vendas Internas e Externas (FBR)* — e a tabela acima
dizendo *"Nenhum departamento participa do RDV nesta filial ainda"*. Se vier **0**,
anotar o status HTTP: aí a causa é a chamada, não a régua, e o roteiro **para aqui**.

4. Selecionar o representante **Kelver Eduardo**, o departamento
   *Vendas Internas e Externas (FBR)* e clicar em **Cadastrar**.

**Previsão:** **403 — "Departamento fora do seu escopo."**

| O que | Observado |
|---|---|
| Status do `POST /supervisor/supervisores` | |
| Mensagem que a TELA exibe | |
| A mensagem explica o que fazer? | |

**Confirmação no banco (nada pode ter sido gravado):**

```sql
SELECT count(*) FROM logistica.supervisor
WHERE filial_id='d764d838-e177-421f-a79d-cb71abdbda83';   -- tem de ser 0
```

> Se a previsão se confirmar, estão provados de uma vez os **defeitos 1 e 2**: a tela
> do RDV lê a régua da FROTA, e oferece o que a API recusa.
> E fica exposto o problema de arranque: **do zero, o Supervisor de Departamento não
> consegue montar nada** — depende do ADMIN. Anotar se a tela diz isso a ela.

---

## PASSO 1 — ADMIN monta do zero (o caminho nunca percorrido)

1. Login `admin` → aba **Equipe** → seletor de filial em **18**.
2. Olhar o bloco **"Supervisores de Departamento"**.

| O que | Observado |
|---|---|
| Texto exibido com a lista vazia | |
| O seletor "Adicionar outro departamento desta filial" aparece? | |
| Quantas opções ele tem? (esperado **3**, só da filial 18) | |

3. Escolher ***Vendas Internas e Externas (FBR)*** → **Adicionar** → no campo
   Responsável escolher **Lidyane** → salvar (✓).

| O que | Observado |
|---|---|
| Status do `PUT /supervisor/departamentos-responsavel/:id` | |
| A Lidyane aparecia na lista de candidatos? | |

```sql
SELECT departamento_id, usuario_id FROM logistica.supervisor_departamento
WHERE filial_id='d764d838-e177-421f-a79d-cb71abdbda83';   -- 1 linha, apontando p/ 3b89e857…
```

---

## PASSO 2 — Lidyane monta o time dela

Relogar como `lidyanerocha`, aba **Equipe**.

1. **Novo cadastro** → **Fabricio Silva Neiva** *(coordenador)* → departamento
   *Vendas Internas e Externas (FBR)* → **Cadastrar**.
   - Observar: ao escolher um coordenador, o campo "Coordenador" **some** (coordenador
     não tem coordenador acima). Confirmar que sumiu.
2. **Novo cadastro** → **Kelver Eduardo** → departamento *Vendas Internas e Externas
   (FBR)* → coordenador **Fabricio** → **Cadastrar**.

| O que | Observado |
|---|---|
| Status dos dois `POST` | |
| O departamento veio pré-preenchido do cadastro da pessoa? | |
| A tabela "Supervisores de Departamento" passou a contar 2 representantes? | |

```sql
SELECT s.nome, s.departamento_id, s.coordenador_id FROM logistica.supervisor s
WHERE s.filial_id='d764d838-e177-421f-a79d-cb71abdbda83';
-- 2 linhas; a do Kelver com coordenador_id = 187b1458… (Fabricio)
```

> Se o Passo 2 só funciona **depois** do Passo 1, está confirmado que o arranque do
> RDV exige ADMIN — e a pergunta que fica é se a tela do Passo 0 dizia isso.

---

## PASSO 3 — O defeito da filial na lista do ADMIN

1. Login `admin`, aba **Equipe**, filial **18**, **Novo cadastro**, abrir
   **"Departamento *"**.

| O que | Observado |
|---|---|
| Nº total de opções (esperado **56**) | |
| Quantas se chamam exatamente "Agroveterinaria" (esperado **16**) | |
| Alguma diz de que filial é? (esperado **não**) | |

2. Escolher um representante e, no departamento, uma **"Agroveterinaria"** — nenhuma
   é da filial 18. **Cadastrar**.

**Previsão do defeito:** grava com **201**, sem reclamar.

```sql
SELECT s.nome, f.codigo AS filial_do_depto
FROM logistica.supervisor s
JOIN core.departamentos d ON d.id=s.departamento_id
JOIN core.filiais f ON f.id=d.filial_id
WHERE s.filial_id='d764d838-e177-421f-a79d-cb71abdbda83';
-- linha com filial_do_depto <> '18' confirma o defeito
```

3. **Limpar:** apagar esse cadastro de teste pela própria tela (é novo, sem viagem,
   despesa ou adiantamento — exclusão segura).

---

## PASSO 4 — O defeito mudo

1. Login `admin`, aba **Equipe**.
2. DevTools → Network → botão direito em `departamentos-filtro` → **Block request URL**.
3. Recarregar e abrir **Novo cadastro**.

**Previsão:** o select fica só com `— selecione`, **sem mensagem, sem toast, sem log** —
idêntico ao caso legítimo de "não há departamento". Comparar com o campo logo **acima**,
que no cenário equivalente diz *"Nenhum usuário com o papel… Atribua o papel no
Configurador primeiro"*.

4. **Unblock request URL.**

---

## Fechamento — as respostas que fecham o diagnóstico

| # | Pergunta | Resposta |
|---|---|---|
| 0 | Lidyane vê 0 ou 1 departamento? | |
| 0 | Status de `/frota/departamentos-filtro` na sessão dela | |
| 0 | O `POST` foi recusado? Com que mensagem na tela? | |
| 0 | A tela disse a ela o que fazer para destravar? | |
| 1 | Com a lista vazia, o ADMIN entendeu por onde começar? | |
| 1 | O seletor de departamento da amarração trouxe só os 3 da filial? | |
| 2 | Depois da amarração, a Lidyane conseguiu cadastrar os dois? | |
| 3 | Quantas opções o ADMIN vê? Quantas "Agroveterinaria"? | |
| 3 | O backend aceitou departamento de outra filial? | |
| 4 | Chamada bloqueada = tela em silêncio? | |

Com essas dez respostas os quatro defeitos ficam confirmados ou descartados **por
observação**, e a correção pode ser escrita sabendo o que conserta.

## Restaurar, se precisar

```bash
docker compose exec -T postgres psql -U capul_user -d capul_platform \
  -c "DROP SCHEMA logistica CASCADE;"
docker compose exec -T postgres psql -U capul_user -d capul_platform \
  < backup_logistica_20260911_0838.sql
```

---

# VERIFICAÇÃO EM CÓDIGO — 11/09/2026, após a execução

> A execução do roteiro (versão 2, sessão com skill do Chrome) confirmou 6 defeitos.
> Conferi os dois novos no fonte. **Os dois existem**, mas em três pontos a CAUSA
> descrita diverge do que o código faz — e a diferença muda o conserto.

## Defeito 5 — confirmado, sem ressalva

`supervisor.controller.ts` só declara `@Get('supervisores')` (l.28),
`@Post('supervisores')` (l.36) e `@Patch('supervisores/:id')` (l.41).
**Não existe rota de exclusão.** O 404 observado é a ausência da rota, não permissão.

## Defeito 0 — confirmado, com a causa corrigida em 3 pontos

O efeito é o descrito: do zero, o ADMIN não alcança a filial 18. A mecânica é outra.

**(a) O seletor de filial EXISTE — está escondido por condição.**
`SupervisoresPage.tsx:588`: `{ehAdmin && filiaisDoUsuario.length > 1 && (…)}`.
A conta `admin` tem **uma** filial (a 18), então `length === 1` e o seletor não
renderiza. Não é "não existe em nenhuma aba": é que ele some justamente para o admin
de filial única — que é quem mais precisa dele quando a tela pula de filial.

**(b) A tela mandou o ADMIN para uma filial que ele NÃO possui.**
`filiaisComRdv` (`supervisor.service.ts:125`) faz `groupBy` global e **nunca cruza com
as filiais do usuário**. Medido: devolve 4 filiais (01, 02, 08, 09); a conta `admin`
só tem a 18. O `useEffect` (`SupervisoresPage.tsx:509-517`) então faz
`setFilialAlvo(comRdv[0].filialId)` → **filial 09 (Fazenda Experimental Capul)**.
Há uma inconsistência interna citável: o caminho da preferência salva **valida**
(`localStorage` + `usuario.filiais.some(...)`, l.505), o caminho do auto-pick **não**.
E como `filialAlvo` não está em `filiaisDoUsuario`, o `value` do seletor não casaria
com nenhuma `<option>` nem se ele aparecesse.

**(c) O subtítulo "— Indústria de Ração" é texto FIXO, não rótulo de filial.**
`SupervisoresPage.tsx:110`, string literal na página. Não é "nome da filial 18 com
dados de outra filial": a página nunca exibiu filial nenhuma. Conserto é trocar o
literal pelo nome da filial em uso, não corrigir uma derivação que não existe.

## Ressalva do Estado ZERO — DESCARTADA

O roteiro marcou como suspeito: *"filiais-rdv mostrou 0 representantes nas 4 filiais;
se a filial 01 tem 11 de seed, a contagem está errada."*
**A contagem está certa.** `supervisor.service.ts:132` pesa só representante **com
departamento**, de propósito (comentário nas l.129-131): os 11 da matriz não têm
departamento, logo peso 0 — mas entram na lista pelo `quaisquer` (l.140). Conferido:
filial 01 = 11 ativos / 0 com departamento; filiais 02, 08 e 09 = 0 representantes,
1 amarração cada. Comportamento correto, não defeito.

## Ordem de correção sugerida

| Ordem | Defeito | Por quê primeiro |
|---|---|---|
| 1º | **0** | Bloqueia os Passos 1 e 2. Sem ele nada mais é testável pela tela. |
| 2º | **1 e 2** | São o defeito original; a régua do select tem de ser a do RDV. |
| 3º | **3** | Grava dado inconsistente em silêncio — `departamentoEhDaFilial` no `criar` e no `atualizar`. |
| 4º | **4** | Não gera dado errado, mas é o que impede diagnosticar os outros. |
| 5º | **5** | Menor impacto: hoje resta inativar, e a matrícula fica ocupada na filial. |

---

## DEFEITO 0 — CORRIGIDO em 11/09/2026

Tudo em `logistica/frontend/src/pages/SupervisoresPage.tsx` (o backend já estava certo:
`filialAlvo` aceita qualquer filial para o ADMIN e só valida que ela existe).

| O quê | Antes | Agora |
|---|---|---|
| Fonte do seletor de filial | `usuario.filiais` (vínculo) | **catálogo `GET /core/filiais`** (35 filiais) — coerente com "ADMIN é global" |
| Quando o seletor aparece | `ehAdmin && filiaisDoUsuario.length > 1` | **todo ADMIN** — a condição escondia o seletor do admin de filial única, que é quem não tinha volta |
| Alvo automático | podia cair em filial fora do alcance | só filial que o seletor oferece (`alcancavel()`), mesma validação que o caminho do `localStorage` já fazia |
| Filial padrão | a da sessão **só se tivesse representante**, senão saltava | **a da sessão quando alcançável**; o salto vira fallback |
| Quando a filial exibida ≠ a da sessão | nada | **tarja âmbar**: "Você está vendo outra filial — a da sua sessão é X" |
| Subtítulo da página | literal fixo "— Indústria de Ração" | sem nome de filial (a tela serve 35); quem diz a filial é o seletor |

**Varredura:** a regra estava escrita em **dois** lugares — aba Planejamentos (l.234) e
aba Equipe (l.624), as duas com o mesmo defeito. Extraí o hook
`useFiliaisSelecionaveis`, usado pelas duas; não existe mais cópia.

**Conferido:** `tsc -b` e `eslint` limpos · `GET /core/filiais` devolve **35** filiais
com a 18 presente · bundle servido `index-DEUcrB_V.js` contém a tarja nova e **não**
contém mais o literal "Indústria de Ração" · nginx recarregado.

**Próximo:** repetir o roteiro a partir do **PASSO 1** — a base segue no estado ZERO.

---

# RODADA 2 — 11/09/2026 tarde, build com a correção do defeito 0

Passos 1 e 2, que a rodada 1 não conseguiu executar. Rebuild às 13:59.

## PASSO 1 ✅ PASSOU — é a validação da correção do defeito 0

| O que | Observado |
|---|---|
| Seletor de filial | **Existe**, com **35 filiais** do catálogo `/core/filiais`; abriu em *18 · INDUSTRIA DE RACAO… (sua filial)* |
| A tela ficou na 18? | **Sim.** `filiais-rdv` ainda é chamado, mas **não troca mais a filial** |
| Bloco vazio | *"Nenhum departamento participa do RDV nesta filial ainda — cadastre representantes abaixo."* |
| "Adicionar outro departamento desta filial" | **3 opções**, só as FBR da filial 18 |
| `PUT /supervisor/departamentos-responsavel/ffaabe83…` | **200** |
| Banco | 1 linha · criado_por **Administrador** · 14:58:59 (após o rebuild) |

## PASSO 2 ✅ PASSOU

| O que | Observado |
|---|---|
| `POST` Fabricio (coordenador) / Kelver | **201** e **201** |
| Campo "Coordenador" ao escolher o Fabricio | **Some** ✅, com o aviso de roteamento por departamento |
| Departamento pré-preenchido | Sim, nos dois |
| Tabela de departamentos | *Vendas Internas e Externas (FBR) · 2 · Lidyane* |

> ⚠️ **Não limpa os defeitos 1 e 2.** O select continua vindo do VEÍCULO; aqui veículo e
> amarração apontam para o mesmo departamento. Sucesso por **coincidência**, não por acerto.

## Achados menores novos (tela), em aberto

| Onde | O quê |
|---|---|
| Bloco vazio do ADMIN | Manda *"cadastre representantes abaixo"*, mas o 1º passo real é **adicionar departamento + responsável**. E "Adicionar **outro** departamento" não faz sentido quando não há nenhum |
| Linha pendente após "Adicionar" | Fica só na tela, com ✓/✕, **sem dizer que ainda não foi salva** — trocar de aba perde a linha calado |
| Toast do cadastro | Diz *"Supervisor de área cadastrado."* também para **coordenador** |
| Select de representante | Quem já tem cadastro continua na lista; o erro de matrícula duplicada só vem depois do clique |

## ⚠️ O estado NÃO é mais ZERO

Filial 18 agora tem **1 amarração** (Vendas Internas e Externas → Lidyane) e
**2 representantes** (Fabricio, Kelver). Passo que exigir o zero precisa restaurar o
backup ou limpar de novo.

## Ressalva do Estado ZERO — DESCARTADA (repetida na v3, fica o registro)

*"filiais-rdv mostrou 0 representantes nas 4 filiais listadas"* **não é defeito.**
`supervisor.service.ts:132` pesa só representante **com departamento**, de propósito
(comentário nas l.129-131); os 11 de seed da matriz não têm, logo peso 0 — mas entram na
lista pelo `quaisquer` (l.140). Conferido: filial 01 = 11 ativos / 0 com departamento;
filiais 02, 08 e 09 = 0 representantes e 1 amarração cada.

## Cenário que ainda falta: fazer as duas réguas DIVERGIREM

Enquanto o veículo da Lidyane estiver lotado no mesmo departamento da amarração, os
defeitos 1 e 2 ficam invisíveis. Para provar a correção:

1. ADMIN → Veículos → `KELVER` → lotação para ***Produção e Qualidade (FBR)***.
2. Relogar `lidyanerocha` → Equipe → Novo cadastro → abrir "Departamento".
   - **Errado (régua da frota):** aparece *Produção e Qualidade (FBR)*, e o `POST` dá **403**.
   - **Certo (régua do RDV):** aparece *Vendas Internas e Externas (FBR)*, e o `POST` dá **201**.
3. Reverter a lotação do veículo.

---

# DEFEITOS 1 e 2 — CORRIGIDOS em 11/09/2026 (rebuild 15:23)

## O que mudou

**Backend** — `GET /supervisor/departamentos-gerenciaveis?filialId=` (novo).
Devolve exatamente o que `assertPodeGerirDepartamento` aceita na escrita:

| Perfil | Devolve |
|---|---|
| ADMIN | departamentos **DA FILIAL** alvo (não o catálogo global de 56) |
| SUPERVISOR_FROTA | os da **amarração** (`supervisor_departamento`), nunca dos veículos |
| Demais | vazio — não montam time |

**Frontend** — o select passa a consumir esse endpoint; o `.catch` mudo virou `deptErro`,
que separa "falhou" de "não há"; e o campo vazio agora **diz por quê**, com texto
diferente por perfil. Os dois textos que empurravam ao erro também foram trocados:
*"cadastre representantes abaixo"* (justamente o que a API recusa) e *"Adicionar **outro**
departamento"* quando não existe nenhum.

## Teste de PAREAMENTO (o que impede a regressão)

`supervisor.service.spec.ts` — 6 casos novos. O central: para o mesmo usuário, **tudo que
`departamentosGerenciaveis` oferece tem de passar em `criarSupervisor`, e o que ela não
oferece tem de ser recusado**. Régua nova que mexa em um lado só quebra a suíte.

**Validado por mutação:** trocando a régua do SUPERVISOR_FROTA de volta para "todos os
departamentos da filial", **4 dos 6 testes reprovam**; revertida, os 6 passam.
Suíte `src/supervisor` completa: **193 passando**.

## Medido na API (ADMIN, filial 18)

| Endpoint | Devolve |
|---|---|
| `supervisor/departamentos-gerenciaveis?filialId=18` | **3** — Adminstrativo (FBR), Produção e Qualidade (FBR), Vendas Internas e Externas (FBR) |
| `frota/departamentos-filtro` (o antigo) | **56** — catálogo global |

## ⚠️ CENÁRIO ARMADO — reverter depois do teste

Para provar os defeitos 1 e 2 é preciso que as duas réguas DIVIRJAM, e elas foram
separadas de propósito agora:

| Régua | Aponta para |
|---|---|
| FROTA — lotação de `KELVER` e `LIDYANE` | **Produção e Qualidade (FBR)** |
| RDV — amarração da Lidyane | **Vendas Internas e Externas (FBR)** |

**Teste (falta executar — exige a senha de `lidyanerocha`):**
login `lidyanerocha` → Equipe → Novo cadastro → abrir "Departamento".

- **Antes da correção** apareceria *Produção e Qualidade (FBR)* e o `POST` daria **403**.
- **Depois da correção** tem de aparecer ***Vendas Internas e Externas (FBR)*** e o
  `POST` tem de dar **201**.

**Reverter a lotação assim que terminar:**

```sql
UPDATE logistica.veiculo SET departamento_lotacao_id='ffaabe83-c038-4db4-8944-6b19926e8e94'
WHERE placa IN ('KELVER','LIDYANE');
```

## Ainda abertos

**3** (backend aceita departamento de outra filial — falta `departamentoEhDaFilial` no
`criarSupervisor`/`atualizarSupervisor`; a metade de TELA já caiu junto com esta onda),
**4** (o `.catch` mudo ainda existe nas OUTRAS chamadas da tela), **5** (não há exclusão
de representante), e os menores da rodada 2 (linha pendente sem aviso; toast chamando
coordenador de "supervisor de área"; representante já cadastrado continua na lista).

---

# DEFEITO 3 — CORRIGIDO em 11/09/2026 (imagem `9d195310-sujo`)

## O que faltava

`criarSupervisor` não conferia se o departamento pertencia à filial do cadastro, e
`atualizarSupervisor` tinha o mesmo furo na hora de MOVER de departamento.
`definirSupervisorDepartamento` já barrava desde sempre — mesma regra, aplicada só num
dos dois lugares.

Nova guarda `assertDepartamentoDaFilial`, usada pelos dois. A distinção que ela torna
explícita no código:

| Guarda | Pergunta | Para o ADMIN |
|---|---|---|
| `assertPodeGerirDepartamento` | **AUTORIDADE** — posso gerir este departamento? | passa direto |
| `assertDepartamentoDaFilial` | **INTEGRIDADE** — ele é desta filial? | **é a única que resta** |

## Verificação: o MESMO `POST` que gravou 201 de manhã

```
POST /supervisor/supervisores?filialId=<filial 18>
{ "departamentoId": "64c42da8-…" }   -- "Agroveterinaria" da filial 21
```

| Quando | Resultado |
|---|---|
| Manhã (antes) | **201** — representante gravado na 18 com departamento da 21 |
| Agora | **400** — *"Este departamento é de outra filial — escolha um departamento desta filial."* |

**Controle** (para o 400 não ser "agora tudo falha"): o mesmo `POST` com o departamento
CORRETO da filial 18 passa da guarda e para no check seguinte — *"Já existe um supervisor
com essa matrícula nesta filial"*. E repetido com matrícula inédita (`009111`) contra o
departamento da 21: **400**, com **0 linhas** gravadas.

## Testes

6 casos novos, entre eles: a guarda usa a **filial alvo**, não a do token; edição que não
mexe em departamento **não** dispara a guarda; representante sem departamento passa;
a mesma regra vale para o SUPERVISOR_FROTA.
**Validado por mutação:** desligando a guarda, **3 reprovam**. Suíte: **199 passando**.

## Auditoria do dado existente

`SELECT ... WHERE d.filial_id <> s.filial_id` → **0 violações**. A guarda entrou sem
precisar de backfill.

> ⚠️ O `coreMock` compartilhado da suíte não tinha `departamentoEhDaFilial` e **1 teste
> alheio quebrou** ao adicionar a guarda. Era mock incompleto, não comportamento errado —
> o método entrou no mock com padrão `true`.

---

# DEFEITO 4 — CORRIGIDO na tela do RDV em 11/09/2026 (bundle `index-CGpy4J34.js`)

## O que mudou

O padrão `.catch(() => ({ data: [] }))` existia para uma chamada secundária não derrubar
a tela — intenção boa. O efeito é que **401, 403, 429, timeout e "de fato não há nada"
viram a mesma tela**: um seletor vazio, sem uma palavra. Foi por isso que o defeito
original levou dois dias para ser nomeado.

Helper `buscaAcessoria`: a falha continua não derrubando a tela, mas fica **registrada**,
e a tela mostra o que não carregou (banner `AvisoFalhasCarga`).

**5 chamadas migradas** na `SupervisoresPage` — restam **zero** `catch` mudos nela:

| Chamada | O que a falha produzia, calada |
|---|---|
| `departamentos-gerenciaveis` | seletor "Departamento" vazio |
| `departamentos-responsavel` | a frase **"Nenhum departamento participa do RDV nesta filial ainda"** — afirmação FALSA sobre o banco |
| `departamentos-filial` | o seletor "adicionar departamento" **sumia** |
| `/veiculos` (Planejamentos) | seletor de veículo sem opção; a despesa VEÍCULO só cobra isso muito depois |
| `/supervisor/meu-cadastro` | auto-serviço degradava sem dizer |

A frase da 2ª linha agora só aparece quando a busca **deu certo**; falhando, a tela diz
que não deu para saber — em vez de afirmar que não há nada.

## ⚠️ A varredura achou MAIS 14 ocorrências, em 7 outras telas

Não mexi nelas: são páginas fora do roteiro, não testadas nesta onda. Inventário para
decidir, já separado por gravidade:

**Armadilhas (lista de escolha some, e o usuário não descobre por quê) — 7:**

| Arquivo | Chamada |
|---|---|
| `MontarViagemPage.tsx:109` | `/motoristas` |
| `VeiculoFormPage.tsx:116` | `/departamentos` — mesma classe do defeito que acabamos de corrigir |
| `VeiculoFormPage.tsx:120` | `/veiculos/supervisores-elegiveis` |
| `VeiculoFormPage.tsx:122` | `/veiculos/representantes` |
| `ViagemDetalhePage.tsx:111-113` | `/veiculos`, `/motoristas`, `/entregas` |

**Cosméticas (só resolvem nome para exibir; vazio degrada rótulo para id) — 7:**
`IndicadoresPage.tsx:58-59`, `RomaneioPage.tsx:76-77`, `PainelPage.tsx:58-59`,
`VeiculosPage.tsx:48`.

Para reaproveitar o helper nessas telas ele precisa sair da `SupervisoresPage` para um
módulo compartilhado (`src/lib/`).

---

# DEFEITO 5 — CORRIGIDO em 11/09/2026

## Por que doía mais do que parecia

Não havia rota de exclusão: `DELETE /supervisor/supervisores/:id` → 404, e o front só
tinha `PATCH {ativo}`. O custo não era estético — **`criarSupervisor` recusa matrícula
repetida na filial, e a linha inativada continua ocupando a matrícula**. Quem cadastrava
errado (departamento errado, pessoa errada) ficava sem saída: inativar não liberava
recadastrar, e a tentativa dava *"Já existe um supervisor com essa matrícula nesta filial"*.

## O que entrou

- `DELETE /supervisor/supervisores/:id` (`@Roles('SUPERVISOR_FROTA')`, ADMIN sempre),
  com as mesmas guardas da edição: filial e `assertPodeGerirDepartamento`.
- **Só apaga cadastro com ZERO movimento** (planejamento + adiantamento + fechamento).
  Com movimento, recusa dizendo **quantos** e **o que fazer** — `viagem.supervisorRegistroId`
  é `SET NULL`: apagar deixaria planejamento órfão, sem dono, calado.
- `listarSupervisores` passa a devolver **`movimentos`** (3 `groupBy`, não N+1), para a
  tela **desabilitar** o Excluir com o motivo no `title` em vez de escondê-lo.
- Diálogo de confirmação que diz o que se perde **e o que não se perde**: o cadastro some
  e a matrícula fica livre; o usuário e a permissão dele no Configurador ficam intactos.

## Verificado na API

| Caso | Resultado |
|---|---|
| Listagem traz `movimentos` | ✅ `003448 → 0`, `005274 → 0` |
| `DELETE` sem movimento | **200** `{ok:true}` |
| **Recadastrar a mesma matrícula depois** | **201** — o que a inativação **não** permitia |
| `DELETE` com 1 planejamento | **400**: *"já tem 1 registro no RDV … Use 'Inativar'"* (singular correto) |

## Testes

10 casos novos: soma os três tipos de movimento; outra filial → 403 (não 404, o registro
existe); SUPERVISOR_FROTA só apaga em departamento seu; COORDENADOR não apaga; a listagem
devolve `movimentos`. **Validado por mutação:** desligando a guarda de movimento,
**4 reprovam**. Suíte: **209 passando**.

> ⚠️ **O teste de invariante pegou o método novo**, como foi desenhado para fazer:
> `removerSupervisor` escreve no Prisma e não tinha `assertRdvAberto`. Entrou na lista de
> dispensados com justificativa por **CHECAGEM**, não por categoria: ele só apaga quando
> `movimentosPorSupervisor` devolve 0, e esse 0 inclui `fechamentoRdv` — um representante
> excluível não tem mês nenhum. Se a exclusão passar a aceitar cadastro com movimento, a
> dispensa sai e o guard entra.
