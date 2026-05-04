# Plano — Inventário: clareza de fluxo pós-liberação

> **Status:** PROPOSTA (v1) | **Autores:** Claude Code + Clenio | **Data:** 02/05/2026
> **Origem:** análise de fluxo solicitada por Clenio em 02/05 (módulo Inventário, do release de lista até integração Protheus)
> **Premissa:** **NÃO refazer o que já está bom** — importação Protheus (hierarquia/produto), criação de inventário, adição de produto à lista, abas Visão geral/Itens/Lista/Análise.

---

## 1. Contexto e problema

Após a migração do Inventário para a plataforma Capul (React TS + UNIFIED_AUTH, com sidebar e layout consistentes), a operação **a partir da liberação da lista** ficou intuitiva apenas em parte. Pontos confusos relatados e validados em código:

1. **Mobile sem feedback de progresso e de fim de contagem** — operador não sabe quanto falta nem que terminou.
2. **Pós-encerramento das listas** — o supervisor não tem indicação clara de "agora encerre o inventário" e do que vem depois.
3. **Pós-encerramento do inventário** — telas de Comparação, Transferência, Envio Protheus e Análise estão soltas no menu sem ordem visual nem gating; o usuário escolhe a ordem.
4. **Encerrado vs Finalizado vs CLOSED** — três estados reais (`ENCERRADA` da lista, `COMPLETED` do inventário, `CLOSED` quando enviado ao ERP) sem indicador visual unificado.
5. **RBAC do `release` da lista não valida perfil** — qualquer usuário autenticado libera lista (achado lateral; não é só UX, é segurança).
6. **Endpoint `finalize-inventory` existe, sem botão correspondente na UI** — workflow incompleto.

### O que **NÃO** é problema (validado com Clenio)

- **"Avançar Ciclo" e "Encerrar Lista" são caminhos legítimos**, não escape hatch. Inventário pode operar com 1, 2 ou 3 ciclos por decisão do supervisor. **Mantém os dois botões em pé de igualdade**, sem warning dramático.
- Layout das telas, abas do detalhe e cards estão bons. Não mexer.

---

## 2. Estado atual mapeado

### 2.1 Status (modelos `Inventory` / `CountingList`)

```
CountingList.list_status:  PREPARACAO -> EM_CONTAGEM -> ENCERRADA
CountingList.current_cycle: 1 -> 2 -> 3 (avança via finalize-cycle)

Inventory.list_status:     EM_PREPARACAO -> EM_ANDAMENTO -> ENCERRADA
Inventory.status (enum):   DRAFT -> IN_PROGRESS -> COMPLETED -> CLOSED
                                                       |          |
                                          finalize-inventory   send-protheus
```

### 2.2 Endpoints (backend FastAPI)

| Endpoint | Quem dispara | Onde está na UI |
|----------|--------------|------------------|
| `POST /counting-lists/{id}/release` | (hoje qualquer usuário) | Botão **Liberar** em `InventarioDetalhePage` |
| `POST /counting-lists/{id}/finalize-cycle` | SUPERVISOR/ADMIN | Botão **Finalizar Ciclo** em `InventarioDetalhePage` |
| `POST /counting-lists/{id}/finalizar` | SUPERVISOR/ADMIN | Botão **Encerrar Lista** em `InventarioDetalhePage` |
| `POST /inventory/lists/{id}/finalize-inventory` | SUPERVISOR/ADMIN | **Sem botão correspondente** (falta) |
| `GET /inventory-comparison/preview` | STAFF | Página `ComparacaoPage` |
| `POST /integration-protheus/transfers/preview` | STAFF | (parte do fluxo de envio) |
| `POST /send-protheus/finalize` | STAFF | Página `SincronizacaoPage` ("Envio Protheus") |

### 2.3 Menu lateral atual (`Sidebar.tsx:25-38`)

```
Dashboard
INVENTARIO
  Inventarios | Contagem | Produtos | Armazens
OPERACOES (STAFF)
  Importacao Protheus | Envio Protheus | Relatorios | Monitoramento | Analise
```

A seção "OPERACOES" mistura dois mundos — **integração de entrada** (Importacao) e **integração de saída/encerramento** (Envio, Análise). Daí parte da confusão.

---

## 3. Estratégia em 3 ondas

Resolver na ordem de risco/usuário-impacto, sem refator estrutural até validar UX dos quick wins.

### Onda 1 — Quick wins (1 sessão, ~3h)

Itens de alto impacto e baixo esforço. Não mexem em arquitetura.

| # | Item | Onde | Efeito |
|---|------|------|--------|
| 1.1 | Header do mobile mostra `X de Y contados` + barra de progresso | `ContagemMobilePage.tsx` | Operador vê o que falta |
| 1.2 | Tela "Contagem concluída" no mobile quando todos os pendentes do ciclo atual foram salvos | `ContagemMobilePage.tsx` | Encerra sensação de "estou perdido" |
| 1.3 | Mesmo contador no header do desktop (já tem `CountingProgress`, redundante mas valida-paridade) | `ContagemDesktopPage.tsx` | Paridade UI |
| 1.4 | Validar perfil em `POST /counting-lists/{id}/release` (SUPERVISOR/ADMIN) | `counting_lists.py:629-685` | Fecha furo RBAC |
| 1.5 | Tooltip explicativo nos dois botões da contagem em `InventarioDetalhePage` — **sem warning**, só descrição: "Avança para o próximo ciclo se houver divergências" / "Encerra a lista no ciclo atual" | `InventarioDetalhePage.tsx` | Clareza sem dramatizar |
| 1.6 | Quando todas as listas estiverem ENCERRADA, exibir banner verde no card do inventário: "Todas as listas concluídas — encerre o inventário para seguir para Comparação" + botão **Encerrar Inventário** chamando `finalize-inventory` | `InventarioDetalhePage.tsx` | Fecha o gap do botão fantasma |

**Critério de aceite Onda 1:**
- Operador no celular sabe quando terminou.
- Supervisor descobre sozinho que precisa "encerrar o inventário" depois de encerrar todas as listas.
- Liberar lista exige perfil correto.

### Onda 2 — Reorganização do menu por blocos de propósito (~2h)

Sugestão original do Clenio: separar visualmente o que pertence a cada etapa do ciclo de vida.

**Menu proposto:**

```
Dashboard

INVENTÁRIOS
  Inventários
  Contagem
  Produtos
  Armazéns                              [STAFF]

ENCERRAMENTO                            [STAFF]
  Comparação
  Análise (divergências)

INTEGRAÇÃO PROTHEUS                     [STAFF]
  Importação (entrada)
  Envio (saída)
  Monitoramento

RELATÓRIOS                              [STAFF]
```

**Ganhos:**
- "Importação" e "Envio" passam a aparecer juntos (são os dois lados da integração com o ERP).
- "Comparação" e "Análise" formam o bloco de revisão pós-contagem.
- "Relatórios" fica como bloco transversal.

**Custo:** baixíssimo (mexe só em `Sidebar.tsx:25-38`). Sem mudança de rota — só reagrupamento visual.

### Onda 3 — Indicador de etapa + gating do envio (~4-6h, design + execução)

Os dois itens mais arquiteturais. Justificam-se pela **solução robusta**.

**3.1 Indicador de etapa no card do Inventário**

No card de cada inventário (lista e detalhe), badge de etapa atual + próximo passo recomendado:

```
[ EM CONTAGEM ]      Próximo: encerrar listas pendentes (3/5)
[ ENCERRADO ]        Próximo: rodar Comparação
[ COMPARADO ]        Próximo: revisar Análise (12 divergências)
[ ANALISADO ]        Próximo: enviar ao Protheus
[ INTEGRADO (CLOSED) ] Concluído
```

Implementação: campo derivado no `Inventory` (não persistir — calcular via property baseado em `status` + flags). Pode ser um helper `inventory.etapa_atual` no backend devolvido junto.

**Decisão de design pendente:** os estados intermediários "COMPARADO" e "ANALISADO" hoje **não existem** no modelo. Duas opções:

- **(A) Calcular por heurística** (existe registro em `inventory_comparison` para o inventário? então COMPARADO). Sem migration. Ágil. Risco: heurística pode mentir se a comparação foi rodada e descartada.
- **(B) Persistir `etapa_atual`** com migration. Confiável, auditável. Custo: migration + atualização nos endpoints relevantes.

Recomendação: **(B)** alinhado com `feedback_preferir_solucao_robusta.md`. Heurística é o tipo de paliativo que trava evolução.

**3.2 Gating do `send-protheus/finalize`**

Hoje o envio pode ser executado sem ter rodado comparação. Risco real de mandar dados errados.

Regra proposta no backend:
- `send-protheus/finalize` só aceita inventário com `etapa_atual >= ANALISADO`.
- Erro 409 com mensagem orientadora: "Rode a Comparação e revise a Análise antes de enviar."

UI espelha: botão "Enviar ao Protheus" desabilitado com tooltip explicativo enquanto não cumprida a sequência.

**Critério de aceite Onda 3:**
- Card mostra etapa e o que fazer a seguir, em qualquer momento.
- Backend rejeita envio prematuro com mensagem clara.
- Documentação atualizada em `inventario/CLAUDE.md` (estados + ordem das etapas).

---

## 4. Itens deliberadamente fora de escopo

- **Wizard "passo 1/2/3/4" com next/prev em página dedicada.** Avaliado e descartado: combina mal com casos onde supervisor quer revisitar etapa anterior. Indicador de etapa + gating cobrem o objetivo sem prender o usuário num fluxo linear.
- **Renomear "Encerrar Lista" para "Forçar Encerramento ⚠"**. Descartado por feedback do Clenio — caminho legítimo, não exceção.
- **Mexer nas abas do detalhe do inventário** (Visão geral / Itens / Lista / Análise). Estão validadas como boas.
- **Refazer telas de Importação / Hierarquia**. Validadas como boas.

---

## 5. Riscos

| Risco | Mitigação |
|-------|-----------|
| Onda 3 (etapa persistida) exige migration em produção — Inventário tem dado real | Migration aditiva (default = etapa derivada do status atual no momento da migration), seguindo `feedback_migrations.md` |
| Gating de envio pode pegar inventários antigos que pularam comparação | Backfill: marcar inventários `CLOSED` existentes como `etapa_atual = INTEGRADO` direto |
| Reorganização de menu confunde usuários acostumados | Onda 2 só renomeia/reagrupa visual — paths e telas continuam idênticas |

---

## 6. Estimativas e ordem sugerida

| Onda | Esforço | Pré-requisito | Quando faz sentido |
|------|---------|----------------|---------------------|
| 1 | ~3h | nenhum | Próxima sessão |
| 2 | ~2h | nenhum | Pode ir junto com Onda 1 |
| 3.1 (etapa) | ~3h | nenhum | Sessão dedicada |
| 3.2 (gating) | ~1-2h | 3.1 | Mesma sessão de 3.1 |

**Total estimado:** 9-11h (3 sessões).

---

## 7. Aprovação

- [ ] Onda 1 aprovada para execução
- [ ] Onda 2 aprovada para execução
- [ ] Onda 3 — escolha entre opção (A) heurística ou (B) persistir etapa
- [ ] Plano arquivado em `docs/MELHORIAS_BACKLOG.md` se postergado

---

*Última atualização: 02/05/2026*
