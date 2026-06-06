# CAPUL — Plataforma Capul / Módulo Logística

## Solicitação Protheus: consulta de cliente/cooperado por MATRÍCULA, TELEFONE ou NOME — com ENDEREÇO

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 05/06/2026 (rev. 1)
- **Tipo:** Solicitação de endpoint de leitura (sem senha) — **extensão de capacidade já existente**
- **Prioridade:** Baixa/Média — funcionalidade entregue com digitação manual; o endpoint elimina redigitação no balcão de entregas.

---

## 1. Contexto

No módulo **Logística → Entregas** (entregas domiciliares do supermercado), ao
cadastrar uma entrega o operador identifica o cliente pelo que tem **em mãos no
balcão** — em ordem de uso:

1. **Matrícula / código** do cooperado/cliente (o mais usado);
2. **Telefone**;
3. **Nome** (busca, pode retornar lista).

A partir dessa chave queremos **pré-preencher o endereço de entrega** (e o
nome/telefone), em vez de redigitar logradouro/bairro/cidade/UF/CEP a cada pedido.

**O dado já existe no Protheus.** A operação **`cadastroFiscal`** (SA1010/SA2010),
usada hoje pelo Módulo Fiscal, **já retorna o endereço** (`endereco: {logrado,
complem, bairro, municip, uf, cep}`), `contato: {telefone}`, `pessoa: F|J`. O
problema é só a **chave de busca**: o `cadastroFiscal` pesquisa por **CPF/CNPJ**,
e no balcão de entregas o operador usa **matrícula/telefone/nome**.

**Solução interina já em produção:** o operador digita o endereço manualmente
(com máscaras e snapshot do endereço na entrega). Busca por nome/telefone já
funciona contra a base **local** da plataforma; falta a fonte **Protheus**.

---

## 2. O que pedimos (uma das duas formas, o que for mais simples pra vocês)

### Opção A — endpoint SA1 por matrícula/telefone/nome (preferida)

Mesma leitura da SA1 que o `cadastroFiscal` já faz, porém **pesquisável pelas
chaves do balcão**:

```
GET {BASE}/LOGISTICA/clienteEndereco?MATRICULA=000001047
GET {BASE}/LOGISTICA/clienteEndereco?TELEFONE=34999990000
GET {BASE}/LOGISTICA/clienteEndereco?NOME=FULANO            (retorna lista)
Authorization: Basic <base64>     (mesma credencial de serviço dos demais)
```

**Resposta (encontrado / por chave única):**
```json
{
  "codigo": "000001047",
  "loja": "01",
  "nome": "FULANO DE TAL",
  "cpfCnpj": "12345678900",
  "telefone": "3499990000",
  "endereco": {
    "logradouro": "RUA EXEMPLO", "numero": "123", "complemento": "",
    "bairro": "CENTRO", "municipio": "UNAI", "uf": "MG", "cep": "38610000"
  }
}
```
**Por NOME (lista):** `{ "clientes": [ { ...mesmos campos... } ] }` (ordenada por nome).
**Não encontrado:** `{ "encontrado": false }`.

### Opção B — adicionar as chaves ao `cadastroFiscal` que já existe

Se for mais simples, **aceitar `MATRICULA`/`TELEFONE`/`NOME` como filtro** na
operação `cadastroFiscal` atual (que já devolve `endereco`+`contato`), além do
CPF/CNPJ. Aí reaproveitamos 100% o contrato existente.

### Requisitos (ambas)
- **Sem senha** (apenas a auth Basic de serviço).
- **Sem SEFAZ** — leitura direta da SA1/SA2 no Protheus (o `cadastroFiscal` já é
  assim). **Não** envolver consulta SEFAZ/CCC (risco de bloqueio + cota).
- Trazer **CEP e UF** sempre que existirem.

> **Dúvida a confirmar (CAPUL interno):** a "matrícula" usada no balcão é de
> **cliente/cooperado (SA1)** ou de **funcionário (SRA)**? Se for SRA, a operação
> **`infoPortal`** (já entregue) **já aceita `MATRICULA`/`NOME`** — bastaria
> **adicionar `endereco` + `telefone`** ao retorno dela, e nem precisaríamos de
> endpoint novo. Vamos confirmar e avisar.

---

## 3. Como a Plataforma vai consumir

1. Cadastrar a operação em `core.integracoes_api_endpoints` (módulo `LOGISTICA`),
   HOM e PROD (Configurador) — mesmo padrão dinâmico dos demais módulos.
2. Na **busca unificada** da Nova Entrega (que já varre clientes locais por
   matrícula/telefone/nome), o Protheus entra como **mais uma fonte**: achou →
   pré-preenche nome/telefone/endereço (continua editável; o confirmado vira o
   snapshot da entrega).

---

## 4. Status

- [ ] Definido (CAPUL): matrícula = SA1 (cliente) ou SRA (funcionário)?
- [ ] Endpoint/extensão criado pela equipe Protheus (HOM)
- [ ] Validado pela Plataforma em HOM
- [ ] Cadastrado em PROD (Configurador) + ligado o autofill na Nova Entrega
- [x] **Interino em produção:** endereço digitado manual; busca local por nome/telefone OK (05/06/2026)
