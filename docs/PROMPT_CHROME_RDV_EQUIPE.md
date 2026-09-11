# Prompts para colar numa sessão COM a skill do Chrome

Dois roteiros, dois prompts. Hoje o que vale é o **B** (verificação da onda de 11/09).
O **A** fica como registro do que descobriu os defeitos.

Antes de colar, substituir `<SENHA_LIDYANE>` e `<SENHA_ADMIN>`.

---

## B — VERIFICAÇÃO da onda de correções (11/09/2026) ← use este

```
Use a skill do Chrome para executar um roteiro de VERIFICAÇÃO no ambiente de
DESENVOLVIMENTO local. O repositório é /mnt/c/meus_projetos/capul-platform.

Leia primeiro, e siga como fonte de verdade:
docs/ROTEIRO_VERIFICACAO_RDV_ONDA_11SET.md

CONTEXTO
Em 10–11/09/2026 um roteiro de tela achou 6 defeitos na aba Equipe do RDV (módulo
Logística) e mais 4 arestas. Todos foram corrigidos em 8 commits. Este roteiro
CONFIRMA que cada correção pegou — e, em duas partes, cobre coisa que nunca foi
verificada no navegador.

PASSO ZERO, OBRIGATÓRIO
Confirmar a identidade do build ANTES de tudo:
  curl -sk https://localhost/api/v1/logistica/health | grep -o '"versao":{[^}]*}'
- backend tem de ser commit `5a8271ba-sujo`
- bundle do frontend tem de ser `index-BDQ-DlfN.js`
O sufixo `-sujo` é esperado: vem de arquivos não commitados do módulo gestão-pessoas,
que não tem relação com a Logística.
SE NÃO BATER, PARE e me avise. Testar o build errado devolve a resposta trocada com
cara de verdade.

AMBIENTE
- URL: https://localhost/entregas/  (certificado self-signed — aceitar o aviso)
- Filial principal do teste: 18 - INDUSTRIA DE RACAO E SUPLEMENTO MINERAL

CONTAS
- admin        / <SENHA_ADMIN>     -> ADMIN, vinculado só à filial 18
- lidyanerocha / <SENHA_LIDYANE>   -> SUPERVISOR_FROTA (Supervisor de Departamento)
- fabricioneiva, kelvereduardo     -> aparecem como opção; não precisam logar

REGRAS (não negociáveis)
1. NENHUM deploy, rebuild, `docker compose build/up` ou `npm run build` do começo ao
   fim. O passo zero fixou o build; mudá-lo invalida tudo que veio antes.
2. Anotar o STATUS HTTP de cada chamada relevante (DevTools → Network).
3. Confirmar cada passo com a consulta SQL que o roteiro fornece, via:
   docker compose exec -T postgres psql -U capul_user -d capul_platform -c "<SQL>"
   O desempate é o rastro no banco, nunca o print.
4. Passo que falhar INTERROMPE o roteiro e é reportado na hora.
5. Relogar de verdade ao trocar de usuário (token de 60 min carrega papel e filial).
6. NÃO corrigir nada. Este roteiro observa.
7. ORDEM IMPORTA: a PARTE 2 tem de vir antes da PARTE 3, porque a Parte 2 usa uma
   divergência armada de propósito no banco e a 2.1 a reverte.

O QUE EXECUTAR — as 7 partes, nesta ordem
  PARTE 1 - Defeito 0: o ADMIN alcança qualquer filial (inclusive uma ZERADA)
  PARTE 2 - Defeitos 1 e 2: a tela usa a régua do RDV, não a da FROTA  << a mais importante
  PARTE 3 - Defeito 3: departamento de outra filial (tela + API)
  PARTE 4 - Defeito 4: falha de carga tem voz
  PARTE 5 - Defeito 5: exclusão de representante
  PARTE 6 - As 4 arestas da aba Equipe
  PARTE 7 - Regressão nas 7 telas que mudaram na varredura

A PARTE 2 é a que mais importa: é o defeito que originou a investigação e a única
verificação que nunca foi feita. A divergência entre as duas réguas está armada no
banco (veículo em "Produção e Qualidade", amarração em "Vendas Internas e Externas"),
que é o único cenário em que elas discordam.

A PARTE 7 cobre 7 telas que foram alteradas e NÃO abertas no navegador depois.
Compilador limpo não é o mesmo que ter visto funcionar. Ali o objetivo é só confirmar
que abrem, carregam e não mostram o banner âmbar de falha.

O QUE ME DEVOLVER
A tabela "Fechamento" do fim do roteiro preenchida, mais:
- status HTTP das chamadas e resultado das consultas SQL de cada parte;
- a mensagem EXATA que a tela mostrou em cada recusa (texto literal, não paráfrase);
- screenshots dos pontos onde o roteiro pede contagem ou mensagem;
- uma lista explícita do que DIVERGIU da previsão.

Divergência é o resultado mais valioso: significa que uma correção não pegou. Não
tente consertar nem contornar — registre e me diga.
```

---

## A — DESCOBERTA (rodado em 11/09, mantido como registro)

```
Use a skill do Chrome para executar um roteiro de teste de tela no ambiente de
DESENVOLVIMENTO local. O repositório é /mnt/c/meus_projetos/capul-platform.

Leia primeiro, e siga como fonte de verdade:
docs/ROTEIRO_CHROME_RDV_EQUIPE_DEPARTAMENTO.md

CONTEXTO
Investigação de por que o select "Departamento" da aba Equipe do RDV se comportava de
forma diferente entre ADMIN e Supervisor de Departamento. A base do RDV da filial 18
foi zerada de propósito — o estado ZERO é o caso de teste, não um problema a corrigir.

AMBIENTE
- URL: https://localhost/entregas/  (certificado self-signed — aceitar o aviso)
- Tela: menu "Supervisores" -> aba "Equipe (supervisores)"
- Filial alvo: 18 - INDUSTRIA DE RACAO E SUPLEMENTO MINERAL

CONTAS
- admin        / <SENHA_ADMIN>
- lidyanerocha / <SENHA_LIDYANE>

REGRAS
1. NÃO rodar deploy, rebuild, `docker compose up/build/restart` nem `npm run build`.
2. NÃO apagar nem alterar dado nenhum, exceto o cadastro de teste do PASSO 3.
3. DevTools → Network aberto; registrar o STATUS HTTP de cada chamada relevante.
4. Confirmar cada passo com a consulta SQL do roteiro, via:
   docker compose exec -T postgres psql -U capul_user -d capul_platform -c "<SQL>"
5. Passo que falhar INTERROMPE o roteiro.
6. Relogar de verdade ao trocar de usuário.
7. Screenshot de cada tela onde o roteiro pede contagem ou mensagem.

Executar os 5 passos na ordem e devolver a tabela "Fechamento" preenchida, com a
mensagem exata de cada recusa e o que divergiu da previsão. Não corrigir nada.
```

---

## Se a skill do Chrome não estiver disponível

Os dois roteiros funcionam executados à mão — cada passo termina numa consulta ao banco,
não num print. Basta seguir o `.md` com o DevTools aberto e anotar as respostas do
Fechamento.
