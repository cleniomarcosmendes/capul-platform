# Retomar em 12/08 — o deploy está pronto e travado no push

Substitui `RETOMAR_APP_ENTREGA_11AGO.md` (a lista de testes de campo dele segue
válida e está reproduzida no §3).

---

## 1. 🥇 O que não anda sozinho: o PUSH

**110 commits locais, nada em `origin/main`.** `origin/main` == `4daf094` == o que
roda em PROD. O roteiro manda o Douglas chegar ao alvo por `git pull` — **sem push
não há alvo**, e é a única coisa que bloqueia o deploy inteiro.

O push é do Clenio.

## 2. O roteiro de deploy

**`C:\Arquivos-de-projeto\PlatformCapul_20260811_Roteiro_Deploy.md`**

| | |
|---|---|
| Base | `4daf094` — **confirmada em PROD por evidência** (bundle servido contém textos exclusivos dela e não os do delta) |
| Alvo | o **HEAD após esta atualização de docs** — o hash final está no roteiro (era `1227fa95`; +4 commits em 12/08, ver §2.1) |
| Delta | 110 commits · 4 migrations Prisma (170→174) · 7 SQL do Inventário (015–021) |
| Risco | MÉDIO · `nginx.conf` **não** mudou |

### 2.1 Revisão de 12/08 — alvo movido para `f01daeeb`

O roteiro foi atualizado **no lugar** (mesmo arquivo — renomear foi o que criou a
confusão 0801/0803). Os 3 commits novos: `f194a278` (docs) e `316144cb`+`f01daeeb`
(Logística — a lista de viagens da Frota passa a enxergar a ENTREGA, com seletor
**Viagens · Entregas · Todas** e default igual ao comportamento atual).

O 4º é este próprio commit de documentação — por isso o alvo é o HEAD, não `f01daeeb`.

**Nada estrutural mudou:** sem migration, sem `.env`, sem nginx, mesma lista de
rebuild, mesmo gate 0/170 → 4/174. Suíte da Logística 352 → **357**.

**Gates executados:** `check-migrations-all.sh` OK · typecheck de 10 alvos ·
601 testes (TI 109 · Fiscal 54 · Auth 20 · Logística 352 · App 66 · Inventário 116)
· revisão de segurança (§4).

⚠️ **Pré-requisito que derruba a subida:** `PROTHEUS_API_AUTH` e
`PROTHEUS_INVENTARIO_AUTH` viraram obrigatórias (`${VAR:?}`). Sem elas no `.env`
de cada ambiente, o `docker compose up` **falha**.

## 3. Testes de campo que ficaram sem fazer

O que entrou em 11/08 **não foi exercido no aparelho nem na tela**:

1. **Rota como CICLO** — montar rota, clicar "Sugerir melhor rota" e conferir que o
   traçado fecha na filial (linha tracejada) e que o KM inclui a volta.
2. **Aprendizado de campo** — só age com **3 baixas com GPS no mesmo endereço**; o
   pin vira roxo ("posição aprendida em campo") na montagem.
3. **Não-entrega no app** — o motivo em tela própria nunca foi usado.
4. **Coluna "Entrega"** na grade `/entregas/entregas` (dia destacado em âmbar
   quando não é hoje).

Do dia anterior, já validados pelo Clenio no aparelho: KM inicial/final, "quem
recebeu" em tela própria e o modo avião.

## 4. 🔴 Ação humana pendente (segurança)

Nenhuma bloqueia o deploy, mas as duas primeiras são de rotação de credencial:

1. **Rotacionar 4 senhas** — `admin`, `clenio`, `jordana`, `juliocesar`. Estavam em
   texto em `smoke_ciclo_completo.py` e `preparar_teste_chrome.py`; os arquivos
   saíram da imagem (`.dockerignore`, `1227fa95`), mas **as senhas seguem no
   histórico do git**.
2. **Credencial do Protheus** — o delta a removeu do `docker-compose.yml`, mas o
   mesmo valor segue em `auth-gateway/prisma/seed.ts:377`. Trocar junto com a
   rotação (de preferência lendo de variável de ambiente).
3. **§9.2 do roteiro** — revisar com o Clenio quem tem 2 permissões na Logística: o
   multi-role faz os dois papéis passarem a valer, e antes um era ignorado em
   silêncio.

⚠️ **Lição gravada em `feedback_security_review_delta_nao_basta.md`:** a revisão
de 11/08 quase passou batido em **7 rotas abertas em produção** porque foi escopada
ao delta. O gate pergunta sobre o **estado**, não sobre o diff.

## 5. Ambiente

- Stack no ar; **OSRM sobe à parte** (`docker compose --profile osrm up -d osrm`).
- Metro/API do app no **mesmo IP** `172.16.0.159` (Ethernet; o Wi-Fi da máquina não
  responde). `Cannot connect to Expo CLI` = **a API caiu junto**, não é bug do app.
- Build cache do Docker limpo em 11/08 (21 GB) — o **próximo build de cada serviço
  demora mais**. O `.vhdx` do Docker segue com ~26 GB de folga não devolvida ao
  Windows; compactar exige parar o Docker Desktop (combinar antes).
