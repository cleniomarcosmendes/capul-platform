# Roteiro de teste no Chrome — Chamado: citar `#numero` (28/08/2026)

**Por que este roteiro existe.** No 1º teste real da funcionalidade *"É continuação de um
chamado anterior? Escreva # e o número dele"*, o `#1340` foi digitado no campo certo e
**nada aconteceu** — nenhum laço, nenhum erro, a mesma tela verde de sucesso. Eram
**dois** defeitos empilhados, e cada um sozinho já produzia esse sintoma:

| # | Defeito | Commit |
|---|---|---|
| 1 | **A citação seguia a regra da FILA, não a de LEITURA.** Quem *abre* o chamado não conseguia *citá-lo*. `clenio` é GESTOR do **T.I.**; o #1340 é PÚBLICO do **Fiscal** — fora da fila dele, dentro da leitura dele. | `1e0765f5` |
| 2 | **A recusa era muda.** O backend mandava o motivo desde 26/08, mas `criar()` era tipado `Promise<Chamado>` e o TypeScript apagava o campo — a tela nunca teve como avisar. | `409f76d5` |

> ⚠️ **Este roteiro é para o DEV desta máquina.** Os dois commits **não estão pushados**
> — a HLG roda `fba71ad8` e **não tem nenhum dos dois**. Testar isto na HLG hoje
> reproduz o defeito antigo, não a correção. Ver [§0.3](#03-se-o-alvo-for-a-hlg).

**Tempo:** ~20 min. **Tela:** `https://localhost/gestao-ti/` → **Chamados** → **Novo
Chamado**.

---

## 0 · Antes de abrir o Chrome

### 0.1 Confirmar que o DEV está com os dois fixes

Não confie na data do container — confira o **código que está rodando**:

```bash
cd /mnt/c/meus_projetos/capul-platform

# backend: tem de responder 4 (o gate de leitura novo)
docker compose exec -T gestao-ti-backend \
  sh -c "grep -c 'podeLerChamado' /app/dist/chamado/services/chamado-core.service.js"

# frontend: tem de responder 1 (o aviso âmbar)
docker compose exec -T gestao-ti-frontend \
  sh -c "grep -c 'Nao foi possivel ligar a' /usr/share/nginx/html/assets/index-*.js"
```

Se algum vier **0**, rebuilde antes de continuar:

```bash
docker compose build gestao-ti-backend gestao-ti-frontend
docker compose up -d gestao-ti-backend gestao-ti-frontend
docker compose exec nginx nginx -s reload    # IP novo do container → senão 502
```

*Referência do que está no ar agora: backend com `podeLerChamado`, bundle
`index-DKVR7GZy.js`.*

### 0.2 ⭐ Limpar o cache do Chrome — é o passo que mais engana

O `index.html` é `no-cache`, mas **o bundle não**. Se você já tinha a tela aberta antes
do rebuild, o navegador segue com o JS velho e o aviso âmbar **não aparece** — sintoma
idêntico ao defeito.

- **F12 aberto** → botão de recarregar → **"Limpar cache e atualização forçada"**
  (ou `Ctrl+Shift+R`).
- Confirme na aba **Network** que o `index-*.js` carregado é o **`index-DKVR7GZy.js`**.
  Se for outro nome, o passo 0.1 não terminou.

### 0.3 Se o alvo for a HLG

Ela **não tem** os fixes. Para levar:

1. `git push` (só o Clenio empurra) — hoje há **5 commits locais** à frente do
   `origin/main`, dos quais 2 são estes fixes.
2. Na HLG: `git pull` → `docker compose build gestao-ti-backend gestao-ti-frontend` →
   `up -d` → `nginx -s reload`.
3. **Não há migration nova.** A tabela `chamado_referencias` já veio na onda de 26/08.
4. Repetir o §0.1 **lá**, com os mesmos dois `grep`.

### 0.4 Personas (DEV)

| usuário | senha | papel no Workspace | por que serve |
|---|---|---|---|
| `clenio` | `Cl123456` | **GESTOR** no depto **T.I.** | é a conta que produziu o defeito: atende T.I., **não** atende Fiscal |
| `admin` | `admin123` | **ADMIN** no Workspace | alcance total (D36) — serve de contraste e para montar o caso 5 |

⚠️ O `OVERSIGHT_PLATAFORMA` do `clenio` está **revogado** (`ativo=f`, sobra do teste de
conceder/revogar de 27/08). É proposital: sem ele, o `clenio` passa a valer como
"gestor de um departamento comum", que é o caso que interessa. **Não conceda** antes de
rodar o roteiro — conceder mascara os casos 1 e 5.

### 0.5 Os chamados usados (DEV)

| nº | visibilidade | departamento | papel no teste |
|---|---|---|---|
| **1340** | PÚBLICO | **Fiscal** | o chamado do relato — `clenio` **abre** mas não citava |
| **2065** | PÚBLICO | **Fiscal** | segundo caso público de fora, para confirmar que não é sorte |
| **2082** | PRIVADO | **T.I.** | privado do departamento **do** `clenio` → deve citar |
| **99999999** | — | — | não existe → tem de **avisar**, não silenciar |

---

## 1 · A regressão: citar chamado PÚBLICO de outro departamento ⭐

**Este é o caso do relato.** Logado como **`clenio`**.

1. **Chamados → Novo Chamado**.
2. **Assunto:** `TESTE 28/08 — citacao publica de fora`
3. **Detalhe sua necessidade:** `Continuacao do #1340.`
   - Confira que a dica aparece **logo abaixo do campo**: *"É continuação de um chamado
     anterior? Escreva **#** e o número dele (ex.: `#152`) — os dois ficam ligados."*
   - ⚠️ Só a **descrição** é varrida. `#1340` no **Assunto** é ignorado — de propósito.
4. Escolha uma **Equipe destino** (obrigatório) e salve.

**Esperado:**

- Modal **"Chamado Registrado!"**;
- faixa **verde**: **"Ligado a #1340."** ← *era isto que não existia*;
- **OK** leva ao detalhe, onde há o bloco **"Chamados relacionados" → "Este veio de:"**
  com o cartão `#1340` clicável;
- na linha do tempo, um comentário público **"Seguimento de #1340"**.

**Se a faixa verde não aparecer:** volte ao §0.2 (bundle velho) antes de suspeitar do
backend.

---

## 2 · A recusa que agora FALA

Ainda como **`clenio`**. Novo chamado:

- **Detalhe:** `Continuacao do #1340 e do #99999999.`

**Esperado — as duas faixas juntas:**

- verde: **"Ligado a #1340."**
- âmbar: **"Nao foi possivel ligar a #99999999."** seguida de *"O numero nao existe ou o
  chamado nao esta ao seu alcance — so da para citar chamado que voce mesmo consegue
  abrir. O seu chamado foi registrado normalmente."*

⭐ A última frase é o ponto: sem ela a pessoa reenvia o chamado achando que falhou.

---

## 3 · O sentido inverso (o que faltava a quem atende)

1. Abra o **#1340** (Chamados → busque por `1340`, ou pelo cartão do caso 1).
2. **Esperado:** bloco **"Chamados relacionados" → "Teve continuação em:"** listando os
   chamados criados nos casos 1 e 2.

⭐ É este sentido que substitui o "Reabrir" para quem não é da equipe: quem atende o
chamado antigo descobre que a demanda continuou **sem** alguém reabrir o dele.

---

## 4 · PRIVADO do próprio departamento continua citável

Como **`clenio`** (GESTOR no T.I.), novo chamado:

- **Detalhe:** `Relacionado ao #2082.`

**Esperado:** verde **"Ligado a #2082."** — o #2082 é PRIVADO, mas do **T.I.**, onde ele
atende. Privado não é proibido; privado é *só de quem atende aquele departamento*.

---

## 5 · PRIVADO de fora continua BARRADO 🔒

**O caso que prova que a correção não abriu demais.** Precisa de dois logins.

1. Como **`admin`**: abra um chamado novo com **Visibilidade = PRIVADO** e
   **Departamento = Fiscal**. Anote o número — chame de `#P`.
2. Como **`clenio`**: novo chamado com **Detalhe:** `Olha o #P.`
   **Esperado:** faixa **âmbar** — *"Nao foi possivel ligar a #P"*. Nenhum laço.
   ✅ Correto: o `clenio` não atende o Fiscal, e privado é só de quem atende.
3. **A poda na leitura** (o outro lado da mesma regra): como **`admin`**, crie um
   chamado **PÚBLICO** citando `#P` (o admin alcança). Depois abra **esse** chamado
   como **`clenio`**.
   **Esperado:** o bloco "Chamados relacionados" **não mostra** o `#P` para o `clenio` —
   nem o número, nem o título.
   ⭐ Poda, não tarja: quem não alcança o outro chamado não tem o que fazer com a
   informação de que ele existe.

> Em DEV **todos** os chamados PRIVADOS são do T.I., por isso o passo 1 cria um. Sem ele
> não há como testar este caso pela tela — só pelo teste unitário
> (`PRIVADO de departamento onde não atendo: recusa, com motivo`).

---

## 6 · Bordas rápidas (2 min)

| entrada na descrição | esperado | por quê |
|---|---|---|
| `# 1340` (com espaço) | nenhuma faixa | o gatilho é `#(\d{1,9})\b` — espaço não casa |
| `#1340` no **Assunto** | nenhuma faixa | só a descrição é varrida |
| `#1340 #1340` | uma faixa só | números repetidos são deduplicados |
| 40 números (`#1 #2 … #40`) | no máximo **10** avaliados | teto por requisição: citação liga chamados, não varre faixas |
| citar o número **do próprio chamado** | ignorado | citar a si mesmo não é laço |
| editar um chamado já aberto e pôr `#1340` | **nada acontece** | ⚠️ a varredura roda **só na criação** — não é defeito, é o escopo de hoje |

---

## 7 · Quando falhar, anote isto

Sem estes quatro itens o achado não fecha:

- **A faixa que apareceu** (verde / âmbar / nenhuma) — print do modal inteiro.
- **O `index-*.js` carregado** (F12 → Network) — separa *bug* de *bundle velho*.
- **A resposta HTTP do `POST /chamados`** (F12 → Network → aba Response): o campo
  `referencias` é a verdade. `[{"numero":1340,"vinculado":true}]` com a tela muda = a
  falha é no frontend; `vinculado:false` = é a regra.
- **A hora**, para cruzar com o log:
  ```bash
  docker logs capul-gestao-ti-api --since 10m | grep -v '"statusCode":200'
  ```

⭐ **Sem deploy no meio.** Se rebuildar qualquer coisa durante a bateria, recomece a
bateria — achado com build ambíguo não vale.

---

## 8 · Limpar depois

⚠️ **Não use o botão "Excluir" da tela** — ele dá **500** sempre (`HistoricoChamado` sem
`onDelete: Cascade`; defeito pré-existente, também em PROD). Limpe por SQL:

```bash
cd /mnt/c/meus_projetos/capul-platform
q(){ docker compose exec -T postgres psql -U capul_user -d capul_platform -tAc "$1"; }

# confira ANTES o que vai sair
q "select numero, left(titulo,50) from gestao_ti.chamados where titulo like 'TESTE 28/08%';"

q "delete from gestao_ti.chamado_referencias where origem_id in
     (select id from gestao_ti.chamados where titulo like 'TESTE 28/08%')
   or destino_id in
     (select id from gestao_ti.chamados where titulo like 'TESTE 28/08%');"
q "delete from gestao_ti.historicos_chamado where chamado_id in
     (select id from gestao_ti.chamados where titulo like 'TESTE 28/08%');"
q "delete from gestao_ti.chamados where titulo like 'TESTE 28/08%';"
```

Os chamados criados como `admin` no caso 5 têm outro título — apague-os pelo número.

---

## Cobertura automatizada que já existe

Não repita na mão o que a suíte cobre (`gestao-ti/backend`, 153 testes):

- `PÚBLICO de outro departamento: quem consegue ABRIR consegue CITAR` — o caso 1;
- `PRIVADO de departamento onde não atendo: recusa, com motivo` — o caso 5.2;
- `PRIVADO do MEU departamento: cita` — o caso 4;
- `teto de números por requisição` — a 4ª linha do §6;
- `poda o laço para chamado PRIVADO de departamento onde não atendo` — o caso 5.3.

O que a suíte **não** cobre e só a tela mostra: as faixas do modal (casos 1 e 2), o bloco
"Chamados relacionados" nos dois sentidos (casos 1 e 3) e o comentário "Seguimento de
#…" na linha do tempo.
