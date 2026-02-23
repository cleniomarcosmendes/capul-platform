# Roteiro de Testes — Capul Platform (Gestao TI)

**Data**: 23/02/2026
**Ambiente**: Docker Compose (HTTP, porta 80)
**URL Base**: http://localhost
**Credenciais**: admin / admin123

---

## Pre-requisitos

```bash
# Verificar containers rodando
docker compose ps
# Esperado: 7 containers UP (nginx, hub, auth-gateway, gestao-ti-backend, gestao-ti-frontend, postgres, redis)

# Verificar saude do banco
docker exec capul-db psql -U capul -d capul_platform -c "SELECT current_database();"

# Verificar seed auth-gateway
docker exec capul-db psql -U capul -d capul_platform -c "SELECT id, login, nome FROM core.usuarios;"

# Verificar seed gestao-ti
docker exec capul-db psql -U capul -d capul_platform -c "SELECT COUNT(*) as chamados FROM gestao_ti.chamados;"
```

---

## 1. HUB — Autenticacao e Navegacao

### 1.1 Tela de Login
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 1 | Acessar sistema | Abrir http://localhost | Redireciona para tela de login | |
| 2 | Login invalido | Digitar admin / senhaerrada, clicar Entrar | Mensagem de erro (credenciais invalidas) | |
| 3 | Login valido | Digitar admin / admin123, clicar Entrar | Redireciona para Hub (lista de modulos) | |
| 4 | Campos obrigatorios | Deixar campos vazios, clicar Entrar | Validacao impede envio | |

### 1.2 Hub (Selecao de Modulos)
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 5 | Listar modulos | Apos login, verificar cards | Deve aparecer "Gestao de TI" (e possivelmente "Inventario") | |
| 6 | Acessar Gestao TI | Clicar no card "Gestao de TI" | Navega para /gestao-ti/dashboard | |
| 7 | Perfil do usuario | Clicar no avatar/nome do usuario | Abre pagina de perfil com dados do admin | |
| 8 | Logout | Clicar em Sair/Logout | Volta para tela de login, token removido | |

---

## 2. DASHBOARD

### 2.1 Dashboard Operacional
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 9 | Carregar dashboard | Navegar para /gestao-ti/dashboard | Cards com metricas do seed (chamados, contratos, etc.) | |
| 10 | Cards de Suporte | Verificar secao Suporte | Chamados abertos, em atendimento, pendentes (dados do seed: 8 chamados) | |
| 11 | Cards de Contratos | Verificar secao Contratos | Total ativos, valor comprometido (2 contratos seed) | |
| 12 | Cards de Projetos | Verificar secao Projetos | Projetos ativos, em andamento (3 projetos seed) | |
| 13 | Cards de Portfolio | Verificar secao Portfolio | Softwares, licencas ativas (5 softwares, 3 licencas seed) | |
| 14 | Cards de Ativos | Verificar secao Ativos | Total ativos TI (6 ativos seed) | |
| 15 | Cards de Conhecimento | Verificar secao Conhecimento | Artigos publicados (3 artigos seed) | |
| 16 | Links "Ver mais" | Clicar em cada link dos cards | Navega para a pagina correta de cada modulo | |

### 2.2 Dashboard Executivo
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 17 | Acessar executivo | Sidebar > Executivo (icone PieChart) | Pagina com 7 secoes de KPIs | |
| 18 | Secao Suporte | Verificar KPIs | Abertos, Em Atendimento, Pendentes, Fechados/Mes, SLA Estourado, Tempo Medio, SLA Compliance | |
| 19 | Secao Contratos | Verificar KPIs | Ativos, Valor Comprometido, Vencendo 30d, Parcelas Atrasadas | |
| 20 | Secao Sustentacao | Verificar KPIs | Paradas Ativas, Paradas/Mes, MTTR | |
| 21 | Secao Projetos | Verificar KPIs | Ativos, Em Andamento, Custo Previsto/Realizado, Riscos Abertos | |
| 22 | Secao Portfolio | Verificar KPIs | Softwares, Licencas Ativas, Vencendo 30d, Custo Licencas | |
| 23 | Secao Infraestrutura | Verificar KPIs | Total Ativos, distribuicao por tipo | |
| 24 | Secao Conhecimento | Verificar KPIs | Artigos Publicados | |
| 25 | Links "Ver detalhes" | Clicar em cada link | Navega para a pagina do modulo correspondente | |

---

## 3. SUPORTE — Chamados

### 3.1 Listagem de Chamados
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 26 | Listar chamados | Sidebar > Chamados | Tabela com 8 chamados do seed | |
| 27 | Filtrar por status | Selecionar "Aberto" no filtro | Mostra apenas chamados com status ABERTO | |
| 28 | Filtrar por prioridade | Selecionar "Alta" | Mostra chamados com prioridade ALTA | |
| 29 | Limpar filtros | Voltar para "Todos" | Lista completa novamente | |
| 30 | Exportar Excel | Clicar botao "Exportar" | Download de arquivo .xlsx com dados dos chamados | |

### 3.2 Criar Chamado
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 31 | Abrir formulario | Clicar "Novo Chamado" | Pagina de criacao com campos | |
| 32 | Campos obrigatorios | Tentar enviar sem titulo | Validacao bloqueia envio | |
| 33 | Criar chamado simples | Preencher: Titulo="Teste Manual", Prioridade=MEDIA, Descricao="Teste do roteiro" | Chamado criado, redireciona para detalhe | |
| 34 | Selecionar software | Escolher software no select | Lista de softwares do seed aparece, modulos filtrados | |
| 35 | Selecionar catalogo | Escolher servico do catalogo | Lista de servicos do catalogo aparece | |

### 3.3 Detalhe do Chamado
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 36 | Ver detalhe | Clicar em um chamado da lista | Pagina com info completa + timeline | |
| 37 | Timeline/Historico | Verificar secao de historico | Eventos de criacao listados | |
| 38 | Assumir chamado | Clicar "Assumir" (se disponivel) | Status muda para EM_ATENDIMENTO, tecnico atribuido | |
| 39 | Adicionar comentario | Escrever comentario e salvar | Comentario aparece na timeline | |
| 40 | Transferir para equipe | Clicar "Transferir" > selecionar equipe | Chamado transferido, historico atualizado | |
| 41 | Resolver chamado | Clicar "Resolver", preencher solucao | Status muda para RESOLVIDO | |
| 42 | Fechar chamado | Clicar "Fechar" | Status muda para FECHADO | |

---

## 4. SUPORTE — Catalogo de Servicos

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 43 | Listar catalogo | Sidebar > Catalogo | Lista de servicos do catalogo | |
| 44 | Criar servico | Clicar "Novo", preencher dados | Servico criado na lista | |
| 45 | Editar servico | Clicar em servico, alterar | Dados atualizados | |
| 46 | Desativar servico | Alterar status para inativo | Servico marcado como inativo | |

---

## 5. SUPORTE — SLA

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 47 | Listar SLAs | Sidebar > SLA | Tabela com 12 SLAs do seed (4 prioridades x 3 tipos) | |
| 48 | Criar SLA | Preencher: prioridade, tipo, tempos | SLA criado | |
| 49 | Editar SLA | Clicar em SLA, alterar tempos | Dados atualizados | |

---

## 6. SUPORTE — Ordens de Servico

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 50 | Listar OS | Sidebar > Ordens de Servico | Tabela com 2 OS do seed | |
| 51 | Filtrar por status | Selecionar "Aberta" | Filtra corretamente | |
| 52 | Criar OS | Clicar "Nova OS", preencher titulo + tecnico | OS criada na lista | |
| 53 | Editar status | Clicar "Editar" em uma OS, alterar status | Status atualizado | |

---

## 7. PORTFOLIO — Softwares

### 7.1 Lista de Softwares
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 54 | Listar softwares | Sidebar > Softwares | Tabela com 5 softwares do seed | |
| 55 | Filtrar por status | Selecionar "Ativo" | Filtra por status | |
| 56 | Exportar Excel | Clicar "Exportar" | Download .xlsx | |

### 7.2 Criar/Editar Software
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 57 | Novo software | Clicar "Novo Software", preencher dados | Software criado | |
| 58 | Editar software | Abrir detalhe, clicar Editar | Formulario com dados preenchidos | |

### 7.3 Detalhe do Software (4 Tabs)
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 59 | Tab Modulos | Aba "Modulos" no detalhe | Lista de modulos do software | |
| 60 | Adicionar modulo | Clicar "Novo Modulo", preencher | Modulo adicionado a lista | |
| 61 | Tab Filiais | Aba "Filiais" | Lista de filiais vinculadas | |
| 62 | Tab Licencas | Aba "Licencas" | Licencas vinculadas ao software | |
| 63 | Tab Disponibilidade | Aba "Disponibilidade" | Metricas de uptime/downtime | |

---

## 8. PORTFOLIO — Licencas

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 64 | Listar licencas | Sidebar > Licencas | Tabela com 3 licencas do seed | |
| 65 | Cards resumo | Verificar cards no topo | Ativas, Vencendo 30d, Vencidas, Custo Total | |
| 66 | Filtrar por status | Selecionar "Ativa" | Filtra corretamente | |
| 67 | Filtrar por software | Selecionar um software | Mostra licencas daquele software | |
| 68 | Filtrar vencendo | Selecionar "30 dias" | Mostra licencas vencendo em 30d | |
| 69 | Renovar licenca | Clicar "Renovar" em uma licenca ativa | Data de vencimento atualizada | |
| 70 | Inativar licenca | Clicar "Inativar" | Status muda para INATIVA | |
| 71 | Link para software | Clicar no nome do software | Navega para detalhe do software | |
| 72 | Link para contrato | Clicar no numero do contrato | Navega para detalhe do contrato | |
| 73 | Exportar | Clicar "Exportar" | Download .xlsx | |

---

## 9. CONTRATOS

### 9.1 Lista de Contratos
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 74 | Listar contratos | Sidebar > Contratos | Tabela com 2 contratos do seed | |
| 75 | Filtrar por status | Selecionar "Vigente" | Filtra corretamente | |
| 76 | Filtrar por tipo | Selecionar tipo de contrato | Filtra por tipo | |
| 77 | Exportar | Clicar "Exportar" | Download .xlsx | |

### 9.2 Criar Contrato
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 78 | Novo contrato | Clicar "Novo Contrato", preencher | Contrato criado | |
| 79 | Campos obrigatorios | Tentar enviar sem numero | Validacao bloqueia | |

### 9.3 Detalhe do Contrato (4 Tabs)
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 80 | Info geral | Abrir detalhe de contrato | Dados do contrato + status badge | |
| 81 | Tab Parcelas | Aba "Parcelas" | Lista de parcelas (6 por contrato seed) | |
| 82 | Pagar parcela | Clicar "Pagar" em parcela pendente | Status muda para PAGA, data pagamento preenchida | |
| 83 | Tab Rateio | Aba "Rateio" | Configuracao de rateio por centro de custo | |
| 84 | Simular rateio | Configurar modalidade + itens, clicar Simular | Mostra preview dos valores rateados | |
| 85 | Tab Licencas | Aba "Licencas" | Licencas vinculadas ao contrato | |
| 86 | Vincular licenca | Selecionar licenca, vincular | Licenca aparece na lista do contrato | |
| 87 | Tab Historico | Aba "Historico" | Timeline de alteracoes | |
| 88 | Renovar contrato | Clicar "Renovar" (se vigente) | Status atualizado, historico registrado | |

### 9.4 Dashboard Financeiro
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 89 | Acessar financeiro | Sidebar > Financeiro | Pagina com graficos/metricas financeiras | |
| 90 | Por tipo de contrato | Verificar distribuicao | Valores agrupados por tipo | |
| 91 | Por centro de custo | Verificar distribuicao | Valores por CC | |
| 92 | Proximas parcelas | Verificar lista | Parcelas proximas ao vencimento | |

---

## 10. SUSTENTACAO — Paradas

### 10.1 Lista de Paradas
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 93 | Listar paradas | Sidebar > Paradas | Tabela com 2 paradas do seed | |
| 94 | Filtrar por status | Selecionar status | Filtra corretamente | |
| 95 | Exportar | Clicar "Exportar" | Download .xlsx | |

### 10.2 Criar Parada
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 96 | Nova parada | Clicar "Nova Parada", preencher | Parada criada | |
| 97 | Selecionar software | Escolher software afetado | Lista de softwares do seed | |
| 98 | Selecionar filiais | Marcar filiais afetadas | Filiais selecionadas | |

### 10.3 Detalhe da Parada
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 99 | Ver detalhe | Clicar em parada | Info completa + filiais afetadas | |
| 100 | Finalizar parada | Clicar "Finalizar", informar causa raiz | Status muda, duracao calculada | |

### 10.4 Dashboard Disponibilidade
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 101 | Acessar disponibilidade | Sidebar > Disponibilidade | Dashboard com metricas | |
| 102 | Uptime por software | Verificar tabela/graficos | Dados de disponibilidade | |
| 103 | MTTR | Verificar metrica | Mean Time to Recovery calculado | |

---

## 11. PROJETOS

### 11.1 Lista de Projetos
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 104 | Listar projetos | Sidebar > Projetos | Cards/tabela com 3 projetos do seed | |
| 105 | Filtrar por status | Selecionar "Em Andamento" | Filtra corretamente | |
| 106 | Filtrar por tipo | Selecionar tipo | Filtra por tipo | |
| 107 | Exportar | Clicar "Exportar" | Download .xlsx | |

### 11.2 Criar Projeto
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 108 | Novo projeto | Clicar "Novo Projeto", preencher | Projeto criado | |
| 109 | Modo simples | Selecionar modo SIMPLES | Formulario com campos basicos | |
| 110 | Modo completo | Selecionar modo COMPLETO | Formulario com todos os campos | |
| 111 | Hierarquia | Selecionar projeto pai | Sub-projeto vinculado | |

### 11.3 Detalhe do Projeto (11 Tabs)
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 112 | Info geral | Abrir detalhe de projeto | Dados + status + progresso | |
| 113 | Tab Sub-projetos | Aba "Sub-projetos" | Projetos filhos (se houver) | |
| 114 | Tab Equipe | Aba "Equipe" | Membros do projeto com papel RACI | |
| 115 | Adicionar membro | Clicar "Adicionar Membro" | Formulario com usuario + papel | |
| 116 | Tab Fases | Aba "Fases" | Lista de fases do projeto | |
| 117 | Criar fase | Adicionar fase com datas | Fase na timeline | |
| 118 | Tab Timeline | Aba "Timeline" | Atividades do projeto | |
| 119 | Tab Cotacoes | Aba "Cotacoes" | Lista de cotacoes | |
| 120 | Criar cotacao | Adicionar cotacao | Cotacao na lista | |
| 121 | Tab Custos | Aba "Custos" | Custos previstos x realizados | |
| 122 | Registrar custo | Adicionar custo | Custo consolidado atualizado | |
| 123 | Tab Riscos | Aba "Riscos" (modo COMPLETO) | Matriz de riscos | |
| 124 | Criar risco | Adicionar risco com probabilidade/impacto | Risco na matriz | |
| 125 | Tab Dependencias | Aba "Dependencias" (modo COMPLETO) | Dependencias entre projetos | |
| 126 | Tab Anexos | Aba "Anexos" | Lista de anexos | |
| 127 | Tab Horas | Aba "Horas" (modo COMPLETO) | Apontamentos de horas | |
| 128 | Apontar horas | Registrar apontamento | Horas na lista, total atualizado | |
| 129 | Tab Chamados | Aba "Chamados" | Chamados vinculados ao projeto | |

---

## 12. INFRAESTRUTURA — Ativos (CMDB)

### 12.1 Lista de Ativos
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 130 | Listar ativos | Sidebar > Ativos | Tabela com 6 ativos do seed | |
| 131 | Cards resumo | Verificar cards no topo | Total, por status, por tipo | |
| 132 | Filtrar por tipo | Selecionar "Servidor" | Filtra por tipo | |
| 133 | Filtrar por status | Selecionar "Ativo" | Filtra por status | |
| 134 | Exportar | Clicar "Exportar" | Download .xlsx | |

### 12.2 Criar Ativo
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 135 | Novo ativo | Clicar "Novo Ativo", preencher | Ativo criado | |
| 136 | Campos obrigatorios | Verificar nome, tipo, status | Validacao funciona | |
| 137 | Info tecnica | Preencher hostname, IP, SO, RAM, disco | Dados salvos corretamente | |

### 12.3 Detalhe do Ativo (2 Tabs)
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 138 | Tab Softwares | Aba "Softwares Instalados" | Lista de softwares no ativo | |
| 139 | Instalar software | Clicar "Adicionar Software" | Software vinculado ao ativo | |
| 140 | Tab Info Tecnica | Aba "Informacoes Tecnicas" | Hostname, IP, SO, specs | |

---

## 13. BASE DE CONHECIMENTO

### 13.1 Lista de Artigos
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 141 | Listar artigos | Sidebar > Base de Conhecimento | Cards com 3 artigos do seed | |
| 142 | Filtrar por categoria | Selecionar categoria | Filtra por categoria | |
| 143 | Filtrar por status | Selecionar "Publicado" | Filtra por status | |
| 144 | Buscar | Digitar texto na busca | Filtra artigos por titulo/conteudo | |

### 13.2 Criar Artigo
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 145 | Novo artigo | Clicar "Novo Artigo", preencher | Artigo criado como RASCUNHO | |
| 146 | Publicar | Abrir artigo rascunho, clicar "Publicar" | Status muda para PUBLICADO | |
| 147 | Arquivar | Abrir artigo publicado, clicar "Arquivar" | Status muda para ARQUIVADO | |

### 13.3 Detalhe do Artigo
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 148 | Ver artigo | Clicar em artigo publicado | Conteudo completo renderizado | |
| 149 | Editar artigo | Clicar "Editar" | Formulario com dados preenchidos | |

---

## 14. EQUIPES

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 150 | Listar equipes | Sidebar > Equipes | Tabela com 3 equipes do seed | |
| 151 | Nova equipe | Clicar "Nova Equipe", preencher | Equipe criada | |
| 152 | Detalhe equipe | Clicar em equipe | Membros listados | |
| 153 | Adicionar membro | Adicionar usuario a equipe | Membro na lista | |
| 154 | Alterar papel | Mudar papel do membro | Papel atualizado (lider, membro) | |

---

## 15. CADASTROS (Core Read-Only)

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 155 | Departamentos | Sidebar > Departamentos | Lista de departamentos (schema core) | |
| 156 | Centros de Custo | Sidebar > Centros de Custo | Lista de centros de custo (schema core) | |

---

## 16. NOTIFICACOES

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 157 | Badge no header | Verificar icone sino no topo | Badge com numero de nao lidas (3 seed) | |
| 158 | Listar notificacoes | Clicar no sino | Pagina com lista de notificacoes | |
| 159 | Marcar como lida | Clicar em notificacao | Status muda para lida, badge atualiza | |
| 160 | Filtrar nao lidas | Ativar filtro "Nao lidas" | Mostra apenas nao lidas | |
| 161 | Excluir notificacao | Clicar excluir | Notificacao removida da lista | |
| 162 | Notificacao automatica | Assumir um chamado | Nova notificacao gerada automaticamente | |

---

## 17. IMPORT/EXPORT

### 17.1 Exportacao
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 163 | Exportar ativos | Lista Ativos > Exportar | Arquivo .xlsx com todos os ativos | |
| 164 | Exportar chamados | Lista Chamados > Exportar | Arquivo .xlsx com chamados | |
| 165 | Exportar contratos | Lista Contratos > Exportar | Arquivo .xlsx | |
| 166 | Exportar softwares | Lista Softwares > Exportar | Arquivo .xlsx | |
| 167 | Exportar licencas | Lista Licencas > Exportar | Arquivo .xlsx | |
| 168 | Exportar paradas | Lista Paradas > Exportar | Arquivo .xlsx | |
| 169 | Exportar projetos | Lista Projetos > Exportar | Arquivo .xlsx | |

### 17.2 Importacao
| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 170 | Acessar import | Sidebar > Importar Dados | Wizard de importacao (step 1) | |
| 171 | Upload arquivo | Selecionar tipo + arquivo Excel | Preview dos dados (step 2) | |
| 172 | Validar preview | Verificar dados na tabela preview | Erros marcados em vermelho | |
| 173 | Executar import | Clicar "Importar" | Resultado com sucesso/falhas (step 3) | |

---

## 18. NAVEGACAO E UX

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 174 | Sidebar responsiva | Verificar sidebar em desktop | Todas as secoes visiveis: Dashboard, Executivo, Suporte, Portfolio, Contratos, Sustentacao, Projetos, Infraestrutura, Conhecimento, Cadastros, Configuracoes | |
| 175 | Icones sidebar | Verificar icones | Cada item tem icone correto (Lucide React) | |
| 176 | Breadcrumbs/Header | Verificar titulo no header | Titulo muda conforme pagina atual | |
| 177 | Loading states | Navegar entre paginas | Indicador "Carregando..." aparece durante fetch | |
| 178 | Empty states | Filtrar por status sem resultados | Mensagem "Nenhum X encontrado" | |
| 179 | Voltar ao Hub | Verificar opcao de voltar | Link/botao para retornar ao Hub | |

---

## 19. FLUXOS COMPLETOS (End-to-End)

### 19.1 Fluxo Completo: Ciclo de Chamado
| # | Passo | Acao | Verificacao |
|---|-------|------|-------------|
| 180 | 1. Criar | Novo Chamado: "Servidor lento", prioridade ALTA, software do seed | Chamado criado com status ABERTO |
| 181 | 2. Assumir | Clicar "Assumir" | Status: EM_ATENDIMENTO, tecnico = admin |
| 182 | 3. Comentar | Adicionar "Analisando logs do servidor" | Comentario na timeline |
| 183 | 4. Resolver | Clicar "Resolver", solucao "Reiniciado servico" | Status: RESOLVIDO |
| 184 | 5. Fechar | Clicar "Fechar" | Status: FECHADO |
| 185 | 6. Verificar | Dashboard > Cards suporte | Numeros atualizados |

### 19.2 Fluxo Completo: Contrato com Parcelas e Rateio
| # | Passo | Acao | Verificacao |
|---|-------|------|-------------|
| 186 | 1. Criar contrato | Novo Contrato com dados completos | Contrato criado com status VIGENTE |
| 187 | 2. Adicionar parcelas | Tab Parcelas > nova parcela | Parcela na lista |
| 188 | 3. Configurar rateio | Tab Rateio > definir centro de custo | Rateio configurado |
| 189 | 4. Vincular licenca | Tab Licencas > vincular | Licenca associada |
| 190 | 5. Pagar parcela | Clicar "Pagar" na parcela | Status PAGA |
| 191 | 6. Verificar financeiro | Dashboard Financeiro | Valores atualizados |

### 19.3 Fluxo Completo: Registro de Parada
| # | Passo | Acao | Verificacao |
|---|-------|------|-------------|
| 192 | 1. Criar parada | Nova Parada: software do seed, tipo EMERGENCIAL | Parada criada, EM_ANDAMENTO |
| 193 | 2. Verificar dashboard | Dashboard > Sustentacao | Paradas ativas +1 |
| 194 | 3. Finalizar | Detalhe > Finalizar, causa raiz | Status FINALIZADA, duracao calculada |
| 195 | 4. Verificar disponibilidade | Dashboard Disponibilidade | Metricas atualizadas |

---

## 20. SESSAO E SEGURANCA

| # | Teste | Passos | Resultado Esperado | OK? |
|---|-------|--------|--------------------|-----|
| 196 | Token expirado | Esperar ou limpar token no localStorage | Redireciona para login | |
| 197 | Refresh token | Verificar se token e renovado | Sessao continua sem re-login | |
| 198 | Trocar senha | Perfil > Trocar Senha | Senha alterada, funciona no proximo login | |
| 199 | Acesso sem permissao | Acessar URL direta sem login | Redireciona para login | |
| 200 | CORS | Abrir DevTools > Console | Nenhum erro de CORS | |

---

## Resumo

| Modulo | Testes | Dependencia Seed |
|--------|--------|------------------|
| Hub/Login | 1-8 | admin/admin123 |
| Dashboard | 9-25 | Todos os seeds |
| Chamados | 26-42 | 8 chamados |
| Catalogo | 43-46 | - |
| SLA | 47-49 | 12 SLAs |
| Ordens Servico | 50-53 | 2 OS |
| Softwares | 54-63 | 5 softwares |
| Licencas | 64-73 | 3 licencas |
| Contratos | 74-92 | 2 contratos |
| Paradas | 93-103 | 2 paradas |
| Projetos | 104-129 | 3 projetos |
| Ativos | 130-140 | 6 ativos |
| Conhecimento | 141-149 | 3 artigos |
| Equipes | 150-154 | 3 equipes |
| Cadastros | 155-156 | core schema |
| Notificacoes | 157-162 | 3 notificacoes |
| Import/Export | 163-173 | - |
| Navegacao/UX | 174-179 | - |
| Fluxos E2E | 180-195 | Seed completo |
| Seguranca | 196-200 | - |
| **TOTAL** | **200 testes** | |

---

## Comandos Uteis Durante Teste

```bash
# Ver logs de um container especifico
docker compose logs -f auth-gateway
docker compose logs -f gestao-ti-backend
docker compose logs -f nginx

# Restart de container especifico
docker compose restart gestao-ti-backend

# Verificar banco diretamente
docker exec -it capul-db psql -U capul -d capul_platform

# Queries uteis
SELECT COUNT(*) FROM gestao_ti.chamados;
SELECT COUNT(*) FROM gestao_ti.contratos;
SELECT COUNT(*) FROM gestao_ti.projetos;
SELECT * FROM core.usuarios;

# Rebuild completo (se necessario)
docker compose up -d --build auth-gateway gestao-ti-backend gestao-ti-frontend hub nginx
```

---

**Observacoes**:
- O sistema roda em HTTP (sem SSL) — ambiente de desenvolvimento
- Dados do seed sao fabricados, testar com dados reais na proxima fase
- Bugs encontrados devem ser documentados com: pagina, acao, resultado esperado vs obtido, screenshot
