# CAPUL — Plataforma Capul / Módulo Fiscal
## Investigação: caracteres corrompidos no campo `SZR010.ZR_XML` após `POST /grvXML`

- **De:** Clenio Marcos — Departamento de T.I. (CAPUL)
- **Para:** Equipe Protheus / TOTVS
- **Data:** 28/04/2026
- **Tipo:** Reporte de bug + diagnóstico técnico
- **Prioridade:** Média — não bloqueia consulta NF-e (XML é re-baixado por chave quando precisa), mas corrompe o cache fiscal e qualquer downstream que leia direto do `ZR_XML` (SPED, auditoria, retransmissão para parceiros)

---

## 1. Resumo executivo

A equipe de projeto reportou em 28/04/2026 que o conteúdo gravado em `SZR010.ZR_XML` está chegando com **caracteres latinos corrompidos** após o `POST /grvXML` da Plataforma Capul. Investiguei o pipeline completo do nosso lado (download SEFAZ → encode base64 → request HTTP → POST /grvXML) e **a CAPUL envia bytes UTF-8 íntegros**. O mojibake acontece **dentro do Protheus**, entre o `Decode64` do `xmlBase64` e a gravação física do campo Memo.

Diagnóstico forense abaixo. Inclui evidência byte-a-byte, hipótese sobre a causa raiz no AdvPL e roteiro de teste mínimo para a equipe Protheus reproduzir e validar a correção.

---

## 2. Sintomas observados

XML gravado em `ZR_XML` referente à chave `31260464001799000113550010000000621800055298` (NF-e MG, série 1, número 62, emitida 27/04/2026):

| Trecho original (correto) | Como está em `ZR_XML` (corrompido) |
|---|---|
| `CAMARÃO EMPANADO E RECHEADO COM CREAM CHEESE 400G` | `CAMARÃƒO EMPANADO E RECHEADO COM CREAM CHEESE 400G` |
| `CAMARÃO EMPANADO E RECHEADO COM REQUEIJÃO CREMOSO 400G` | `CAMARÃƒO EMPANADO E RECHEADO COM REQUEIJÃƒO CREMOSO 400G` |
| `CAMARÃO TEMPERADO E EMPANADO 340G` | `CAMARÃƒO TEMPERADO E EMPANADO 340G` |
| `UNAÍ` (município MG-3170404) | `UNAÃ` (com caractere de controle invisível depois do "Ã") |

**Padrão observado:** todo `Ã` (U+00C3) precedido por outro byte alto em UTF-8 vira `Ãƒ` (`Ã` + `ƒ`). Caracteres com sufixo UTF-8 em controle (`0x8D` para `Í`) ficam com um caractere invisível depois.

---

## 3. Diagnóstico forense (reprodução byte-a-byte)

O padrão `Ãƒ` aparecendo onde deveria haver `Ã` é a **assinatura clássica de bytes UTF-8 sendo decodificados como CP1252 (Windows-1252) e re-codificados como UTF-8**. Reproduzido em laboratório e bate exatamente.

### 3.1 Caso `CAMARÃO`

```
"CAMARÃO" em UTF-8 → bytes hex:  43 41 4D 41 52 C3 83 4F
                                              ^^^^^^^^
                                              Ã = U+00C3 (em UTF-8 = 2 bytes: C3 83)

Se um sistema lê byte-a-byte como CP1252 (Windows-1252):
  0x43 → 'C'
  0x41 → 'A'
  0x4D → 'M'
  0x41 → 'A'
  0x52 → 'R'
  0xC3 → 'Ã'   (em CP1252, 0xC3 = U+00C3 "Ã")
  0x83 → 'ƒ'   (em CP1252, 0x83 = U+0192 "ƒ Latin Small Letter F With Hook")
  0x4F → 'O'

Resultado em memória: "CAMARÃƒO" (8 caracteres Unicode)

Ao salvar essa string em campo Memo de banco UTF-8, ela é re-encodada para
UTF-8 → bytes hex finais: 43 41 4D 41 52 C3 83 C6 92 4F (10 bytes).

Quando alguém lê de volta como UTF-8, vê "CAMARÃƒO". ← O QUE A EQUIPE VÊ NO ZR_XML.
```

### 3.2 Caso `UNAÍ`

```
"UNAÍ" em UTF-8 → bytes hex: 55 4E 41 C3 8D
                                       ^^^^^
                                       Í = U+00CD (em UTF-8 = 2 bytes: C3 8D)

Lido como CP1252:
  0x55 → 'U'
  0x4E → 'N'
  0x41 → 'A'
  0xC3 → 'Ã'
  0x8D → indefinido em CP1252 padrão (slot vazio na tabela)
         na maioria dos handlers vira character-zero ou control char invisível

Resultado: "UNAÃ" + char invisível ← O QUE A EQUIPE VÊ NO ZR_XML.
```

### 3.3 Reprodução em laboratório (Node.js, executada em 28/04/2026)

```js
// Lê bytes UTF-8 e os interpreta como CP1252
const original = 'CAMARÃO UNAÍ REQUEIJÃO';
const utf8Bytes = Buffer.from(original, 'utf-8');

// Tabela CP1252 dos slots 0x80-0x9F (parte que diverge de Latin-1):
const cp1252 = { 0x83:'ƒ', 0x8D: '' /*slot vazio em CP1252*/, /* ...demais... */ };

let s = '';
for (const b of utf8Bytes) {
  s += (b in cp1252) ? cp1252[b] : String.fromCharCode(b);
}
console.log(s);
// → "CAMARÃƒO UNAÃ REQUEIJÃƒO"
//    bate exatamente com o ZR_XML reportado
```

Diagnóstico **100% confirmado**. Não há outra combinação de codecs que produza esse output.

---

## 4. O que a CAPUL envia (auditado, está correto)

Pipeline de gravação no lado Plataforma (referência: commit atual `main`):

| Etapa | Arquivo | Linha | Operação | Encoding |
|---|---|---|---|---|
| 1. Download SEFAZ | `fiscal/backend/src/sefaz/nfe-distribuicao.client.ts` | 282 | `gunzipSync(Buffer.from(base64, 'base64')).toString('utf8')` | UTF-8 íntegro |
| 2. Cache xmlNfe Protheus | `fiscal/backend/src/nfe/nfe.service.ts` | 220 | `Buffer.from(xmlNfeResp.xmlBase64, 'base64').toString('utf8')` | UTF-8 íntegro |
| 3. Encode pra `/grvXML` | `fiscal/backend/src/protheus/xml-parser-to-szr-szq.service.ts` | 74 | `Buffer.from(xml, 'utf-8').toString('base64')` | base64 dos bytes UTF-8 originais |
| 4. Send HTTP | `fiscal/backend/src/protheus/protheus-http.client.ts` | 150 | `JSON.stringify(body)` enviado pelo undici | UTF-8 (default JSON, RFC 8259) |

**Conclusão:** o `xmlBase64` que sai da Plataforma e chega ao Protheus contém os bytes UTF-8 originais do XML SEFAZ. A corrupção **não acontece na CAPUL**.

---

## 5. Hipótese sobre o lado Protheus (AdvPL)

Em servidores Windows (caso da CAPUL Protheus), o AppServer roda com **CP1252** como codepage padrão e AdvPL trata strings nesse codec por default. Sequência hipotética dentro do Protheus:

```
1. Recebe payload JSON do POST /grvXML com xmlBase64.
   ::oJson["xmlBase64"] = "PD94bWwgdmVyc2lvbj0iMS4wIi..."

2. Decodifica:
   cBytes := Decode64(::oJson["xmlBase64"])
   //  cBytes contém os bytes UTF-8 do XML (incluindo C3 83 para "Ã")

3. AdvPL trata cBytes como string CP1252:
   //  No momento em que cBytes é atribuída a uma variável character ou
   //  passada por funções string (Substr, AllTrim, At), AdvPL interpreta
   //  cada byte como um caractere CP1252.
   //  Bytes [C3 83] viram chars Unicode [U+00C3 U+0192] = "Ãƒ".

4. Insere no campo Memo da SZR010:
   RecLock("SZR010", .F.)
      SZR010->ZR_XML := cBytes
   MsUnlock()

5. Driver Oracle/PostgreSQL grava a string CP1252 do AdvPL re-codificada como
   UTF-8 (banco está em AL32UTF8). Resultado: bytes finais corrompidos.

6. Quando alguém lê o ZR_XML de volta, o conteúdo é mojibake permanente.
```

**Pontos-chave:**

- Não é problema do banco: o banco grava o que recebe; recebe corrompido.
- Não é problema do JSON parser: o parser entrega o `xmlBase64` íntegro.
- O problema é **a transição "buffer de bytes → string AdvPL"** sem flag de UTF-8.

### 5.1 Por que isso aconteceu agora

O Protheus já lê XML há anos (Monitor NFe, SPED156). A diferença é que o XML do Monitor NFe vem do próprio TSS, que grava o XML **diretamente** em `ZIPPROC` como BLOB binário GZIP — nunca passa por string AdvPL. Já o `/grvXML` recebe o XML via JSON (string codificada em base64), e o ponto de transição "Decode64 → variável AdvPL" é onde o codec entra.

---

## 6. Soluções possíveis (lado Protheus)

Em ordem de preferência:

### 6.1 ★ Recomendado — gravar o Memo via `MEMOWRITE` em modo binário

Em vez de atribuir o resultado do `Decode64` a uma variável character e depois ao campo Memo, escrever direto:

```advpl
// Pseudocódigo — adaptar à API real do AdvPL
cBytes := Decode64(::oJson["xmlBase64"])

// Opção A: MSExecAuto / RecLock convencional, mas com cBytes como buffer binário
// (evitar qualquer função string entre o Decode64 e a atribuição)
RecLock("SZR010", .F.)
   SZR010->ZR_XML := cBytes  // atribuição direta sem manipulação intermediária
MsUnlock()

// Opção B: gravar em arquivo temp e usar MEMOWRITE binário
nFile := FCreate(cTmpPath, FC_NORMAL)
FWrite(nFile, cBytes)
FClose(nFile)
RecLock("SZR010", .F.)
   SZR010->ZR_XML := MEMOREAD(cTmpPath)  // se MEMOREAD respeitar binary
MsUnlock()
```

A solução exata depende da versão do AdvPL/protheus em uso, mas o princípio é: **não passar o buffer por nenhuma função de string entre `Decode64` e a atribuição final ao campo**.

### 6.2 Alternativa — declarar UTF-8 explicitamente no codepage da conexão

Se o AppServer aceita configuração de codepage por sessão, definir `UTF8_PT-BR` na conexão que processa `/grvXML`. Em ambientes mais novos, isso pode ser configurado via `appserver.ini` ou via `__SetCodePage()` no início do request.

### 6.3 Alternativa — converter no lado da Plataforma

Se nenhuma das opções acima for viável no Protheus, a Plataforma pode pré-converter o XML para CP1252 antes de enviar — mas **não recomendamos** porque:
- Caracteres fora do CP1252 (emojis, ásian, símbolos, qualquer coisa fora de Latin-1+ƒ) serão perdidos para sempre
- Cria divergência entre o XML original (UTF-8) e o que vai pro Protheus (CP1252)
- O XML do SEFAZ é canonicamente UTF-8 (declaração `<?xml encoding="UTF-8"?>` no topo)
- Geraria inconsistência com SPED156, que já guarda UTF-8 íntegro em `ZIPPROC`

---

## 7. Roteiro de teste mínimo (para a equipe Protheus reproduzir)

### 7.1 Caso de teste

XML real disponível em `c:\temp\31260464001799000113550010000000621800055298 (1).xml` no ambiente CAPUL.

Identificadores:
- **Chave NF-e:** `31260464001799000113550010000000621800055298`
- **Emitente:** Carla Filomena Marques Sequeira (CNPJ 64001799000113, Pesqueiro da Bia, Unaí/MG)
- **Destinatário:** Cooperativa Agropecuária Unaí Ltda (CNPJ 25834847000100)
- **Itens com acentos relevantes:**
  - Item 1: `CAMARÃO EMPANADO E RECHEADO COM CREAM CHEESE 400G`
  - Item 2: `CAMARÃO EMPANADO E RECHEADO COM REQUEIJÃO CREMOSO 400G`
  - Item 3: `CAMARÃO TEMPERADO E EMPANADO 340G`
- **Município emitente:** `UNAÍ`

### 7.2 Procedimento

1. Pegar o `xmlBase64` exato que a CAPUL envia em `POST /grvXML`. Pode ser capturado:
   - **No Protheus:** logando o body recebido antes do `Decode64`
   - **Na CAPUL:** posso enviar o JSON capturado por e-mail se for útil
2. No Protheus HOM, executar a função de gravação atual (`grvXML`) com esse body.
3. Após execução, ler o conteúdo do campo `SZR010.ZR_XML` (registro recém-gravado).
4. Procurar pelas strings:
   - `CAMARÃO` (esperado correto) vs `CAMARÃƒO` (corrompido)
   - `REQUEIJÃO` (esperado correto) vs `REQUEIJÃƒO` (corrompido)
   - `UNAÍ` (esperado correto) vs `UNAÃ` + char controle (corrompido)
5. Aplicar uma das soluções da Seção 6 e repetir do passo 2.

### 7.3 Critério de aceite

Após o fix, executar:

```sql
-- Em qualquer ferramenta SQL conectada no banco do Protheus
SELECT
  CASE WHEN ZR_XML LIKE '%CAMARÃO%' THEN 'OK' ELSE 'FAIL' END AS camarao,
  CASE WHEN ZR_XML LIKE '%CAMARÃƒO%' THEN 'FAIL' ELSE 'OK' END AS sem_mojibake_camarao,
  CASE WHEN ZR_XML LIKE '%REQUEIJÃO%' THEN 'OK' ELSE 'FAIL' END AS requeijao,
  CASE WHEN ZR_XML LIKE '%UNAÍ%' THEN 'OK' ELSE 'FAIL' END AS unai
FROM SZR010
WHERE ZR_CHVNFE = '31260464001799000113550010000000621800055298'
  AND D_E_L_E_T_ <> '*';
```

Esperado: 4 colunas com `OK`. Se algum vier `FAIL`, o fix não está completo.

---

## 8. Impacto enquanto não corrigido

A consulta NF-e da Plataforma **não é bloqueada** — o sistema sempre prefere parsear o XML que ele mesmo baixou (UTF-8 íntegro) antes de cair no cache do Protheus. O impacto é nos consumidores **diretos** do `ZR_XML`:

- Relatórios SPED gerados a partir de SZR010
- Auditoria fiscal interna que lê o XML do Protheus
- Retransmissão para parceiros (revendas, transportadoras) que consultam o Protheus
- Validação contra portal SEFAZ — o Hash/DigestValue do XML corrompido **NÃO bate** com o XML autorizado, então qualquer revalidação cripto vai falhar
- **Risco de auditoria fiscal:** XMLs gravados com mojibake podem ser questionados pela Receita em fiscalização (descontinuidade entre o XML autorizado pela SEFAZ e o XML retido pela empresa)

Portanto, embora não seja crítico para a operação imediata, **a correção é importante** para a integridade do arquivo fiscal de longo prazo.

---

## 9. Referências

- Schema SEFAZ NF-e v4.00: declara explicitamente `encoding="UTF-8"` no header do XML autorizado (Portal Nacional NF-e — Manual de Orientação ao Contribuinte v7.0 §3.2)
- RFC 8259 (JSON): `JSON text exchanged between systems that are not part of a closed ecosystem MUST be encoded using UTF-8`
- CP1252 reference: Microsoft Windows-1252 codepage, slot `0x83` = U+0192 ("ƒ"), slot `0x8D` = unmapped
- Pipeline CAPUL auditado: arquivos e linhas listados na Seção 4
- Caso de teste físico: `c:\temp\31260464001799000113550010000000621800055298 (1).xml` (ambiente CAPUL)

---

## 10. Próximos passos sugeridos

| Etapa | Responsável | Estimativa |
|-------|-------------|------------|
| Reproduzir bug com o caso de teste da Seção 7 | Equipe Protheus | 30 min |
| Aplicar fix da Seção 6.1 (atribuição direta sem string AdvPL intermediária) | Equipe Protheus | 1-2 horas |
| Validar com o critério de aceite SQL da Seção 7.3 | Equipe Protheus | 15 min |
| Re-executar `/grvXML` na chave de teste do CAPUL | CAPUL + Equipe Protheus | 15 min |
| Revisão de XMLs já gravados em PROD (decisão: re-gravar ou aceitar histórico) | CAPUL + Equipe Protheus | a definir |

**Total estimado: meio dia** (excluindo decisão sobre histórico).

---

*Quando puderem confirmar a reprodução do bug e estimativa de correção, alinhamos a janela de re-aplicação dos XMLs já gravados em PROD desde o início da operação Fiscal (27/04/2026).*
