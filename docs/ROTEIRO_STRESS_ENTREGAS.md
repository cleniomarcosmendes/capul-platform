# Roteiro de ESTRESSE — Entregas Domiciliares (Logística)

**Gerado em:** 18/07/2026 · **Objetivo:** estressar o **processo real do dia-a-dia** das Entregas domiciliares do supermercado — ciclo completo (cadastro no balcão → montar rota → despachar → baixa/prova → concluir), com variações, matriz RBAC e casos de borda.
**Ambiente:** `https://localhost/entregas/` (Logística). Fluxo de ENTREGA = `viagem.tipo=ENTREGA` (distinto de Frota/RDV).
**Como rodar:** Chrome (skill) para a parte web; app Expo (manual, no aparelho) para a baixa do entregador. Cenários **🔧** exercem a regra do backend (UI×RBAC) — se a skill não fizer requisição direta, marcar "backend-only".

---

## Filial de teste & Personas

⚠️ **As Entregas rodam na filial SUPERMERCADO UNAI (código 02)** — não na filial do RDV/Frota. Logar e **selecionar a filial 02** no seletor.

| Papel | Login | Filial | Observação |
|---|---|---|---|
| **GESTOR_ENTREGA** | `renataborges` | tem **02 (SUPERMERCADO UNAI)** + outras | cadastra/monta/despacha/painel/comprovantes; papel de filial |
| **ENTREGADOR** | `wandersonnascimento` | **02** | único ENTREGADOR da 02 → aparece no seletor de motorista; dá baixa no app |
| OPERADOR_ENTREGA | `condutor_col` (PADRÃO), `condutor_ind` | confirmar filial | cadastra/monta/baixa; NÃO vê comprovantes |
| ADMIN | `admin` | global | passa em tudo |

> Senhas: `renataborges`/`wandersonnascimento` → memória `reference_test_users_logistica`; seed (`condutor_col` etc.) → **`123456` (CONFIRMADO** — login testado via API 18/07). **Você digita as senhas.**
> ⚠️ Os logins PADRÃO/OPERADOR de seed (`condutor_col`, `portaria01`, `condutor_ind`) estão na **filial 01 (AGROVETERINARIA)**, não na 02. Para Entregas na filial 02, use **`renataborges`** (GESTOR_ENTREGA, tem a 02) + **`wandersonnascimento`** (ENTREGADOR da 02).

## Fixtures (DEV)

- **Veículo DISPONÍVEL na filial 02:** **`SUP01`** (para montar/despachar rota).
- **Filial 02 (SUPERMERCADO UNAI):** ~41 entregas ENTREGUE + 1 NÃO_ENTREGUE, 8 rotas CONCLUÍDA (histórico p/ Painel/Análise/Comprovantes).
- **Filial 01 (AGROVETERINARIA UNAI):** **1 rota EM_CURSO + 3 entregas EM_VIAGEM** (dá pra testar baixa ao vivo se o motorista da rota tiver app; senão, criar um ciclo novo na 02).
- **Clientes reais p/ autofill (Protheus SA1, leitura):** CLENIO MARCOS MENDES `E01047` · RENATA BORGES `E01981` · THIAGO MACEDO `E04060` (matrícula/nome/telefone). Bloqueados (A1_MSBLQL='1') nunca aparecem.
- 23 endereços cadastrados.

**Máquina de estados** — Entrega: `PENDENTE → EM_VIAGEM → {ENTREGUE | NAO_ENTREGUE}`; `NAO_ENTREGUE → PENDENTE` (nova tentativa); `PENDENTE → CANCELADA`. Viagem(ENTREGA): `RASCUNHO → EM_CURSO → CONCLUIDA` (descartar RASCUNHO = delete).

---

## E1. Cadastrar entrega no balcão (3 variantes)
- **Tela:** Entregas → **Nova entrega** (`/entregas/nova`), como `renataborges` (filial 02).
- **E1a — IDENTIFICADO ("Com matrícula"):** tipo cliente **Com matrícula** → digitar `E01047` (ou nome/telefone) → **autofill** puxa nome/telefone/endereços do Protheus (rótulo "Cadastro") → escolher endereço → volumes + **origem da venda** (obrigatório) → **Salvar entrega**. **Esperado:** entrega **PENDENTE**, nº sequencial.
- **E1b — RECORRENTE (local):** tipo **Recorrente (local)** → escolher um ClienteLocal da filial → endereço → salvar. **Esperado:** PENDENTE, endereço reutilizável.
- **E1c — EVENTUAL:** tipo **Eventual** (sem matrícula) → nome + telefone + endereço digitado → salvar. **Esperado:** PENDENTE; ⚠️ o endereço do EVENTUAL **não** é persistido como reutilizável (não volta no próximo autofill).
- **E1d — Erros** 🔧: sem origem da venda → toast "Informe a origem da venda…"; sem endereço → 400 "Informe enderecoEntregaId ou os campos de endereço (endLogradouro)."; sem filial no perfil → "Sem filial no perfil — selecione uma filial no Hub.".
- **E1e — Operador PADRÃO (caixa compartilhado)** 🔧: logado com login **PADRÃO** (ex.: `condutor_col`), o cadastro exige **matrícula+senha do operador** ("Identifique-se para cadastrar entregas") → sem → "Identifique-se: informe matrícula e senha do operador."; RH fora → 503 "Portal do RH indisponível…"; inválida → "Matrícula ou senha do operador inválidas.".
- **E1f — Autofill Protheus** 🔧: buscar por matrícula (`/^[ACEF]\d+/`), telefone (≥8 díg) e nome (≥3) → retorna clientes + endereços + histórico; cliente **bloqueado** (A1_MSBLQL) **não** aparece.

## E2. Editar / cancelar / nova tentativa
- **E2a — Editar (só PENDENTE, fora de rota):** editar uma entrega PENDENTE (`/entregas/:id/editar`) → **Salvar alterações**. 🔧 editar não-PENDENTE → "Só entrega PENDENTE pode ser editada (status atual: X)."; editar entrega já em rota → "Entrega está na viagem #N — remova-a da viagem antes de editar.".
- **E2b — Cancelar (só PENDENTE, sem parada):** cancelar uma PENDENTE. 🔧 cancelar despachada → "Só é possível cancelar entrega PENDENTE… Entrega despachada não se cancela aqui."; em montagem → "Entrega está na viagem #N (em montagem). Remova-a da viagem…".
- **E2c — Nova tentativa (só NAO_ENTREGUE):** numa entrega NÃO_ENTREGUE cuja rota já concluiu → **Nova tentativa** → volta **PENDENTE**, incrementa `tentativas`, arquiva no histórico. 🔧 nova tentativa com rota ainda EM_CURSO → "A viagem #N ainda está em curso — conclua-a antes da nova tentativa.".

## E3. Montar rota + seletor de motorista + sugerir ordem
- **E3a — Montar rota (A2):** Entregas → **Montar rota** (`/viagens/montar`) → adicionar entregas PENDENTES ao "carrinho" → escolher **veículo** + **motorista**. **Esperado (A2):** o seletor de motorista lista **só ENTREGADOR da filial 02** = **Wanderson Nascimento** (não gestores/coordenadores/supervisores) → **Salvar montagem**. Sem entregas → toast "Adicione ao menos uma entrega à rota.".
- **E3b — Sugerir ordem (OSRM/haversine):** **"Sugerir melhor rota"** → reordena por rua (OSRM) com fallback haversine (`fonteDistancia` no retorno); grava pins geo das entregas. 🔧 <2 entregas → "Selecione ao menos 2 entregas para sugerir a ordem da rota."; >60 → "Máximo de 60 entregas por sugestão de rota.".
- **E3c — Editar rascunho:** trocar veículo/motorista, adicionar/remover/reordenar (↑↓); descartar montagem (as entregas voltam à fila PENDENTE). 🔧 editar viagem não-RASCUNHO → "Só viagem em RASCUNHO pode ser editada (situação: X).".
- **E3d — Race** 🔧: montar rota com uma entrega que **outro** operador já montou → "Entrega já está em outra viagem." / "Entrega não está PENDENTE.".

## E4. Romaneio / Etiquetas
- **E4a — Romaneio:** no detalhe da rota → link **Romaneio** (`/entregas/romaneio/viagem/:id`, nova aba) → confere Rota #, motorista, placa, paradas/volumes → **Imprimir**.
- **E4b — Etiquetas:** **Etiquetas** (por viagem ou por entrega) → etiqueta 72–80mm, quebra de página por entrega → **Imprimir**.

## E5. Despachar
- **E5a:** no detalhe do RASCUNHO (com veículo + motorista + ≥1 parada) → **Despachar** (confirm "Despachar rota"). **Esperado:** rota → **EM_CURSO**, entregas → **EM_VIAGEM**, veículo → EM_USO, grava KM inicial.
- **E5b — Erros** 🔧: despachar sem entregas → "Viagem sem entregas — adicione paradas antes de despachar."; sem veículo/motorista → "Defina veículo e motorista antes de despachar."; veículo indisponível → "Veículo não está disponível (situação: X)."; kmInicial < kmAtual → "KM inicial (X) menor que o KM atual do veículo (Y).".

## E6. Baixa / prova de entrega (app entregador + balcão)
- **E6a — Baixa ENTREGUE (app):** logado como **wandersonnascimento** no app → abrir a rota EM_CURSO → uma entrega EM_VIAGEM → **Confirmar entrega** com **foto** e/ou **assinatura** e/ou **"quem recebeu"** → status **ENTREGUE**, prova no cofre (foto é carimbada com endereço/GPS/data), GPS best-effort.
- **E6b — Baixa NÃO_ENTREGUE (app):** **Confirmar não-entrega** + **motivo** (obrigatório) → status **NAO_ENTREGUE**.
- **E6c — Erros de baixa** 🔧: ENTREGUE sem nenhuma prova (foto/assinatura/recebedor) → "Informe uma prova de entrega: foto, assinatura ou quem recebeu."; NÃO_ENTREGUE sem motivo → "Informe o motivo da não-entrega."; baixar entrega que **não** está EM_VIAGEM → "Só é possível dar baixa em entrega EM_VIAGEM…"; baixar de **outra filial** → "Registro de outra filial — acesso não permitido.".
- **E6d — Idempotência offline (app):** reenvio da mesma baixa (mesma `idempotencyKey`) numa entrega já terminal → **no-op**, não duplica comprovante.
- **E6e — Baixa em massa (balcão):** ver E7 (Concluir baixa entregas EM_VIAGEM sem prova).

## E7. Iniciar / Concluir viagem
- **E7a — Iniciar (app):** na rota EM_CURSO, registrar **KM de saída** (obrigatório). 🔧 km < kmAtual → "KM de saída (X) menor que o KM atual do veículo (Y).".
- **E7b — Concluir:** **Concluir** a rota (app "Encerrar entrega" ou balcão) → entregas ainda EM_VIAGEM são **baixadas SEM prova** (confirm com aviso) → status CONCLUÍDA, veículo liberado, KM final. 🔧 kmFinal < kmInicial → "KM final (X) menor que o KM de saída (Y)."; concluir não-EM_CURSO → "Só conclui viagem EM_CURSO (atual: X).".
- *(Auto-conclusão foi DESLIGADA em 30/06 — a rota é encerrada explicitamente.)*

## E8. Endereços / Geocode
- **E8a — CRUD de endereço** (`/cadastro/enderecos`): criar/editar/remover (soft-delete). 🔧 `clienteLocalId` inválido → "clienteLocalId inválido."; busca sem chave → "Informe matricula ou clienteLocalId."; inexistente → "Endereço não encontrado.".
- **E8b — Recalcular localizações (gestor):** em Montar rota, botão **"Recalcular localizações"** (só GESTOR) → re-geocodifica as entregas não-canceladas da filial; reporta `semCoordenada`.
- **E8c — Geocode fallback (cidade pequena)** 🔧: entrega cujo endereço não resolve na rua → fallback **rua→bairro→município** (precisão BAIRRO/CIDADE); sem cidade/UF → sem coordenada, badge ⚠, vai pro **fim** da rota sugerida.

## E9. Painel / Análise / Comprovantes
- **E9a — Painel** (`/painel`, GESTOR/OPERADOR): cartões de FILA (pendentes/em viagem "agora") + fluxo do mês (entregues/não-entregues/canceladas) + por filial/veículo/motorista/origem + prazo médio + série por dia. Filtros mês/ano.
- **E9b — Análise** (`/analise-entregas`): manchete + grupos + drill-down por origem/status/motorista/bairro; documentos por dimensão.
- **E9c — Comprovantes/cofre** (`/comprovantes`, **só GESTOR_ENTREGA**): buscar baixadas por matrícula/cupom/nº entrega → ver metadados + **baixar arquivo** (foto/assinatura). 🔧 comprovante inexistente → "Comprovante não encontrado".
- **E9d — Escopo de leitura** 🔧: GESTOR_ENTREGA vê **só a própria filial**; só ADMIN/GESTOR_FROTA veem outras filiais no painel.

## E10. RBAC de Entregas (UI × API)
- **E10a — ENTREGADOR não monta/despacha** 🔧: `wandersonnascimento` só tem app (GET viagem, iniciar, concluir, baixar); montar/despachar via API → 403.
- **E10b — GESTOR_ENTREGA é papel de FILIAL** 🔧: só a própria filial; `filialId` de outra no body → "Operação fora da sua filial." / leitura de outra filial bloqueada.
- **E10c — Comprovantes só GESTOR** 🔧: OPERADOR_ENTREGA em `/comprovantes` → 403.
- **E10d — Regeocodificar** só GESTOR_ENTREGA/GESTOR_FROTA; consolidar local só GESTOR_FROTA/SUPERVISOR_FROTA.

## E11. Casos de borda extras
- **E11a — Motorista perdeu o papel ENTREGADOR** 🔧: some do seletor, mas um rascunho antigo com o ID dele ainda despacha (a validação só checa existência do usuário, não o papel) — **possível brecha**, reportar.
- **E11b — Prova com cofre/MinIO indisponível** 🔧: baixa ENTREGUE com foto **falha** (prova é gravada antes de fechar a baixa) — verificar se o app enfileira ou alerta; busca de baixadas/comprovantes **degrada** (lista sem tipo de prova, não quebra).
- **E11c — Mesma matrícula com N endereços** (Protheus SA1): dedupe por logradouro+complemento+cidade+cep no autofill.
- **E11d — Cliente EVENTUAL repetido:** confirmar que não vira cadastro reutilizável (some do autofill seguinte).

---

## Registro de resultados

| # | Cenário | Status | Observação |
|---|---|---|---|
| E1a–E1f | Cadastrar entrega (3 variantes + operador + autofill) | ⬜ | |
| E2a–E2c | Editar / cancelar / nova tentativa | ⬜ | |
| E3a–E3d | Montar rota + seletor motorista (A2) + sugerir ordem | ⬜ | |
| E4a–E4b | Romaneio / etiquetas | ⬜ | |
| E5a–E5b | Despachar | ⬜ | |
| E6a–E6e | Baixa / prova (app + balcão) | ⬜ | |
| E7a–E7b | Iniciar / concluir viagem | ⬜ | |
| E8a–E8c | Endereços / geocode | ⬜ | |
| E9a–E9d | Painel / análise / comprovantes | ⬜ | |
| E10a–E10d | RBAC (UI × API) | ⬜ | |
| E11a–E11d | Casos de borda | ⬜ | |
