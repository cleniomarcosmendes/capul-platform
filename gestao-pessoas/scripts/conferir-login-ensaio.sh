#!/usr/bin/env bash
# Confere que as 16 contas do ensaio ENTRAM de verdade — não que o hash mudou.
#
# ⚠️ Login é a única prova: conta inativa, sem permissão no módulo ou sem
#    colaborador ativo tem o hash certo e mesmo assim não entra.
#
# ⚠️⚠️ RITMO: `/auth/login` é limitado a **10 por minuto** (@Throttle no
#    controller). A primeira versão disparou as 16 seguidas e recebeu **429 nas
#    6 últimas** — e imprimiu "NÃO ENTRA", que é FALSO VERMELHO: as contas
#    estavam boas. Espaçar não é lentidão, é a diferença entre medir e inventar.
#    Ver `feedback_throttle_smoke_login`, que já estava escrito.
set -u
SENHA="${1:-Temp2026}"
ESPERA="${2:-7}"   # 7s × 16 ≈ 2min — abaixo de 10/min com folga
CONTAS="adrianacaetano thiagomacedo lidyanerocha marcioantonio claudimaroliveira
        esmeraldasilva clenio denisealves vanialucia ariellypereira renataborges
        jaiclerferreira julianacouto ivanlucas laislourenco liciaversiani"
ok=0; falhou=0; primeiro=1
for u in $CONTAS; do
  [ $primeiro -eq 1 ] && primeiro=0 || sleep "$ESPERA"
  R=$(curl -sk -w '\n%{http_code}' https://localhost/api/v1/auth/login \
        -H 'Content-Type: application/json' -d "{\"login\":\"$u\",\"senha\":\"$SENHA\"}")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  # ⚠️ 429 NÃO é "não entra" — é "não perguntei direito". Rótulo próprio.
  if [ "$CODE" = "429" ]; then printf '  ⏳ %-20s THROTTLE (429) — aumente a espera\n' "$u"; falhou=$((falhou+1)); continue; fi
  T=$(echo "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
  if [ -z "$T" ]; then printf '  ⛔ %-20s LOGIN %s\n' "$u" "$CODE"; falhou=$((falhou+1)); continue; fi
  # ⭐ Entrar no auth NÃO basta: o módulo tem o IdentidadeGuard (matrícula ↔
  #    colaborador ativo). A fila é a prova de ponta a ponta.
  F=$(curl -sk -w '\n%{http_code}' https://localhost/api/v1/gestao-pessoas/avaliacoes/minhas -H "Authorization: Bearer $T")
  FC=$(echo "$F" | tail -1)
  if [ "$FC" != "200" ]; then printf '  ⛔ %-20s login ok, MÓDULO %s\n' "$u" "$FC"; falhou=$((falhou+1)); continue; fi
  # ⚠️ A fila é dos ciclos ABERTOS. O ENSAIO está em RASCUNHO e NÃO aparece
  #    aqui — estes números são de outros ciclos, e é assim que tem de ser.
  CICLOS=$(echo "$F" | head -n -1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
from collections import Counter
c=Counter(x['ciclo']['nome'][:22] for x in d)
print(f\"{len(d):3}\" + ('  ' + ' · '.join(f'{k}={v}' for k,v in c.items()) if d else '  (vazia)'))" 2>/dev/null)
  printf '  ✅ %-20s entra · fila=%s\n' "$u" "$CICLOS"; ok=$((ok+1))
done
echo "  ── entram: $ok · falharam: $falhou"
