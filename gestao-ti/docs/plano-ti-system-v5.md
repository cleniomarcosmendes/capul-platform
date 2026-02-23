# Plano de Desenvolvimento — Plataforma Corporativa Capul Systems
# Versão 5.0.2

---

## 1. Análise da Necessidade

### 1.1 Contexto Geral

A empresa é um conglomerado com múltiplos CNPJs (filiais), cada uma com departamentos distintos. O departamento de T.I. atua como um prestador de serviços interno e precisa de um sistema unificado para medir, controlar e demonstrar o valor das suas operações ao planejamento estratégico da empresa.

A empresa já possui um **Sistema de Inventário de Estoque** em homologação (FastAPI + HTML/Bootstrap + PostgreSQL). Para evitar multiplicação de logins e cadastros, optou-se por construir uma **Plataforma Corporativa** onde todos os sistemas compartilham uma base comum (login único, cadastro unificado de filiais e usuários, controle de acesso por módulo).

### 1.2 Visão da Plataforma

```
┌─────────────────────────────────────────────────────────────────┐
│                   PLATAFORMA CAPUL SYSTEMS                      │
│                                                                 │
│  ┌──────────┐   Um login        ┌────────────────────────────┐  │
│  │ Portal   │   Um cadastro     │  Módulos:                  │  │
│  │ Hub      │   de usuários     │  📦 Inventário (existente) │  │
│  │ (login + │   Um cadastro     │  🖥️ Gestão de T.I. (novo) │  │
│  │ seleção) │   de filiais      │  🔮 Futuros módulos...     │  │
│  └──────────┘                   └────────────────────────────┘  │
│                                                                 │
│  Banco: PostgreSQL único com schemas separados                  │
│  Core: Entidades compartilhadas (filiais, usuários, auth)       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Módulos da Plataforma

| Módulo | Status | Tecnologia Backend | Tecnologia Frontend |
|--------|--------|-------------------|-------------------|
| **Inventário de Estoque** | Em homologação | FastAPI (Python) + SQLAlchemy | HTML + JS + Bootstrap 5 (PWA) |
| **Gestão de T.I.** | Em planejamento | NestJS (TypeScript) + Prisma | React + TypeScript + Shadcn/ui |
| **Futuros módulos** | — | A definir | React + TypeScript (padrão) |

**Nota sobre UI:** No futuro, o módulo de Inventário será migrado gradualmente para React + Shadcn, unificando a experiência visual. Até lá, o Portal Hub é o ponto de entrada comum e cada módulo tem sua interface própria.

### 1.4 Sistema de Gestão de T.I. — Cinco Pilares

O módulo de Gestão de T.I. abrange **cinco pilares** operacionais:

| Pilar | Escopo | Medição Principal |
|-------|--------|-------------------|
| **Suporte (Software + Hardware)** | Atendimento a chamados em filas separadas por equipe, ordens de serviço | Quantidade de chamados por equipe/tipo, tempo de resolução |
| **Administrativo / Contratos** | Gestão de contratos, despesas de TI com rateio flexível | Evolução das despesas por mês e por tipo |
| **Sustentação do ERP** | Disponibilidade de sistemas, registro de paradas, fila própria de chamados | Uptime/downtime por filial e por sistema/módulo |
| **Projetos de TI** | Desenvolvimento de software, implantações, projetos de infraestrutura com sub-projetos | Horas + custos consolidados (projeto-pai + sub-projetos) |
| **Portfólio de Aplicações** | Inventário completo de softwares, módulos e licenças sob gestão do TI | Mapa de aplicações, licenças vencendo, custos com licenciamento |

---

## 2. Modelo de Equipes e Filas de Chamados

O departamento de T.I. é composto por **equipes distintas**, cada uma com sua **atividade FIM** e sua **fila própria de chamados**.

**Princípios fundamentais:**

1. Cada equipe possui sua **fila isolada** de chamados.
2. Um técnico vê **somente a fila das equipes que pertence**.
3. Chamados podem ser **transferidos entre equipes** (com motivo e histórico completo).
4. O **usuário final escolhe a equipe destino** ao abrir o chamado.
5. Equipes são **dinâmicas** — o administrador pode criar novas equipes sem alteração de código.
6. Algumas equipes podem ser **internas** (não visíveis ao usuário final para abertura de chamado).
7. Todo chamado tem **visibilidade**: PÚBLICO ou PRIVADO (ver seção 2.1).

### 2.1 Visibilidade de Chamados: PÚBLICO vs PRIVADO

O sistema de chamados é **unificado para todos os pilares** (Suporte, Sustentação, Portfólio, Projetos). O que diferencia quem pode ver e interagir com um chamado é a **visibilidade**:

| Visibilidade | Quem pode abrir | Quem visualiza | Uso típico |
|-------------|-----------------|----------------|------------|
| **PÚBLICO** | Qualquer usuário do sistema | Solicitante vê o próprio chamado + equipe de TI responsável | Suporte ao usuário, solicitações de acesso, pedidos de software, dúvidas sobre sistemas |
| **PRIVADO** | Apenas membros de equipes de TI | Somente membros de equipes de TI com role adequada | Tarefas internas, manutenção preventiva, atualizações de infraestrutura, tarefas de projeto |

**Regras de acesso:**
- **PÚBLICO:** O solicitante vê apenas os chamados que ele abriu (status, histórico de mensagens, resolução). A equipe de TI vê todos os chamados da sua fila.
- **PRIVADO:** Invisível para o usuário final. Apenas membros de equipes de TI com permissão visualizam. Ideal para tarefas internas como "Atualizar firmware dos switches" ou "Renovar licenças Microsoft 365".

**Por que isso é importante:** Evita criar sistemas separados para cada pilar. Um único sistema de chamados com filtro de visibilidade atende todos os cenários:

| Pilar | Exemplo PÚBLICO | Exemplo PRIVADO |
|-------|----------------|-----------------|
| Suporte | "Impressora não funciona" | "Escalar para equipe de redes" |
| Sustentação ERP | "Campo novo no cadastro de fornecedores" | "Aplicar patch SAP SP15" |
| Portfólio | "Solicitar acesso ao Adobe" | "Renovar licenças Microsoft 365" |
| Projetos | — | "Bug no módulo de relatórios" (tarefa interna)

**Equipes iniciais (exemplos):**

| Equipe | Sigla | Atividade FIM | Visível ao Usuário Final |
|--------|-------|--------------|--------------------------|
| Suporte Software | SS | Dúvidas e problemas de sistemas | ✅ Sim |
| Suporte Hardware/Infra | SH | Manutenção de equipamentos | ✅ Sim |
| Sustentação do ERP | SERP | Saúde do ERP, disponibilidade | ✅ Sim |
| Desenvolvimento | DEV | Chamados internos da equipe dev | ❌ Não |

---

## 3. Portfólio de Aplicações (Catálogo de Softwares)

### 3.1 Estrutura Hierárquica

Cada software pode ter **módulos/componentes** (estrutura pai-filho):

```
SOFTWARE (nível macro)              MÓDULO/COMPONENTE
───────────────────────             ──────────────────
ERP-PROTHEUS (TOTVS)                ├── Financeiro
                                    ├── Faturamento
                                    ├── Fiscal
                                    ├── Compras
                                    ├── Estoque
                                    ├── Contábil
                                    ├── Folha de Pagamento
                                    └── Ponto Eletrônico

Microsoft 365                       ├── Outlook (E-mail)
                                    ├── Teams
                                    ├── SharePoint
                                    └── OneDrive

Sistema de Câmeras (CFTV)           ├── Módulo Gravação
                                    └── Módulo Monitoramento

Antivírus Corporativo               (sem módulos)
Sistema de Ponto Eletrônico         (sem módulos)
Backup Veeam                        (sem módulos)
```

### 3.2 Informações por Software/Módulo

**Cadastro do Software (nível macro):**

| Campo | Descrição |
|-------|-----------|
| Nome | Nome oficial do software |
| Fabricante/Fornecedor | Empresa responsável |
| Tipo | ERP, CRM, Segurança, Colaboração, Infraestrutura, Operacional, Outros |
| Criticidade | Crítico, Alto, Médio, Baixo |
| Versão atual | Versão instalada |
| Ambiente | On-premise, Cloud, Híbrido |
| URL de acesso | Link para o sistema (se web) |
| Equipe responsável | Vínculo com EquipeTI |
| Status | Ativo, Em implantação, Descontinuado, Homologação |
| Filiais onde está implantado | Multi-seleção de filiais |
| Observações | Notas gerais |

**Cadastro do Módulo (nível detalhe — opcional):**

| Campo | Descrição |
|-------|-----------|
| Nome | Nome do módulo |
| Descrição | O que o módulo faz |
| Status | Ativo, Em implantação, Desativado |
| Filiais onde está ativo | Pode ser diferente do software-pai |
| Versão | Se diferente do software-pai |
| Observações | Notas específicas |

### 3.3 Gestão de Licenças de Software

Cada software pode ter **uma ou mais licenças** ao longo do tempo. A licença é o registro que controla quantidade, modelo, valor, vigência e renovação. Todos os campos são **não obrigatórios**.

**Campos da Licença:**

| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| Modelo de licença | Subscrição, Perpétua, Por usuário, Por estação, OEM, Free/Open Source, SaaS, Outro | Não |
| Quantidade | Número de licenças contratadas | Não |
| Valor total | Custo total da licença nesta vigência | Não |
| Valor unitário | Custo por licença (calculado ou informado) | Não |
| Data início | Início da vigência | Não |
| Data vencimento | Fim da vigência — dispara alertas de renovação | Não |
| Chave/Serial | Chave de ativação (campo sensível, visível apenas para ADMIN e GESTOR_TI) | Não |
| Fornecedor | De quem comprou (pode ser diferente do fabricante do software) | Não |
| Contrato vinculado | Link com contrato do módulo de Contratos (se houver) | Não |
| Observações | Notas livres | Não |
| Status | Ativa, Inativa, Vencida | Automático |

**Regras de negócio:**

| Regra | Descrição |
|-------|-----------|
| RN-LIC-01 | Alerta de vencimento: sistema notifica 30, 15 e 7 dias antes |
| RN-LIC-02 | Renovar: Cria nova licença e marca anterior como Inativa. Histórico preservado |
| RN-LIC-03 | Não renovar: Desativa manualmente. Software pode continuar ativo (licença perpétua) |
| RN-LIC-04 | Status automático: Vencimento expirado sem renovação → status "Vencida" |
| RN-LIC-05 | Vínculo opcional com contrato do módulo de Contratos |
| RN-LIC-06 | Licenças não são excluídas — são inativadas (preserva histórico) |
| RN-LIC-07 | Campo Chave/Serial visível apenas para ADMIN e GESTOR_TI |
| RN-LIC-08 | Ao renovar, sistema sugere copiar dados da licença anterior |

### 3.4 Conexões com Outros Módulos

| Módulo | Conexão | Exemplo |
|--------|---------|---------|
| **Contratos** | Software/módulo vinculado a contrato(s) | "PROTHEUS" → Contrato de Sustentação nº 045 |
| **Chamados** | Chamado pode referenciar um software/módulo | Chamado sobre erro no módulo Fiscal |
| **Sustentação** | Paradas podem ser por software/módulo | Indisponibilidade do Faturamento na Filial 02 |
| **Projetos** | Projeto de implantação de software/módulo | Projeto: "Implantação módulo Compras" |
| **Ativos** | Software instalado em ativos (servidores) | "PROTHEUS" no servidor SRV-PROD-01 |
| **Licenças** | Controle de vencimento e renovação | 45 licenças vencendo em 28/02/2026 |

### 3.5 Dashboard do Portfólio

- Mapa de aplicações por tipo e criticidade.
- Cobertura por filial.
- Softwares por equipe responsável.
- Top softwares com mais chamados.
- **Licenças vencendo** nos próximos 30/60/90 dias.
- **Custo total anual com licenças.**
- Evolução do custo por renovação.
- Softwares com contratos vencendo.

---

## 4. Projetos com Sub-Projetos (Hierarquia até 3 Níveis)

### 4.1 Conceito

Projetos de TI podem conter **sub-projetos** com vida própria.

**Hierarquia suportada: até 3 níveis**

```
NÍVEL 1 — Projeto-Pai
├── NÍVEL 2 — Sub-projeto
│   ├── NÍVEL 3 — Sub-sub-projeto
│   └── NÍVEL 3 — Sub-sub-projeto
├── NÍVEL 2 — Sub-projeto
│   └── NÍVEL 3 — Sub-sub-projeto
└── NÍVEL 2 — Sub-projeto (sem filhos)
```

### 4.2 Modo Simples vs. Modo Completo

Cada sub-projeto é **configurável** individualmente:

| Característica | Modo Simples | Modo Completo |
|----------------|-------------|---------------|
| Timeline de atividades | ✅ | ✅ |
| Cotações | ✅ | ✅ |
| Custos (previsto/realizado) | ✅ | ✅ |
| Documentos/Anexos | ✅ | ✅ |
| Status | ✅ | ✅ |
| Membros/Equipe | ❌ Herda do pai | ✅ Equipe própria (RACI) |
| Fases com gates de aprovação | ❌ | ✅ |
| Board Kanban | ❌ | ✅ |
| Riscos e Dependências | ❌ | ✅ |
| Apontamento de horas | ❌ | ✅ |

O modo pode ser **alterado** a qualquer momento (simples → completo).

### 4.3 Consolidação de Custos

Custos fluem de baixo para cima na hierarquia. Cada nível mostra: custo próprio, custo dos filhos, custo total, previsto vs. realizado.

### 4.4 Regras de Hierarquia

| Regra | Descrição |
|-------|-----------|
| RN-PROJ-HIE-01 | Máximo 3 níveis de profundidade |
| RN-PROJ-HIE-02 | Um sub-projeto pertence a exatamente um projeto-pai |
| RN-PROJ-HIE-03 | Modo (simples/completo) é configurável individualmente |
| RN-PROJ-HIE-04 | Modo pode ser alterado de simples para completo a qualquer momento |
| RN-PROJ-HIE-05 | Alteração de completo para simples: alerta se há dados que serão ocultados (dados não são excluídos) |
| RN-PROJ-HIE-06 | Custos consolidam automaticamente de baixo para cima |
| RN-PROJ-HIE-07 | Status do pai: calculado automaticamente ou definido manualmente |
| RN-PROJ-HIE-08 | Não é possível excluir sub-projeto que tenha filhos |
| RN-PROJ-HIE-09 | Projeto-pai e sub-projetos compartilham o mesmo contrato vinculado |
| RN-PROJ-HIE-10 | Timeline do pai mostra atividades consolidadas com filtro por sub-projeto |

---

## 5. Benchmark — Funcionalidades por Pilar

### 5.1 Suporte

- Portal de autoatendimento com seleção de equipe destino.
- Filas separadas por equipe (padrão ServiceNow, Jira, Freshservice).
- **Visibilidade por chamado:** PÚBLICO (usuário final abre e acompanha) ou PRIVADO (tarefas internas entre equipes de TI).
- Categorização por tipo/software/módulo do Portfólio.
- SLA por prioridade/equipe.
- Workflow: Abertura → assumir → transferir técnico → transferir equipe → sub-chamado → resolver → fechar.
- Chamados vinculados (Parent-Child).
- Ordem de Serviço para visitas externas.
- Registro retroativo.
- Base de conhecimento.
- CSAT.

### 5.2 Contratos

- Cadastro com tipologia e ciclo de vida.
- Alertas de vencimento, renovação, reajuste.
- Rateio flexível por centro de custo (5 modalidades).
- Parcelas por entrega (milestones).
- Vinculação com software/módulo e licenças do Portfólio.
- Vinculação com projetos.
- Dashboard de despesas TI.

**Modalidades de Rateio:**

| Modalidade | Descrição |
|-----------|-----------|
| Percentual customizado | Cada CC recebe percentual definido |
| Valor fixo | Cada CC tem valor fixo |
| Proporcional a critério | Baseado em parâmetro variável (ex: nº estações) |
| Igualitário | Divide igualmente |
| Sem rateio (integral) | 100% para um único CC |

### 5.3 Sustentação do ERP

- Registro de paradas vinculadas ao software/módulo do Portfólio.
- Classificação de impacto: total ou parcial.
- Disponibilidade por filial e por módulo.
- Cálculo automático de uptime/downtime.
- Fila própria de chamados da equipe de Sustentação (PRIVADO para manutenções internas, PÚBLICO para solicitações de usuários).

### 5.4 Projetos de TI

- Tipos: Desenvolvimento interno, Implantação terceiro, Infraestrutura.
- Hierarquia até 3 níveis com modo configurável.
- Fases customizáveis com gates de aprovação.
- RACI, Kanban, apontamento de horas.
- Cotações comparativas.
- Consolidação de custos.
- Vinculação com Portfólio e Contratos.

### 5.5 Portfólio de Aplicações

- Cadastro hierárquico: Software → Módulos.
- Gestão de licenças com renovação e alertas.
- Mapa de implantação por filial.
- Vinculação cruzada com todos os módulos.
- Dashboard consolidado.

---

## 6. Funcionalidades Adicionais

- **Dashboard Executivo Unificado:** KPIs de todos os pilares.
- **Gestão de Ativos (CMDB simplificado):** Equipamentos vinculados a filial/usuário/software.
- **Catálogo de Serviços:** Selecionável ao abrir chamado.
- **Relatórios e Exportações.**
- **Notificações e Alertas.**
- **Controle de Acesso Multi-Filial e Multi-Equipe.**

---

## 7. Stack Tecnológica

### 7.1 Plataforma Core + Gestão de T.I.

| Camada | Tecnologia |
|--------|-----------|
| **Frontend Hub** | React + TypeScript + Vite + Shadcn/ui |
| **Frontend Gestão TI** | React + TypeScript + Vite + Shadcn/ui + Tailwind |
| **Gráficos** | Recharts |
| **Tabelas** | TanStack Table |
| **Backend Auth Gateway** | NestJS + Prisma (schema core) |
| **Backend Gestão TI** | NestJS + Prisma (schema gestao_ti + leitura do core) |
| **Banco** | PostgreSQL 16+ (schemas separados: core, inventario, gestao_ti) |
| **Cache** | Redis |
| **Auth** | JWT (login por username OU email) + Refresh Tokens com rotação |
| **Uploads** | MinIO (S3-compatible) |
| **Containers** | Docker + Docker Compose (unificado) |
| **Reverse Proxy** | Nginx (origem única, SSL, roteamento por path) |

### 7.2 Módulo Inventário (Existente)

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | HTML + JavaScript + Bootstrap 5 (PWA) |
| **Backend** | FastAPI (Python 3.11) + SQLAlchemy |
| **Auth** | Valida JWT do Auth Gateway (mesma chave secreta) |

**Roadmap de UI:** No futuro, o Inventário será migrado gradualmente para React + Shadcn, unificando a experiência visual com a Gestão de T.I.

---

## 8. Modelo de Dados Simplificado

### 8.1 Schema Core (Compartilhado)

- **Empresa** (razão social, CNPJ matriz, endereço)
- **Filial** (código, CNPJ, nome fantasia, endereço — evolução da tabela `stores` do inventário)
- **Departamento** (nome, filial)
- **CentroCusto** (código, nome, filial)
- **Usuario** (username, email, senha — login aceita ambos. Evolução da tabela `users`)
- **UsuarioFilial** (N:N — mesma lógica do `user_stores` do inventário)
- **ModuloSistema** (código: INVENTARIO, GESTAO_TI, etc.)
- **RoleModulo** (roles disponíveis por módulo)
- **PermissaoModulo** (qual usuário tem qual role em qual módulo)
- **RefreshToken** (tokens de autenticação com rotação)
- **SystemConfig** (configurações globais)
- **SystemLog** (logs de auditoria)

### 8.2 Schema Inventario (Existente — Sem Alteração Estrutural)

- **products**, **product_barcodes**, **product_prices**, **product_stores**
- **warehouses**
- **inventory_lists**, **inventory_items**, **inventory_items_snapshot**
- **inventory_lots_snapshot**, **inventory_sub_lists**, **inventory_sub_items**
- **countings**, **counting_lots**, **counting_lists**, **counting_list_items**
- **counting_assignments**, **closed_counting_rounds**
- **discrepancies**, **cycle_audit_log**, **lot_counting_drafts**
- **protheus_integrations**, **protheus_integration_items**
- **sb1010**, **sb2010**, **sb8010**, **sbm010**, **sbz010**, **slk010**, **da1010**, **szb010**, **szd010**, **sze010**, **szf010** (tabelas Protheus)

**Nota:** As tabelas `stores`, `users` e `user_stores` migram para o schema `core`. VIEWs de compatibilidade são criadas no schema `inventario` para manter as queries existentes do FastAPI funcionando durante a transição.

### 8.3 Schema Gestao_TI (Novo)

- **EquipeTI** (nome, sigla, cor, ícone, aceitaChamadoExterno, ordem, status)
- **MembroEquipe** (N:N Usuario ↔ EquipeTI, flag isLider)
- **Software** (nome, fabricante, tipo, criticidade, versão, ambiente, url, status, equipeResponsavel)
- **SoftwareModulo** (nome, descrição, status — filho de Software)
- **SoftwareFilial** (N:N Software ↔ Filial)
- **ModuloFilial** (N:N Módulo ↔ Filial)
- **SoftwareLicenca** (modelo, quantidade, valor, vigência, chave, fornecedor, status, contrato)
- **Chamado** (equipeAtual, softwareId, moduloId, prioridade, status, SLA, solicitante, técnico)
- **HistoricoChamado** (tipos: ABERTURA, ASSUMIDO, TRANSFERENCIA, COMENTARIO, RESOLVIDO, FECHADO, REABERTO)
- **OrdemServico** — agrupador para visitas
- **Contrato** (tipo, fornecedor, valor, vigência, softwareId)
- **CategoriaContrato**, **ParcelaContrato**, **ConfiguracaoRateio**, **ItemRateio**, **HistoricoRateio**
- **RegistroDisponibilidade** (softwareId, moduloId, tipo, impacto, início, fim)
- **Projeto** (nome, tipo, status, projetoPaiId, nivel, modo: simples/completo, softwareId, contrato)
- **FaseProjeto**, **MembroProjeto**, **ApontamentoHoras**, **AtividadeProjeto**
- **CotacaoProjeto**, **CustoProjeto**, **RiscoProjeto**, **DependenciaProjeto**, **AnexoProjeto**

---

## 9. Plano de Desenvolvimento por Fases

### Fase 0 — Plataforma Core + Migração Inventário (3-4 semanas)

**Escopo:**
- Criar schema `core` no banco PostgreSQL existente.
- Tabelas core: empresas, filiais, departamentos, centros_custo, usuarios, usuario_filiais, modulos_sistema, roles_modulo, permissoes_modulo, refresh_tokens, system_config, system_logs.
- Auth Gateway (NestJS): login (aceita username OU email), refresh token com rotação, logout, change-password, me, listar módulos do usuário.
- Portal Hub (React): tela de login, seleção de módulo, troca de filial, meu perfil.
- Migração: `inventario.stores` → `core.filiais`, `inventario.users` → `core.usuarios`, `inventario.user_stores` → `core.usuario_filiais`.
- VIEWs de compatibilidade no schema inventario.
- Ajustar FastAPI para validar novo JWT do Auth Gateway.
- Docker Compose unificado.

**Entregável:** Login único funcionando. Inventário acessível pelo Hub.

---

### Fase 1 — Fundação Gestão de T.I. (4 semanas) — Reduzida

**O que já existe do core (não precisa recriar):** Auth, Empresa, Filiais, Usuários, Permissões.

**Escopo:**
- Schema `gestao_ti` no banco.
- Backend NestJS da Gestão de TI (validação JWT + role GESTAO_TI).
- CRUD Departamentos e Centros de Custo (no core, se ainda não existir).
- CRUD Equipes de T.I. + Membros (no schema gestao_ti).
- Frontend React: Layout base, Sidebar, páginas de cadastro.
- Integração com Portal Hub.

**Entregável:** Gestão de TI acessível pelo Hub, cadastros organizacionais, equipes criadas.

---

### Fase 2 — Módulo Suporte (8 semanas)

**Escopo:**
- Abertura de chamados com seleção de equipe destino.
- **Visibilidade por chamado: PÚBLICO (qualquer usuário) ou PRIVADO (só equipes de TI).**
- Filas separadas por equipe.
- Workflow completo (incluindo transferência entre equipes).
- Ordens de Serviço.
- Dashboard por equipe.
- CSAT, Catálogo de Serviços.
- Campo software/módulo no chamado (texto livre até Fase 2B).

**Entregável:** Suporte com filas por equipe e visibilidade PÚBLICO/PRIVADO.

---

### Fase 2B — Portfólio de Aplicações + Licenças (5 semanas)

**Escopo:**
- Cadastro de Softwares (CRUD completo).
- Cadastro de Módulos por software (hierarquia pai-filho).
- Implantação por filial (quais softwares/módulos em cada filial).
- Gestão de Licenças: cadastro, renovação, inativação, histórico, alertas de vencimento.
- Dashboard do portfólio (mapa de aplicações, cobertura, criticidade, licenças vencendo, custo total).
- Integração retroativa com Chamados (selects alimentados pelo Portfólio).
- Sidebar: novo item "Portfólio de Aplicações".

**Justificativa para ser Fase 2B:** O Portfólio alimenta os selects de software/módulo nos chamados, contratos, sustentação e projetos. Construí-lo cedo permite que as fases seguintes já nasçam integradas.

**Entregável:** Inventário de aplicações com gestão de licenças.

---

### Fase 3 — Módulo Contratos (8 semanas)

**Escopo:**
- Contratos com todas as modalidades.
- Vinculação contrato ↔ software/módulo/licença do Portfólio.
- Rateio flexível (5 modalidades + simulação + histórico).
- Dashboard financeiro.

**Entregável:** Módulo financeiro com vínculo ao Portfólio.

---

### Fase 4 — Módulo Sustentação ERP (4 semanas)

**Escopo:**
- Registro de paradas vinculadas ao software/módulo do Portfólio.
- Disponibilidade por filial e por módulo.
- Dashboard de disponibilidade.
- Integração com fila de chamados da equipe de Sustentação.

**Entregável:** Sustentação com métricas por software/módulo.

---

### Fase 5 — Módulo Projetos de TI (12 semanas)

**Parte A (6 semanas):** Projetos base + hierarquia 3 níveis + modo simples/completo + fases + RACI + Kanban + Portfólio + Contratos.

**Parte B (6 semanas):** Cotações + consolidação de custos + riscos + dependências + dashboard hierárquico + fila de chamados internos do DEV.

**Entregável:** Projetos com sub-projetos e custos consolidados.

---

### Fase 6 — Consolidação (8 semanas)

**Escopo:**
- Dashboard executivo unificado.
- Ativos (CMDB) com vínculo a software do Portfólio.
- Base de conhecimento.
- Notificações completas.
- Relatórios avançados.
- Migração de dados Excel.
- Testes, documentação, treinamento.

**Entregável:** Sistema completo.

---

## 10. Estimativa de Prazo

| Fase | Duração | Acumulado |
|------|---------|-----------|
| **Fase 0 — Plataforma Core + Migração** | **3-4 semanas** | **4 semanas** |
| Fase 1 — Fundação Gestão TI | 4 semanas | 8 semanas |
| Fase 2 — Suporte | 8 semanas | 16 semanas |
| Fase 2B — Portfólio + Licenças | 5 semanas | 21 semanas |
| Fase 3 — Contratos | 8 semanas | 29 semanas |
| Fase 4 — Sustentação ERP | 4 semanas | 33 semanas |
| Fase 5 — Projetos (com sub-projetos) | 12 semanas | 45 semanas |
| Fase 6 — Consolidação | 8 semanas | 53 semanas |
| **Total estimado** | **~53 semanas (~13 meses)** | |

---

## 11. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Resistência dos usuários | Alto | Portal simples, treinamento, registro retroativo |
| Escopo crescente | Médio | Backlog priorizado, entregas incrementais |
| Duas linguagens (Python + TypeScript) | Médio | Auth Gateway centralizado, JWT compartilhado |
| Migração do auth do inventário | Médio | VIEWs de compatibilidade, rollback planejado |
| Complexidade do rateio flexível | Médio | Prototipar e validar com financeiro |
| Hierarquia de 3 níveis de projetos | Médio | Consolidação automática, testes rigorosos |
| Portfólio desatualizado | Médio | Vincular com contratos e licenças (alertas cruzados) |
| Duas UIs diferentes (Bootstrap vs Shadcn) | Baixo | Hub unifica entrada; migração gradual futura |

---

## 12. Diagrama de Integração

```
          ┌───────────────────────────────────────┐
          │      PORTFÓLIO DE APLICAÇÕES           │
          │  (Software → Módulos → Filiais)        │
          │  (Licenças → Renovações → Alertas)     │
          └──────┬──────────┬──────────┬───────────┘
                 │          │          │
    ┌────────────┘    ┌─────┘    ┌─────┘
    ▼                 ▼          ▼
┌─────────┐   ┌───────────┐  ┌──────────────┐
│ SUPORTE │   │ CONTRATOS │  │ SUSTENTAÇÃO  │
│(chamados│   │ (despesas, │  │ (uptime por  │
│por equi-│   │  rateio)   │  │  software/   │
│pe, SLA) │   │            │  │  módulo)     │
└────┬────┘   └─────┬──────┘  └──────────────┘
     │              │
     └──────┬───────┘
            ▼
    ┌───────────────┐
    │   PROJETOS    │
    │ (hierarquia   │
    │  3 níveis,    │
    │  custos       │
    │  consolidados)│
    └───────────────┘

    Todos conectados ao CORE:
    (Filiais, Usuários, Permissões, Auth)
```

---

## Controle de Versão do Documento

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | — | Versão inicial com 4 tópicos |
| 2.0 | — | Rateio flexível, projetos de infraestrutura |
| 3.0 | — | Equipes dinâmicas com filas separadas |
| 4.0 | — | Portfólio de Aplicações, sub-projetos 3 níveis |
| 4.1 | — | Gestão de Licenças de Software |
| 5.0 | — | **Plataforma Corporativa Unificada.** Incorpora decisão de plataforma única com inventário existente. Auth Gateway compartilhado (login por username OU email). Schema core + schemas por módulo. Migração inventário (Fase 0). Portal Hub. Permissões por módulo. Fase 1 reduzida de 6→4 semanas. Roadmap de migração visual do inventário para React. Alinhamento completo com arquitetura-plataforma-v2.1 e fase0-fase1-tecnico-v1.1. Resolve todos os 7 pontos da 1ª revisão técnica. |
| 5.0.1 | — | Nginx adicionado à stack tecnológica (2ª revisão técnica). |
| 5.0.2 | — | **Visibilidade de Chamados:** Conceito PÚBLICO/PRIVADO incorporado (seção 2.1). Chamado unificado para todos os pilares — PÚBLICO para solicitações de usuários finais, PRIVADO para tarefas internas de TI. Atualizado em Suporte (5.1), Sustentação (5.3) e Fase 2. |
