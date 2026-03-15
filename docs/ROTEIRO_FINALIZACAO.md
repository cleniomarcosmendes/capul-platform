# Roteiro de Finalizacao - Capul Platform

**Versao**: 1.0
**Data**: 15/03/2026
**Objetivo**: Procedimento padrao apos finalizar ajustes no sistema

---

## Quando Usar

Use este roteiro **SEMPRE QUE**:
- Finalizar um conjunto de ajustes/correcoes
- Implementar nova funcionalidade em qualquer modulo
- Corrigir bugs importantes
- Apos sessao longa de desenvolvimento
- Antes de encerrar o dia de trabalho

---

## Prompts para Executar

```
# Roteiro completo (recomendado)
"Execute roteiro completo: ETAPA 0 + ETAPA 1 + ETAPA 2"

# Apenas documentacao e commits
"Execute ETAPA 0 + ETAPA 1 do roteiro"

# Apenas verificacao e limpeza
"Execute ETAPA 2 do roteiro"

# Apenas commits organizados
"Execute ETAPA 1 do roteiro"
```

---

## ETAPA 0: Documentacao (OBRIGATORIA)

### 0.1 Verificar o Que Mudou
**Perguntas a responder**:
- Qual modulo foi alterado? (auth-gateway, hub, gestao-ti, inventario, configurador)
- Foi bug fix, feature nova, refatoracao?
- Precisa atualizar CLAUDE.md raiz?
- Precisa atualizar MEMORY.md?

### 0.2 Documentos a Atualizar

| # | Documento | O que atualizar | Quando |
|---|-----------|-----------------|--------|
| 1 | **CLAUDE.md** (raiz) | Data de ultima atualizacao | Sempre |
| 2 | **MEMORY.md** | Status da fase/sprint atual | Se mudou estado do projeto |
| 3 | **CLAUDE.md do modulo** | Se houver (ex: inventario/CLAUDE.md) | Se mudou arquitetura do modulo |

### 0.3 Regras
- NAO criar arquivos de documentacao desnecessarios
- NAO duplicar informacao que ja esta no codigo
- Manter CLAUDE.md raiz como fonte da verdade para arquitetura
- Manter MEMORY.md como fonte da verdade para estado do projeto

---

## ETAPA 1: Analise e Commits (OBRIGATORIA)

### 1.1 Verificar Status do Git
```bash
git status
git diff --stat
```

### 1.2 Analisar Alteracoes por Servico
Agrupar mudancas por modulo:
- `auth-gateway/` → commits separados
- `gestao-ti/backend/` → commits separados
- `gestao-ti/frontend/` → commits separados
- `hub/` → commits separados
- `configurador/` → commits separados
- `inventario/` → commits separados
- `nginx/` → commits separados
- Raiz (`docker-compose.yml`, `CLAUDE.md`, etc.) → commit proprio

### 1.3 Regras de Commit
1. **1 commit = 1 funcionalidade/correcao**
2. **Mensagem clara** descrevendo o que e por que
3. **Formato padrao**:
```
<tipo>(<escopo>): <descricao>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

**Tipos**: `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `chore:`
**Escopos**: `gestao-ti`, `auth-gateway`, `hub`, `configurador`, `inventario`, `nginx`, `platform`

### 1.4 Verificacao Pos-Commit
```bash
git status    # Deve estar limpo
git log -5    # Verificar commits recentes
```

### 1.5 NUNCA fazer automaticamente
- Push para remoto sem aprovacao
- Commits sem verificar alteracoes
- Amend em commits ja publicados

---

## ETAPA 2: Verificacao e Limpeza (RECOMENDADA)

### 2.1 Verificacao de Builds
```bash
# Backend gestao-ti
cd gestao-ti/backend && npx tsc --noEmit

# Frontend gestao-ti
cd gestao-ti/frontend && npx tsc --noEmit

# Auth gateway
cd auth-gateway && npx tsc --noEmit
```

### 2.2 Verificacao de Containers
```bash
# Status dos containers
docker compose ps

# Verificar logs de erro
docker compose logs --tail 5 auth-gateway gestao-ti-backend 2>&1 | grep -i error

# Verificar uso de disco
docker system df
```

### 2.3 Verificacao de Migrations
```bash
# Auth gateway
docker compose exec auth-gateway npx prisma migrate status

# Gestao TI
docker compose exec gestao-ti-backend npx prisma migrate status
```

### 2.4 Analise de Arquivos Orfaos
```bash
# Arquivos nao rastreados pelo git
git ls-files --others --exclude-standard

# Arquivos grandes (>5MB) excluindo node_modules e .git
find . -type f -size +5M ! -path "./.git/*" ! -path "*/node_modules/*" -exec ls -lh {} \;

# Verificar se ha .env ou credenciais expostas
git ls-files | grep -E "\.env$|credentials|secret"
```

### 2.5 Limpeza Docker (com confirmacao)
```bash
# Imagens nao utilizadas (PERGUNTAR antes)
docker image prune -f

# Volumes orfaos (PERGUNTAR antes)
docker volume prune -f

# Build cache antigo (PERGUNTAR antes)
docker builder prune -f --filter "until=168h"
```

### 2.6 Limpeza de Cache Local
```bash
# Cache Python (inventario)
find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null
find . -type f -name "*.pyc" -delete

# Arquivos temporarios
find . -type f -name ".DS_Store" -delete
find . -type f -name "*.log" ! -path "./.git/*" -delete 2>/dev/null
```

### 2.7 Relatorio Final
Ao concluir, apresentar:

```
=== RELATORIO DE FINALIZACAO ===

ETAPA 0 - Documentacao:
  [x] CLAUDE.md atualizado (data: DD/MM/AAAA)
  [x] MEMORY.md atualizado (se aplicavel)

ETAPA 1 - Commits:
  [x] N commits realizados
  [x] Arquivos commitados: X
  [x] Status git: limpo

ETAPA 2 - Verificacao:
  [x] Build backend: OK/ERRO
  [x] Build frontend: OK/ERRO
  [x] Containers: X/Y rodando
  [x] Migrations: em dia
  [x] Arquivos orfaos: N encontrados
  [x] Limpeza Docker: Xmb liberados

================================
```

---

## Roteiro Completo (Checklist)

### Pre-Finalizacao
- [ ] Todos os ajustes concluidos e testados
- [ ] Sistema funcionando (docker compose ps)

### ETAPA 0: Documentacao
- [ ] Atualizar **CLAUDE.md** raiz (data)
- [ ] Atualizar **MEMORY.md** (se estado mudou)

### ETAPA 1: Commits
- [ ] `git status` verificado
- [ ] `git diff --stat` revisado
- [ ] Commits organizados por modulo
- [ ] Status final limpo

### ETAPA 2: Verificacao e Limpeza
- [ ] Builds OK (tsc --noEmit)
- [ ] Containers saudaveis
- [ ] Migrations em dia
- [ ] Arquivos orfaos analisados
- [ ] Limpeza Docker (se necessario)
- [ ] Relatorio apresentado

---

## Avisos Importantes

### NUNCA fazer automaticamente:
- Commits sem verificar alteracoes
- Push para remoto sem aprovacao
- Remocao de arquivos sem confirmar
- `docker system prune` sem perguntar
- Reset ou checkout destrutivo

### Pode fazer automaticamente:
- Limpar `__pycache__/` e `*.pyc`
- Remover `.DS_Store`
- Verificar builds (tsc --noEmit)
- Verificar status de containers
- Gerar relatorio

---

**Ultima Atualizacao**: 15/03/2026
**Versao**: 1.0
