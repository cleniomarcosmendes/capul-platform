# ✅ CHECKLIST PRÉ-TESTE FINAL - v2.17.3

**Data**: 02/11/2025
**Versão**: 2.17.3
**Responsável**: Equipe de Desenvolvimento

---

## 🔐 **1. SEGURANÇA E AUTENTICAÇÃO**

- [ ] Testar login com credenciais corretas (admin/admin123)
- [ ] Testar login com credenciais incorretas (deve bloquear)
- [ ] Verificar expiração de token JWT (após 1 hora)
- [ ] Testar logout e redirecionamento
- [ ] Validar permissões RBAC:
  - [ ] ADMIN: acesso total
  - [ ] SUPERVISOR: sem acesso a usuários/lojas
  - [ ] OPERATOR: apenas counting_mobile.html

---

## 📦 **2. FLUXO DE INVENTÁRIO COMPLETO**

### **2.1 Criação de Inventário**
- [ ] Criar inventário sem produtos (deve permitir)
- [ ] Criar inventário com nome duplicado (deve bloquear)
- [ ] Criar inventário e adicionar produtos via modal
- [ ] Verificar filtros no modal "Adicionar Produtos":
  - [ ] Filtro por código de barras
  - [ ] Filtro por categoria
  - [ ] Filtro por grupo
  - [ ] Paginação (50 produtos por página)

### **2.2 Primeiro Ciclo**
- [ ] Liberar 1ª contagem
- [ ] Fazer contagem de produto sem lote
- [ ] Fazer contagem de produto COM lote (modal de lotes)
- [ ] Salvar contagem e verificar atualização em tempo real
- [ ] Verificar badge de divergência (vermelho se qty ≠ esperado)
- [ ] Encerrar 1ª rodada

### **2.3 Segundo Ciclo**
- [ ] Liberar 2ª contagem
- [ ] Verificar que apenas produtos divergentes aparecem
- [ ] Fazer recontagem
- [ ] Encerrar 2ª rodada

### **2.4 Terceiro Ciclo (se necessário)**
- [ ] Liberar 3ª contagem
- [ ] Fazer contagem de desempate
- [ ] Encerrar 3ª rodada

### **2.5 Finalização**
- [ ] Clicar em "Finalizar Inventário"
- [ ] Verificar modal de confirmação
- [ ] Confirmar finalização
- [ ] Verificar status "ENCERRADA"
- [ ] Verificar que não é mais possível editar

---

## 📊 **3. RELATÓRIOS E EXPORTAÇÕES**

- [ ] Abrir "Relatório Final"
- [ ] Verificar todas as colunas:
  - [ ] Código
  - [ ] Descrição
  - [ ] Saldo Estoque
  - [ ] Armazém
  - [ ] Lote Fornecedor (produtos com lote)
  - [ ] Qtd Esperada
  - [ ] Qtd Final
  - [ ] Diferença
  - [ ] % Divergência
- [ ] Exportar CSV
- [ ] Exportar Excel
- [ ] Exportar JSON
- [ ] Imprimir (PDF)
- [ ] Verificar que PDF tem todas as colunas visíveis (paisagem)

---

## 🔄 **4. COMPARAÇÃO DE INVENTÁRIOS**

- [ ] Criar 2 inventários diferentes (ex: MED_01 e MED_02)
- [ ] Clicar em "Comparar Inventários"
- [ ] Selecionar 2 inventários
- [ ] Testar 3 modalidades:
  - [ ] Match Perfeito
  - [ ] Análise Manual
  - [ ] Relatório de Transferências
- [ ] Verificar cálculo de economia (R$ 850/produto)
- [ ] Exportar relatórios de comparação

---

## 📱 **5. MODO MOBILE (OPERATOR)**

- [ ] Logar como OPERATOR
- [ ] Verificar que abre automaticamente counting_mobile.html
- [ ] Testar interface touch:
  - [ ] Cards 44x44px (touch-friendly)
  - [ ] Fontes legíveis (16-24px)
- [ ] Fazer contagem cega (NÃO mostra qty esperada)
- [ ] Testar modal de lotes no mobile
- [ ] Verificar filtros:
  - [ ] Todos
  - [ ] Não contados
  - [ ] Contados
- [ ] Fazer logout

---

## 🏢 **6. MULTI-FILIAL**

- [ ] Logar como usuário com múltiplas filiais (clenio/123456)
- [ ] Verificar modal de seleção de filial
- [ ] Selecionar filial 01
- [ ] Verificar badge de filial no header
- [ ] Criar inventário na filial 01
- [ ] Fazer logout
- [ ] Logar novamente e selecionar filial 02
- [ ] Verificar que inventários da filial 01 NÃO aparecem

---

## 🔄 **7. SINCRONIZAÇÃO COM PROTHEUS**

- [ ] Ir para página de Importação
- [ ] Clicar em "Sincronizar com Protheus"
- [ ] Verificar modal de confirmação
- [ ] Confirmar sincronização
- [ ] Verificar tabela de resultados:
  - [ ] Grupos (SBM010)
  - [ ] Categorias (SZD010)
  - [ ] Subcategorias (SZE010)
  - [ ] Segmentos (SZF010)
- [ ] Verificar tempo de sincronização (< 2s ideal)

---

## 🎯 **8. VALIDAÇÕES E ERROS**

### **8.1 Validações de Entrada**
- [ ] Tentar criar inventário sem nome (deve bloquear)
- [ ] Tentar digitar quantidade negativa (deve bloquear)
- [ ] Tentar digitar texto no campo quantidade (deve bloquear)

### **8.2 Tratamento de Erros**
- [ ] Simular erro de rede (desligar WiFi por 5s)
- [ ] Verificar mensagem de erro amigável
- [ ] Reconectar e verificar retomada

### **8.3 Permissões**
- [ ] Logar como OPERATOR
- [ ] Tentar acessar /users.html diretamente na URL
- [ ] Verificar bloqueio ou redirecionamento

---

## 📈 **9. PERFORMANCE**

- [ ] Criar inventário com 500+ produtos
- [ ] Medir tempo de carregamento (< 3s ideal)
- [ ] Testar paginação (scroll suave)
- [ ] Verificar consumo de memória (< 200MB ideal)
- [ ] Testar busca em tempo real (< 1s para retornar)

---

## 🐛 **10. BUGS CONHECIDOS (CORRIGIDOS)**

Verificar que os seguintes bugs NÃO aparecem mais:

- [x] ~~Células vazias no modal "Análise do Inventário"~~ (v2.17.2)
- [x] ~~Badge de armazém desproporcional~~ (v2.17.3)
- [x] ~~PDF cortando última coluna~~ (v2.17.3)
- [x] ~~Produtos não contados não subiam para recontagem~~ (v2.15.5)
- [x] ~~Salvamentos duplicados no modal de lotes~~ (v2.17.1)
- [x] ~~Lote falso "09" aparecendo~~ (v2.15.7.8)

---

## 🎨 **11. UX/UI**

- [ ] Verificar responsividade:
  - [ ] Desktop (1920x1080)
  - [ ] Tablet (768x1024)
  - [ ] Mobile (375x667)
- [ ] Verificar contraste de cores (acessibilidade)
- [ ] Verificar alinhamento de colunas
- [ ] Verificar espaçamento consistente
- [ ] Verificar ícones visíveis e intuitivos
- [ ] Verificar badges legíveis (cores, tamanhos)

---

## 🔧 **12. INFRAESTRUTURA**

- [ ] Verificar logs do Docker:
  ```bash
  docker-compose logs backend --tail=100
  ```
- [ ] Verificar uso de CPU (< 50% ideal)
- [ ] Verificar uso de memória (< 2GB ideal)
- [ ] Verificar conectividade do banco:
  ```bash
  docker-compose exec postgres pg_isready
  ```
- [ ] Verificar Redis:
  ```bash
  docker-compose exec redis redis-cli ping
  ```

---

## 📝 **13. DOCUMENTAÇÃO**

- [ ] Verificar que CLAUDE.md está atualizado
- [ ] Verificar que DOCUMENTACAO.md indexa todos os arquivos
- [ ] Verificar que há commits descritivos no git
- [ ] Verificar que há documentação de APIs (/docs)

---

## ✅ **APROVAÇÃO FINAL**

- [ ] Todos os itens acima foram testados
- [ ] Nenhum bug crítico foi encontrado
- [ ] Performance está aceitável
- [ ] UX está profissional
- [ ] Sistema pronto para produção

---

**Assinatura**: ___________________________
**Data**: ___/___/2025
