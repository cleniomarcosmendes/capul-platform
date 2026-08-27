# Roteiro de Fechamento — 25–26/08/2026

**Sessão**: Workspace (papel por departamento, ponta a ponta) + dois ajustes de campo
**Alvo**: `e9334016` · **17 commits** desde `38fc8053` — ✅ **todos pushados em 26/08**
**Base**: `38fc8053` — o que a HLG roda hoje

---

## 1. Estado final

| Gate | Resultado |
|---|---|
| `gestao-ti/backend` — tsc + Jest | ✅ **147 testes** (era 108) |
| `logistica/backend` — tsc + Jest | ✅ **405 testes** |
| `auth-gateway` — tsc + Jest | ✅ **47 testes** |
| `gestao-ti/frontend` — `tsc -b` | ✅ limpo |
| `logistica/frontend` — `tsc -b` | ✅ limpo |
| `check-migrations-all.sh` | ✅ 4 backends consistentes |
| Containers | ✅ 19/19 no ar |
| Erros nos backends (level 50) | ✅ nenhum |

---

## 2. O que foi entregue

### 2.1 Workspace — o papel passou a ser DO DEPARTAMENTO (o grosso da sessão)

Partiu de uma pergunta do Clenio: *"o papel das equipes de acordo com o departamento não
se misturam, certo?"*. Estava certo como intenção e errado como implementação.

| Onda | O que era | O que virou |
|---|---|---|
| `b53b5bcc` | `@Roles` decidia pela role **denormalizada** (uma por módulo) | papel **no departamento do chamado** — 20 rotas |
| `421c6197` | contrato/NF liberavam ADMIN/GESTOR sem olhar departamento | papel no departamento do registro (E1, com `OVERSIGHT` como bypass) |
| `729002d6` | 38 métodos com `role = 'ADMIN'` **por padrão** (fail-open) | parâmetro obrigatório |
| `80cb901c` | role do módulo = a do **primeiro registro** do banco (sem `ORDER BY`) | a **mais forte**, deterministicamente |
| `cf55d4d6` | "staff" = *"é do T.I."* | *"atende NESTE departamento"* (18 chamadas) |
| `468b1dda`+`710e244f` | texto do papel dizia "Acesso total a gestao de TI" | diz o que faz, e o ADMIN diz que é global |

**Três varreduras de fonte ficaram no lugar** (é o que impede a volta): guard por rota de
chamado, guard de escrita em contrato/NF, e `role = 'ADMIN'` como default. Elas acharam
**14 rotas** que nem eu nem a auditoria tinham listado — entre elas **anexo, que não
checava nada** em chamado, contrato e NF.

Decisão registrada em `docs/DECISAO_STAFF_TI_VS_DEPARTAMENTO_26AGO.md`; auditoria completa
em `docs/AUDITORIA_WORKSPACE_ADMIN_GESTOR_25AGO.md`.

### 2.2 Chamado — reabrir e referência (`d44c689f`)

- **Reabrir** virou ato de quem atende (equipe, técnico, colaborador, gestor do
  departamento). Saiu do solicitante, que usava o chamado resolvido como atalho.
- **`#numero` no detalhamento** liga o chamado novo ao antigo, em tabela própria
  (`chamado_referencias` — ⚠️ **migration nova**). Os dois sentidos aparecem no detalhe.

### 2.3 Em cópia volta a aparecer na lista (`ec7a7e63`)

O código prometia desde o SAC; três ramos por papel cortavam antes com um `AND`. Medido
na base: `laislourenco` via **9** chamados, passa a ver **16**.

### 2.4 Entregas — hora do lançamento na fila (`05255733`)

`⏱ 14:32` por linha e **"última entrada há X min"** no cabeçalho de *Montar rota* — o
sinal de "esperar encher o veículo ou sair com o que tem".

### 2.5 Certificado sai do git (`89f51480`)

A HLG aparecia como `-sujo` porque tinha o certificado real por cima do de dev, que
estava versionado contra o que o próprio `.gitignore` mandava. Agora não é mais
rastreado, e `scripts/gerar-cert-dev.sh` cobre o clone novo.

---

## 3. ⚠️ O que MUDA PARA O USUÁRIO (avisar antes de subir)

Estas três mudam o que as pessoas veem — sem aviso, viram chamado:

1. **A lista de chamados vai crescer** para quem está em cópia (42 cópias entre 25
   usuários no DEV). Não é bug: são os chamados que já eram dele e não apareciam.
2. **O botão "Reabrir" some** para o solicitante. A recusa da API explica o caminho, mas
   quem só olha a tela não vê botão nenhum — vale um aviso.
3. **Conteúdo interno passa a seguir o departamento.** Hoje isso não tira nada de
   ninguém (o Fiscal tem 0 privados/notas internas), mas quem é do T.I. deixa de ter
   alcance automático sobre outros departamentos. Quem precisar, recebe
   `OVERSIGHT_PLATAFORMA` pela tela nova do Configurador.

---

## 4. Deploy

Roteiro: **`C:\Arquivos-de-projeto\PlatformCapul_20260826_Roteiro_Deploy_HLG_Incremental.md`**
(atualizado nesta sessão para o alvo `e9334016`).

🔴 **Mudou desde a 1ª versão dele:** o delta agora tem **3 migrations**, não 2 — entrou a
`20260826120000_chamado_referencia` no schema `gestao_ti`. Isso obriga a rebuildar
**`gestao-ti-migrate`** junto do backend; sem isso o job imprime *"No pending migrations
to apply."*, que é a mensagem de sucesso, e o backend sobe procurando uma tabela que não
existe.

---

## 5. ⛔ O que continua ABERTO

- **`M scripts/build-com-versao.sh` na HLG** — o Douglas alterou o script no servidor;
  falta o `git diff` para trazer a adaptação ao repositório. Enquanto não vier, a HLG
  seguirá marcada `-sujo` mesmo depois do commit do certificado.
- **Decidir quem recebe `OVERSIGHT_PLATAFORMA`** (hoje só o `admin`).
- **141 `role?: string` opcionais** no Workspace — varredura atrás de outras checagens
  condicionais como as duas já corrigidas.
- **Deploy de PRODUÇÃO** (`b7f8bf2f`), com o Douglas — não muda com esta onda.
- **Rotacionar** a credencial do Protheus e as 4 senhas do histórico do git.
- **APK de homologação** e a validação do travamento da tela da rota — assunto de
  segunda-feira, ainda sem retorno.

---

## 6. Gates da casa antes do deploy

- [x] `check-migrations-all.sh` — 4 backends consistentes
- [x] `/security-review` do delta — **executado em 27/08**, 2 achados (ambos na
      referência `#numero`), **ambos corrigidos** em `c89a1892`. Junto saiu um achado
      não-security que bloqueava a saída do §6: a capability `OVERSIGHT_PLATAFORMA`
      faltava na whitelist do auth-gateway (a tela concedia e tomava 400).
- [ ] Verificação de **ESTADO** (rotas anônimas × `location` do nginx) — não feita nesta
      sessão. O delta não adiciona rota nova nem `@Public`, mas a lição de 11/08 é que
      esse gate é sobre o estado do ambiente, não sobre o diff.
