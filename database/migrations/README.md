# ⚠️ HISTÓRICO — nada aqui é executado

**Estes seis arquivos NÃO são migrations pendentes. Nenhum runner os lê.**
Não rode nada daqui sem ler tudo abaixo.

Eles são o rascunho de uma arquitetura de fevereiro/2026 que foi **abandonada no
meio**. Ficam versionados porque documentam uma decisão — não porque faltem
aplicar.

## Onde ficam as migrations de verdade

| Módulo | Caminho | Quem aplica |
|---|---|---|
| `core` (filiais, usuários, permissões) | `auth-gateway/prisma/migrations/` | Prisma (`auth-migrate`) |
| `gestao_ti` | `gestao-ti/backend/prisma/migrations/` | Prisma (`gestao-ti-migrate`) |
| `logistica` | `logistica/backend/prisma/migrations/` | Prisma (`logistica-migrate`) |
| `fiscal` | `fiscal/backend/prisma/migrations/` | Prisma (`fiscal-migrate`) |
| **`inventario`** | **`inventario/database/migrations/`** | **`migrate.sh` (job `inventario-migrate`)** |

O schema `core` acabou sendo gerenciado pelo **Prisma do auth-gateway**
(142 migrations), e não por estes `.sql`.

## O que cada arquivo faria

| Arquivo | Intenção |
|---|---|
| `001-core-tables.sql` | criar as tabelas do schema `core` |
| `002-migrate-stores.sql` | migrar `inventario.stores` → `core.filiais`, preservando UUIDs |
| `003-migrate-users.sql` | migrar `inventario.users` → `core.usuarios` + módulos/roles |
| `004-compatibility-views.sql` | **substituir** `inventario.stores`/`users`/`user_stores` por **VIEWs sobre o core** |
| `005-instead-of-triggers.sql` | INSTEAD OF triggers, porque VIEW com JOIN é read-only |
| `006-sync-inventario-core.sql` | plano B do 004: espelhar core → inventário, em vez de virar view |

## Por que o plano travou

O 004 é o coração da ideia: se `inventario.stores` fosse uma VIEW sobre
`core.filiais`, as duas nunca dessincronizariam e não haveria o que espelhar.

Só que **no PostgreSQL uma FOREIGN KEY não pode referenciar uma VIEW.** E 48 FKs
do módulo apontam para `inventario.stores` / `users` / `user_stores` — 12 delas
NOT NULL (`countings.counted_by`, `inventory_lists.created_by`,
`cycle_audit_log.user_id`...). Transformar as tabelas em views exigiria derrubar
as 48 FKs junto, apagando a trilha de auditoria da contagem.

O plano era incompatível com o schema que já existia. Parou aí.

## O que isso custou

O 006 era o plano B — e **ele estava certo**. Foi escrito e commitado em
`42cfd818` (26/02/2026), a mesma commit que ligou o `UNIFIED_AUTH` no inventário.

Mas nasceu **neste diretório**, que nenhum runner lê. Nunca foi aplicado, nunca
foi registrado em nenhuma tabela de controle.

Resultado: a partir de 26/02/2026 a identidade passou a vir do core
(`core/security.py`, `_get_current_user_unified`) enquanto as três tabelas
continuavam vazias. Todo o caminho de escrita da contagem ficou bloqueado — criar
inventário, criar lista, atribuir contador, contar, auditar, handoff, encerrar
ciclo. E de forma **silenciosa**: dropdown vazio, "Found 0 available users",
nenhum erro gritado.

Ficou assim por **5 meses**, e só apareceu em 07-08/08/2026, em três sintomas
que pareciam não ter relação entre si:

1. seletor de armazém vazio → contornado no `warehouses.py` (casa por CÓDIGO)
2. importação da `slk010` quebrando → contornado na `019` (FKs viraram opcionais)
3. "Loja não encontrada ou inválida" ao criar inventário → aí a raiz apareceu

**Resolvido em `inventario/database/migrations/020_ancorar_identidade_unified_auth.sql`**,
que faz o que o 006 faria, mais o que faltava nele (o vínculo `user_stores`), e
com as redes de segurança que HLG/PROD exigem. A manutenção contínua ficou em
`_espelhar_identidade` (`inventario/backend/app/core/security.py`).

## Se você veio aqui achando que faltava aplicar algo

Não falta. Mas cuidado com o que acontece se rodar mesmo assim:

- **`002` / `003`** — inserem em `core.filiais` / `core.usuarios`. O core hoje
  está populado e é do Prisma: isso **duplica filial e usuário**. É o arquivo
  perigoso do diretório.
- **`004`** — falha em erro (`CREATE OR REPLACE VIEW` não substitui uma TABELA
  existente). Inofensivo, mas inútil.
- **`006`** — hoje é redundante com a `020`; ele ainda copia `u.senha` para
  `inventario.users.password_hash`, duplicando credencial entre schemas. A `020`
  grava propositalmente um hash aleatório e inútil no lugar.

---

*Registrado em 08/08/2026, ao investigar por que o inventário havia parado de
funcionar meses depois de testado.*
