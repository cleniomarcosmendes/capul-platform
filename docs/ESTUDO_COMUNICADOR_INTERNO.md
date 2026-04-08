# Estudo: Comunicador Interno — Capul Platform

**Data:** 08/04/2026
**Status:** Estudo preliminar — aguardando decisao
**Autor:** Equipe Capul

---

## 1. Objetivo

Implementar um comunicador interno na plataforma Capul com funcionalidades de **chat em tempo real**, **chamadas de voz/video** e **reunioes remotas com gravacao**, integrado ao fluxo de trabalho existente (chamados, projetos, atividades).

---

## 2. Benchmark: Microsoft Teams

O Teams e a referencia solicitada. Abaixo, o que ele entrega e a complexidade tecnica envolvida em cada funcionalidade:

| Funcionalidade | Complexidade | Tecnologias envolvidas |
|---|---|---|
| Chat 1:1 e em grupo | Alta | WebSocket, armazenamento de historico, busca full-text |
| Presenca (online/offline/ocupado) | Media | Heartbeat via WebSocket, Redis pub/sub |
| Chamadas de voz | Muito alta | WebRTC, STUN/TURN servers, codecs de audio |
| Videochamadas | Muito alta | WebRTC, SFU (Selective Forwarding Unit) |
| Compartilhamento de tela | Alta | WebRTC Screen Capture API |
| Gravacao de reunioes | Extremamente alta | Media server, transcoding em tempo real, storage |
| Reunioes com muitos participantes | Extremamente alta | SFU/MCU (mediasoup, Janus, Jitsi) |

**Nota:** A Microsoft investe bilhoes/ano com milhares de engenheiros dedicados ao Teams. Replicar 100% do produto nao e viavel para equipes pequenas.

---

## 3. Licenciamento Teams

| Plano | Custo | Limitacoes |
|---|---|---|
| Teams gratuito | R$ 0 | Ate 100 participantes, 60min por reuniao, sem gravacao, sem suporte |
| Microsoft 365 Business Basic | ~R$ 32/usuario/mes | Gravacao, 300 participantes, 30h por reuniao |
| Microsoft 365 Business Standard | ~R$ 65/usuario/mes | Apps desktop, webinars |

**Conclusao:** A versao gratuita do Teams tem limitacoes significativas (sem gravacao, tempo limitado). Para uso corporativo pleno, o custo por usuario e relevante.

---

## 4. Alternativas gratuitas e open-source

### 4.1 Para Video/Voz/Reunioes

| Solucao | Tipo | Custo | Limites | Gravacao | Self-hosted | Docker |
|---|---|---|---|---|---|---|
| **Jitsi Meet** | Open-source | Gratis | Sem limite | Sim (Jibri) | Sim | Sim |
| **BigBlueButton** | Open-source | Gratis | Sem limite | Sim | Sim | Parcial |
| **Element (Matrix)** | Open-source | Gratis | Sem limite | Via Jitsi | Sim | Sim |
| **Nextcloud Talk** | Open-source | Gratis | Sem limite | Sim (HPB) | Sim | Sim |
| Google Meet (gratis) | Cloud | Gratis | 60min, 100 pessoas | Nao | Nao | N/A |
| Zoom (gratis) | Cloud | Gratis | 40min, 100 pessoas | Nao | Nao | N/A |

### 4.2 Para Chat

| Solucao | Tipo | Custo | Destaque |
|---|---|---|---|
| **Rocket.Chat** | Open-source | Gratis | Muito similar ao Slack, self-hosted, API rica |
| **Mattermost** | Open-source | Gratis | Alternativa corporativa ao Slack |
| **Matrix (Synapse)** | Open-source | Gratis | Protocolo descentralizado, federado |
| **Zulip** | Open-source | Gratis | Organizado por topicos |
| Desenvolvimento proprio | Customizado | Gratis | Total controle, integrado ao workflow |

### 4.3 Recomendacao: Jitsi Meet

**Por que Jitsi?**
- 100% gratuito, sem licencas, sem limites de tempo ou participantes
- Self-hosted via Docker (encaixa na infra existente)
- Embed via iframe com API JavaScript completa
- Suporta JWT para autenticacao (compativel com nosso auth gateway)
- Gravacao disponivel via Jibri (componente adicional)
- Usado por empresas e governos em producao
- Comunidade ativa, atualizacoes frequentes

---

## 5. Arquitetura proposta

### 5.1 Visao geral

```
                        Internet
                           |
                      [ Nginx :443 ]
                     /    |    |    \    \
                    /     |    |     \    \
              [Hub]  [Auth GW]  [Gestao TI]  [Comunicador]  [Jitsi]
              :5170   :3000      :3001        :3002          :8443
                 \      |        /       /        |
                  \     |       /       /         |
                [ PostgreSQL :5432 ]         [ Prosody ]
                schemas: core | gestao_ti       XMPP
                       | comunicador
                           |
                      [ Redis :6379 ]
                    Cache + WebSocket pub/sub
```

### 5.2 Componentes

| Componente | Tecnologia | Funcao |
|---|---|---|
| **Comunicador Backend** | NestJS + WebSocket Gateway | Chat em tempo real, presenca, API REST |
| **Comunicador Frontend** | React (no Hub ou standalone) | Interface do chat e reunioes |
| **Jitsi Meet** | Docker (jitsi-meet) | Video/voz/reunioes |
| **Jibri** | Docker (jitsi-jibri) | Gravacao de reunioes (opcional) |
| **Redis** | Redis 7 (existente) | Pub/sub para presenca e broadcast |
| **PostgreSQL** | Schema `comunicador` | Conversas, mensagens, historico |

### 5.3 Schema do banco (comunicador)

```sql
-- Schema: comunicador

CREATE TABLE conversas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            VARCHAR(20) NOT NULL,  -- 'DIRETA', 'GRUPO', 'CANAL'
    nome            VARCHAR(200),          -- null para conversas diretas
    descricao       TEXT,
    avatar_url      VARCHAR(500),
    criador_id      UUID NOT NULL REFERENCES core.usuarios(id),
    -- Vinculo opcional com entidades do gestao_ti
    chamado_id      UUID,                  -- vinculo com chamado
    projeto_id      UUID,                  -- vinculo com projeto
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE participantes_conversa (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id     UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
    usuario_id      UUID NOT NULL REFERENCES core.usuarios(id),
    role            VARCHAR(20) DEFAULT 'MEMBRO',  -- 'ADMIN', 'MEMBRO'
    silenciado      BOOLEAN DEFAULT false,
    ultima_leitura  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(conversa_id, usuario_id)
);

CREATE TABLE mensagens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id     UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
    usuario_id      UUID NOT NULL REFERENCES core.usuarios(id),
    tipo            VARCHAR(20) DEFAULT 'TEXTO',  -- 'TEXTO', 'ARQUIVO', 'SISTEMA', 'REUNIAO'
    conteudo        TEXT NOT NULL,
    arquivo_url     VARCHAR(500),
    arquivo_nome    VARCHAR(255),
    arquivo_tamanho INTEGER,
    -- Referencia a outra mensagem (resposta)
    resposta_a_id   UUID REFERENCES mensagens(id),
    editado         BOOLEAN DEFAULT false,
    deletado        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reunioes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id     UUID NOT NULL REFERENCES conversas(id),
    criador_id      UUID NOT NULL REFERENCES core.usuarios(id),
    jitsi_room      VARCHAR(200) NOT NULL UNIQUE,
    titulo          VARCHAR(200),
    status          VARCHAR(20) DEFAULT 'ATIVA',  -- 'ATIVA', 'ENCERRADA'
    inicio          TIMESTAMPTZ DEFAULT now(),
    fim             TIMESTAMPTZ,
    gravacao_url    VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE presenca (
    usuario_id      UUID PRIMARY KEY REFERENCES core.usuarios(id),
    status          VARCHAR(20) DEFAULT 'OFFLINE',  -- 'ONLINE', 'AUSENTE', 'OCUPADO', 'NAO_PERTURBE', 'OFFLINE'
    status_texto    VARCHAR(200),           -- mensagem personalizada
    ultimo_ping     TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX idx_mensagens_conversa ON mensagens(conversa_id, created_at DESC);
CREATE INDEX idx_mensagens_usuario ON mensagens(usuario_id);
CREATE INDEX idx_participantes_usuario ON participantes_conversa(usuario_id);
CREATE INDEX idx_presenca_status ON presenca(status) WHERE status != 'OFFLINE';
```

---

## 6. Fases de implementacao

### Fase 1 — Chat interno (3-4 semanas)

**Escopo:**
- Backend NestJS com WebSocket Gateway
- Conversas diretas (1:1) e em grupo
- Envio de mensagens em tempo real
- Historico com scroll infinito
- Envio de arquivos/anexos
- Interface React integrada ao Hub
- Badge de notificacao com contagem de nao-lidas

**Entregaveis:**
- Modulo `comunicador/` no backend
- Pagina `/comunicador` no Hub
- 5 tabelas no schema `comunicador`
- WebSocket Gateway com eventos: `msg:send`, `msg:received`, `typing`, `read`

**Tecnologias:**
```
NestJS @WebSocketGateway (Socket.IO)
Redis pub/sub (broadcast entre instancias)
PostgreSQL schema comunicador
React + Socket.IO client
```

### Fase 2 — Presenca e notificacoes (1-2 semanas)

**Escopo:**
- Heartbeat automatico via WebSocket (ping a cada 30s)
- Status automatico: online → ausente (5min inativo) → offline (desconecta)
- Status manual: disponivel, ocupado, nao perturbe
- Texto personalizado de status
- Notificacoes push no browser (Notification API)
- Som de notificacao configuravel

**Entregaveis:**
- Tabela `presenca` + indicadores visuais nos contatos
- Logica de auto-away e auto-offline
- Configuracoes de notificacao por usuario

### Fase 3 — Integracao com workflow (1-2 semanas)

**Escopo:**
- Botao "Chat" no chamado → cria/abre conversa vinculada ao chamado
- Botao "Chat" no projeto → cria/abre conversa do projeto
- Mensagens de sistema automaticas: "Chamado #122 resolvido", "Atividade concluida"
- Cards ricos no chat (preview de chamado, projeto, atividade)
- Mencoes (@usuario) com notificacao

**Entregaveis:**
- Integracao bidirecional Gestao TI ↔ Comunicador
- Webhooks internos para eventos do sistema

### Fase 4 — Video/Voz com Jitsi (1-2 semanas)

**Escopo:**
- Container Docker Jitsi Meet (docker-jitsi-meet)
- Botao "Iniciar reuniao" no chat
- Iframe Jitsi embutido na plataforma (Jitsi IFrame API)
- Autenticacao JWT compartilhada
- Notificacao para participantes da conversa
- Registro de reunioes (inicio, fim, participantes)

**Configuracao Jitsi (docker-compose):**
```yaml
# Adicionado ao docker-compose.yml
jitsi-web:
  image: jitsi/web:stable
  ports:
    - '8443:443'
  environment:
    - ENABLE_AUTH=1
    - AUTH_TYPE=jwt
    - JWT_APP_ID=capul
    - JWT_APP_SECRET=${JWT_SECRET}

jitsi-prosody:
  image: jitsi/prosody:stable

jitsi-jicofo:
  image: jitsi/jicofo:stable

jitsi-jvb:
  image: jitsi/jvb:stable
  ports:
    - '10000:10000/udp'
```

**Entregaveis:**
- 4 containers Jitsi adicionais
- Componente React `JitsiMeeting` com iframe
- Tabela `reunioes` com historico

### Fase 5 — Gravacao (opcional, futuro)

**Escopo:**
- Container Jibri para gravacao
- Botao "Gravar" na reuniao (apenas criador/admin)
- Transcoding automatico para MP4
- Armazenamento em disco local ou S3
- Link da gravacao salvo no historico

**Requisitos de infra adicionais:**
- Jibri requer Chrome + FFmpeg → container pesado (~2-3GB RAM)
- Storage: ~100MB por hora de gravacao (720p)

---

## 7. Requisitos de infraestrutura

### Fase 1-3 (Chat apenas)

| Recurso | Adicional necessario |
|---|---|
| CPU | +0.5 vCPU |
| RAM | +256MB (WebSocket Gateway) |
| Disco | +1GB (mensagens/anexos) |
| Redis | Ja existente, reuso |
| Portas | Nenhuma adicional (via Nginx) |

### Fase 4 (Jitsi)

| Recurso | Adicional necessario |
|---|---|
| CPU | +2 vCPU (JVB e intensivo) |
| RAM | +2-4GB (Prosody + JVB + Web) |
| Disco | +500MB (imagens Docker) |
| Portas | 8443/tcp (web), 10000/udp (media) |
| Rede | UDP aberto para WebRTC (STUN/TURN) |

### Fase 5 (Gravacao)

| Recurso | Adicional necessario |
|---|---|
| CPU | +2 vCPU (transcoding) |
| RAM | +2-3GB (Jibri com Chrome) |
| Disco | +50-500GB (gravacoes, depende do uso) |

---

## 8. Riscos e mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| WebSocket instavel em redes corporativas | Media | Alto | Fallback para long-polling (Socket.IO faz automatico) |
| Jitsi com problemas de NAT/firewall | Alta | Alto | TURN server proprio ou coturn |
| Consumo excessivo de recursos | Media | Medio | Limitar conexoes simultaneas, lazy-load Jitsi |
| Perda de mensagens offline | Baixa | Medio | Fila de mensagens pendentes no Redis |
| Complexidade de manutencao | Media | Alto | Modulo isolado, equipe dedicada |
| Desvio de foco do core business | Alta | Alto | Implementar em fases, validar ROI a cada etapa |
| Armazenamento de gravacoes | Media | Medio | Politica de retencao (ex: 30 dias) |

---

## 9. Alternativa rapida: Rocket.Chat

Se o objetivo for ter um comunicador completo sem desenvolver do zero, considerar o **Rocket.Chat**:

- Open-source, self-hosted, Docker
- Chat, canais, video (via Jitsi ou WebRTC proprio)
- API REST + webhooks para integracao
- Marketplace de apps/plugins
- Mobile apps (iOS/Android)
- 1 container Docker (~512MB RAM)

**Integracao com Capul:**
- SSO via OAuth2/JWT com Auth Gateway
- Webhooks: eventos do Gestao TI criam mensagens automaticas
- Iframe embed ou link no Hub
- Botao "Abrir chat" no chamado → deeplink para canal no Rocket.Chat

**Vantagem:** Pronto para uso em 1-2 dias de configuracao
**Desvantagem:** Menos controle visual, interface separada da plataforma

---

## 10. Comparativo final

| Criterio | Desenvolvimento proprio | Jitsi + Chat proprio | Rocket.Chat |
|---|---|---|---|
| Tempo de implantacao | 6-8 semanas | 5-7 semanas | 1-2 semanas |
| Integracao com workflow | Excelente | Excelente | Boa (via webhooks) |
| Experiencia do usuario | Perfeita (nativo) | Muito boa | Boa (interface separada) |
| Manutencao | Alta | Media | Baixa |
| Custo de infra | Baixo | Medio | Baixo |
| Video/Voz | Nao incluso | Jitsi (excelente) | Integrado |
| Gravacao | Nao incluso | Jibri | Plugin |
| Mobile | Nao incluso | Jitsi app | Apps prontos |
| Risco tecnico | Alto | Medio | Baixo |

---

## 11. Proximos passos

1. **Definir escopo minimo:** Apenas chat? Chat + video? Comunicador completo?
2. **Decidir abordagem:** Desenvolvimento proprio vs Rocket.Chat vs hibrido
3. **Validar infraestrutura:** O servidor atual suporta os containers adicionais?
4. **Prototipo:** Fazer POC (proof of concept) com a abordagem escolhida
5. **Cronograma:** Definir timeline considerando as fases da equipe

---

## 12. Conclusao

Para a realidade da Capul Platform, a **abordagem hibrida** e a mais pragmatica:

- **Chat proprio** integrado ao workflow (maximo valor agregado)
- **Jitsi Meet** para video/voz/reunioes (evita reinventar a roda)
- **Implementacao em fases** (validar cada etapa antes de avancar)

Isso entrega ~90% da experiencia do Teams com custo zero de licenciamento e total controle sobre os dados.

---

*Documento gerado em 08/04/2026 — Capul Platform*
