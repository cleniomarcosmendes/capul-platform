# Roteiro de Finalização - Pós Ajustes

**Versão**: 1.2
**Data**: 18/01/2026
**Objetivo**: Procedimento padrão após finalizar ajustes no sistema (100% completo - nada fica pendente!)

---

## Quando Usar Este Roteiro

Use este roteiro **SEMPRE QUE**:
- Finalizar um conjunto de ajustes/correções
- Implementar uma nova funcionalidade
- Corrigir um bug importante
- Após uma sessão longa de desenvolvimento

---

## IMPORTANTE - v1.2 (Atualização 18/01/2026)

**O QUE MUDOU na v1.2**:
- Simplificação para **3 documentos essenciais** (era 5)
- Referência correta ao changelog atual (`CHANGELOG_v2.19.md` na raiz)
- Remoção de referências obsoletas (`docs/CHANGELOG_CICLOS.md`)
- Atualização de exemplos para versão v2.19.x

### 3 Documentos OBRIGATÓRIOS (SEMPRE atualizar):

| # | Documento | O que atualizar |
|---|-----------|-----------------|
| 1 | **CLAUDE.md** | Versão e data do projeto |
| 2 | **CHANGELOG_v2.19.md** | Histórico detalhado das alterações |
| 3 | **DOCUMENTACAO.md** | Versão e data (índice master) |

**Por quê apenas 3?**
- CLAUDE.md → Status rápido do projeto
- CHANGELOG → Histórico detalhado (o mais importante!)
- DOCUMENTACAO.md → Índice que aponta para tudo

---

## ETAPA 0: Atualizar Documentação (OBRIGATÓRIA!)

### 0.1 Verificar o Que Mudou
**Perguntas a responder**:
- Foi corrigido algum bug? → Adicionar no CHANGELOG
- Foi adicionada funcionalidade? → Adicionar no CHANGELOG
- Mudou versão? → Atualizar CLAUDE.md e DOCUMENTACAO.md

### 0.2 Documentos a Atualizar

#### SEMPRE atualizar (Obrigatórios):
1. **CLAUDE.md** - Versão e data no header
2. **CHANGELOG_v2.19.md** - Nova entrada com detalhes
3. **DOCUMENTACAO.md** - Versão e data

#### Verificar conforme o caso (Opcionais):
1. **docs/TROUBLESHOOTING_CICLOS.md** - Se corrigiu bug de ciclos
2. **docs/GUIA_USO_SISTEMA.md** - Se mudou fluxo de uso
3. **README.md** - Se mudou instalação ou uso básico

### 0.3 Template de Entrada no CHANGELOG

```markdown
## v2.19.XX (DD/MM/AAAA) - Título Descritivo

### TIPO: Descrição breve

**Contexto**: Por que foi necessário.

**Alterações Implementadas**:
1. Item 1
2. Item 2

**Arquivos alterados**:

| Arquivo | Alteração |
|---------|-----------|
| `arquivo.html` | Descrição |

---
```

**Tipos válidos**: FEAT, FIX, REFACTOR, ENHANCEMENT, SECURITY, PERF

### 0.4 Template de Atualização do CLAUDE.md

```markdown
**Sistema de Inventário Protheus v2.19.XX** - **PRODUÇÃO** *(DD/MM/AAAA)*
```

E no final:
```markdown
*Última atualização: DD/MM/AAAA*
```

---

## ETAPA 1: Análise e Commits (OBRIGATÓRIA)

### 1.1 Verificar Status do Git
```bash
git status
```

### 1.2 Analisar Arquivos Modificados
**Perguntas a responder**:
- Quais arquivos foram alterados?
- As mudanças fazem sentido juntas ou devem ser commits separados?
- Há arquivos de configuração (.json, .env) que não devem ser commitados?

### 1.3 Revisar Alterações
```bash
# Ver resumo de todas alterações
git diff --stat

# Ver detalhes de cada arquivo
git diff <arquivo>
```

### 1.4 Organizar Commits Lógicos
**Regras**:
1. **1 commit = 1 funcionalidade/correção**
2. **Mensagem clara** descrevendo o que e por quê
3. **Incluir versão** no commit (ex: `v2.19.52`)

**Estrutura de Commit**:
```
<tipo>(<escopo>): <descrição> (vX.X.XX)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Tipos de Commit**:
- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Documentação
- `refactor:` - Refatoração de código
- `perf:` - Melhoria de performance
- `chore:` - Tarefas de manutenção

---

## ETAPA 2: Backup e Limpeza (OPCIONAL)

### 2.1 Pré-requisitos
**Antes de qualquer limpeza, SEMPRE**:
1. Backup completo criado
2. Todos os commits feitos
3. Sistema testado e funcionando

### 2.2 Criar Backup
```bash
timestamp=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_pre_limpeza_${timestamp}.tar.gz" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=__pycache__ \
  --exclude=*.pyc \
  --exclude=venv \
  backend/ frontend/ database/ docs/ *.md docker-compose.yml

echo "Backup criado: backup_pre_limpeza_${timestamp}.tar.gz"
```

### 2.3 Análise de Arquivos Órfãos

```bash
# Arquivos não rastreados pelo git
git ls-files --others --exclude-standard

# Arquivos grandes (>1MB)
find . -type f -size +1M ! -path "./.git/*" ! -path "./node_modules/*" ! -path "./venv/*"

# Diretórios __pycache__
find . -type d -name __pycache__ | wc -l

# Arquivos .pyc
find . -type f -name "*.pyc" | wc -l

# Backups existentes
ls -lh backup_*.tar.gz 2>/dev/null
```

### 2.4 Categorização de Arquivos

| Categoria | Arquivos | Ação |
|-----------|----------|------|
| SEGURO REMOVER | `*.pyc`, `__pycache__/`, `.DS_Store`, `*.log` | Automático |
| ANALISAR | `.md` duplicados, PDFs não referenciados | Perguntar |
| NUNCA REMOVER | `.py`, `.html`, `.js`, `.sql`, configs | Backup primeiro |

### 2.5 Limpeza Segura (Automática)
```bash
# Remover cache Python
find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null
find . -type f -name "*.pyc" -delete

# Remover arquivos temporários
find . -type f -name ".DS_Store" -delete

# Remover backups muito antigos (> 60 dias)
find . -name "backup_*.tar.gz" -mtime +60 -delete
```

---

## ROTEIRO COMPLETO (Checklist)

### Pré-Finalização
- [ ] Todos os ajustes concluídos e testados
- [ ] Sistema funcionando 100%

### ETAPA 0: Documentação
- [ ] Atualizar **CLAUDE.md** (versão e data)
- [ ] Atualizar **CHANGELOG_v2.19.md** (nova entrada)
- [ ] Atualizar **DOCUMENTACAO.md** (versão e data)

### ETAPA 1: Commits
- [ ] Verificar `git status`
- [ ] Revisar `git diff`
- [ ] Executar commits organizados
- [ ] Verificar status final

### ETAPA 2: Backup e Análise
- [ ] Criar backup com timestamp
- [ ] Analisar arquivos órfãos
- [ ] Limpar cache se necessário
- [ ] Reportar resultado

---

## Exemplo de Execução

**Usuário solicita**:
> "Execute roteiro completo: ETAPA 0 + ETAPA 1 + ETAPA 2 (análise de órfãos)"

**Claude Code executa**:

1. **ETAPA 0** - Atualiza documentação:
   - CLAUDE.md → v2.19.52 (18/01/2026)
   - CHANGELOG_v2.19.md → Nova entrada detalhada
   - DOCUMENTACAO.md → Versão atualizada

2. **ETAPA 1** - Commits:
   - Analisa git status
   - Cria commits organizados
   - Verifica status final

3. **ETAPA 2** - Backup e análise:
   - Cria `backup_pre_limpeza_YYYYMMDD_HHMMSS.tar.gz`
   - Lista arquivos órfãos
   - Reporta estado do projeto

**Resultado**: Documentação sincronizada + Commits feitos + Backup criado!

---

## Avisos Importantes

### NUNCA faça automaticamente:
- Commits sem verificar alterações
- Remoção de arquivos sem backup
- Push para remoto sem aprovação

### Pode fazer automaticamente:
- Limpar `__pycache__/` e `*.pyc`
- Remover `.DS_Store`
- Criar backup

---

## Como Solicitar (Comandos Rápidos)

**Opção 1 - Roteiro Completo**:
```
"Execute roteiro completo: ETAPA 0 + ETAPA 1 + ETAPA 2 (análise de órfãos)"
```

**Opção 2 - Apenas Documentação e Commits**:
```
"Execute ETAPA 0 + ETAPA 1 do roteiro"
```

**Opção 3 - Apenas Commits**:
```
"Execute ETAPA 1 do roteiro de finalização"
```

---

## Documentos Relacionados

- [../../CLAUDE.md](../../CLAUDE.md) - Guia principal
- [../../CHANGELOG_v2.19.md](../../CHANGELOG_v2.19.md) - Changelog atual
- [../../DOCUMENTACAO.md](../../DOCUMENTACAO.md) - Índice master

---

**Última Atualização**: 18/01/2026
**Versão**: 1.2 - Simplificação para 3 documentos essenciais
