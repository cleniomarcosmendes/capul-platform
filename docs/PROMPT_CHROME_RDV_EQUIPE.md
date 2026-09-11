# Prompt para colar numa sessão COM a skill do Chrome

Copiar tudo o que está dentro do bloco abaixo e colar como primeira mensagem da sessão.
Antes de colar, substituir `<SENHA_LIDYANE>` (e `<SENHA_ADMIN>` se não for `admin123`).

---

```
Use a skill do Chrome para executar um roteiro de teste de tela no ambiente de
DESENVOLVIMENTO local. O repositório é /mnt/c/meus_projetos/capul-platform.

Leia primeiro, e siga como fonte de verdade:
docs/ROTEIRO_CHROME_RDV_EQUIPE_DEPARTAMENTO.md

CONTEXTO
Estou investigando por que o select "Departamento" da aba Equipe do módulo RDV
(Logística) se comporta de forma diferente entre ADMIN e Supervisor de Departamento.
A base do RDV da filial 18 foi zerada de propósito em 11/09/2026 — o estado ZERO é o
caso de teste, não um problema a corrigir.

AMBIENTE
- URL: https://localhost/entregas/  (certificado self-signed — aceitar o aviso)
- Tela: menu "Supervisores" -> aba "Equipe (supervisores)"
- Filial alvo: 18 - INDUSTRIA DE RACAO E SUPLEMENTO MINERAL

CONTAS
- admin        / <SENHA_ADMIN>     -> ADMIN
- lidyanerocha / <SENHA_LIDYANE>   -> SUPERVISOR_FROTA (Supervisor de Departamento)
- fabricioneiva e kelvereduardo    -> só aparecem como opção, não precisam logar

REGRAS (não negociáveis)
1. NÃO rodar deploy, rebuild, `docker compose up/build/restart` nem `npm run build`
   em momento nenhum. Build que muda no meio invalida todos os passos anteriores.
2. NÃO apagar nem alterar dado nenhum, exceto o cadastro de teste criado no PASSO 3,
   que o próprio roteiro manda apagar no fim.
3. Abrir o DevTools na aba Network ANTES de cada passo e registrar o STATUS HTTP de
   cada chamada relevante. A tela engole erro: uma falha de rede ou um 403 viram
   "lista vazia" sem nenhuma mensagem. Sem o status, a observação não vale.
4. Confirmar cada passo com a consulta SQL que o roteiro fornece, via:
   docker compose exec -T postgres psql -U capul_user -d capul_platform -c "<SQL>"
   O desempate é o rastro no banco, nunca o print.
5. Passo que falhar INTERROMPE o roteiro. Não seguir para o próximo "para ver no que dá".
6. Ao trocar de usuário, fazer logout e login de verdade — o token carrega papel e
   filial por 60 minutos.
7. Tirar screenshot de cada tela onde o roteiro pede uma contagem ou uma mensagem.

O QUE EXECUTAR
Os cinco passos do roteiro, nesta ordem:
  PASSO 0 - Lidyane no zero: a tela oferece o que a API recusa
  PASSO 1 - ADMIN monta do zero (o caminho nunca percorrido)
  PASSO 2 - Lidyane monta o time dela
  PASSO 3 - O defeito da filial na lista do ADMIN
  PASSO 4 - O defeito mudo

Cada passo tem uma PREVISÃO escrita no roteiro. Anote sempre o observado, e diga
explicitamente quando o observado DIVERGIR da previsão — divergência é o resultado
mais valioso, não um erro de execução.

O QUE ME DEVOLVER
A tabela "Fechamento" do fim do roteiro, com as dez respostas preenchidas, mais:
- para cada passo: status HTTP das chamadas e o resultado da consulta SQL;
- a mensagem EXATA que a tela mostrou em cada recusa (texto literal, não paráfrase);
- os screenshots;
- uma lista do que divergiu da previsão.

Não corrija nenhum defeito que encontrar. Este roteiro é de observação.
```

---

## Se a skill do Chrome não estiver disponível

O roteiro funciona igual executado à mão — cada passo termina numa consulta ao banco,
não num print. Basta seguir `docs/ROTEIRO_CHROME_RDV_EQUIPE_DEPARTAMENTO.md` com o
DevTools aberto e anotar as dez respostas do Fechamento.
