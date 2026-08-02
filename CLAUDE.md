# CLAUDE.md

Orientacoes para o Claude Code ao trabalhar neste repositorio.

## Status do Projeto

**Capul Platform v1.0** - **PRODUCAO** *(Março/2026)*

### Arquitetura

Plataforma corporativa modular com microservicos independentes:

```
                      Internet
                         |
                    [ Nginx :443 ]
                    SSL Termination
                   /    |    |    \
                  /     |    |     \
            [Hub]  [Auth GW]  [Gestao TI]  [Inventario]
            :5170   :3000      :3001/:5173   :8000/:5174
               \      |        /       /
                \     |       /       /
              [ PostgreSQL :5432 ]
              capul_platform DB
              schemas: core | gestao_ti | inventario
                         |
                    [ Redis :6379 ]
```

### Servicos

| Servico | Stack | Porta | Schema DB |
|---------|-------|-------|-----------|
| **Nginx** | Nginx 1.27 | 80, 443 | - |
| **Auth Gateway** | NestJS 11 + Prisma 6 | 3000 | `core` |
| **Hub** | React 19 + Vite 7 | 5170 | - |
| **Gestao TI Backend** | NestJS 11 + Prisma 6 | 3001 | `core` (RO) + `gestao_ti` |
| **Gestao TI Frontend** | React 19 + Vite 7 + Tailwind v4 | 5173 | - |
| **Inventario Backend** | FastAPI + Python 3.11 | 8000 | `inventario` |
| **Inventario Frontend** | React 19 + Vite 7 + Tailwind v4 | 5174 | - |
| **Logistica Backend** | NestJS 11 + Prisma 6 | 3003 | `logistica` (+ `core` RO) |
| **Logistica Frontend** | React 19 + Vite 7 + Tailwind v4 | 5177 | - |
| **PostgreSQL** | PostgreSQL 16 | 5432 | Multi-schema |
| **Redis** | Redis 7 | 6379 | Cache/sessoes |

---

## Modulos da Plataforma

### 1. Auth Gateway (`/auth-gateway`)
- Autenticacao centralizada JWT
- Gestao de usuarios, empresas e filiais
- Controle de acesso por modulo/role
- UNIFIED_AUTH: autenticacao unificada para todos os modulos

### 2. Hub (`/hub`)
- Portal de entrada da plataforma
- Navegacao entre modulos autorizados
- Dashboard inicial do usuario

### 3. Gestao TI / Workspace (`/gestao-ti`)
- Sistema completo de gestao de TI (Workspace multi-departamento)
- Chamados, contratos, projetos, CMDB
- 16 controllers, ~145 endpoints
- **SAC** (sobre o Workspace/Chamado, branch `feat/sac`): atendimento ao cliente
  com e-mail de entrada (poller IMAP supervisionado + triagem), e-mail de saida,
  respostas prontas, indicadores e SLA. Telas gateadas por funcionalidade
  (`SAC_TRIAGEM`/`SAC_INDICADOR`/`SAC_TEMPLATE`/`SAC_EMAIL_CONFIG`). Ver
  `docs/AVALIACAO_SAC_WORKSPACE.md` e `docs/PLANO_SAC_FASE3_EMAIL_ENTRADA.md`.
- Docs: `gestao-ti/docs/documentacao-tecnica-v1.md`

### 4. Inventario (`/inventario`)
- Sistema de inventario Protheus
- Contagem multi-ciclo, sincronizacao ERP
- Docs: `inventario/CLAUDE.md`

### 5. Configurador (`/configurador`)
- Configuracao da plataforma
- Gestao de usuarios e permissoes
- Atribuicao de modulos por usuario

### 6. Fiscal (`/fiscal`) *(em desenvolvimento — Abril/2026 — Onda 1 do Plano v2.0 completa; Fase 1 CT-e Distribuição distNSU completa em 05/05)*
- Consulta cadastral (CCC/Sintegra) por CNPJ/CPF + UF + Receita Federal + Vínculo Protheus (SA1/SA2)
- Consulta NF-e/CT-e por chave (SEFAZ direto; Onda 2 migra para SZR → SPED156 → SEFAZ via Protheus)
- Cruzamento cadastral **movimento-based 2×/dia** (12:00 + 06:00 D+1) dentro da janela de 24h de cancelamento NF-e
- **Proteção 5 camadas** contra bloqueio SEFAZ: dedup CNPJ + rate 20 req/min + circuit breaker UF + limite diário 2.000/dia + freio de mão
- Tela `/operacao/limites` com política SEFAZ escrita + widget consumo tempo real
- Tela `/divergencias` para resolver discrepâncias Protheus × SEFAZ
- Cliente HTTP Protheus resolvido dinamicamente via `core.integracoes_api_endpoints` (Configurador)
- Schema Prisma: `fiscal` (multi-schema com core read-only) + tabela `limite_diario`
- Certificado A1: gestão no **Configurador** (não no Fiscal)
- Docs: `docs/PLANO_MODULO_FISCAL_v2.0.md` (plano mestre), `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` (formais)
- **Regra critica**: NUNCA disparar consultas SEFAZ em loop ou cron nao supervisionado — risco de bloqueio do CNPJ da CAPUL (ver `memory/feedback_sefaz_nunca_em_loop.md`)

### 7. Logistica / Entregas (`/entregas`) *(em desenvolvimento — Fase 1a/1b + Supervisores/RDV e gestão de Frota; Jul/2026)*
- Entregas domiciliares do supermercado (Unaí/MG): cadastro de entrega (balcao), montagem de viagem, frota, romaneio/etiquetas, painel
- **Supervisores/RDV**: planejamentos + workflow de aprovação do coordenador + fechamento mensal (prestação de contas de representantes). Hierarquia: **Sup. de Departamento → Coordenador → Supervisor de Área**. Visita: rótulo contextual (planejar × registrar). **App = execução** (o planejamento é feito no desktop; a lista do app pede `escopo=meus` e traz só o RDV do próprio usuário).
- **⭐ RDV — as 4 regras de integridade (onda 31/07–01/08, `40db4ac`..`8866090`)**, que valem para qualquer mexida futura no módulo:
  1. **Planejar ≠ executar.** Montar o roteiro é do time (o aprovador inclui/altera/exclui item na aprovação), mas **enviar, liberar para execução, apontar visita e concluir são atos do DONO** (ADMIN é escape hatch de suporte).
  2. **Quem decide é quem NÃO lançou.** Aprovar o próprio lançamento é barrado; **contestar** o próprio segue livre (é ato contra o lançamento). A despesa que a autoridade lança no RDV de outro nasce PENDENTE e **quem confere é o representante** — a conta é dele. "Nasce aprovada" só quando a autoridade lança no RDV **dela**.
  3. **A decisão vale para o valor decidido.** Editar valor/tipo/data/veículo de despesa decidida devolve para PENDENTE; depois de decidido só a autoridade apaga (despesa, adiantamento e comprovante); `editar`/`remover` respeitam o **fechamento do mês**, como `lançar` já fazia. Quem não lançou **não altera o valor**.
  4. **Adiantamento é lançado por quem aprova** — auto-serviço encerrado em 01/08, inclusive no desktop. Ninguém lança o próprio (nem o coordenador); só APROVADO entra no saldo.
- **Veículo na despesa do RDV**: cadastro do veículo aponta o **representante responsável** (coordenador OU supervisor de área, validado contra a Equipe e gravado em chapa `E00000`) → o planejamento **sugere** esse carro → a despesa **herda** e pode trocar. Categoria VEÍCULO **exige** veículo — antes o combustível do RDV nascia sem carro e sumia de Custos da Frota.
- **Geolocalização de campo (Fase A)**: locais do cliente (`LocalCliente`) aprendidos das marcações de campo (consolidação por medóide, robusta a outlier) — o Protheus não tem esse dado. **SEDE** (visita técnica → tipo PROPRIEDADE) × **SILO/ponto de entrega** (entrega de ração rural → tipo ENTREGA) são locais distintos; entrega urbana não gera geo. "Ver no mapa" usa a coordenada consolidada. Gravar no Protheus = Fase C (futura). Ver `memory/project_geo_local_cliente.md`
- **Despesa com vários comprovantes** (foto/PDF, até 5): tabela `anexo_despesa` (cofre/MinIO), padrão em supervisor + frota, web + app, convivendo com o comprovante único legado. Ver `memory/project_despesa_multi_anexo.md`
- **Gestão de Frota**: saída de veículos, adiantamento/acerto de viagem, manutenção, linha do KM, custos/análise (custo de frota restrito a GESTOR_FROTA/ADMIN). Saída e retorno aceitam **data/hora informada** (lançamento retroativo de quem saiu às pressas; teto de 7 dias, futuro barrado) — `criadoEm` segue sendo o carimbo de *quando foi registrado* e `fechadoPorId`/`fechadoEm` registram **quem fechou** a viagem.
- **Geocode** com fallback graduado rua→bairro→município (cidade pequena) + botão "Recalcular localizações" em Montar rota. A precisão de cada parada é exibida na montagem (o fallback de município fica a ~1,2 km e reordenava a rota), e o operador **corrige a coordenada arrastando o pin** — gravado no **cache de geocode** (`fonte=MANUAL`), então vale para as próximas entregas no mesmo endereço e sobrevive ao recálculo. Mapa da rota com pins numerados a partir da filial.
- Backend NestJS 11 + Prisma 6 (schema `logistica` + `core` read-only via `$queryRaw`), porta 3003, prefixo `/api/v1/logistica`
- Frontend React 19 + Vite 7, base `/entregas/`, porta 5177; app entregador/supervisor em Expo (`logistica/app`)
- Escopo por **filial** (entregas/veiculos/viagens/cadastros — filiais sao cidades diferentes). No RDV, o **ADMIN** tem seletor de filial nas abas Equipe e Planejamentos (padrão: a filial dele) — `filialAlvo` honra o parâmetro só para ADMIN e **ignora** para os demais; **Gestor de Entregas é papel de FILIAL** (só ADMIN é global; GESTOR_FROTA cross-filial só p/ veículos). RBAC: `OPERADOR_ENTREGA`/`GESTOR_ENTREGA`/`GESTOR_FROTA`/`REGISTRADOR_FROTA`/`COORDENADOR`/`SUPERVISOR`/`SUPERVISOR_FROTA` (ADMIN sempre)
- **Supervisor de Departamento** (`SUPERVISOR_FROTA`, Jul/2026): responde só pelos veículos do(s) seu(s) departamento(s) — viagens/acerto/despesas/custo escopados por departamento (derivado de `veiculo.supervisorId`); distinto do `GESTOR_FROTA` (frota inteira, decisões estratégicas). Ver `memory/project_supervisor_departamento_frota.md`
- Cliente Protheus (SA1) por matricula/telefone/nome via `core.integracoes_api_endpoints` (interino reusa `getLimite`; ver `docs/SOLICITACAO_PROTHEUS_enderecos_SA1.md`)
- Suite Jest + logging pino + auditoria de migrations (hardening da Fase 1a)
- **Fase 1b** (app entregador + prova de entrega/cofre + device-sessions): plano em `C:\Arquivos-de-projeto\clenio\Sistema de Rota\007_Fase1b_Plano_PRs.md`. PR 1b.1 (device-sessions no auth-gateway) feito em branch `feat/device-sessions`
- Docs/decisoes: `C:\Arquivos-de-projeto\clenio\Sistema de Rota\` (002 spec, 003 adendo, 004 Fase1a, 007 Fase1b) + `memory/project_modulo_entregas_proximo.md`

---

## Comandos Essenciais

```bash
# Docker Compose (raiz)
docker compose up -d                    # Iniciar tudo
docker compose ps                       # Status
docker compose logs -f <service>        # Logs
docker compose down                     # Parar

# Rebuild servico especifico
docker compose build gestao-ti-backend
docker compose up -d gestao-ti-backend

# Databases
docker compose exec gestao-ti-backend npx prisma migrate deploy
docker compose exec gestao-ti-backend npx prisma db seed
docker compose exec auth-gateway npx prisma migrate deploy
docker compose exec auth-gateway npx prisma db seed
```

### Acessos

| Servico | URL | Credenciais |
|---------|-----|-------------|
| Hub | https://localhost/ | - |
| Gestao TI | https://localhost/gestao-ti/ | admin |
| Inventario | https://localhost/inventario/ | admin/admin123 |
| Fiscal | https://localhost/fiscal/ | admin (role ADMIN_TI) |
| Logistica | https://localhost/entregas/ | role OPERADOR_ENTREGA/GESTOR_ENTREGA |
| PgAdmin | http://localhost:5050 | Ver .env |
| API Docs (Inventario) | http://localhost:8000/docs | - |

---

## Estrutura do Repositorio

```
capul-platform/
├── .env                    # Variaveis de ambiente globais
├── docker-compose.yml      # Orquestracao de containers
├── nginx/                  # Proxy reverso + SSL
│   ├── nginx.conf
│   └── certs/              # Certificados SSL
├── auth-gateway/           # Autenticacao centralizada
│   ├── prisma/schema.prisma
│   └── src/
├── hub/                    # Portal de entrada
│   └── src/
├── gestao-ti/              # Modulo Gestao de TI
│   ├── backend/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   ├── frontend/
│   │   └── src/
│   └── docs/               # Documentacao tecnica
├── inventario/             # Modulo Inventario
│   ├── backend/
│   └── frontend/
├── configurador/           # Modulo Configurador
│   └── ...
└── fiscal/                 # Modulo Fiscal (em desenvolvimento)
    ├── backend/            # NestJS 11 + Prisma 6 (schema fiscal)
    │   ├── prisma/schema.prisma
    │   └── src/
    │       ├── sefaz/      # Clients NFeDistribuicaoDFe / CCC / CTe
    │       ├── cadastro/   # Consulta cadastral + Receita Federal
    │       ├── nfe/, cte/  # Parsers + geracao DANFE/DACTE
    │       └── cruzamento/ # BullMQ workers + scheduler
    └── frontend/           # React 19 + Vite 7 + Tailwind v4
```

---

## Autenticacao Unificada

### Fluxo JWT

1. Login via Auth Gateway (`POST /api/v1/auth/login`)
2. Retorna `{ accessToken, refreshToken }`
3. JWT payload inclui modulos e roles:
   ```typescript
   {
     sub: string,          // userId
     email: string,
     nome: string,
     empresaId: string,
     filialId: string,
     modulos: [
       { codigo: 'GESTAO_TI', role: 'ADMIN' },
       { codigo: 'INVENTARIO', role: 'ADMIN' },
       { codigo: 'CONFIGURADOR', role: 'ADMIN' }
     ]
   }
   ```
4. Cada modulo valida JWT com mesmo `JWT_SECRET`
5. Access token: 15min | Refresh token: 7 dias

### UNIFIED_AUTH

Variavel de ambiente que habilita autenticacao unificada:
- `UNIFIED_AUTH=true`: Inventario usa `core.usuarios` via JWT do Auth Gateway
- `UNIFIED_AUTH=false`: Inventario usa tabela propria `inventario.users` (legado)

---

## Roles por Modulo

### Gestao TI (9 roles)
| Role | Descricao |
|------|-----------|
| ADMIN | Administrador do sistema |
| GESTOR_TI | Gestor de TI |
| TECNICO | Tecnico de suporte |
| DESENVOLVEDOR | Desenvolvedor |
| USUARIO_FINAL | Usuario comum |
| MANUTENCAO | Manutencao |
| INFRAESTRUTURA | Infraestrutura |
| USUARIO_CHAVE | Usuario-chave de projetos |
| TERCEIRIZADO | Analista externo com acesso restrito a projetos vinculados |

### Inventario (3 roles)
| Role | Descricao |
|------|-----------|
| ADMIN | Administrador |
| SUPERVISOR | Supervisor |
| OPERATOR | Operador |

### Configurador (3 roles)
| Role | Descricao |
|------|-----------|
| ADMIN | Administrador |
| OPERADOR | Operador |
| VIEWER | Visualizador |

---

## Diretrizes de Desenvolvimento

1. **Multi-schema**: Cada modulo usa seu schema PostgreSQL isolado
2. **JWT compartilhado**: Mesmo `JWT_SECRET` para todos os backends
3. **Schema core read-only**: Gestao TI nao escreve no schema core
4. **Store/Filial context**: Operacoes requerem filial do usuario
5. **Transacoes**: Usar sessoes com rollback em erros
6. **Seguranca**: Validar inputs, sanitizar erros
7. **Commits**: Descritivos, changelog atualizado

---

## Documentacao

### Por Modulo
- **Auth Gateway**: `auth-gateway/README.md`
- **Gestao TI**: `gestao-ti/docs/documentacao-tecnica-v1.md`
- **Inventario**: `inventario/CLAUDE.md`

### Roteiros e Procedimentos
- **Roteiro de Finalizacao**: `docs/ROTEIRO_FINALIZACAO.md` — Procedimento padrao pos-desenvolvimento (documentacao + commits + verificacao). Invocar com: `"Execute roteiro completo: ETAPA 0 + ETAPA 1 + ETAPA 2"`

### Este Arquivo
Este arquivo serve como ponto de entrada para o Claude Code entender a estrutura geral da plataforma e navegar entre os modulos.

---

*Ultima atualizacao: 01/08/2026*
