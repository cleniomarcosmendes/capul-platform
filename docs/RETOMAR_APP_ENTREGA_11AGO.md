# Retomar em 11/08 — testes do APP-MOBILE na Entrega (continuação)

Sessão de 10/08: o app **foi executado no Expo Go**, no aparelho, pela primeira vez
desde as mudanças do ponto 1. Substitui `RETOMAR_APP_ENTREGA_10AGO.md`.

⚠️ **8 commits locais nesta sessão, NADA PUSHADO** (`80433dda`..`e1cc2fbb`).

---

## Validado em campo pelo Clenio

- ✅ **KM inicial e final** — "funcionou conforme o previsto".
- ✅ **"Quem recebeu" em tela própria** — "deu certo".

## O que mudou (8 commits)

| # | Commit | O quê |
|---|---|---|
| 1 | `80433dda` | KM de saída vira o **primeiro ato** da rota; fila offline deixa de **apagar a foto** da baixa |
| 2 | `9dae1d36` | KM de saída sobe ao ser enfileirado **e** antes da baixa |
| 3 | `af173350` | Localização pedida **uma vez** (no KM), não a cada entrega; teclado no padrão da casa |
| 4 | `336fa894` | Sem sinal, o app **parecia travado** — spinner de tela cheia a cada foco e erro grudado |
| 5 | `3f087c45` | Offset do teclado x rodapé fixo (superado pelo #6) |
| 6 | `400309db` | **"Quem recebeu" e "motivo" em tela própria** (`EntradaTextoModal`) |
| 7 | `e1cc2fbb` | Prazo interativo ≠ prazo de fila; **encerrar deixou de ser mudo**; aviso de KM igual |

O defeito mais grave foi o do #1: sem sinal, as baixas subiam **antes** do KM de saída,
o servidor recusava, e a fila tratava 4xx como rejeição definitiva — **descartava a
baixa e apagava a foto**. Perda de prova de entrega, que é lastro de cobrança por 5 anos.

## 🔴 O que falta testar (a lista de amanhã)

O caminho **offline** é o que menos rodou, e é onde estavam os piores defeitos:

1. **Modo avião → registrar KM de saída → dar baixa → religar o sinal.**
   Esperado: banner "1 baixa aguardando sinal"; ao voltar o sinal, a baixa sobe com a
   foto. **Nada pode ser descartado.**
2. **KM de saída recusado** (digitar um KM menor que o odômetro do veículo): a baixa
   **não** pode subir depois; deve aparecer "KM de saída recusado" com o motivo.
3. **Encerrar sem trocar o KM** → deve perguntar "Confirmar 0 km" (era o caminho mudo).
4. **Encerrar com entrega pendente** → o botão agora é tocável e diz o que falta.
5. **Não-entrega** (motivo em tela própria) — o campo do motivo nunca foi exercido.
6. **Permissão de localização**: deve aparecer **uma vez**, logo após o KM de saída.

## ⚠️ Sobre o ambiente de teste (não confundir com defeito)

- Metro em `exp://172.16.0.159:8081` — **Ethernet**. O Wi-Fi da máquina (`.45`) está
  `Deprecated` e **não responde**.
- `EXPO_PUBLIC_API_URL=http://172.16.0.159:8085` é embutido **no bundle**: trocar exige
  parar o Metro e subir com `-c`.
- **`Cannot connect to Expo CLI`** = o celular perdeu a rede até a máquina. Como Metro e
  API vivem no mesmo IP, **a API cai junto** no mesmo instante. Suspeito principal: o
  Android trocando sozinho para 4G quando o Wi-Fi enfraquece.
- Stack no ar por `docker compose up -d` **+ `--profile osrm up -d osrm`** (OSRM é
  profile; sem ele a rota vira linha reta calada).

## Também pendente (fora do app)

- **Decisão:** os 120 usuários INDIVIDUAL sem matrícula passam a exigi-la no próximo save.
- **Push** — é do Clenio.
