# Roteiros de teste no Chrome — jornada de 09/08/2026 (Logística)

Sete roteiros curtos, um por fase entregue. Cada um se sustenta sozinho: tem a
persona, o setup e o "esperado" próprios, e roda em 10–20 minutos.

**Nada disto foi pushado.** Tudo está em commits locais sobre a `main`.

## Ordem sugerida

| # | Roteiro | O que valida | Commit |
|---|---|---|---|
| 1 | [Multi-role](1-MULTIROLE.md) | papel por departamento; a 2ª permissão de Logística | `e60108e8` `a93aab21` |
| 2 | [Supervisor do veículo](2-SUPERVISOR-VEICULO.md) | ponto 4 — o campo só aceita quem pode exercer | `396aefd9` |
| 3 | [Aprovador da despesa](3-APROVADOR-DESPESA.md) | 5b — a despesa é da PESSOA, não do carro | `1db1ce0c` `41388562` |
| 4 | [Acerto com login PADRÃO](4-ACERTO-PADRAO.md) | 5a — prestar contas pelo desktop com conta de caixa | `7f2d3b55` |
| 5 | [Registro de Viagem](5-REGISTRO-VIAGEM.md) | ponto 3 — viagem sem veículo da empresa | `0345b974` |
| 6 | [Data de entrega](6-DATA-ENTREGA.md) | ponto 2 — o dia manda na fila de montagem | `42521540` |
| 7 | [Travessia](7-TRAVESSIA.md) | os quatro primeiros **juntos**, num caminho só | — |

O **1 é pré-requisito real** dos demais: sem ele, um usuário não acumula papéis e
vários cenários ficam impossíveis de montar. Os outros podem ser rodados fora de
ordem. **O 7 é o que a divisão por fase não cobre** — a interação entre elas.

> **Ponto 1 da pauta (KM) NÃO entra aqui**: ficou pendente, para tratar depois.
> Ver `docs/ANALISE_ROTA_KM_ENTREGA.md`.

---

## ⚠️ Antes de começar — duas restrições que travam o roteiro no passo 1

*(A nº 2 já derrubou uma execução. Não pule.)*

### 1. Matrícula + senha vai ao Protheus de PRODUÇÃO
Todo ponto que pede **senha do portal RH** (saída PADRÃO, identificação do
condutor no acerto, porteiro) é validado contra o Protheus **real**. Senha
inventada não passa, e não há como simular.

Onde isso pesa: **roteiro 4** depende de uma credencial real de colaborador. Os
demais têm caminho alternativo por login **INDIVIDUAL**, que dispensa a senha do
RH — está indicado em cada um.

### 2. 🔴 O ambiente precisa estar com o código desta jornada — os TRÊS containers

Este é o erro que já aconteceu: em 09/08 a skill reprovou o item 1.1 porque o
**Configurador servia um bundle de 43 horas atrás**. O achado estava tecnicamente
correto (não havia seletor de departamento na tela) e a causa era container velho,
não defeito. Frontend em container é **imagem buildada** — editar o fonte não muda
o que o navegador recebe.

```bash
cd /mnt/c/meus_projetos/capul-platform
docker compose build logistica-backend logistica-frontend configurador
docker compose up -d logistica-backend logistica-frontend configurador
docker compose exec nginx nginx -s reload      # IP novo do container → senão 502
```

**Conferir antes de abrir o Chrome** (não confie no "buildou"):

```bash
# Configurador: a Logística tem de estar na lista de módulos com departamento
docker compose exec configurador sh -c 'grep -o "WORKSPACE\",\"LOGISTICA" /usr/share/nginx/html/assets/*.js | head -1'
# esperado: WORKSPACE","LOGISTICA

# Logística: a tela renomeada
docker compose exec logistica-frontend sh -c 'grep -c "Registro de Viagem" /usr/share/nginx/html/assets/*.js'
# esperado: 1 ou mais
```

Se qualquer um vier vazio/0, **pare**: o roteiro vai reprovar itens que estão
corretos no código. Não adianta grepar o **nome** de constantes (`USA_DEPTO_WORKSPACE`
etc.) — o Vite minifica identificadores; procure **textos** que aparecem na tela.

> **Se um item reprovar, cheque isto primeiro.** "A tela não tem o campo" é o
> sintoma tanto de bug quanto de build velho, e os dois se parecem no navegador.

---

## Personas (DEV, 09/08/2026)

| Login | Tipo | Papel Logística | Departamento | Filial | Matrícula |
|---|---|---|---|---|---|
| `admin` | INDIVIDUAL | ADMIN | T.I. | 01 | — |
| `supdept01` | INDIVIDUAL | SUPERVISOR_FROTA | T.I. | 01 | 001047 |
| `lidyanerocha` | INDIVIDUAL | SUPERVISOR_FROTA | Vendas (FBR) | 18 | 002336 |
| `renataborges` | INDIVIDUAL | SUPERVISOR_FROTA | Supermercado | 02 | — |
| `raydeborges` | INDIVIDUAL | OPERADOR_ENTREGA | Supermercado | 02 | — |
| `wandersonnascimento` | INDIVIDUAL | **ENTREGADOR** | Supermercado | 02 | — |
| `gfrota01` | INDIVIDUAL | GESTOR_FROTA | T.I. | 01 | — |
| `supdeptb` | INDIVIDUAL | GESTOR_ENTREGA | T.I. | 02 | — |
| `condutor_ind` | INDIVIDUAL | OPERADOR_ENTREGA | T.I. | 01 | E01047 |
| `condutor_col` | **PADRAO** | OPERADOR_ENTREGA | T.I. | 01 | — |
| `agrounai` | **PADRAO** | REGISTRADOR_FROTA | Agroveterinaria | 01 | — |
| `portaria01` | **PADRAO** | PORTARIA | T.I. | 01 | — |
| `supunai` | **PADRAO** | REGISTRADOR_ENTREGA | Supermercado | 02 | — |

**Senhas** (memória local, não versionadas): `admin` = `admin123`;
`lidyanerocha`, `fabricioneiva`, `kelvereduardo`, **`renataborges`, `raydeborges` e
`wandersonnascimento`** = `Temp@123`; **demais = `123456`**.
*(Clenio confirmou as três da filial 02 em 09/08 — a memória antiga dizia `Temp2026`.)*

### A filial 02 (Supermercado) fecha um cenário inteiro sozinha

`raydeborges` lança e conduz, `renataborges` aprova (é a Supervisora de
Departamento do Supermercado) e `wandersonnascimento` é o **único ENTREGADOR** da
base — sem ele não há motorista para montar rota de entrega. Como `raydeborges` e
`renataborges` **não têm matrícula** em `core.usuarios`, elas exercitam de graça o
caminho de fallback do 5b (departamento vindo do login) — ver roteiro 3.

### Fatos do cadastro que os roteiros usam

- **Departamentos COM aprovador** (têm alguém com SUPERVISOR_FROTA): T.I.,
  Vendas Internas e Externas (FBR), Supermercado.
- **Departamentos SEM aprovador** — servem para provocar o alerta do 5b:
  **Agroveterinaria**, Compras, Almoxarifado, Análise Crédito, entre outros.
- `condutor_ind` (E01047) e `supdept01` (001047) **colapsam na mesma chapa**
  `E01047`. É o caso de DEV que o código já previa; os dois são do T.I., então o
  departamento resolvido é o mesmo. Não é defeito.

---

## Registro de resultados

Preencher ao rodar cada roteiro:

| Roteiro | Data | Quem rodou | Resultado | Observações |
|---|---|---|---|---|
| 1 Multi-role | | | | |
| 2 Supervisor do veículo | | | | |
| 3 Aprovador da despesa | | | | |
| 4 Acerto PADRÃO | | | | |
| 5 Registro de Viagem | | | | |
| 6 Data de entrega | | | | |
| 7 Travessia | | | | |
