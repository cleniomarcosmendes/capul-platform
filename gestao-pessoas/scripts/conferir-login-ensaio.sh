#!/usr/bin/env bash
# Confere que as 16 contas do ensaio ENTRAM de verdade — não que o hash mudou.
# ⚠️ Login é a única prova: conta inativa, sem permissão no módulo ou sem
#    colaborador ativo tem o hash certo e mesmo assim não entra.
set -u
SENHA="${1:-Temp2026}"
CONTAS="adrianacaetano thiagomacedo lidyanerocha marcioantonio claudimaroliveira
        esmeraldasilva clenio denisealves vanialucia ariellypereira renataborges
        jaiclerferreira julianacouto ivanlucas laislourenco liciaversiani"
ok=0; falhou=0
for u in $CONTAS; do
  T=$(curl -sk https://localhost/api/v1/auth/login -H 'Content-Type: application/json' \
        -d "{\"login\":\"$u\",\"senha\":\"$SENHA\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
  if [ -z "$T" ]; then printf '  ⛔ %-20s NÃO ENTRA\n' "$u"; falhou=$((falhou+1)); continue; fi
  # ⭐ Entrar no auth NÃO basta: o módulo tem o IdentidadeGuard (matrícula ↔
  #    colaborador ativo). A fila é a prova de ponta a ponta.
  C=$(curl -sk -o /dev/null -w '%{http_code}' https://localhost/api/v1/gestao-pessoas/avaliacoes/minhas -H "Authorization: Bearer $T")
  N=$(curl -sk https://localhost/api/v1/gestao-pessoas/avaliacoes/minhas -H "Authorization: Bearer $T" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null || echo '?')
  if [ "$C" = "200" ]; then printf '  ✅ %-20s entra · fila=%s\n' "$u" "$N"; ok=$((ok+1))
  else printf '  ⛔ %-20s login ok, MÓDULO %s\n' "$u" "$C"; falhou=$((falhou+1)); fi
done
echo "  ── entram: $ok · falharam: $falhou"
