# Plano de Execução — Logística (16/06/2026)

Pontos levantados pelo Clenio em 15/06 (testes do app + uso da web). Ordenados por
prioridade: primeiro o que **bloqueia teste real**, depois sweeps rápidos e de
consistência, por fim a feature maior e o revamp de UX.

Branch atual: `feat/logistica-frota` (19 commits locais, sem push).

---

## FASE 1 — APP: bugs bloqueantes da "Registrar saída de veículo" ⏳
Arquivo: `logistica/app/src/screens/SaidaFrotaScreen.tsx` (+ `ViagemFrotaScreen.tsx`, `auth/AuthContext.tsx`).

1. **Seletor de veículo "sumido"** — hoje a seção *Veículo* só aparece **depois** de
   validar a senha (`{credOk ? ... : null}`). Usuário não acha o veículo.
   → **Repensar a ordem do formulário**: mostrar veículo + KM primeiro (ou tudo visível
   com os passos numerados claros), e deixar a senha como confirmação no fim. Nada de
   campo essencial escondido atrás de um passo anterior.
2. **Botão "Registrar saída" não habilita** — `podeRegistrar = credOk && veiculoId && km>=0`.
   Como *finalidade* é opcional e a senha é validada por último (`onBlur`), o usuário
   preenche KM + finalidade e o botão segue desabilitado porque `credOk` ainda é false
   (senha não validada / ordem confusa). → Corrigir o fluxo: deixar claro o que falta
   ("valide a senha para registrar") e/ou reordenar para a senha ser o último passo
   natural. Revisar a lógica de habilitação.
3. **Botão "Sair" não funciona** — já corrigimos `AuthContext.logout` (vira estado antes
   do SecureStore). Revalidar em TODAS as telas do app (Home/lançador, FrotaHome,
   MinhasViagens, SaidaFrota, ViagemFrota) — pode haver "Sair" em tela que não recarregou
   o bundle ou que chama outro handler.
4. **Olhinho na senha** (mostrar/ocultar) — SaidaFrota e ViagemFrota (LoginScreen já tem).

## FASE 2 — Olhinho (mostrar senha) em TODO o sistema 🔎
Sweep de todos os campos de senha. Criar componente reutilizável por frontend
(`PasswordInput` web; padrão já existente no app).
Pontos já mapeados (`type=password` / `secureTextEntry`):
- `gestao-ti/frontend/.../chamados/ChamadoCreatePage.tsx`
- `logistica/frontend/src/pages/FrotaPage.tsx`
- `logistica/app/.../LoginScreen.tsx` (✅ feito), `ViagemFrotaScreen.tsx`, `SaidaFrotaScreen.tsx`
- Varrer ainda: login do **Hub**, **Configurador**, **Fiscal**, **Inventário** (conferir
  campos de senha que não casaram no grep — ex.: login, troca de senha).

## FASE 3 — Matrícula com 'E' e sem 'E' (E01047 == 001047) 🔎
Padronizar para o mesmo colaborador aceitar os dois formatos, em **todos** os pontos de
entrada de matrícula + senha do portal RH.
- Já existe `toChapaPortal` em `gestao-ti/backend/.../protheus.service.ts:67` e
  `logistica/backend/.../protheus/protheus-condutor.service.ts:32` (normaliza p/ chapa
  `E0####`). Garantir que **toda** validação/comparação passe por ela.
- Frontend: aceitar `E01047` **ou** `001047` no input (normalizar/exibir consistente).
  Aplicar em: cadastro de entrega, frota (web + app) **e no Workspace "abrir chamado"**
  (`gestao-ti/.../ChamadoCreatePage.tsx`) — o usuário citou que num ponto já funciona
  (placeholder `ex.: E01047`); replicar o padrão.

## FASE 4 — Credencial por SESSÃO no cadastro de entrega (caixas do mercado) ⏳ (feature)
Contexto: os **caixas do supermercado** vão cadastrar as entregas. Modelo desejado = o do
Workspace "abrir chamado": um usuário **PADRÃO** logado e, na ação, o sistema pede
**matrícula + senha do portal RH**. Como entrega é muito mais frequente que chamado,
**pedir a senha só UMA vez enquanto a aplicação estiver aberta**.
- Reusar o conceito do **Chamado PADRAO** (validação matrícula+senha via `loginPortal`,
  resposta 200 `{valida,motivo}` — ver `[[project_chamado_matricula_senha_10jun]]`).
- **Cache de sessão** (em memória, NÃO persistir a senha): após validar 1x, guardar o
  operador validado para as próximas entregas da sessão. Incluir:
  - botão **"trocar operador"** (limpa o cache),
  - **expiração** por inatividade/timeout,
  - limpeza ao fechar/atualizar a aba e no logout.
- Decidir: cachear apenas a matrícula validada + um "desbloqueio" da sessão, ou um token
  curto. Revalidar no backend ao criar a entrega (defesa em profundidade).
- Telas afetadas: `logistica/frontend/.../EntregaNovaPage.tsx` (+ serviço de criação).

## FASE 5 — Padronização de navegação + validação de formulários (logística) ⏳
- **ENTER vs TAB**: hoje em alguns campos o `Enter` avança/salva e em outros só o `Tab`.
  Definir um padrão único (ex.: Enter avança/foca o próximo; Enter no último
  campo/submit confirma) e aplicar em todos os formulários do módulo.
- **Cupom + Valor (cadastro de entrega)**: `Enter` no cupom adiciona outra linha mesmo
  com o **valor do cupom atual vazio** → falta validação. Corrigir: só adicionar nova
  linha se cupom + valor do item atual estiverem válidos; senão, focar o campo faltante.
- Arquivo: `logistica/frontend/.../EntregaNovaPage.tsx` e demais forms.

## FASE 6 — Revamp de usabilidade das telas de FROTA 🎨 (maior)
Usuários de **baixa habilidade** → telas precisam ser simples e claras. Elevar ao padrão
de qualidade do módulo **Workspace** (referência citada: tela de **Nota Fiscal** do
gestao-ti).
- Revisar `FrotaPage.tsx`, `PainelFrotaPage.tsx`, `DespesasPage.tsx` (e correlatas).
- Diretrizes: passos numerados claros, menos densidade, botões grandes, rótulos diretos,
  feedback visível, evitar campos escondidos atrás de etapas.
- Quebrar por tela (sub-tarefas) e validar com o Clenio a cada tela.

---

## Ordem sugerida para amanhã
1. **FASE 1** (desbloqueia o teste do app — rápido e crítico).
2. **FASE 2** + **FASE 3** (sweeps rápidos, alto valor, baixo risco).
3. **FASE 4** (feature da credencial por sessão — alinhar segurança antes de codar).
4. **FASE 5** (navegação + validação).
5. **FASE 6** (revamp FROTA — maior, incremental por tela).

Checkpoint a cada fase: build + verificar em DEV + commit (entrega incremental).
Dados de teste DEV: `clenio`/`123456` (ADMIN, vê Frota+Entrega), `entregador_teste`/`entrega123`.
