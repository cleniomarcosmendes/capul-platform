# Plano de Teste: Correção do Filtro de Produtos v2.17.0

**Data**: 31/10/2025
**Bug**: Filtro retornando produto errado (00010009 ao invés de 00082027)
**Status**: ✅ **CORRIGIDO** (aguardando validação do usuário)

---

## 🎯 Objetivo do Teste

Validar que o filtro de produtos agora retorna APENAS o produto especificado (00082027), e NÃO produtos já adicionados ao inventário (como 00010009).

---

## 📋 Checklist Rápido

### Antes de Começar:
- [ ] Backend está rodando (`docker-compose ps | grep backend` → deve mostrar "Up")
- [ ] Cache do navegador foi limpo (ver instruções abaixo)

### Durante o Teste:
- [ ] Console do navegador está aberto (F12 → aba Console)
- [ ] Filtro aplicado: De `00082027` Até `00082027`
- [ ] Console mostra: `🌐 Enviando requisição: {...produto_from: "00082027"...}`
- [ ] Resultado: APENAS produto 00082027 é listado
- [ ] Produto 00010009 NÃO aparece na lista

---

## 🧪 Passo a Passo Detalhado

### PASSO 1: Limpar Cache do Navegador 🔥 CRÍTICO

**Por que?** O código JavaScript foi modificado, mas navegadores armazenam versão antiga em cache.

**Opção A - Hard Reload** (Recomendado):
1. Abrir página https://localhost:8443/
2. Pressionar **F12** para abrir DevTools
3. Clicar com **botão direito** no ícone de reload (🔄) ao lado da barra de endereço
4. Selecionar **"Empty Cache and Hard Reload"** ou **"Limpar cache e forçar atualização"**
5. Aguardar página recarregar completamente

**Opção B - Modo Anônimo** (Mais Rápido):
1. Pressionar **Ctrl + Shift + N** (Chrome/Edge) ou **Ctrl + Shift + P** (Firefox)
2. Acessar https://localhost:8443/
3. Fazer login
4. Testar filtro

**⚠️ IMPORTANTE**: Se não limpar cache, o código antigo será executado e o bug permanecerá!

---

### PASSO 2: Abrir Console do Navegador

1. Pressionar **F12** (ou Ctrl + Shift + I)
2. Clicar na aba **Console**
3. **NÃO fechar** o console durante o teste (precisamos ver os logs)

---

### PASSO 3: Acessar Modal "Adicionar Produtos"

1. **Login**: https://localhost:8443/
   - Usuário: `clenio`
   - Senha: `123456`

2. **Abrir inventário**: Clicar em "clenio_011" na lista de inventários

3. **Abrir modal**: Clicar no botão **"Adicionar Produtos"** (ícone ➕)

4. **Aguardar carregamento**: Modal deve abrir com lista de produtos

---

### PASSO 4: Aplicar Filtro de Código de Produto

1. **Localizar filtros**: No modal, procurar seção "Código do Produto"

2. **Preencher filtros**:
   - **De**: `00082027`
   - **Até**: `00082027`

3. **NÃO preencher** outros filtros (deixar em branco)

4. **Clicar** no botão **🔍 Buscar**

---

### PASSO 5: Verificar Logs no Console ✅ **VALIDAÇÃO TÉCNICA**

**O que deve aparecer no Console**:

```javascript
🌐 Enviando requisição para backend: {
  produto_from: "00082027",
  produto_to: "00082027",
  local: "02",
  counting_round: "1",
  page: 1,
  size: 100
}
```

**✅ Se aparecer**: Correção frontend está funcionando!
**❌ Se NÃO aparecer**: Cache não foi limpo ou código antigo ainda está rodando.

---

### PASSO 6: Verificar Resultado Visual ✅ **VALIDAÇÃO FUNCIONAL**

**Resultado ESPERADO**:

| Código | Descrição | Local | Qtd Sistema | Qtd Esperada Ajustada | Status |
|--------|-----------|-------|-------------|----------------------|--------|
| 00082027 | PROLONGADOR ESG 150X200MM90001 | 02 | 30.00 | 40.84 | 🟢 DISPONÍVEL |

**Detalhes do Produto**:
- **b2_qatu**: 30.00 (quantidade em estoque)
- **b2_xentpos**: 10.84 (entregas posteriores)
- **Qtd Esperada Ajustada**: 40.84 (soma de ambos)

**✅ Deve aparecer**:
- APENAS 1 produto: 00082027
- Status: 🟢 DISPONÍVEL
- Checkbox habilitado para seleção

**❌ NÃO deve aparecer**:
- Produto 00010009 (ANDROGENOL HERTAPE 5X10ML)
- Produtos que já estão no inventário (badge "✓ JÁ ADICIONADO")
- Produtos de outros armazéns
- Múltiplos produtos (deve ser apenas 1)

---

### PASSO 7: Adicionar Produto ao Inventário (OPCIONAL)

Se quiser testar a adição completa:

1. **Marcar checkbox** do produto 00082027
2. **Verificar contador**: Deve mostrar "1 produto selecionado"
3. **Clicar** em "Adicionar ao Inventário"
4. **Resultado esperado**:
   - ✅ Mensagem: "1 produtos adicionados com sucesso!"
   - ✅ Modal fecha
   - ✅ Produto aparece na lista do inventário

---

## 🔍 Troubleshooting

### Problema 1: Console NÃO mostra log `🌐 Enviando requisição`

**Causa**: Cache não foi limpo ou código antigo ainda está rodando.

**Solução**:
1. Fechar navegador completamente (Ctrl + Shift + Q)
2. Abrir novamente
3. Pressionar Ctrl + Shift + N (modo anônimo)
4. Acessar sistema e testar novamente

---

### Problema 2: Produto 00010009 AINDA aparece

**Causa**: Backend não está aplicando filtro (improvável após correção).

**Solução**:
1. Verificar logs do backend:
   ```bash
   docker-compose logs backend --tail 50 | grep "FILTROS RECEBIDOS"
   ```

2. Deve aparecer:
   ```
   🔍 FILTROS RECEBIDOS: {'produto_from': '00082027', 'produto_to': '00082027', ...}
   ```

3. Se NÃO aparecer `produto_from` nos logs: problema no frontend (cache)
4. Se aparecer `produto_from` nos logs: problema no backend (query SQL)

---

### Problema 3: Modal não abre ou erro 403/500

**Causa**: Problemas de autenticação ou permissões.

**Solução**:
1. Fazer logout e login novamente
2. Verificar se usuário `clenio` tem permissão SUPERVISOR
3. Verificar logs de erro:
   ```bash
   docker-compose logs backend --tail 50 | grep "ERROR"
   ```

---

## ✅ Critérios de Sucesso

O teste é considerado **SUCESSO** se:

1. ✅ Console mostra log `🌐 Enviando requisição` com `produto_from: "00082027"`
2. ✅ Backend recebe filtros (verificar logs): `{'produto_from': '00082027', ...}`
3. ✅ Modal lista APENAS produto 00082027
4. ✅ Produto 00010009 NÃO aparece
5. ✅ Status do produto 00082027 é "🟢 DISPONÍVEL"
6. ✅ Quantidade Esperada Ajustada mostra 40.84 (30.00 + 10.84)

---

## 📊 Validação SQL (OPCIONAL - Apenas para Debug)

Se quiser confirmar que produto 00082027 existe no banco:

```sql
-- Verificar se 00082027 existe no armazém 02
SELECT
    b1.b1_cod,
    b1.b1_desc,
    b2.b2_local,
    b2.b2_qatu,
    b2.b2_xentpos,
    (b2.b2_qatu + COALESCE(b2.b2_xentpos, 0)) as qtd_esperada_ajustada
FROM inventario.sb1010 b1
JOIN inventario.sb2010 b2 ON b1.b1_cod = b2.b2_cod
WHERE b1.b1_cod = '00082027'
  AND b2.b2_local = '02'
  AND b2.b2_filial = '01';
```

**Resultado Esperado**:
```
b1_cod   | b1_desc                          | b2_local | b2_qatu | b2_xentpos | qtd_esperada_ajustada
---------|----------------------------------|----------|---------|------------|----------------------
00082027 | PROLONGADOR ESG 150X200MM90001   | 02       | 30.0000 | 10.84      | 40.84
```

---

## 📝 Relatório de Teste

Após executar o teste, preencha:

- [ ] **Teste executado em**: ________________ (data/hora)
- [ ] **Cache limpo**: ☐ Hard Reload  ☐ Modo Anônimo
- [ ] **Console mostra log de requisição**: ☐ Sim  ☐ Não
- [ ] **Produto 00082027 apareceu**: ☐ Sim  ☐ Não
- [ ] **Produto 00010009 NÃO apareceu**: ☐ Sim  ☐ Não
- [ ] **Qtd Esperada Ajustada = 40.84**: ☐ Sim  ☐ Não
- [ ] **Produto adicionado com sucesso** (opcional): ☐ Sim  ☐ Não  ☐ Não testado

**Resultado Geral**: ☐ ✅ PASSOU  ☐ ❌ FALHOU

**Observações**:
```
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
```

---

## 📚 Documentação Relacionada

- **Correção Completa**: [CORRECAO_BUG_FILTRO_PRODUTOS_v2.17.0.md](CORRECAO_BUG_FILTRO_PRODUTOS_v2.17.0.md)
- **Bug do Checkbox**: [CORRECAO_BUG_ADICIONAR_PRODUTOS_v2.17.0.md](CORRECAO_BUG_ADICIONAR_PRODUTOS_v2.17.0.md)
- **Testes b2_xentpos**: [TESTE_B2_XENTPOS_v2.17.0.md](TESTE_B2_XENTPOS_v2.17.0.md)

---

**✅ Correção implementada e pronta para validação!**
**🧪 Execute o teste seguindo os passos acima**
**📞 Reporte qualquer problema encontrado**
