# CLAUDE.md

Orientações para o Claude Code ao trabalhar neste repositório.

## Status do Projeto

**Sistema de Inventário Protheus v2.19.54** - **PRODUÇÃO** *(19/01/2026)*

### Arquitetura
- **Backend**: FastAPI (Python 3.11) + SQLAlchemy ORM
- **Banco**: PostgreSQL 15 (schema `inventario`)
- **Frontend**: HTML/JS vanilla + Bootstrap 5 (PWA)
- **Infra**: Docker Compose (backend, postgres, redis, pgadmin)
- **Segurança**: HTTPS (mkcert), JWT, RBAC (ADMIN/SUPERVISOR/OPERATOR)

### Features Principais
- Sistema de Ciclos Multi-Contagem (1º, 2º, 3º ciclos)
- Contagem Mobile e Desktop sincronizadas
- Sistema Multi-Filial com isolamento
- Sincronização com API Protheus
- Sistema de Snapshot (congelamento de dados)
- Relatórios (CSV, Excel, JSON, Impressão)
- Comparação entre Inventários
- Transferência Lógica (otimização fiscal)

---

## Comandos Essenciais

```bash
# Docker
docker-compose up -d          # Iniciar
docker-compose ps             # Status
docker-compose logs -f backend # Logs
docker-compose restart backend # Reiniciar
docker-compose down           # Parar

# Backend local
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
cd backend && pip install -r requirements.txt
cd backend && pytest
```

### Acessos
| Serviço | URL | Porta |
|---------|-----|-------|
| Frontend | http://localhost:8000/ | 8000 |
| API Docs | http://localhost:8000/docs | 8000 |
| PgAdmin | http://localhost:5050 | 5050 |
| Login | admin / admin123 | - |

---

## Estrutura do Projeto

```
backend/app/
├── main.py              # FastAPI app + endpoints principais
├── core/
│   ├── database.py      # Conexão PostgreSQL
│   ├── config.py        # Configurações
│   ├── security.py      # JWT auth
│   ├── exceptions.py    # Erros sanitizados
│   └── constants.py     # Constantes de segurança
├── models/models.py     # SQLAlchemy models
├── schemas/             # Pydantic schemas
└── api/v1/endpoints/    # Endpoints REST

frontend/
├── *.html               # Páginas
├── js/                  # auth.js, ui.js, export.js, utils.js
└── static/              # Assets
```

### APIs REST
- `/api/v1/auth/*` - Autenticação
- `/api/v1/inventory/*` - Inventários e itens
- `/api/v1/products/*` - Produtos
- `/api/v1/users/*`, `/api/v1/stores/*` - Gestão
- `/api/v1/sync/protheus/*` - Sincronização ERP

---

## Sistema de Ciclos

```
1. Criar Inventário → "Em Preparação"
2. Liberar 1ª Contagem → Carrega produtos
3. Contagem → Salva em count_cycle_1
4. Encerrar 1ª Rodada → Recálculo divergências
5. Liberar 2ª Contagem → Apenas divergentes
6. Recontagem → Salva em count_cycle_2
7. Se count_2 == count_1 → ENCERRA
   Se count_2 != count_1 AND != expected → CICLO 3
8. Finalizar → Status "ENCERRADA"
```

---

## Diretrizes de Desenvolvimento

1. **Database-first**: Schema SQL → Modelos seguem estrutura
2. **Store context**: Operações requerem `store_id`
3. **Transações**: Usar sessões com rollback em erros
4. **Segurança**: Validar inputs, usar `safe_error_response()`
5. **Performance**: Evitar N+1, usar índices, cache Redis
6. **Commits**: Descritivos, changelog atualizado

---

## Documentação

### Changelogs
- **[CHANGELOG_v2.19.md](CHANGELOG_v2.19.md)** - Versão atual (v2.19.x)
- **[CHANGELOG_RECENTE_v2.15-v2.18.md](CHANGELOG_RECENTE_v2.15-v2.18.md)** - v2.15-v2.18
- **[docs/CHANGELOG_HISTORICO.md](docs/CHANGELOG_HISTORICO.md)** - v2.9 e anteriores

### Guias
- **[DOCUMENTACAO.md](DOCUMENTACAO.md)** - Índice master (65+ arquivos)
- **[docs/GUIA_USO_SISTEMA.md](docs/GUIA_USO_SISTEMA.md)** - Como usar
- **[docs/GUIA_TECNICO_DESENVOLVEDOR_v4.2.md](docs/GUIA_TECNICO_DESENVOLVEDOR_v4.2.md)** - Guia técnico
- **[docs/TROUBLESHOOTING_CICLOS.md](docs/TROUBLESHOOTING_CICLOS.md)** - Resolução de problemas

---

## FAQ

**Qual documento ler primeiro?**
→ Este arquivo, depois [DOCUMENTACAO.md](DOCUMENTACAO.md)

**O ciclo não avança?**
→ [docs/TROUBLESHOOTING_CICLOS.md](docs/TROUBLESHOOTING_CICLOS.md)

**Última correção?**
→ [CHANGELOG_v2.19.md](CHANGELOG_v2.19.md)

---

*Última atualização: 19/01/2026*
