# 📚 GUIA DE USO - SISTEMA DE INVENTÁRIO PROTHEUS

## 🎯 Visão Geral
Sistema completo de gestão de inventário físico com integração preparada para ERP Protheus. Desenvolvido para operações multi-loja com controle de acesso baseado em papéis.

---

## 🚀 INÍCIO RÁPIDO

### 1. Iniciar o Sistema
```bash
# Iniciar todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f backend
```

### 2. Acessar o Sistema
- **Frontend**: Abrir `frontend/login.html` no navegador
- **API Docs**: http://localhost:8000/docs
- **PgAdmin**: http://localhost:5050

### 3. Credenciais Padrão
```
Usuário: admin
Senha: admin123
```

---

## 👥 FLUXOS POR PERFIL DE USUÁRIO

### 🔴 ADMINISTRADOR (ADMIN)
**Acesso total ao sistema, todas as lojas**

#### Fluxo Completo:
1. **Login** → `frontend/login.html`
2. **Dashboard** → Visão geral de todas as lojas
3. **Gestão de Usuários** → `frontend/users.html`
   - Criar novos usuários
   - Atribuir papéis e lojas
   - Resetar senhas
4. **Gestão de Lojas** → `frontend/stores.html`
   - Cadastrar novas lojas
   - Configurar parâmetros
5. **Gestão de Produtos** → `frontend/products.html`
   - Importar catálogo do Protheus
   - Cadastrar novos produtos
   - Gerenciar códigos de barras
6. **Inventários** → `frontend/inventory.html`
   - Criar inventários para qualquer loja
   - Acompanhar progresso global
   - Aprovar divergências

### 🟡 SUPERVISOR
**Gerencia inventários da sua loja**

#### Fluxo Completo:
1. **Login** → Autenticação
2. **Dashboard** → Visão da sua loja
3. **Criar Inventário**:
   ```
   Dashboard → Novo Inventário → Selecionar Produtos → Atribuir Contadores
   ```
4. **Gerenciar Contagens**:
   - Acompanhar progresso em tempo real
   - Resolver divergências
   - Aprovar recontagens
5. **Relatórios**:
   - Exportar divergências
   - Gerar relatório final

### 🟢 OPERADOR (Contador)
**Realiza contagens físicas**

#### Fluxo de Contagem:
1. **Login** → Via dispositivo móvel
2. **Tela de Contagem** → `frontend/counting_improved.html`
3. **Processo de Contagem**:
   ```
   Selecionar Item → Scanner/Digite Código → Informar Quantidade → Confirmar
   ```
4. **Atalhos de Teclado**:
   - `Ctrl+Shift+S`: Simular scanner
   - `Enter`: Confirmar contagem
   - `Tab`: Navegar campos

---

## 📱 FLUXO DE INVENTÁRIO COMPLETO

### Fase 1: PREPARAÇÃO
```mermaid
Admin/Supervisor → Criar Lista → Selecionar Produtos → Definir Período
```

1. **Criar Lista de Inventário**
   - Nome descritivo
   - Selecionar loja
   - Definir data limite

2. **Adicionar Produtos**
   - Importar do Protheus
   - Seleção manual
   - Por categoria/localização

3. **Atribuir Contadores**
   - Selecionar operadores disponíveis
   - Distribuir itens

### Fase 2: EXECUÇÃO
```mermaid
Operadores → Contar Fisicamente → Registrar no Sistema → Confirmar
```

1. **Contagem Física**
   - Usar dispositivo móvel
   - Scanner de código de barras
   - Entrada manual quando necessário

2. **Registro de Informações**
   - Código do produto
   - Quantidade contada
   - Lote/Serial (se aplicável)
   - Localização

### Fase 3: VALIDAÇÃO
```mermaid
Sistema → Calcular Divergências → Supervisor Analisa → Aprovar/Recontar
```

1. **Análise de Divergências**
   - Comparar com estoque sistema
   - Identificar variações significativas
   - Priorizar por valor/impacto

2. **Decisão**
   - Aprovar contagem
   - Solicitar recontagem
   - Ajustar manualmente

### Fase 4: FINALIZAÇÃO
```mermaid
Supervisor → Fechar Inventário → Gerar Relatórios → Integrar Protheus
```

1. **Fechamento**
   - Resolver todas as pendências
   - Aprovar contagens finais
   - Documentar justificativas

2. **Integração**
   - Exportar para Protheus
   - Atualizar saldos
   - Gerar documentos fiscais

---

## 🛠️ OPERAÇÕES TÉCNICAS

### Backup do Banco de Dados
```bash
# Backup manual
./scripts/backup_database.sh

# Backup automático (crontab)
0 2 * * * /path/to/scripts/backup_database.sh
```

### Testes do Sistema
```bash
# Executar testes automatizados
docker-compose exec backend python tests/test_api_endpoints.py

# Verificar saúde
curl http://localhost:8000/health
```

### Monitoramento
```bash
# Logs em tempo real
docker-compose logs -f backend

# Status dos containers
docker stats

# Uso do banco
docker exec -i inventario_postgres psql -U inventario_user -d inventario_protheus -c "SELECT pg_database_size('inventario_protheus');"
```

---

## 🔄 FLUXOS DE INTEGRAÇÃO

### Importação do Protheus
1. Exportar dados do Protheus (SB1, SB2)
2. Acessar `frontend/import.html`
3. Fazer upload dos arquivos
4. Validar importação
5. Confirmar atualização

### Exportação para Protheus
1. Finalizar inventário
2. Gerar arquivo de ajustes
3. Importar no Protheus
4. Processar movimentações

---

## 📊 RELATÓRIOS DISPONÍVEIS

### 1. Relatório de Divergências
- Produtos com variação
- Percentual de acuracidade
- Valor das divergências

### 2. Relatório de Produtividade
- Itens por contador
- Tempo médio de contagem
- Taxa de recontagem

### 3. Relatório Gerencial
- Status por loja
- Evolução do inventário
- Indicadores de performance

---

## 🚨 TROUBLESHOOTING

### Problema: Login não funciona
```bash
# Verificar se backend está rodando
docker-compose ps
docker-compose restart backend
```

### Problema: Contagem não salva
```bash
# Verificar logs
docker-compose logs backend | grep ERROR

# Verificar conexão com banco
docker exec -i inventario_postgres psql -U inventario_user -d inventario_protheus -c "SELECT 1;"
```

### Problema: Sistema lento
```bash
# Reiniciar serviços
docker-compose restart

# Limpar cache
docker system prune -f
```

---

## 📝 BOAS PRÁTICAS

### Para Administradores
- ✅ Fazer backup diário do banco
- ✅ Monitorar logs regularmente
- ✅ Manter usuários atualizados
- ✅ Revisar permissões periodicamente

### Para Supervisores
- ✅ Planejar inventários com antecedência
- ✅ Distribuir carga entre contadores
- ✅ Resolver divergências rapidamente
- ✅ Documentar decisões importantes

### Para Operadores
- ✅ Verificar código antes de confirmar
- ✅ Informar problemas imediatamente
- ✅ Manter dispositivo carregado
- ✅ Seguir procedimento padrão

---

## 🔐 SEGURANÇA

### Níveis de Acesso
| Papel | Criar | Ler | Atualizar | Deletar |
|-------|-------|-----|-----------|---------|
| ADMIN | ✅ Tudo | ✅ Tudo | ✅ Tudo | ✅ Tudo |
| SUPERVISOR | ✅ Inventário | ✅ Sua loja | ✅ Sua loja | ❌ |
| OPERATOR | ❌ | ✅ Atribuído | ✅ Contagem | ❌ |

### Auditoria
- Todas as ações são registradas
- Logs mantidos por 90 dias
- Rastreabilidade completa

---

## 📞 SUPORTE

### Documentação Técnica
- API: http://localhost:8000/docs
- Código: `/docs/` no projeto

### Contatos
- Email: suporte@inventario.com
- Telefone: (11) 1234-5678

---

## 🎯 CHECKLIST RÁPIDO

### Início do Dia
- [ ] Verificar sistema online
- [ ] Conferir backups
- [ ] Revisar pendências

### Durante Inventário
- [ ] Monitorar progresso
- [ ] Resolver divergências
- [ ] Apoiar contadores

### Fim do Dia
- [ ] Backup do banco
- [ ] Exportar relatórios
- [ ] Registrar ocorrências

---

*Última atualização: Agosto 2025 | Versão 2.0*