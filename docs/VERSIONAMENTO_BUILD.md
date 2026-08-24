# Identidade de build — "estou testando a versão certa?"

*24/08/2026 — nasceu da dúvida antes do teste do APK de homologação.*

## O problema

`version` (1.0.0) e `versionCode` do app ficam parados por meses, e o backend não
dizia nada sobre si. Resultado: dois APKs diferentes se apresentavam com **o mesmo
rótulo**, e com o aparelho na mão não havia como saber se a correção que se quer
testar está ali. Pior: "não funcionou" e "não chegou no aparelho" têm exatamente
a mesma cara — a rodada de teste é gasta antes de a dúvida aparecer.

## Como ficou

Cada artefato carrega o **commit** de que foi gerado. É o mesmo repositório para
app e backends, então os rótulos são comparáveis entre si.

| Onde | O que mostra | De onde vem |
|---|---|---|
| App — rodapé do Login e da Home | `CAPUL Logística V. 1.0.0 · build 4 · 7190a7c3` | `extra.build.commit`, gravado por `app.config.js` no empacotamento |
| App — tela **Versão** (toque no rodapé) | app + **cada serviço**, com veredito de alinhamento | health público de cada serviço |
| `GET /api/v1/logistica/health` | `versao: { versao, commit, buildEm }` | `ARG`/`ENV` da imagem (`src/common/versao.ts`) |
| `GET /api/v1/auth/health` | idem | idem |

O commit do app vem, nesta ordem: `EAS_BUILD_GIT_COMMIT_HASH` (build na nuvem) →
`git rev-parse --short HEAD` (build local) → `desconhecido`.

## Como construir COM identidade

```bash
# na raiz, com o checkout NO COMMIT que vai subir
./scripts/build-com-versao.sh logistica-backend auth-gateway
docker compose up -d logistica-backend auth-gateway

# conferir
curl -sk https://localhost/api/v1/logistica/health | grep -o '"versao":{[^}]*}'
```

`docker compose build` puro continua funcionando — a imagem só sai marcada
`desconhecido`. **É de propósito:** build sem identidade tem de se declarar sem
identidade. Rótulo errado é pior que rótulo nenhum, porque encerra a
investigação com a resposta trocada.

Árvore suja marca o commit com sufixo `-sujo` (`7190a7c3-sujo`): a imagem **não
é** aquele commit, e isso precisa aparecer.

## Lendo o veredito na tela "Versão"

- ✅ **Alinhado** — app e serviços do mesmo commit.
- ⚠️ **Divergente** — commits diferentes. Não é necessariamente defeito (o backend
  costuma subir antes do APK), mas explica um comportamento que "deveria" estar
  corrigido.
- ❔ **Indeterminado** — algum lado subiu sem identidade. Não afirma alinhamento
  sem prova.

A comparação é por **prefixo**: a EAS entrega 7 caracteres e o `git rev-parse
--short` deste repositório entrega 8 — exigir igualdade marcaria como divergente
dois artefatos do mesmo commit, e alarme falso ensina a ignorar o alarme.

## Regras ao mexer nisto

1. **Serviço novo que o app consome entra em `src/lib/versaoServicos.ts`** — senão
   ele fica fora do veredito e o alinhamento passa a mentir por omissão.
2. **Health novo devolve `versao`** — copie `src/common/versao.ts` e o bloco `ARG`
   do Dockerfile (fica no FIM, senão invalida o cache das camadas de cima).
3. **APK novo bump em `versionCode`** — o Android usa esse número para distinguir
   instalações.
4. O Inventário (FastAPI) ainda **não** publica versão: o health dele não é servido
   sob `/api/v1` no nginx. Quando for, entra na tabela acima.
