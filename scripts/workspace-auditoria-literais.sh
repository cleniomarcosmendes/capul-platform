#!/usr/bin/env bash
# ============================================================================
# Workspace Multi-Departamento — Pré-Onda 0 — Auditoria de Literais
# ============================================================================
# Faz grep pelos literais de roles legadas que serão renomeados na Onda 1:
#   - GESTOR_TI       → GESTOR
#   - SUPORTE_TI      → SUPORTE
#   - TECNICO         → (a remover)
#   - DESENVOLVEDOR   → (a remover)
#   - MANUTENCAO      → (a remover)
#   - INFRAESTRUTURA  → (a remover)
#
# Saída: tabela markdown + detalhamento por arquivo, separando ocorrências em
# código de produção (src/, prisma/) vs testes (*.test.*, __tests__/) vs docs
# (*.md, docs/). Não muda nenhum arquivo do projeto.
#
# Uso:
#   ./scripts/workspace-auditoria-literais.sh                    # stdout
#   ./scripts/workspace-auditoria-literais.sh > saida.md         # arquivo
#
# Referência: Workspace_Multi_Departamento_Design.md §7.0 (Pré-Onda 0)
# Tarefa associada: dimensiona Lote 1.7 (renomear roles) da Onda 1.
# ============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Literais a procurar
LITERALS=(
  "GESTOR_TI"
  "SUPORTE_TI"
  "TECNICO"
  "DESENVOLVEDOR"
  "MANUTENCAO"
  "INFRAESTRUTURA"
)

# Subdiretórios a varrer (4 frontends + 3 backends Node + Inventário FastAPI)
SUBPATHS=(
  "hub"
  "gestao-ti/frontend"
  "gestao-ti/backend"
  "configurador"
  "fiscal/frontend"
  "fiscal/backend"
  "auth-gateway"
  "inventario/backend"
  "inventario/frontend"
)

# Excludes comuns (mesmo padrão pra rg e grep -r)
GLOB_EXCLUDES=(
  "--glob=!node_modules"
  "--glob=!dist"
  "--glob=!build"
  "--glob=!.next"
  "--glob=!coverage"
  "--glob=!__pycache__"
  "--glob=!.git"
  "--glob=!*.lock"
  "--glob=!package-lock.json"
)

# Detecta ripgrep
if command -v rg >/dev/null 2>&1; then
  USE_RG=1
else
  USE_RG=0
fi

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

# Busca um literal num path, retorna linhas no formato file:line:content
search_literal() {
  local literal="$1"
  local path="$2"
  if [[ ! -d "$path" ]]; then return 0; fi
  if [[ $USE_RG -eq 1 ]]; then
    # Word boundary (-w) pra não casar VARIAVEL_TECNICO ou similar
    rg --no-heading --line-number --color=never -w "${GLOB_EXCLUDES[@]}" "$literal" "$path" 2>/dev/null || true
  else
    grep -rnw \
      --exclude-dir=node_modules \
      --exclude-dir=dist \
      --exclude-dir=build \
      --exclude-dir=.next \
      --exclude-dir=coverage \
      --exclude-dir=__pycache__ \
      --exclude-dir=.git \
      --exclude=*.lock \
      --exclude=package-lock.json \
      "$literal" "$path" 2>/dev/null || true
  fi
}

# Classifica arquivo por tipo: prod | test | doc | other
classify_file() {
  local file="$1"
  case "$file" in
    *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.spec.ts|*.spec.tsx|*.spec.js|*.spec.py)
      echo "test" ;;
    */__tests__/*|*/tests/*|*/test/*)
      echo "test" ;;
    *.md|*/docs/*|*/CHANGELOG*|*README*)
      echo "doc"  ;;
    *.ts|*.tsx|*.js|*.jsx|*.py|*.prisma|*.sql|*.yml|*.yaml|*.json)
      echo "prod" ;;
    *)
      echo "other" ;;
  esac
}

# ----------------------------------------------------------------------------
# Header
# ----------------------------------------------------------------------------

echo "# Workspace Multi-Departamento — Pré-Onda 0 — Auditoria de Literais"
echo ""
echo "**Gerado em:** $(date '+%Y-%m-%d %H:%M:%S')"
echo "**Branch:** $(git branch --show-current 2>/dev/null || echo 'n/a')"
echo "**Commit base:** $(git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
echo "**Ferramenta:** $([[ $USE_RG -eq 1 ]] && echo 'ripgrep' || echo 'grep -r')"
echo ""
echo "Auditoria sem alteração de código. Resultado dimensiona o **Lote 1.7** da Onda 1 (rename de roles)."
echo "Documento de referência: \`Workspace_Multi_Departamento_Design.md\` §7.0 (Pré-Onda 0)."
echo ""
echo "## Literais auditados"
echo ""
echo "| Literal | Destino na Onda 1 |"
echo "|---|---|"
echo "| \`GESTOR_TI\` | Renomear → \`GESTOR\` |"
echo "| \`SUPORTE_TI\` | Renomear → \`SUPORTE\` |"
echo "| \`TECNICO\` | Remover (role não-usada) |"
echo "| \`DESENVOLVEDOR\` | Remover (role não-usada) |"
echo "| \`MANUTENCAO\` | Remover (role não-usada) |"
echo "| \`INFRAESTRUTURA\` | Remover (role não-usada) |"
echo ""
echo "**Word boundary** (\`-w\`) aplicado pra não casar substrings (ex: \`VARIAVEL_TECNICO\`)."
echo ""

# ----------------------------------------------------------------------------
# Coleta principal
# ----------------------------------------------------------------------------

# Arquivo temporário com TODAS ocorrências
TMP_ALL=$(mktemp)
trap "rm -f $TMP_ALL" EXIT

for literal in "${LITERALS[@]}"; do
  for path in "${SUBPATHS[@]}"; do
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      # Formato: file:line:content → adiciona literal como prefixo
      echo "${literal}|${line}"
    done < <(search_literal "$literal" "$path")
  done
done > "$TMP_ALL"

TOTAL=$(wc -l < "$TMP_ALL" | tr -d ' ')

# ----------------------------------------------------------------------------
# Sumário por literal
# ----------------------------------------------------------------------------

echo "## 1. Sumário por literal"
echo ""
echo "| Literal | Total | Produção | Testes | Docs | Outros |"
echo "|---|---:|---:|---:|---:|---:|"

for literal in "${LITERALS[@]}"; do
  total=0; prod=0; test=0; doc=0; other=0
  while IFS='|' read -r lit rest; do
    [[ "$lit" != "$literal" ]] && continue
    file="${rest%%:*}"
    cat=$(classify_file "$file")
    total=$((total+1))
    case "$cat" in
      prod)  prod=$((prod+1)) ;;
      test)  test=$((test+1)) ;;
      doc)   doc=$((doc+1)) ;;
      other) other=$((other+1)) ;;
    esac
  done < "$TMP_ALL"
  echo "| \`$literal\` | $total | $prod | $test | $doc | $other |"
done

echo "| **TOTAL** | **$TOTAL** | | | | |"
echo ""

# ----------------------------------------------------------------------------
# Sumário por subdiretório
# ----------------------------------------------------------------------------

echo "## 2. Sumário por subdiretório (apenas código de produção)"
echo ""
echo "| Subdiretório | Ocorrências (prod) |"
echo "|---|---:|"

for path in "${SUBPATHS[@]}"; do
  count=0
  while IFS='|' read -r lit rest; do
    file="${rest%%:*}"
    [[ "$file" != "$path"* ]] && continue
    cat=$(classify_file "$file")
    [[ "$cat" != "prod" ]] && continue
    count=$((count+1))
  done < "$TMP_ALL"
  printf "| \`%s\` | %d |\n" "$path" "$count"
done
echo ""

# ----------------------------------------------------------------------------
# Detalhe por arquivo (apenas produção) — top-N
# ----------------------------------------------------------------------------

echo "## 3. Detalhe por arquivo (apenas código de produção)"
echo ""
echo "Cada linha tem o formato \`file:line | literal | trecho\`. Ordenado por arquivo."
echo ""
echo "<details>"
echo "<summary>Clique para expandir (pode ter muitas linhas)</summary>"
echo ""
echo '```'

# Filtra só produção e formata
while IFS='|' read -r lit rest; do
  file="${rest%%:*}"
  cat=$(classify_file "$file")
  [[ "$cat" != "prod" ]] && continue
  # rest = file:line:content (mas tem ":" no content também)
  # Pega primeiros 2 campos com :
  line_no=$(echo "$rest" | awk -F: '{print $2}')
  # Resto é o conteúdo (até 200 chars)
  content=$(echo "$rest" | cut -d: -f3- | sed 's/^[[:space:]]*//' | cut -c1-200)
  printf "%-80s | %-15s | %s\n" "${file}:${line_no}" "$lit" "$content"
done < "$TMP_ALL" | sort -u

echo '```'
echo ""
echo "</details>"
echo ""

# ----------------------------------------------------------------------------
# Estimativa de esforço (heurística por arquivo)
# ----------------------------------------------------------------------------

echo "## 4. Estimativa de esforço (heurística)"
echo ""
echo "Critério: 1 arquivo único = ~1-3 minutos de revisão+rename. Arquivos com muitas"
echo "ocorrências do mesmo literal são candidatos a \`sed -i\` mecânico; arquivos com"
echo "literais diferentes exigem revisão caso-a-caso."
echo ""

UNIQUE_PROD_FILES=$(
  while IFS='|' read -r lit rest; do
    file="${rest%%:*}"
    cat=$(classify_file "$file")
    [[ "$cat" != "prod" ]] && continue
    echo "$file"
  done < "$TMP_ALL" | sort -u | wc -l | tr -d ' '
)

UNIQUE_TEST_FILES=$(
  while IFS='|' read -r lit rest; do
    file="${rest%%:*}"
    cat=$(classify_file "$file")
    [[ "$cat" != "test" ]] && continue
    echo "$file"
  done < "$TMP_ALL" | sort -u | wc -l | tr -d ' '
)

UNIQUE_DOC_FILES=$(
  while IFS='|' read -r lit rest; do
    file="${rest%%:*}"
    cat=$(classify_file "$file")
    [[ "$cat" != "doc" ]] && continue
    echo "$file"
  done < "$TMP_ALL" | sort -u | wc -l | tr -d ' '
)

echo "- **Arquivos de produção únicos com literais**: $UNIQUE_PROD_FILES"
echo "- **Arquivos de teste únicos com literais**: $UNIQUE_TEST_FILES"
echo "- **Arquivos de documentação únicos**: $UNIQUE_DOC_FILES"
echo ""

# Estimativa em horas (assumindo 2min/arquivo prod, 1min/teste, ignora docs)
EST_MIN=$(( UNIQUE_PROD_FILES * 2 + UNIQUE_TEST_FILES * 1 ))
EST_HOURS=$(awk "BEGIN { printf \"%.1f\", $EST_MIN / 60 }")
echo "**Estimativa bruta:** $EST_MIN minutos (~$EST_HOURS horas) de rename + revisão."
echo "Soma-se ~2h de testes manuais (smoke test JWT + RBAC) → total Lote 1.7 entre 4-8h."
echo ""

# ----------------------------------------------------------------------------
# Recomendações
# ----------------------------------------------------------------------------

echo "## 5. Recomendações para a Onda 1 (Lote 1.7)"
echo ""
echo "1. **Estratégia de rename mecânico vs revisão manual:**"
echo "   - Arquivos com \`GESTOR_TI\` ou \`SUPORTE_TI\` em isolado (constantes, types, fixtures): \`sed -i\` mecânico aceita."
echo "   - Arquivos com TECNICO/DESENVOLVEDOR/MANUTENCAO/INFRAESTRUTURA: **revisar caso-a-caso** — pode ser referência a permissão obsoleta que precisa ser **removida** (não renomeada)."
echo ""
echo "2. **Ordem sugerida pra rename:**"
echo "   a. Backend Node (constantes em \`common/constants/roles.constant.ts\`, decorators de guard)."
echo "   b. Schema Prisma (seed pra roles_modulo)."
echo "   c. Frontend (componentes de Configurador, RoleSelect, etc.)."
echo "   d. Testes (atualizar fixtures)."
echo "   e. Docs (atualizar README, documentacao-tecnica)."
echo ""
echo "3. **Testes obrigatórios pós-rename:**"
echo "   - Smoke test de login (JWT carrega role correta)."
echo "   - RBAC guard em rota privada (\`@Roles('GESTOR')\` aceita usuário recém-renomeado)."
echo "   - UI Configurador renderiza dropdown de roles sem as 4 removidas."
echo ""
echo "4. **NÃO renomear**:"
echo "   - Migrations Prisma já aplicadas (são histórico — não tocar)."
echo "   - Arquivos do diretório \`memory/\` do Claude (são point-in-time)."
echo ""
echo "---"
echo ""
echo "_Auditoria executada por \`scripts/workspace-auditoria-literais.sh\`. Para regenerar: rode o script novamente._"
