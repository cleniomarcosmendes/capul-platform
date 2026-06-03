# CAPUL — Plataforma Capul / Módulo Gestão de TI
## Solicitação de novo endpoint Protheus: consulta de FUNCIONÁRIO por matrícula (SRA)

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 03/06/2026
- **Tipo:** Solicitação de novo endpoint (leitura, sem senha)
- **Prioridade:** Média — funcionalidade entregue com preenchimento manual; o endpoint elimina digitação e erro de nome.

---

## 1. Contexto

No módulo **Gestão de TI → Licenças de Software**, passamos a vincular cada licença
ao **funcionário** que a utiliza (ex.: Office com chave própria → 1 funcionário).
O objetivo é registrar quem usa a licença mesmo que a pessoa **não tenha login**
na plataforma.

Para isso precisamos resolver o **nome do funcionário a partir da matrícula**.

**Problema identificado (smoke 03/06):** o único endpoint hoje disponível —
`GET /rest/api/INFOCLIENTES/getLimite?CODCLIENTE=<cod>` (operação `INFOCLIENTES`,
usado também pela busca de "colaborador" do Chamado) — consulta o **cadastro de
CLIENTES/cooperados (SA1)**, **não** o de **funcionários (SRA)**. Evidência: a
matrícula de funcionário `001047` (CLENIO MARCOS MENDES) retorna **HTTP 400**;
já `CODCLIENTE=000001047` casa com o **cliente** `000001` ("CLIENTE PADRAO P/
ORCAMENTOS").

O endpoint de portal `INFOCLIENTES/loginPortal` (MATRICULA+SENHA) apenas **valida
credencial** (retorna "Credenciais válidas/inválidas") — **exige senha** e **não
retorna o nome**, portanto não serve para consulta.

**Solução interina já em produção:** o operador digita **matrícula + nome**
manualmente no vínculo da licença. Funciona, mas é sujeito a digitação.

---

## 2. Spec do endpoint solicitado

Consulta de funcionário por matrícula, **sem senha**, lendo o cadastro de RH
(tabela **SRA010** — funcionários), análogo ao padrão dos demais endpoints já
entregues (mesma `BASE` e mesma auth Basic).

```
GET {BASE}/GESTAO_TI/funcionario?MATRICULA=001047
Authorization: Basic <base64>            (mesma credencial dos demais endpoints)
```

**Resposta (encontrado):**
```json
{
  "matricula": "001047",
  "nome": "CLENIO MARCOS MENDES",
  "situacao": "ATIVO",          // opcional, se disponível (SRA_SITFOLH / demitido)
  "centroCusto": "...",          // opcional
  "funcao": "..."                // opcional
}
```

**Resposta (não encontrado):**
```json
{ "matricula": "001047", "encontrado": false }
```

Requisitos:
- **Sem senha** (apenas a auth Basic de serviço, como os outros endpoints).
- Buscar pela **matrícula exata** (campo `RA_MAT` da SRA010), sem precisar de prefixo.
- Idealmente filtrar por filial corrente / ativos, mas retornar inativos também é aceitável (campo `situacao` resolve).

---

## 3. Como a Plataforma vai consumir

1. Cadastrar a operação `FUNCIONARIO` em `core.integracoes_api_endpoints` (módulo `GESTAO_TI`), nos ambientes HOM e PROD (Configurador).
2. No vínculo de licença, ao digitar a matrícula, a plataforma chama o endpoint e **preenche o nome automaticamente** (hoje manual). O nome continua editável.
3. (Bônus) Mesmo padrão pode melhorar outras telas que hoje dependem de digitação de nome de funcionário.

---

## 4. Status

- [ ] Endpoint criado pela equipe Protheus (HOM)
- [ ] Validado pela Plataforma em HOM
- [ ] Cadastrado em PROD (Configurador) + religado o autofill no frontend
- [x] **Interino em produção:** matrícula + nome digitados manualmente (03/06/2026)
