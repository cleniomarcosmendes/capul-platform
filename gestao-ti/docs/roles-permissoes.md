# Gestao TI - Roles e Permissoes

> Documento atualizado em: 10/03/2026

## Visao Geral

O modulo Gestao TI possui **9 roles** com diferentes niveis de acesso. As permissoes sao validadas via JWT no `GestaoTiGuard` e `RolesGuard`.

---

## Roles Disponiveis

| Role | Descricao | Nivel |
|------|-----------|-------|
| `ADMIN` | Administrador do sistema | 1 |
| `GESTOR_TI` | Gestor de TI | 2 |
| `TECNICO` | Tecnico de suporte | 3 |
| `DESENVOLVEDOR` | Desenvolvedor | 3 |
| `MANUTENCAO` | Manutencao | 3 |
| `INFRAESTRUTURA` | Infraestrutura | 3 |
| `USUARIO_FINAL` | Usuario comum | 4 |
| `USUARIO_CHAVE` | Usuario-chave de projetos | 5 |
| `TERCEIRIZADO` | Analista externo | 5 |

---

## Detalhamento por Role

### ADMIN
Acesso total ao sistema.

**Permissoes:**
- Todas as operacoes em todos os modulos
- Gestao de equipes e membros
- Configuracao de SLA
- Dashboards executivo e financeiro
- Importacao/exportacao de dados

### GESTOR_TI
Gestao completa da area de TI.

**Permissoes:**
- CRUD completo em todas as entidades
- Gestao de contratos e financeiro
- Gestao de projetos e equipes
- Publicacao de artigos
- Dashboards executivo e financeiro

### TECNICO
Operacoes tecnicas de suporte.

**Permissoes:**
- Atender chamados (assumir, transferir, resolver)
- Registrar paradas
- Criar/editar artigos de conhecimento
- Gerenciar ativos (CMDB)
- Dashboard operacional

### DESENVOLVEDOR
Desenvolvimento e projetos.

**Permissoes:**
- Visualizar projetos
- Apontar horas em projetos
- Comentar em chamados
- Visualizar softwares e contratos
- Exportar dados

### MANUTENCAO / INFRAESTRUTURA
Roles tecnicos especializados.

**Permissoes:**
- Similar ao TECNICO
- Foco em areas especificas

### USUARIO_FINAL
Usuario comum do sistema.

**Permissoes:**
- Abrir chamados
- Comentar em seus proprios chamados
- Fechar/reabrir seus chamados
- Avaliar atendimento (CSAT)
- Visualizar artigos publicos

### USUARIO_CHAVE
Usuario-chave em projetos de implantacao.

**Permissoes:**
- Acesso a projetos onde esta vinculado como usuario-chave
- Visualizar e interagir com pendencias do projeto
- Comentar (apenas comentarios publicos)
- Alterar status de pendencias (PENDENTE, EM_ANDAMENTO, CONCLUIDA)
- Nao ve interacoes internas (marcadas como `isInterno`)

### TERCEIRIZADO
Analista externo trabalhando em implantacao.

**Permissoes:**
- Acesso RESTRITO apenas a projetos vinculados via `terceirizados_projeto`
- Visualizar e interagir com pendencias do projeto
- Comentar (apenas comentarios publicos, forcado automaticamente)
- Alterar status de pendencias (PENDENTE, EM_ANDAMENTO, CONCLUIDA)
- Nao ve interacoes internas (marcadas como `isInterno`)
- Nao pode criar/editar/excluir projetos
- Nao pode gerenciar membros ou configuracoes

---

## Tabela terceirizados_projeto

Vincula usuarios TERCEIRIZADO a projetos especificos.

```sql
CREATE TABLE gestao_ti.terceirizados_projeto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES gestao_ti.projetos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES core.usuarios(id),
  empresa VARCHAR(200),           -- Empresa do terceirizado
  funcao VARCHAR(100) NOT NULL,   -- Ex: "Analista de Implantacao"
  especialidade VARCHAR(100),     -- Ex: "Fiscal", "Contabil"
  data_inicio DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,     -- Soft delete
  observacoes VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(projeto_id, usuario_id)
);
```

### Endpoints de Gestao

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/projetos/:id/terceirizados` | Listar terceirizados do projeto |
| POST | `/projetos/:id/terceirizados` | Adicionar terceirizado |
| PATCH | `/projetos/:id/terceirizados/:tid` | Atualizar dados |
| DELETE | `/projetos/:id/terceirizados/:tid` | Remover (soft delete) |
| GET | `/projetos/meus-projetos-terceirizado` | Projetos do terceirizado logado |

---

## Matriz de Permissoes por Endpoint

### Equipes

| Endpoint | ADMIN | GESTOR_TI | TECNICO | DESENV | USUARIO_FINAL |
|----------|-------|-----------|---------|--------|---------------|
| GET /equipes | OK | OK | OK | OK | OK |
| POST /equipes | OK | OK | - | - | - |
| PATCH /equipes/:id | OK | OK | - | - | - |

### Chamados

| Endpoint | ADMIN | GESTOR_TI | TECNICO | DESENV | USUARIO_FINAL |
|----------|-------|-----------|---------|--------|---------------|
| GET /chamados | OK | OK | OK | OK | OK |
| POST /chamados | OK | OK | OK | OK | OK |
| POST /assumir | OK | OK | OK | - | - |
| POST /transferir | OK | OK | OK | - | - |
| PATCH /resolver | OK | OK | OK | - | - |
| PATCH /fechar | OK | OK | OK | OK | OK |
| POST /avaliar | OK | OK | OK | OK | OK |

### Projetos

| Endpoint | ADMIN | GESTOR_TI | TECNICO | DESENV | USR_CHAVE | TERCEIRIZADO |
|----------|-------|-----------|---------|--------|-----------|--------------|
| GET /projetos | OK | OK | OK | OK | - | - |
| GET /projetos/:id | OK | OK | OK | OK | OK* | OK* |
| POST /projetos | OK | OK | - | - | - | - |
| PATCH /projetos/:id | OK | OK | - | - | - | - |
| DELETE /projetos/:id | OK | OK | - | - | - | - |

*\* Apenas projetos vinculados*

### Pendencias (Projetos)

| Endpoint | ADMIN | GESTOR_TI | TECNICO | DESENV | USR_CHAVE | TERCEIRIZADO |
|----------|-------|-----------|---------|--------|-----------|--------------|
| GET pendencias | OK | OK | OK | OK | OK* | OK* |
| POST pendencias | OK | OK | OK | OK | OK | OK |
| PATCH status | OK | OK | OK | OK | OK** | OK** |
| POST interacoes | OK | OK | OK | OK | OK*** | OK*** |

*\* Filtra interacoes internas*
*\*\* Apenas PENDENTE, EM_ANDAMENTO, CONCLUIDA*
*\*\*\* Forcado como publico (isInterno=false)*

### Contratos

| Endpoint | ADMIN | GESTOR_TI | TECNICO | DESENV | USUARIO_FINAL |
|----------|-------|-----------|---------|--------|---------------|
| GET /contratos | OK | OK | OK | OK | OK |
| POST /contratos | OK | OK | - | - | - |
| PATCH /contratos | OK | OK | - | - | - |
| POST /rateio | OK | OK | - | - | - |

### Dashboard

| Endpoint | ADMIN | GESTOR_TI | TECNICO | DESENV | USUARIO_FINAL |
|----------|-------|-----------|---------|--------|---------------|
| GET /dashboard | OK | OK | OK | OK | OK |
| GET /executivo | OK | OK | - | - | - |
| GET /financeiro | OK | OK | - | - | - |
| GET /disponibilidade | OK | OK | OK | - | - |

---

## Implementacao Tecnica

### Guard Chain

```typescript
Request → JwtAuthGuard → GestaoTiGuard → RolesGuard → Controller
```

1. **JwtAuthGuard**: Valida JWT, popula `req.user`
2. **GestaoTiGuard**: Extrai role do modulo GESTAO_TI para `req.gestaoTiRole`
3. **RolesGuard**: Verifica se role esta na lista `@Roles(...)`

### Decorators

```typescript
// Definir roles permitidas
@Roles('ADMIN', 'GESTOR_TI', 'TECNICO')

// Obter userId do JWT
@CurrentUser('sub') userId: string

// Obter role do modulo
@GestaoTiRole() role: string
```

### Verificacao de Acesso a Projeto

Para USUARIO_CHAVE e TERCEIRIZADO, o acesso e verificado em runtime:

```typescript
async checkProjetoAccessChave(projetoId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'USUARIO_CHAVE') {
    const membro = await this.prisma.membroProjeto.findFirst({
      where: { projetoId, usuarioId: userId, papel: 'USUARIO_CHAVE' }
    });
    return !!membro;
  }

  if (role === 'TERCEIRIZADO') {
    const terceirizado = await this.prisma.terceirizadoProjeto.findFirst({
      where: { projetoId, usuarioId: userId, ativo: true }
    });
    return !!terceirizado;
  }

  return true; // Outras roles tem acesso geral
}
```

---

## Seed das Roles

As roles sao criadas no seed do Auth Gateway:

```typescript
// auth-gateway/prisma/seed.ts
const rolesGestaoTi = [
  { codigo: 'ADMIN', nome: 'Administrador', descricao: '...' },
  { codigo: 'GESTOR_TI', nome: 'Gestor TI', descricao: '...' },
  { codigo: 'TECNICO', nome: 'Tecnico', descricao: '...' },
  { codigo: 'DESENVOLVEDOR', nome: 'Desenvolvedor', descricao: '...' },
  { codigo: 'MANUTENCAO', nome: 'Manutencao', descricao: '...' },
  { codigo: 'INFRAESTRUTURA', nome: 'Infraestrutura', descricao: '...' },
  { codigo: 'USUARIO_FINAL', nome: 'Usuario Final', descricao: '...' },
  { codigo: 'USUARIO_CHAVE', nome: 'Usuario-Chave', descricao: '...' },
  { codigo: 'TERCEIRIZADO', nome: 'Terceirizado', descricao: '...' },
];
```

---

*Documento gerado em: 10/03/2026*
