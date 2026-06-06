# CAPUL — Plataforma Capul / Módulo Logística

## Solicitação de novo endpoint Protheus: consulta de ENDEREÇO de cliente/cooperado por código (SA1)

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 05/06/2026
- **Tipo:** Solicitação de novo endpoint (leitura, sem senha)
- **Prioridade:** Baixa/Média — funcionalidade entregue com digitação manual do endereço; o endpoint elimina redigitação para clientes/cooperados já cadastrados.

---

## 1. Contexto

No novo módulo **Logística → Entregas** (entregas domiciliares do supermercado),
ao cadastrar uma entrega para um **cliente identificado** (cooperado/cliente já
existente no ERP), queremos **puxar o endereço cadastrado** dele a partir do
**código/matrícula**, em vez de o operador redigitar logradouro/número/bairro/
cidade/UF/CEP a cada pedido.

Hoje só temos `GET /rest/api/INFOCLIENTES/getLimite?CODCLIENTE=<cod>` (operação
`INFOCLIENTES`), que consulta a **SA1 (clientes)** mas retorna **dados de limite/
crédito**, **não o endereço**. Precisamos dos **campos de endereço da SA1**.

**Solução interina já em produção:** o operador digita o endereço manualmente
(com máscaras de CEP/telefone e snapshot do endereço na entrega). Funciona, mas
é redigitação para quem já está cadastrado.

---

## 2. Spec do endpoint solicitado

Consulta de **endereço(s) de cliente/cooperado por código**, **sem senha**,
lendo a **SA1010**, no mesmo padrão dos demais endpoints (mesma `BASE`, mesma
auth Basic de serviço).

```
GET {BASE}/LOGISTICA/enderecoCliente?CODCLIENTE=000001047
Authorization: Basic <base64>            (mesma credencial dos demais endpoints)
```

**Resposta (encontrado):**
```json
{
  "codigo": "000001047",
  "loja": "01",
  "nome": "FULANO DE TAL",
  "cpfCnpj": "12345678900",
  "telefone": "3436812345",
  "endereco": {
    "logradouro": "RUA EXEMPLO",        // A1_END
    "numero": "123",                     // se houver campo separado; senão vem em A1_END
    "complemento": "",                   // A1_COMPLEM (se existir)
    "bairro": "CENTRO",                  // A1_BAIRRO
    "municipio": "UNAI",                 // A1_MUN
    "uf": "MG",                          // A1_EST
    "cep": "38610000"                    // A1_CEP
  }
}
```

**Resposta (não encontrado):**
```json
{ "codigo": "000001047", "encontrado": false }
```

Requisitos:
- **Sem senha** (apenas a auth Basic de serviço, como os outros endpoints).
- Buscar pelo **código exato** (`A1_COD` [+ `A1_LOJA`, se aplicável]).
- Trazer **CEP e UF** sempre que existirem (são o que mais economiza digitação).
- Se o cliente tiver **endereço de entrega distinto do de cobrança**, retornar os
  dois (ex.: array `enderecos[]` com um campo `tipo`) seria o ideal; caso
  contrário, o endereço principal já resolve.
- (Opcional) Aceitar também busca por **CPF/CNPJ** além do código.

---

## 3. Como a Plataforma vai consumir

1. Cadastrar a operação `enderecoCliente` em `core.integracoes_api_endpoints`
   (módulo `LOGISTICA`), nos ambientes HOM e PROD (Configurador) — mesmo padrão
   dinâmico já usado por Gestão TI/Fiscal/Inventário.
2. Na tela **Nova Entrega**, ao informar o código/matrícula do cliente
   identificado, a plataforma chama o endpoint e **pré-preenche o endereço**
   (continua editável; o que for confirmado vira o snapshot da entrega).
3. Reaproveita a busca unificada já existente (`/api/v1/logistica/cadastro/busca`),
   que hoje já casa clientes locais por nome/telefone — o Protheus passa a ser
   mais uma fonte para o caso "cliente identificado".

---

## 4. Status

- [ ] Endpoint criado pela equipe Protheus (HOM)
- [ ] Validado pela Plataforma em HOM
- [ ] Cadastrado em PROD (Configurador) + ligado o autofill de endereço na Nova Entrega
- [x] **Interino em produção:** endereço digitado manualmente, com snapshot na entrega (05/06/2026)

---

> Observação: este endpoint é **análogo** ao `infoPortal` (funcionários/SRA) já
> entregue — mesma ideia (leitura por chave, sem senha, retorno JSON), agora para
> **endereço de cliente/cooperado (SA1)**. Reaproveitar o mesmo padrão de
> implementação e autenticação agiliza a entrega.
