# Reunião Equipe Protheus — Integração xmlFiscal + cadastroFiscal

**Data**: segunda-feira, 14/04/2026
**Módulo**: Fiscal (CAPUL Platform)
**Objetivo**: Validar e ativar a integração do Módulo Fiscal com as APIs do Protheus
**Duração estimada**: 1h30

---

## 🎯 Objetivo da reunião

Confirmar que as **duas APIs REST** do Protheus (`/xmlFiscal` e `/cadastroFiscal`)
estão prontas para consumo pelo Módulo Fiscal, destravar a troca de
`FISCAL_PROTHEUS_MOCK=true` → `false` em homologação e depois produção.

Hoje o Módulo Fiscal está **100% operacional** usando um stub em memória
(`ProtheusXmlMock`) que simula as respostas do Protheus. Após esta reunião,
queremos começar a bater na API real.

---

## 👥 Participantes esperados

- **CAPUL**: Clenio (TI/Plataforma), responsável Fiscal (setor), gestor TI
- **Protheus**: desenvolvedor integração, analista fiscal (se aplicável)

---

## 📋 Agenda

| Tempo | Item | Responsável |
|---|---|---|
| 00:00 | Abertura e contexto (status atual do Módulo Fiscal) | Clenio |
| 00:05 | Demo rápida do Módulo Fiscal rodando com mock | Clenio |
| 00:15 | **Revisão do contrato** `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md` | Todos |
| 00:40 | Autenticação, URLs, ambientes (hom + prod) | Protheus |
| 00:55 | Códigos de erro e SLA | Protheus |
| 01:05 | Plano de cutover: mock → real | Clenio |
| 01:15 | Decisões e responsáveis | Todos |
| 01:25 | Próximos passos | Todos |

---

## 📦 O que a CAPUL leva para a reunião

1. **Especificação técnica completa** da integração esperada:
   - Arquivo: `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md`
   - Lista todos os endpoints, payloads, headers, códigos de erro
2. **Demo do Módulo Fiscal funcionando** com mock
   - URL: `https://localhost/fiscal/`
   - Login: admin / admin123
   - Demonstrar: consulta NF-e, CCC, badge TLS, OrigemBadge em modo mock
3. **Este documento** (roteiro de reunião)

---

## ✅ Checklist de confirmação (durante a reunião)

### Endpoints xmlFiscal (SZR010 + SZQ010)

- [ ] `GET /xmlFiscal/{chave}/exists` — verifica se XML já foi baixado
- [ ] `GET /xmlFiscal/{chave}` — retorna o XML completo + metadados
- [ ] `POST /xmlFiscal` — grava XML novo (NFe ou CTe) em SZR010/SZQ010
- [ ] Endpoints aceitam/retornam JSON conforme especificação?
- [ ] Campo `tipoDocumento` aceita `"NFE"` e `"CTE"`?
- [ ] Status de retorno: `GRAVADO` (201) e `JA_EXISTENTE` (200)?

### Endpoints cadastroFiscal (SA1010 + SA2010)

- [ ] `GET /cadastroFiscal?tipo=CLIENTE|FORNECEDOR&...` — listagem paginada
- [ ] `GET /cadastroFiscal/{cnpj}` — consulta por CNPJ
- [ ] Retorna vínculos em ambas as tabelas quando CNPJ existe nas duas?
- [ ] Filtros: `ativo`, `filial`, `desdeData`, `comMovimentoDesde`, paginação?

### Autenticação

- [ ] Qual mecanismo? (Basic Auth, Bearer token, mTLS, chave estática?)
- [ ] Rotação de credenciais: como é feita?
- [ ] Quem gerencia o segredo do lado da CAPUL?
- [ ] **Variável de ambiente** a usar: `PROTHEUS_API_AUTH=...`

### URLs por ambiente

- [ ] **Homologação**: `https://___________________________________`
- [ ] **Produção**: `https://___________________________________`
- [ ] Rede: é acessível a partir do WSL/Docker onde o Fiscal roda?
- [ ] Protocolo: HTTPS com certificado válido?
- [ ] **Variável de ambiente**: `PROTHEUS_API_URL=...`

### Códigos de erro

A API do Protheus deve retornar códigos estruturados no body. Nosso client já
mapeia os seguintes (ver `fiscal/backend/src/protheus/protheus-gravacao.helper.ts`):

- [ ] `VALIDATION_ERROR` (400) — dados inválidos
- [ ] `DATABASE_ERROR` (500) — banco Protheus falhou
- [ ] `TIMEOUT` (504) — demorou demais
- [ ] `UNAUTHORIZED` (401) — token inválido
- [ ] `NOT_FOUND` (404) — chave/CNPJ não encontrado
- [ ] `CONNECTION_REFUSED` — serviço fora
- [ ] **Qual formato do erro?** Esperamos `{ erro: string, mensagem: string, detalhe?: any }`

### SLA / timeout

- [ ] Tempo máximo esperado de resposta: ____ segundos
- [ ] Rate limit do lado Protheus: ____ req/min (se houver)
- [ ] Janela de manutenção: quando?
- [ ] Quem avisar em caso de indisponibilidade?

### Filiais

- [ ] Como identificamos a filial no payload POST? Campo `filial` (2 dígitos)?
- [ ] A CAPUL tem quantas filiais ativas hoje? Listagem?
- [ ] Diferenças por filial (estoque, centro de custo) afetam SZR010?

---

## 🔄 Plano de cutover (mock → real)

### Fase 1: Homologação (imediato após reunião)
1. Protheus publica endpoints de homologação
2. CAPUL configura `PROTHEUS_API_URL` apontando para HOM
3. Troca `FISCAL_PROTHEUS_MOCK=true` → `false` **apenas em dev local**
4. Roda bateria de testes: consulta 5 NF-es reais, verifica gravação SZR010
5. Valida retorno do `/cadastroFiscal` comparando com SQL direto no Protheus

### Fase 2: Produção (após homologação estável)
1. Agendamento de janela de deploy
2. Configura `PROTHEUS_API_URL` de produção + credenciais
3. Deploy do fiscal-backend
4. Smoke test: consulta 1 NF-e real, confirma gravação
5. Monitoramento intensivo primeiras 24h

### Rollback
- Se Fase 1 falhar: voltar `FISCAL_PROTHEUS_MOCK=true`, investigar, re-agendar
- Se Fase 2 falhar: mesmo rollback + escalonamento

---

## 🎯 Decisões necessárias (deixar registrado)

| Pergunta | Decisão |
|---|---|
| Quem mantém as credenciais do lado CAPUL? | ________________ |
| Ambiente de homologação fica aberto permanentemente? | ________________ |
| Frequência esperada de consultas (pico diário)? | ________________ |
| Logs de auditoria do lado Protheus serão enviados a onde? | ________________ |
| Há contrato de SLA formal ou informal? | ________________ |

---

## 📌 Follow-ups após a reunião

Criar ticket/task para cada item:

- [ ] Atualizar `PROTHEUS_API_URL` e `PROTHEUS_API_AUTH` nos `.env` de cada ambiente
- [ ] Trocar `FISCAL_PROTHEUS_MOCK=false` em HOM e validar
- [ ] Documentar credenciais em local seguro (não no git)
- [ ] Agendar cutover HOM → PRD
- [ ] Ajustar `docs/ROTEIRO_MIGRACAO_PRODUCAO.md` com endpoints reais
- [ ] Testar end-to-end: consulta SEFAZ → gravação Protheus → cache hit
- [ ] Confirmar que o OrigemBadge no frontend mostra corretamente os estados
  (cache hit verde, gravado verde, falha amarelo com retry)

---

## 📚 Anexo: contrato técnico resumido

### POST /xmlFiscal

**Request**:
```json
{
  "chave": "31260443214055000107550000254957611872343548",
  "tipoDocumento": "NFE",
  "filial": "01",
  "xml": "<nfeProc>...XML completo...</nfeProc>",
  "usuarioCapulQueDisparou": "admin@capul.com"
}
```

**Response sucesso**:
```json
{
  "status": "GRAVADO",
  "chave": "31260443214055000107550000254957611872343548",
  "filial": "01",
  "gravadoEm": "2026-04-14T10:30:00-03:00"
}
```

**Response erro**:
```json
{
  "erro": "VALIDATION_ERROR",
  "mensagem": "Chave já existe em SZR010 para outra filial",
  "detalhe": { "filialExistente": "02" }
}
```

### GET /xmlFiscal/{chave}/exists

**Response**:
```json
{ "existe": true, "filial": "01", "gravadoEm": "2026-04-10T14:22:00-03:00" }
```

### GET /xmlFiscal/{chave}

**Response**:
```json
{
  "chave": "...",
  "tipoDocumento": "NFE",
  "filial": "01",
  "xml": "<nfeProc>...</nfeProc>",
  "metadados": {
    "cnpjEmitente": "...",
    "numeroNF": "000025495",
    "serie": "000",
    "valorTotal": 12345.67,
    "gravadoEm": "2026-04-10T14:22:00-03:00",
    "usuarioGravacao": "admin@capul.com"
  }
}
```

### GET /cadastroFiscal?tipo=CLIENTE

**Response**:
```json
{
  "pagina": 1,
  "porPagina": 100,
  "total": 3452,
  "registros": [
    {
      "cnpj": "...",
      "uf": "MG",
      "razaoSocial": "...",
      "filial": "01",
      "codigo": "000123",
      "loja": "01",
      "bloqueado": false,
      "origem": "SA1010"
    }
  ]
}
```

> **Contrato completo**: ver `docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md`

---

## 🧪 Como testar rapidamente após a reunião

Depois que o endpoint de HOM estiver configurado:

```bash
# 1. Ajustar .env
docker compose exec fiscal-backend env | grep PROTHEUS

# 2. Configurar nova URL (editar .env ou docker-compose.yml)
# PROTHEUS_API_URL=https://protheus-hom.capul.com.br/api
# PROTHEUS_API_AUTH=Bearer xxx...
# FISCAL_PROTHEUS_MOCK=false

# 3. Restart
docker compose up -d fiscal-backend

# 4. Verificar modo saiu de mock
docker compose logs fiscal-backend | grep -i 'mock\|protheus'

# 5. Consultar uma NF-e via UI em https://localhost/fiscal/nfe
#    O OrigemBadge deve mostrar verde "Baixado da SEFAZ e gravado no Protheus"
#    e NÃO o banner amarelo tracejado de simulação.

# 6. Verificar no Protheus (SQL direto) se a linha foi gravada em SZR010
```

---

**Documento preparado em**: 12/04/2026
**Próxima revisão**: após a reunião, com respostas preenchidas
