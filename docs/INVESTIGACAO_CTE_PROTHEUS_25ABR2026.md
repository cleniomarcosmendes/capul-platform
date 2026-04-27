# Investigação CT-e no Protheus — 25/04/2026

**Autor:** Clenio (TI) + análise técnica
**Banco analisado:** Oracle `capulfis` (192.168.7.85), schemas `TOTVS_PRD` e `SPED_NFE`
**Objetivo:** Determinar se o Protheus padrão TOTVS baixa e armazena XML de CT-e automaticamente, e identificar onde a plataforma Fiscal pode obter o XML de CT-e antes do lançamento de entrada.

---

## 1. Contexto e motivação

A **plataforma Fiscal** (módulo da Capul Platform) tem como finalidade **eliminar o passo manual** em que o operador acessa o portal SEFAZ para baixar XML de NF-e/CT-e e em seguida importa no Protheus.

Para NF-e o caminho está claro:
- O Protheus padrão TOTVS roda `NFeDistribuicaoDFe` (consulta SEFAZ por chave) e grava o resultado em `SPED_NFE.SPED156`
- A partir daí, o XML pode ser consumido pela plataforma via endpoint `/xmlNfe`
- Em último caso, a própria plataforma Fiscal consulta o SEFAZ por chave

Para **CT-e**, esse fluxo não está disponível por uma limitação do próprio SEFAZ:
- `CTeDistribuicaoDFe` (web service nacional) **só aceita consulta por NSU**, não por chave de acesso
- Logo, "baixar um CT-e específico" exige sincronização sequencial NSU + indexação por chave

A questão investigada foi: **o Protheus tem alguma rotina padrão que faça essa sincronização CT-e e guarde o XML em alguma tabela?**

---

## 2. Resumo executivo (revisado 25/04/2026)

**A rotina existe no Protheus padrão TOTVS — mas não está configurada para CT-e nesta instalação.**

A documentação oficial TOTVS (TDN/Central de Atendimento) confirma que o caminho padrão para baixar CT-e contra o CNPJ destinatário é:

> **SIGACOM → Miscelânea → Manifesto do Destino**, usando o web service `NFeDistribuicaoDFe` via TSS.

A doc é explícita sobre CT-e:
> "O JOB de processamento do CTe é o mesmo utilizado para a NFe e MDFe, mudando apenas a seção e a chamada do JOB no arquivo `.ini` do TSS que deverá ser feita através da criação de uma seção para o CTe."

**Por que SPED156 tem 0 CT-e e GZH010 está zerada na CAPUL:** o JOB CT-e do TSS **nunca foi configurado** nesta instalação. Sem ele, a Manifestação do Destino só processa NF-e.

**Workaround atual:** operador usa **Importador XML (COMXCOL)** — baixa do portal SEFAZ e importa no Protheus, populando SZR010/SZQ010 (custom CAPUL). Após a entrada (SF1/SD1/SF3/SFT/SF8), SZR010 é deletado logicamente.

**Solicitação atual (25/04/2026):** equipe Protheus avaliando ativação do JOB CT-e no TSS — caminho oficial TOTVS, sem necessidade de desenvolvimento na plataforma Fiscal.

---

## 3. Evidências técnicas

### 3.1 SZR010 — cache custom CAPUL (origem: import manual)

| Modelo | Ativos (`D_E_L_E_T_=' '`) | Deletados (`D_E_L_E_T_='*'`) | Período |
|---:|---:|---:|---|
| 55 (NF-e) | 9.315 | 192 | jan→abr/2026 |
| 57 (CT-e) | **827** | 26 | jan→abr/2026 |

> SZR010/SZQ010 são tabelas **customizadas pela equipe Protheus CAPUL**, populadas exclusivamente pela tela de **import manual** após o operador baixar o XML do portal SEFAZ.

### 3.2 SPED156 — TSS (onde distDFe TOTVS grava NF-e)

```sql
SELECT MODELO, COUNT(*) FROM SPED_NFE.SPED156 WHERE D_E_L_E_T_=' ' GROUP BY MODELO;
```

| Modelo | Quantidade |
|---:|---:|
| 55 | 7.521 |
| 57 | **0** |

→ Confirma que o distDFe TOTVS **não baixa CT-e** nesta instalação.

### 3.3 SPED154 — eventos (cancelamento, CC-e, desacordo)

| Modelo | Quantidade |
|---:|---:|
| 55 | 19.725 |
| 57 | **4** |
| 58 | 607 |

→ Eventos isolados de CT-e existem (cancelamento, prestação em desacordo etc.), **mas não o XML do CT-e em si**.

### 3.4 GZH010 — módulo CT-e OS Protheus

```
COUNT(*) total = 0
```
Tabela vazia. Tem colunas `GZH_XMLCTE`, `GZH_XMLAUT`, `GZH_XMLERR` mas a CAPUL não usa o módulo.

### 3.5 Outras tabelas testadas

| Tabela | Coluna | Resultado |
|---|---|---|
| DT6010 | DT6_CHVCTE | 30 linhas total, 0 das chaves teste |
| SPED150 | NFE_CHV | 0 das chaves teste |
| SPED155 | DOCID | 0 linhas total |
| SPED157 | DOCID | 0 linhas total |
| SPED072L/074L/076L | IDCTACTE | 0 linhas total |

### 3.6 Teste com 6 chaves CT-e ativas

Chaves do fornecedor F12708, série 005, emitidas 24/11/2025, lançadas como NF Entrada com `F1_STATUS='A'`:
```
35251141104296000410570050000037561574570326
35251141104296000410570050000037571587999617
35251141104296000410570050000037581743944567
35251141104296000410570050000037591288747629
35251141104296000410570050000037601668582282
35251141104296000410570050000037611591813614
```

| Tabela | Encontradas | XML disponível? |
|---|---:|---|
| SF1010 (NF Entrada) | 6/6 | ❌ só metadados |
| SZR010 (custom) | 6/6 | ✅ 5.500-5.642 bytes — **mas todas com `D_E_L_E_T_='*'`** |
| SPED156 (TSS distDFe) | 0/6 | — |
| SPED154 (eventos) | 0/6 | — |

→ Padrão idêntico à investigação anterior: **CT-e processado = SZR010 deletado lógico**.

---

## 4. Fluxo real do CT-e na CAPUL hoje

```
[1] Operador acessa portal SEFAZ e baixa XML manualmente
       │
       ▼
[2] Operador abre tela custom Protheus e importa o XML
       │
       ▼
[3] SZR010/SZQ010 ATIVOS — XML completo disponível       ← janela em que a
       │                                                    plataforma Fiscal
       │                                                    pode ler o XML
       ▼
[4] Operador confere e dá entrada
       │
       ▼
[5] SF1/SD1/SF3/SFT/SF8 povoadas (lançamento contábil/fiscal)
       │
       ▼
[6] SZR010 marcado como deletado lógico (D_E_L_E_T_='*')
       XML continua fisicamente na tabela mas é invisível
       para o endpoint padrão (assumindo filtro por D_E_L_E_T_)
```

**Tabelas pós-entrada (sem XML):**
- **SF1** — cabeçalho NF Entrada
- **SD1** — itens NF Entrada
- **SF3** — livro fiscal padrão SPED
- **SFT** — livro fiscal de transações (entrada/saída)
- **SF8** — livro de inventário (acrescentada por Clenio em 25/04)

---

## 5. Caminho oficial TOTVS (descoberto via doc oficial em 25/04/2026)

### 5.1 O que é o TSS
TOTVS Service SOA — aplicação SOA que provê serviços de emissão e manutenção de documentos fiscais eletrônicos: NF-e, **CT-e**, NFS-e, CL-e, MDF-e, NFC-e, MDe, e troca de mensagens entre produtos homologados.

### 5.2 Rotina oficial — Manifesto do Destinatário (MDe)
- **Acesso:** Protheus → módulo Compras (SIGACOM) → Miscelânea → **Manifesto do Destino**
- **Web service usado:** `NFeDistribuicaoDFe` (mesmo da NF-e — o filtro de tipo de documento muda só os schemas retornados: `procCTe/resCTe` em vez de `procNFe/resNFe`)
- **Primeiro acesso:** dispara o Wizard de configuração — IP/porta do TSS + dados do certificado A1
- **Outras Ações → Sincronizar:** popula `SPED156` com todas as notas/CT-es contra o CNPJ (apenas sincroniza, não manifesta nem baixa XML)
- **Ciência da Operação:** libera download do XML (não conclui o processo)
- **Confirmação da Operação:** conclui pelo SEFAZ

### 5.3 Configuração CT-e específica (o que falta na CAPUL)
> "O JOB de processamento do CTe é o mesmo utilizado para a NFe e MDFe, mudando apenas a seção e a chamada do JOB no arquivo `.ini` do TSS que deverá ser feita através da criação de uma seção para o CTe."

Ou seja: criar uma **seção CT-e** no `tss.ini` e cadastrar a chamada do JOB. **Esse é o passo que precisa ser executado.**

### 5.4 Parâmetros TSS críticos (tabela `SPED000`)
| Parâmetro | Função | Valor recomendado |
|---|---|---|
| `MV_MDNSU` | Último NSU consultado (controle sequencial) | 0 inicial → SEFAZ devolve últimos 90 dias |
| `MV_MDAMB` | Ambiente | 1=Produção, 2=Homologação |
| `MV_MDVER` | Versão do leiaute | **1.00** (1.01 usa `NfeConsultaDest` descontinuado) |

### 5.5 Limites SEFAZ — NT 2014.002 (atenção)
- **20 consultas/hora** por chave de acesso ou NSU
- Ultrapassar → **erro 656 "Consumo indevido"** → **CNPJ bloqueado 1h**
- Quando `ultNSU == maxNSU`: aguardar 1h antes de nova consulta
- → Mesmo cuidado de proteção 5-camadas que a plataforma Fiscal já aplica para NF-e

### 5.6 Manutenção contínua do TSS
- Atualização do RPO (patches TOTVS)
- Atualização dos schemas XML (mudam regularmente)
- Atualização das URLs SEFAZ (mudam após contingências SVRS)

### 5.7 Links oficiais
- Manual de Configuração do TSS: https://tdn.totvs.com/download/attachments/128681294/TSS_Manual_de_Configuracao.pdf
- O que é o TSS: https://tdn.totvs.com/pages/releaseview.action?pageId=5271365
- Baixar CT-e via SIGACOM: https://centraldeatendimento.totvs.com/hc/pt-br/articles/17327237313047
- CT-e OS via TSS: https://centraldeatendimento.totvs.com/hc/pt-br/articles/360015997531
- Spec NT 2014.002 SEFAZ: https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=wLVBlKchUb4%3D

---

## 6. Caminhos viáveis para a plataforma Fiscal (revisados)

### Opção A (RECOMENDADA) — Equipe Protheus ativa o JOB CT-e no TSS
- **Como funciona**: criar seção CT-e no `tss.ini`, configurar JOB de processamento (mesmo fluxo de NF-e/MDF-e), rodar Manifesto do Destino (Sincronizar → Ciência → Confirmação) — caminho oficial TOTVS
- **Custo**: baixo (configuração feita pela equipe Protheus, sem desenvolvimento na plataforma Fiscal)
- **Risco**: baixo (rotina padrão TOTVS, mesma usada com sucesso para NF-e)
- **Cobertura**: a partir da ativação; SEFAZ devolve até 90 dias com `MV_MDNSU=0`
- **Status (25/04/2026)**: solicitação enviada à equipe Protheus para avaliação

### Opção B — Plataforma implementa `NFeDistribuicaoDFe` filtrando CT-e
- **Como funciona**: caso a Opção A seja inviável, plataforma Fiscal absorve a responsabilidade — chama o web service direto, mantém estado NSU em tabela própria, indexa por chave
- **Custo**: médio (estado NSU, fila BullMQ, proteção 5-camadas SEFAZ, monitoramento)
- **Risco**: médio (duplica responsabilidade que é do Protheus; certificado A1 fica em dois lugares)
- **Quando faz sentido**: só se a configuração TSS não puder ser feita

### Opção C — Tela de upload manual
- **Como funciona**: plataforma fornece tela para o setor fiscal subir XMLs recebidos por e-mail do emitente
- **Custo**: baixo (tela + validação)
- **Risco**: alto (não escala)
- **Uso típico**: fallback pontual para CT-es que sumiram do cache antes da entrada

---

## 7. Próximos passos

### 7.1 Pendentes na equipe Protheus (caminho oficial)
1. Avaliar viabilidade técnica da **Opção A** — configurar JOB CT-e no `tss.ini`
2. Confirmar versão do leiaute (`MV_MDVER=1.00` ou superior compatível)
3. Definir ambiente de validação (homologação primeiro)
4. Confirmar se `/xmlNfe` filtra `D_E_L_E_T_=' '` (premissa do filtro)

### 7.2 Pendentes no setor fiscal CAPUL
1. Levantar volume mensal de CT-es por filial (dimensiona necessidade de cache local na plataforma)
2. Decidir política de manifestação: Ciência automática? Confirmação manual?

### 7.3 Pendentes na plataforma Fiscal (após Opção A ativa)
1. Adaptar consulta CT-e para ler do mesmo `/xmlNfe` (já preparado, hoje retorna 404 — vai começar a retornar 200)
2. Atualizar UI para refletir origem `SPED156` ao invés de só SZR010 nos badges
3. Considerar tela de Manifestação na plataforma se setor fiscal quiser controle (em vez de ir no SIGACOM)

### 7.4 Apenas se Opção A for inviável (fallback Opção B)
1. Modelar tabela `fiscal.cte_distribuicao_dfe` (NSU por destinatário, chave, XML, status)
2. Worker BullMQ para sincronização contínua respeitando NT 2014.002
3. Reaproveitar proteção 5-camadas existente (rate limit, circuit breaker UF, limite diário, freio de mão)

---

## 8. Apêndice — chaves usadas na investigação

**NF-e da CMOC (cruzamento NF-e ↔ CT-e):**
```
52251226108898000703550020002512221295352310
```

**CT-e da LK Transportes (frete da NF-e acima):**
```
52251213086828000156570010000340801013012250
```
- Estado em SZR010: presente, **deletado lógico**, XML 8.843 bytes
- XML referencia a NF-e via `<infDoc><infNFe><chave>` (posição 4201)

**6 CT-es do fornecedor F12708 (série 005, lançadas 24/11/2025):**
```
35251141104296000410570050000037561574570326
35251141104296000410570050000037571587999617
35251141104296000410570050000037581743944567
35251141104296000410570050000037591288747629
35251141104296000410570050000037601668582282
35251141104296000410570050000037611591813614
```
- Todas em SF1010 ativas (`F1_STATUS='A'`)
- Todas em SZR010 com `D_E_L_E_T_='*'`
- Nenhuma em SPED156, SPED154, GZH010

---

*Última atualização: 25/04/2026*
