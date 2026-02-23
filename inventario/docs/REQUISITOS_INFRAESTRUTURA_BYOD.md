# Requisitos de Infraestrutura para Sistema de Inventário Mobile (BYOD)

**Documento Técnico para Discussão com Departamento de Infraestrutura**

| Informação | Valor |
|------------|-------|
| **Projeto** | Sistema de Inventário Protheus |
| **Versão do Sistema** | v2.19.18 |
| **Data** | 25/12/2024 |
| **Elaborado por** | Equipe de Desenvolvimento |
| **Destinatário** | Departamento de Infraestrutura / TI |

---

## 1. Contexto e Objetivo

### 1.1 Situação Atual

O Sistema de Inventário Protheus utiliza **dispositivos móveis pessoais (celulares/tablets)** para realizar contagens físicas de estoque, eliminando a necessidade de coletores de dados dedicados.

**Benefícios da abordagem mobile:**
- Redução de custos (elimina coletores de R$ 3.000-8.000/unidade)
- Maior flexibilidade operacional
- Interface moderna e intuitiva
- Escalabilidade (qualquer celular pode ser usado)

### 1.2 Desafio de Segurança

A utilização de dispositivos pessoais (BYOD - Bring Your Own Device) na rede corporativa apresenta riscos que precisam ser mitigados:

| Risco | Descrição | Impacto |
|-------|-----------|---------|
| Dispositivos não gerenciados | Celulares pessoais sem antivírus/MDM | Alto |
| Acesso lateral | Dispositivo comprometido acessando outros recursos | Crítico |
| Vazamento de dados | Dados sensíveis em dispositivos pessoais | Médio |
| Sobrecarga de rede | Muitos dispositivos simultâneos | Baixo |

### 1.3 Objetivo deste Documento

Definir os **requisitos mínimos de infraestrutura** para permitir o uso seguro de dispositivos móveis no sistema de inventário, **isolando-os da rede corporativa principal**.

---

## 2. Arquitetura Proposta

### 2.1 Diagrama de Rede

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REDE CORPORATIVA                              │
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│   │  Servidores  │    │   Estações   │    │    ERP       │          │
│   │   Internos   │    │  de Trabalho │    │   Protheus   │          │
│   └──────────────┘    └──────────────┘    └──────────────┘          │
│          │                   │                   │                   │
│          └───────────────────┴───────────────────┘                   │
│                              │                                       │
│                         [ SWITCH CORE ]                              │
│                              │                                       │
│                              │ (Trunk)                               │
│                              │                                       │
├──────────────────────────────┼───────────────────────────────────────┤
│                         [ FIREWALL ]                                 │
│                              │                                       │
│    Regra: VLAN_INVENTARIO → Servidor API (porta 443) APENAS         │
│    Regra: VLAN_INVENTARIO → Qualquer outro destino: BLOQUEADO       │
│                              │                                       │
├──────────────────────────────┼───────────────────────────────────────┤
│                              │                                       │
│   ┌──────────────────────────┴──────────────────────────┐            │
│   │              VLAN INVENTÁRIO (Isolada)              │            │
│   │                                                      │            │
│   │   ┌─────────────────────────────────────────────┐   │            │
│   │   │           Servidor de Inventário            │   │            │
│   │   │                                             │   │            │
│   │   │  ┌─────────┐  ┌──────────┐  ┌─────────┐    │   │            │
│   │   │  │ Nginx   │  │ Backend  │  │Postgres │    │   │            │
│   │   │  │ :443    │─►│ API      │─►│  :5432  │    │   │            │
│   │   │  │ (HTTPS) │  │ :8000    │  │         │    │   │            │
│   │   │  └─────────┘  └──────────┘  └─────────┘    │   │            │
│   │   │                                             │   │            │
│   │   │  IP: 10.100.1.10 (exemplo)                  │   │            │
│   │   └─────────────────────────────────────────────┘   │            │
│   │                                                      │            │
│   └──────────────────────────────────────────────────────┘            │
│                              │                                       │
│                              │                                       │
│                      [ ACCESS POINT ]                                │
│                     SSID: INVENTARIO                                 │
│                              │                                       │
│                              │                                       │
│              ┌───────────────┼───────────────┐                       │
│              │               │               │                       │
│             📱              📱              📱                       │
│          Operador 1      Operador 2      Operador 3                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Princípio de Isolamento

O conceito central é **"Zero Trust"**: os dispositivos móveis são tratados como **não confiáveis** e têm acesso **exclusivamente** ao servidor de inventário, sem possibilidade de comunicação com qualquer outro recurso da rede.

---

## 3. Requisitos Técnicos

### 3.1 Requisitos de Rede

| Componente | Requisito | Prioridade | Observações |
|------------|-----------|------------|-------------|
| **VLAN dedicada** | Criar VLAN isolada para inventário | **Obrigatório** | Ex: VLAN 100, Range 10.100.1.0/24 |
| **SSID dedicado** | Criar rede WiFi separada | **Obrigatório** | Nome sugerido: `INVENTARIO` ou `CONTAGEM` |
| **Isolamento L2** | Dispositivos não se comunicam entre si | Recomendado | Client isolation no AP |
| **Trunk para AP** | Access Point recebe VLAN de inventário | **Obrigatório** | Tagged VLAN no uplink do AP |

### 3.2 Requisitos de Firewall

| Regra | Origem | Destino | Porta | Ação | Prioridade |
|-------|--------|---------|-------|------|------------|
| 1 | VLAN_INVENTARIO | Servidor Inventário | 443/TCP | **ALLOW** | **Obrigatório** |
| 2 | VLAN_INVENTARIO | DNS Corporativo | 53/UDP | ALLOW | Recomendado |
| 3 | VLAN_INVENTARIO | Qualquer | Qualquer | **DENY** | **Obrigatório** |
| 4 | Qualquer | VLAN_INVENTARIO | Qualquer | **DENY** | **Obrigatório** |

**Nota:** A regra 3 e 4 garantem que dispositivos na VLAN de inventário não acessem nada além do servidor autorizado, e que ninguém da rede corporativa acesse diretamente os dispositivos móveis.

### 3.3 Requisitos de WiFi

| Parâmetro | Valor Recomendado | Observações |
|-----------|-------------------|-------------|
| **Autenticação** | WPA2-PSK (mínimo) ou WPA2/WPA3-Enterprise | Enterprise requer RADIUS |
| **Senha PSK** | Complexa, 16+ caracteres | Trocar periodicamente |
| **Banda** | 2.4 GHz + 5 GHz | 5 GHz preferencial |
| **Client Isolation** | Habilitado | Impede comunicação entre celulares |
| **Limite de clientes** | 50-100 por AP | Depende do modelo do AP |
| **Captive Portal** | Opcional | Registro e aceite de termos |

### 3.4 Requisitos do Servidor

| Recurso | Especificação Mínima | Recomendado |
|---------|---------------------|-------------|
| **CPU** | 2 vCPUs | 4 vCPUs |
| **RAM** | 4 GB | 8 GB |
| **Disco** | 50 GB SSD | 100 GB SSD |
| **Sistema** | Ubuntu 22.04 LTS ou similar | Docker instalado |
| **Rede** | 1 Gbps | Interface na VLAN de inventário |
| **HTTPS** | Certificado SSL válido | Let's Encrypt ou interno |

---

## 4. Cenários de Implementação

### 4.1 Cenário A: Implementação Mínima (Baixo Custo)

**Ideal para:** Empresas com infraestrutura básica, orçamento limitado.

**Componentes:**
- VLAN criada no switch existente
- SSID adicional no Access Point existente (se suportar múltiplos SSIDs)
- Regras de firewall no equipamento existente

**Custo estimado:** R$ 0 (apenas configuração)

**Segurança:** Média-Alta

```
┌─────────────────────────────────────────┐
│  SSID: INVENTARIO                       │
│  Autenticação: WPA2-PSK                 │
│  Senha: (compartilhada com operadores)  │
│  VLAN: 100                              │
│  Firewall: Só porta 443 para servidor   │
└─────────────────────────────────────────┘
```

### 4.2 Cenário B: Implementação Intermediária

**Ideal para:** Empresas com múltiplas lojas, necessidade de controle centralizado.

**Componentes adicionais:**
- Access Points com suporte a RADIUS
- Servidor RADIUS para autenticação individual
- Portal Captivo para registro de dispositivos

**Custo estimado:** R$ 2.000 - 10.000

**Segurança:** Alta

```
┌─────────────────────────────────────────┐
│  SSID: INVENTARIO                       │
│  Autenticação: WPA2-Enterprise          │
│  Credenciais: Usuário/senha individual  │
│  RADIUS: Integrado ao AD ou local       │
│  Captive Portal: Aceite de termos       │
│  Logs: Registro de MAC + usuário        │
└─────────────────────────────────────────┘
```

### 4.3 Cenário C: Implementação Enterprise

**Ideal para:** Grandes operações, requisitos de compliance rigorosos.

**Componentes adicionais:**
- NAC (Network Access Control)
- MDM (Mobile Device Management) opcional
- SIEM para monitoramento de logs
- Certificados de cliente

**Custo estimado:** R$ 20.000+

**Segurança:** Muito Alta

---

## 5. Estimativa de Capacidade

### 5.1 Dispositivos Simultâneos por Loja

| Cenário | Operadores | Dispositivos | Banda Necessária |
|---------|------------|--------------|------------------|
| Pequeno | 5-10 | 10-15 | 10 Mbps |
| Médio | 10-25 | 25-35 | 25 Mbps |
| Grande | 25-50 | 50-70 | 50 Mbps |

### 5.2 Requisitos de Tráfego por Dispositivo

| Operação | Tamanho | Frequência | Banda |
|----------|---------|------------|-------|
| Login | 5 KB | 1x/dia | Desprezível |
| Carregar lista | 50-200 KB | 1-5x/dia | Baixa |
| Salvar contagem | 1-2 KB | 100-500x/dia | Baixa |
| Buscar produto | 2-5 KB | 50-200x/dia | Baixa |

**Conclusão:** O sistema é **muito leve** em termos de banda. Um link de 10 Mbps atende confortavelmente 50 dispositivos simultâneos.

---

## 6. Segurança Implementada no Sistema

Além da segurança de rede, o próprio sistema já possui as seguintes proteções:

| Mecanismo | Descrição | Status |
|-----------|-----------|--------|
| **HTTPS obrigatório** | Toda comunicação é criptografada | ✅ Implementado |
| **Autenticação JWT** | Tokens com expiração de 8 horas | ✅ Implementado |
| **RBAC** | Controle de acesso por perfil (OPERATOR/SUPERVISOR/ADMIN) | ✅ Implementado |
| **Sanitização de erros** | Erros não expõem detalhes internos | ✅ Implementado |
| **SQL Injection prevention** | Queries parametrizadas | ✅ Implementado |
| **CORS configurado** | Origens permitidas definidas | ✅ Implementado |
| **Rate limiting** | Limite de requisições por IP | 🔄 Planejado |
| **Device fingerprint** | Identificação de dispositivos | 🔄 Planejado |
| **Logs de auditoria** | Registro de todas as operações | ✅ Implementado |

---

## 7. Perguntas para Discussão

### 7.1 Sobre Infraestrutura Existente

1. Os Access Points atuais suportam múltiplos SSIDs com VLANs diferentes?
2. O switch core suporta criação de VLANs e trunk?
3. O firewall atual permite regras por VLAN/subnet?
4. Existe servidor RADIUS disponível para autenticação Enterprise?
5. Qual a capacidade de dispositivos WiFi por AP instalado?

### 7.2 Sobre Políticas de Segurança

1. Existe política de BYOD já definida na empresa?
2. É necessário aceite de termos de uso pelos operadores?
3. Há requisitos de compliance específicos (LGPD, etc)?
4. Qual o processo para solicitar novas VLANs/SSIDs?

### 7.3 Sobre Operação

1. Quem será responsável pela manutenção da rede de inventário?
2. Como será o processo de suporte para problemas de conexão?
3. Há janela de manutenção para implementação?

---

## 8. Plano de Implementação Sugerido

### Fase 1: Preparação (1-2 dias)

- [ ] Definir range de IPs para VLAN de inventário
- [ ] Definir nome do SSID e política de senha
- [ ] Identificar Access Points que receberão o novo SSID
- [ ] Planejar regras de firewall

### Fase 2: Configuração de Rede (1-2 dias)

- [ ] Criar VLAN no switch core
- [ ] Configurar trunk para Access Points
- [ ] Criar SSID dedicado nos APs
- [ ] Configurar DHCP para a nova VLAN

### Fase 3: Configuração de Segurança (1 dia)

- [ ] Implementar regras de firewall
- [ ] Habilitar client isolation no WiFi
- [ ] Configurar logging de conexões
- [ ] Testar isolamento (dispositivo não acessa rede corporativa)

### Fase 4: Testes e Validação (1-2 dias)

- [ ] Conectar dispositivo de teste
- [ ] Validar acesso ao sistema de inventário
- [ ] Validar bloqueio a outros recursos
- [ ] Testar performance com múltiplos dispositivos
- [ ] Documentar configurações

### Fase 5: Produção

- [ ] Comunicar operadores sobre novo SSID
- [ ] Distribuir credenciais de acesso WiFi
- [ ] Monitorar logs de conexão
- [ ] Ajustar configurações conforme necessário

---

## 9. Contatos e Responsabilidades

| Área | Responsabilidade | Contato |
|------|------------------|---------|
| **Desenvolvimento** | Sistema de Inventário, API, Frontend | [A definir] |
| **Infraestrutura** | Rede, VLAN, WiFi, Firewall | [A definir] |
| **Segurança** | Políticas, compliance, auditoria | [A definir] |
| **Operação** | Uso do sistema, suporte aos operadores | [A definir] |

---

## 10. Anexos

### Anexo A: Exemplo de Configuração de Firewall (pfSense/OPNsense)

```
# Permitir inventário -> servidor
pass in on VLAN100 proto tcp from VLAN100:network to 10.100.1.10 port 443

# Permitir DNS
pass in on VLAN100 proto udp from VLAN100:network to <dns_server> port 53

# Bloquear todo o resto
block in on VLAN100 all
block out on VLAN100 all
```

### Anexo B: Exemplo de Configuração de AP (UniFi)

```
Network Name: INVENTARIO
Security: WPA2
Password: [senha-complexa-16-caracteres]
VLAN: 100
Guest Policy: Enabled (client isolation)
Band: 2.4 GHz + 5 GHz
```

### Anexo C: URLs do Sistema

| Ambiente | URL | Observações |
|----------|-----|-------------|
| Produção | https://inventario.empresa.local | Certificado interno |
| Homologação | https://inventario-hml.empresa.local | Para testes |

---

**Documento elaborado para facilitar a discussão entre as equipes de Desenvolvimento e Infraestrutura.**

*Este documento pode ser atualizado conforme as decisões tomadas em conjunto.*
