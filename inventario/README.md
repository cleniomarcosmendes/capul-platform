# 📦 Sistema de Inventário Protheus v2.18.1

**Status**: ✅ **PRODUCTION READY**
**Última Atualização**: 04/11/2025
**Arquitetura**: FastAPI + PostgreSQL + Docker

---

## 🚀 Início Rápido

### Pré-requisitos
- Docker & Docker Compose
- Git

### Instalação

```bash
# 1. Clonar repositório
git clone [url-do-repo]
cd Capul_Inventario

# 2. Iniciar sistema completo
docker-compose up -d

# 3. Acessar sistema
# Frontend: http://localhost/
# API Docs: http://localhost:8000/docs
# PgAdmin: http://localhost:5050
```

### Login Padrão
- **Admin**: admin / admin123
- **Operador**: clenio / 123456

---

## 📚 Documentação

### 📖 Índice Master
**[DOCUMENTACAO.md](DOCUMENTACAO.md)** - Índice completo com 72 arquivos organizados

### 🎯 Documentos Principais
1. **[CLAUDE.md](CLAUDE.md)** - Guia principal do projeto (LEIA PRIMEIRO!)
2. **[DOCUMENTACAO.md](DOCUMENTACAO.md)** - Índice master (~9.900 linhas!)
3. **[docs/GUIA_USO_SISTEMA.md](docs/GUIA_USO_SISTEMA.md)** - Como usar
4. **[docs/GUIA_TECNICO_DESENVOLVEDOR_v4.2.md](docs/GUIA_TECNICO_DESENVOLVEDOR_v4.2.md)** - Guia técnico

### 📝 Últimas Atualizações
- **v2.18.1** (04/11) - [IMPLEMENTACAO_RELATORIOS_INDIVIDUAIS_v2.18.1.md](IMPLEMENTACAO_RELATORIOS_INDIVIDUAIS_v2.18.1.md) + [CORRECOES_CRITICAS_v2.18.1.md](CORRECOES_CRITICAS_v2.18.1.md) - Relatórios Individuais A/B + 6 Correções Críticas ⭐⭐⭐⭐⭐
- **v2.18.0** (04/11) - [IMPLEMENTACAO_TRANSFERENCIA_LOGICA_v2.18.0.md](IMPLEMENTACAO_TRANSFERENCIA_LOGICA_v2.18.0.md) - Sistema de Transferência Lógica (Otimização Fiscal com custo real B2_CM1) ⭐⭐⭐⭐⭐
- **v2.15.5** (28/10) - [CORRECAO_CRITICA_PRODUTOS_NAO_CONTADOS_v2.15.5.md](CORRECAO_CRITICA_PRODUTOS_NAO_CONTADOS_v2.15.5.md) - Correção crítica financeira ⚠️
- **v2.15.0** (26/10) - [PLANO_COMPARACAO_INVENTARIOS_v1.0.md](PLANO_COMPARACAO_INVENTARIOS_v1.0.md) - Comparação de inventários ⭐ NOVO
- **v2.14.0** (24/10) - [IMPLEMENTACAO_SYNC_PROTHEUS_v2.14.0.md](IMPLEMENTACAO_SYNC_PROTHEUS_v2.14.0.md) - Sincronização API Protheus ⭐ NOVO
- **v2.12.0** (21/10) - [ANALISE_MULTI_FILIAL_USUARIO_v2.12.0.md](ANALISE_MULTI_FILIAL_USUARIO_v2.12.0.md) - Sistema Multi-Filial ⭐ NOVO
- **v2.11.0** (19/10) - [PLANO_COUNTING_MOBILE_v2.11.0.md](PLANO_COUNTING_MOBILE_v2.11.0.md) - Sistema de Contagem Mobile ⭐ NOVO
- **v2.10.0** (15/10) - [PLANO_SNAPSHOT_INVENTARIO_v1.0.md](PLANO_SNAPSHOT_INVENTARIO_v1.0.md) - Sistema de Snapshot ⭐ NOVO

---

## ✨ Funcionalidades

### ⭐ Features Principais (v2.18)
- **Sistema de Transferência Lógica** - Otimização fiscal com ajustes contábeis e economia calculada com custo real (B2_CM1) ⭐⭐⭐⭐⭐
- **Relatórios Individuais A/B** - Visualização com impacto de transferências (11 colunas, color-coding, economia em R$) ⭐⭐⭐⭐⭐
- **Sistema de Comparação de Inventários** - Análise inteligente entre 2 inventários (Match Perfeito, Análise Manual, Transferências)
- **Sincronização API Protheus** - Hierarquia mercadológica automática (2.706 registros/segundo)
- **Sistema Multi-Filial** - Usuários acessam múltiplas lojas (tabela user_stores N:N)
- **Sistema de Contagem Mobile** - Interface touch-friendly com modo cego para OPERATORs
- **Sistema de Snapshot** - Congelamento imutável de dados do inventário
- **Proteção Financeira** - Validação crítica de produtos não contados (v2.15.5) ⚠️

### ✅ Sistema de Ciclos Multi-Contagem
- **3 Ciclos de Contagem** (1º, 2º, 3º)
- **Detecção Automática de Divergências** (recálculo inteligente)
- **Rastreamento de Múltiplos Lotes** (visualização detalhada por lote)
- **Triggers Automáticos** (campo status sempre sincronizado)
- **Validação Robusta** (dupla camada: Frontend + Backend)

### ✅ Gestão Completa
- **Multi-loja** com isolamento de dados por filial
- **Multi-usuário** com RBAC completo (ADMIN/SUPERVISOR/OPERATOR)
- **Sistema de Lotes** com rastreabilidade completa
- **Sistema de Relatórios** (CSV, Excel, JSON, Impressão)

### ✅ Interface Moderna
- **PWA** (Progressive Web App)
- **Responsivo** mobile-first + desktop
- **Scanner Simulado** (Ctrl+Shift+S)
- **Modais Acessíveis** (Bootstrap + ARIA)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│          FRONTEND (Nginx)               │
│  PWA HTML/JS/Bootstrap - Port 80        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        BACKEND (FastAPI)                │
│  Python 3.11 + SQLAlchemy - Port 8000   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      DATABASE (PostgreSQL 15)           │
│  Schema: inventario - Port 5432         │
└─────────────────────────────────────────┘
```

### Serviços Docker
- **frontend** (Nginx) - Interface Web
- **backend** (FastAPI) - API REST
- **postgres** (PostgreSQL) - Banco de Dados
- **redis** (Redis) - Cache/Sessions
- **pgadmin** (PgAdmin) - Admin DB

---

## 🔧 Desenvolvimento

### Comandos Úteis

```bash
# Status dos serviços
docker-compose ps

# Logs do backend
docker-compose logs -f backend

# Reiniciar backend
docker-compose restart backend

# Parar tudo
docker-compose down
```

### Estrutura do Projeto

```
Capul_Inventario/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── main.py      # Ponto de entrada
│   │   ├── models/      # SQLAlchemy models
│   │   ├── api/         # Endpoints REST
│   │   └── core/        # Config, DB, Security
│   └── requirements.txt
├── frontend/            # Interface Web
│   ├── inventory.html   # Tela principal
│   └── counting.html    # Tela de contagem
├── database/
│   └── init.sql        # Schema PostgreSQL
├── docs/               # Documentação (11 arquivos)
├── docker-compose.yml  # Orquestração
├── CLAUDE.md          # Guia principal
└── DOCUMENTACAO.md    # Índice master
```

---

## 🧪 Testes

### Teste Manual - Fluxo Completo

1. **Criar Inventário** → Status "Em Preparação"
2. **Liberar 1ª Contagem** → Status "Em Contagem"
3. **Contar Produtos** → Validação automática
4. **Encerrar 1ª Rodada** → Avança para Ciclo 2
5. **Repetir** para ciclos 2 e 3
6. **Finalizar** → Status "Encerrada"

### Validação Automática
- ✅ **Sem Contagens** → Modal informativo (não erro)
- ✅ **Com Contagens** → Avanço de ciclo permitido
- ✅ **Divergências** → Detectadas automaticamente

---

## 📊 Versões

### v2.15.5 (Atual) ⚠️ - 28/10/2025
- ✅ **BUG CRÍTICO FINANCEIRO**: Produtos não contados aparecem para recontagem
- ✅ Sincronização condicional `current_cycle` (backend)
- ✅ Filtro de recontagem incluindo `wasNotCounted` (frontend)
- ✅ Proteção contra ajustes de estoque incorretos (R$ 850/produto)

### v2.15.4 - 28/10/2025
- ✅ Sistema Multi-Filial 100% funcional
- ✅ 4 correções de queries (user_stores JOIN)
- ✅ Usuários multi-filial funcionando completamente

### v2.15.3 - 28/10/2025
- ✅ Correção de códigos de filial na importação
- ✅ Tabelas exclusivas com filial correta (SB2, SB8, SBZ)

### v2.15.0 - 26/10/2025
- ✅ Sistema de Comparação de Inventários (3 modalidades)
- ✅ Economia estimada com transferências
- ✅ Exportação completa (Excel, CSV, JSON)

### v2.14.0 - 24/10/2025
- ✅ Sincronização automática com API Protheus
- ✅ Performance: 2.706 registros/segundo
- ✅ 4 tabelas de hierarquia mercadológica

### v2.12.0 - 21/10/2025
- ✅ Sistema Multi-Filial (tabela user_stores)
- ✅ Login com seleção de filial
- ✅ HTTPS com certificados mkcert

### v2.11.0 - 19/10/2025
- ✅ Sistema de Contagem Mobile
- ✅ Modo cego para OPERATORs
- ✅ Interface touch-friendly

### v2.10.0 - 15/10/2025
- ✅ Sistema de Snapshot (imutabilidade)
- ✅ Triggers automáticos de status
- ✅ Rastreamento de lotes corrigido

Ver: [docs/CHANGELOG_CICLOS.md](docs/CHANGELOG_CICLOS.md)

---

## 🔌 Integrações

### Protheus ERP
Sistema preparado para integração com ERP Protheus via WebServices.

Ver: [docs/protheus_integration.md](docs/protheus_integration.md)

### API REST
Documentação completa da API disponível.

Ver: [docs/products_api_guide.md](docs/products_api_guide.md)

---

## 🐛 Troubleshooting

### Problema: Ciclo não avança
**Solução**: Verificar se há contagens no ciclo atual
**Docs**: [docs/TROUBLESHOOTING_CICLOS.md](docs/TROUBLESHOOTING_CICLOS.md)

### Problema: Modal de erro ao encerrar
**Solução**: Normal! É uma validação informativa
**Docs**: [UX_VALIDACAO_CONTAGENS.md](UX_VALIDACAO_CONTAGENS.md)

### Problema: Divergência não detectada
**Solução**: Verificar lógica de comparação
**Docs**: [CORRECAO_VALIDACAO_CONTAGENS.md](CORRECAO_VALIDACAO_CONTAGENS.md)

---

## 📈 Próximos Passos

- [ ] Integração Protheus WebServices
- [ ] Relatórios PDF/Excel
- [ ] Scanner QR Code real
- [ ] Dashboard Analytics avançado

---

## 👥 Equipe

**Desenvolvimento**: Claude Code + Equipe
**Documentação**: 72 arquivos | ~35.000 linhas
**Status**: Produção desde 05/10/2025 | v2.15.5 desde 28/10/2025

---

## 📞 Suporte

- **Documentação**: [DOCUMENTACAO.md](DOCUMENTACAO.md)
- **Troubleshooting**: [docs/TROUBLESHOOTING_CICLOS.md](docs/TROUBLESHOOTING_CICLOS.md)
- **GitHub Issues**: [Reportar problema]

---

## 📄 Licença

[Definir licença do projeto]

---

**Sistema de Inventário Protheus v2.15.5** - Robusto, Profissional e Pronto para Produção! 🚀
