# Plano de Integracao GLPI — Passo 2

## Contexto

O GLPI sera utilizado como ferramenta de **descoberta e inventario automatico** de hardware via agentes (FusionInventory/GLPI Agent). O nosso sistema mantem o contexto de negocios (chamados, contratos, projetos, paradas).

### O que ja foi feito (Passo 1)
- Campo `glpiId` (unique) no modelo `Ativo` — identificador do CI no GLPI
- Campo `ativoPaiId` (self-ref) — hierarquia pai-filho para estacoes de trabalho
- Campo `ativoId` no modelo `Chamado` — vincular ativo ao chamado
- Frontend: selecao de ativo ao criar chamado, ativo pai no formulario de ativo
- Frontend: tabs Componentes e Chamados na pagina de detalhe do ativo

## Arquitetura da Integracao

```
GLPI (fonte de verdade de hardware)
  |
  | API REST (GLPI nativo)
  |
  v
NestJS - GlpiSyncService
  |
  | Prisma ORM
  |
  v
PostgreSQL (gestao_ti.ativos)
```

### Fluxo de Dados
1. **GLPI → Nosso sistema** (importacao): Sincronizar CIs do GLPI para ativos locais
2. **Nosso sistema → GLPI** (link): Manter `glpiId` como chave de referencia
3. **Direcao unica**: GLPI e a fonte de verdade para dados de hardware; nosso sistema e a fonte de verdade para dados de negocios

## Implementacao Backend

### 1. Modulo GlpiSync

```
gestao-ti/backend/src/glpi-sync/
  glpi-sync.module.ts
  glpi-sync.service.ts
  glpi-sync.controller.ts
  glpi-api.client.ts        # Client HTTP para API REST do GLPI
  dto/
    sync-config.dto.ts       # Configuracao de conexao
    sync-result.dto.ts       # Resultado da sincronizacao
```

### 2. GlpiApiClient — Chamadas a API do GLPI

```typescript
// Autenticacao: POST /apirest.php/initSession
// Headers: App-Token + Authorization (user_token ou Basic)
// Response: { session_token: string }

// Listar computadores: GET /apirest.php/Computer
// Query: range=0-999, expand_dropdowns=true
// Response: array de Computer objects

// Detalhe: GET /apirest.php/Computer/:id
// Response: { id, name, serial, uuid, ... }

// Listar monitores/impressoras/perifericos: GET /apirest.php/Monitor, /Printer, /Peripheral
// Listar softwares instalados: GET /apirest.php/Computer/:id/Item_SoftwareVersion
```

### 3. Mapeamento GLPI → Ativo

| Campo GLPI (Computer) | Campo Ativo | Observacoes |
|---|---|---|
| `id` | `glpiId` | Chave de referencia (string) |
| `name` | `nome` / `hostname` | |
| `serial` | `numeroSerie` | |
| `computertypes_id` → name | `tipo` | Mapear para enum TipoAtivo |
| `manufacturers_id` → name | `fabricante` | |
| `computermodels_id` → name | `modelo` | |
| `locations_id` → name | Mapear para `filialId` | Precisa de tabela de-para |
| `users_id` → name | Mapear para `responsavelId` | Match por username ou nome |
| `states_id` → name | `status` | Mapear para enum StatusAtivo |
| `operatingsystems_id` → name | `sistemaOperacional` | |
| NetworkPort → ip | `ip` | Via sub-recurso |

### 4. Logica de Sincronizacao

```typescript
// Pseudo-codigo do sync
async sincronizar(config: SyncConfig): Promise<SyncResult> {
  const session = await this.glpiClient.initSession(config);
  const computers = await this.glpiClient.listComputers(session);

  let criados = 0, atualizados = 0, ignorados = 0;

  for (const computer of computers) {
    const glpiId = String(computer.id);
    const ativoExistente = await this.prisma.ativo.findUnique({ where: { glpiId } });

    const dados = this.mapearParaAtivo(computer, config.mapeamentos);

    if (ativoExistente) {
      // Atualizar apenas campos de hardware (nao sobrescrever dados de negocio)
      await this.prisma.ativo.update({
        where: { id: ativoExistente.id },
        data: {
          nome: dados.nome,
          hostname: dados.hostname,
          numeroSerie: dados.numeroSerie,
          fabricante: dados.fabricante,
          modelo: dados.modelo,
          ip: dados.ip,
          sistemaOperacional: dados.sistemaOperacional,
          processador: dados.processador,
          memoriaGB: dados.memoriaGB,
          discoGB: dados.discoGB,
        },
      });
      atualizados++;
    } else {
      // Criar novo ativo
      const tag = await this.gerarTag(dados.tipo);
      await this.prisma.ativo.create({
        data: { ...dados, tag, glpiId },
      });
      criados++;
    }
  }

  return { criados, atualizados, ignorados, total: computers.length };
}
```

### 5. Endpoints

| Metodo | Rota | Descricao |
|---|---|---|
| `POST` | `/glpi-sync/testar-conexao` | Testa conexao com API do GLPI |
| `POST` | `/glpi-sync/preview` | Lista CIs do GLPI sem importar (preview) |
| `POST` | `/glpi-sync/executar` | Executa a sincronizacao |
| `GET` | `/glpi-sync/historico` | Lista ultimas sincronizacoes |
| `POST` | `/glpi-sync/configurar` | Salva configuracao de conexao |

### 6. Configuracao (SyncConfigDto)

```typescript
class SyncConfigDto {
  glpiUrl: string;       // Ex: https://glpi.empresa.com.br
  appToken: string;      // App-Token do GLPI
  userToken: string;     // User API token
  tiposImportar: string[]; // ['Computer', 'Monitor', 'Printer']
  mapeamentoFiliais: Record<string, string>; // { "GLPI Location Name": "filialId" }
  sincronizarSoftwares: boolean;
  criarTag: 'AUTO' | 'GLPI_NAME'; // Como gerar a tag
}
```

## Implementacao Frontend

### 1. Pagina de Integracao GLPI

```
src/pages/infraestrutura/GlpiSyncPage.tsx
```

Secoes:
1. **Configuracao**: URL, tokens, botao "Testar Conexao"
2. **Mapeamentos**: De-para locations→filiais, states→status
3. **Preview**: Tabela com CIs encontrados no GLPI, marcando quais ja existem (por glpiId)
4. **Executar Sync**: Botao + resultado (criados/atualizados/ignorados)
5. **Historico**: Ultimas sincronizacoes com data/hora e resultados

### 2. Sidebar
- Novo item "Integracao GLPI" (icone: RefreshCw) na secao INFRAESTRUTURA

## Modelo de Dados Adicional (se necessario)

```prisma
model GlpiSyncConfig {
  id          String   @id @default(uuid())
  glpiUrl     String   @map("glpi_url")
  appToken    String   @map("app_token")
  userToken   String   @map("user_token")
  ultimaSync  DateTime? @map("ultima_sync")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("glpi_sync_config")
  @@schema("gestao_ti")
}

model GlpiSyncLog {
  id          String   @id @default(uuid())
  inicio      DateTime
  fim         DateTime?
  status      String   // EXECUTANDO, SUCESSO, ERRO
  criados     Int      @default(0)
  atualizados Int      @default(0)
  ignorados   Int      @default(0)
  erros       Int      @default(0)
  detalhes    Json?    // Array de erros detalhados
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("glpi_sync_logs")
  @@schema("gestao_ti")
}
```

## Hierarquia de Ativos (Estacoes de Trabalho)

Com o campo `ativoPaiId` ja implementado, a composicao de estacoes funciona assim:

```
Estacao de Trabalho (pai)
  ├── Monitor (filho, ativoPaiId = pai.id)
  ├── Teclado (filho)
  ├── Mouse (filho)
  └── Impressora (filho)
```

Na sincronizacao GLPI, os perifericos associados a um Computer podem ser automaticamente vinculados como filhos:
1. Importar Computer como ativo pai
2. Importar perifericos (Monitor, Peripheral) com `ativoPaiId` apontando para o Computer

## Pre-requisitos no GLPI

1. **API habilitada**: Setup > General > API (Enable Rest API = Yes)
2. **App-Token**: Setup > General > API > Add API client
3. **User Token**: Gerar em Administration > Users > (usuario) > API token
4. **Agentes instalados**: GLPI Agent nos computadores da rede
5. **Permissoes**: O usuario API deve ter acesso de leitura aos tipos de CI desejados

## Ordem de Execucao

1. Configurar GLPI (API + agentes) — responsabilidade do usuario
2. Implementar `GlpiApiClient` (HTTP client com auth)
3. Implementar `GlpiSyncService` (logica de sync)
4. Implementar `GlpiSyncController` (endpoints)
5. Frontend: `GlpiSyncPage` (config + preview + executar)
6. Testar com GLPI real do usuario
7. Ajustar mapeamentos conforme necessidade
