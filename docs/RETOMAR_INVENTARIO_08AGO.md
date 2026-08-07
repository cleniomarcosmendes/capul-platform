# Onde paramos — Inventário

*Fechado em 07/08/2026 (fim da tarde). Substitui o `RETOMAR_INVENTARIO_OFFLINE_06AGO.md`,
que continua válido para o histórico das Fases 0/1/1.5.*

---

## Estado em uma linha

**O módulo está funcional de ponta a ponta no DEV, com dados reais importados.**
Suíte do Inventário **81** · app **34** · 21 commits locais · **nada pushado**.

---

## O que está no DEV agora (dá para testar direto)

Hierarquia mercadológica e produtos importados do Protheus:

| | |
|---|---|
| Produtos (`sb1010`) | 32.820 |
| Saldos (`sb2010`) | 38.872 — armazéns **02** (32.637) e **06** (6.235) da filial 01 |
| Lotes (`sb8010`) | 23.940 |
| Localizações (`sbz010`) | 30.357 |
| Códigos de barras (`slk010`) | 44.078 |
| Armazéns (`szb010`) | 377 |

⚠️ **O que ainda NÃO existe:** nenhum inventário criado, nenhuma lista de
contagem. É esse o próximo passo natural de teste.

---

## Retomar por aqui

### 1. Subir
```bash
docker compose up -d
docker compose --profile osrm up -d osrm     # OSRM é profile; sem ele a rota vira linha reta CALADA
```
O job `inventario-migrate` roda sozinho antes do backend (criado hoje).

### 2. Conferir que está de pé
```bash
# migrations: esperado 40 aplicadas, terminando na 019
docker compose exec -T postgres psql -U capul_user -d capul_platform \
  -c "SELECT count(*) FROM inventario.schema_migrations;"

# suíte: esperado 81 passed
cd inventario/backend && ./run-tests.sh
```

### 3. O teste que falta — contagem ponta a ponta
Com os dados já importados:
1. criar um inventário (armazém 02 ou 06 da filial 01);
2. adicionar produtos — os **7 filtros de faixa** estão lá; repare no aviso do
   **teto de 3.000** se passar;
3. criar lista de contagem e atribuir contador;
4. liberar e contar **pelo desktop** — isso exercita tudo que foi feito nas
   Fases 0/1 (ciclo carimbado, contagem cega, idempotência);
5. só então o app.

### 4. O app — nunca rodou em aparelho
**É a única parte não validada.** Precisa do Expo Go (fast refresh; **não** OTA,
**não** APK). O ciclo que importa:

> baixar a lista → **modo avião** → contar alguns itens → voltar o sinal →
> sincronizar → conferir no desktop

E os casos de conflito, que são o coração do desenho:
- baixar no app e tentar contar a MESMA lista no desktop → deve avisar e pedir confirmação;
- supervisor clicar em **"liberar"** no selo da lista → o app deve recusar a
  sincronização com mensagem pedindo devolução;
- tentar **encerrar** no app com contagem pendente → deve bloquear.

---

## O que ficou aberto

### Do módulo
- **`inventario.stores`/`warehouses` são pré-UNIFIED_AUTH** e convivem mal com
  `core.filiais`. Bateu 2× em 07/08 (seletor de armazém vazio; FKs da `slk010`).
  Os sintomas estão resolvidos; **unificar é decisão maior**.
- **Teto de 3.000 só se altera pelo banco** (`system_config`) — não há tela.
- **Rotação da credencial do Protheus** — depende do Marco. Tirá-la do código
  (feito hoje) **não a invalida**: está no histórico do git.

### Fora do módulo
- **🥇 O deploy** segue sendo o item parado. As 4 rotas de `/api/v1/import/`
  continuam **sem auth em produção**.
  ⚠️ Duas coisas novas para o roteiro:
  1. **HLG/PROD precisam de `PROTHEUS_API_AUTH` e `PROTHEUS_INVENTARIO_AUTH` no
     `.env` ANTES de subir** — o compose agora aborta sem elas (proposital).
  2. As **6 migrations** (014–019) aplicam sozinhas pelo job; conferir o log
     dele. Lá provavelmente existem as mesmas lacunas que achamos aqui.
- **RDV no Chrome**: faltam os casos 3.7, 1.4 e 1.6.

---

## Contexto de hoje, se precisar

`docs/MELHORIAS_BACKLOG.md` tem o mapa das 6 correções de schema e a causa de
fundo (o runner de migrations não estava ligado a nada, e uma migration que se
auto-registrava matava as seguintes).
