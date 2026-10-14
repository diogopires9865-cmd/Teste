# SW Service Desk v1.0 — Documento de Engenharia & Especificação Técnica

**Organização:** SW Cloud Solutions  
**Produto:** SW Service Desk v1.0  
**Data:** Outubro de 2026  
**Ambiente Alvo:** Produção Linux (Ubuntu 22.04/24.04 LTS), Nginx/Apache (Reverse Proxy SSL), Node.js LTS, MySQL 8.0 / MariaDB 10.11+

---

## 1. Especificação Funcional Completa

### 1.1 Visão Geral e Âmbito
O **SW Service Desk v1.0** é o sistema central de gestão de serviços de TI (ITSM) da SW Cloud Solutions, alinhado com as boas práticas ITIL 4. O sistema gere todo o ciclo de vida dos serviços internos e de suporte a clientes, cobrindo:
- **Gestão de Incidentes (Incident Management):** Restauro célere do serviço com impacto mínimo no negócio.
- **Gestão de Pedidos de Serviço (Service Requests):** Catálogo padronizado de pedidos com aprovações prévias e workflows configuráveis.
- **Gestão de Problemas (Problem Management):** Análise de causa-raiz (RCA), Workarounds e Known Error Database (KEDB).
- **Gestão de Alterações (Change Management):** CAB (Change Advisory Board), avaliação de risco, plano de rollback e agendamento.
- **CMDB & Gestão de Ativos (Asset Management):** Registo de Configuration Items (CIs), estações de trabalho, servidores, licenças de software, alocação a utilizadores e histórico de manutenção.
- **Base de Conhecimento (Knowledge Base):** Artigos internos para técnicos e externos para utilizadores finais (auto-serviço).
- **SLA Dinâmico e Calendários de Serviço:** Cálculo automático de prioridade (Matriz Impacto x Urgência), calendários de suporte (8x5, 24x7) e gatilhos de escalamento.
- **Assistência por Inteligência Artificial Privada:** Resumo inteligente de tickets, classificação automática, sugestões de resolução com base em tickets anteriores e artigos KB, com o princípio ético e de segurança de **confirmação humana obrigatória para ações sensíveis** (Human-in-the-Loop).

### 1.2 Módulos Funcionais Detalhados

#### Módulo 1: Autenticação, Identidade e Sessões
- **Autenticação:** Login local com Argon2id/Bcrypt (salt rounds = 12), proteção contra força bruta (Rate limiting por IP e por conta).
- **2FA (Autenticação de Dois Fatores):** Suporte a TOTP (RFC 6238, Google Authenticator / Microsoft Authenticator) e códigos de emergência (backup codes).
- **Gestão de Sessões:** Tokens JWT de curta duração (15m) + Refresh Tokens seguros com rotação em cookies `HttpOnly; Secure; SameSite=Lax` ou `Strict`, registados em base de dados com IP e User-Agent para permitir revogação remota instantânea.
- **Recuperação de Password:** Tokens de expiração única com expiração de 1 hora e registo de auditoria.

#### Módulo 2: RBAC (Role-Based Access Control)
Hierarquia de perfis:
1. **Admin / Super Admin:** Acesso irrestrito a configurações globais, RBAC, auditoria, integrações, SLAs e backups.
2. **Manager / Supervisor:** Gestão de equipas, aprovações de alterações e orçamentos, relatórios executivos, redistribuição de carga.
3. **Technician / Especialista TI (L1, L2, L3):** Resolução de tickets, edição de notas internas, atualização de CIs no CMDB, escrita de artigos KB.
4. **End User / Colaborador:** Abertura de tickets, visualização dos seus pedidos e ativos atribuídos, consulta à KB pública, aprovação de pedidos sob a sua alçada.

#### Módulo 3: Tickets (Incidentes, Pedidos, Problemas, Mudanças)
- **Campos Principais:** Código único legível (`INC-2026-0001`, `REQ-2026-0001`, `PRB-2026-0001`, `CHG-2026-0001`), título, descrição rica, requerente, departamento, técnico atribuído, equipa, categoria/subcategoria, impacto (Baixo, Médio, Alto, Crítico), urgência (Baixa, Média, Alta, Crítica), prioridade calculada (P1 a P4), estado do ciclo de vida, SLA First Response Due, SLA Resolution Due.
- **Comunicação:** Feed cronológico com separação estrita entre **Respostas ao Requerente (Públicas)** e **Notas Internas (apenas visíveis para Técnicos/Admins)**.
- **Histórico e Auditoria:** Registo detalhado e imutável de todas as transições de estado, alterações de campo, atribuições e anexos.

#### Módulo 4: SLA e Regras de Negócio
- Matriz de cálculo automático:
  - *Crítico + Crítica = P1 (Crítico)* → SLA Resposta: 15 min, SLA Resolução: 2 horas.
  - *Alto + Média / Médio + Alta = P2 (Alto)* → SLA Resposta: 1 hora, SLA Resolução: 8 horas.
  - *Médio + Média = P3 (Médio)* → SLA Resposta: 4 horas, SLA Resolução: 24 horas.
  - *Baixo + Baixa = P4 (Baixo)* → SLA Resposta: 8 horas, SLA Resolução: 72 horas.
- Pausa de SLA: Quando em estado `Aguardando Informação do Utilizador` ou `Aguardando Fornecedor Externo`.
- Alertas e Escalamento: Notificação automática a 75% e 100% de violação de tempo limite.

#### Módulo 5: CMDB e Gestão de Ativos
- **Tipos de Ativos:** Estações de Trabalho (Laptops/Desktops), Servidores (VMs e Físicos), Dispositivos de Rede, Impressoras, Licenças de Software (SaaS / Volume).
- **Atributos:** Tag de Ativo (`SW-CI-001`), Número de Série, Fabricante, Modelo, Especificações de Hardware (CPU, RAM, Disco), Sistema Operativo, IP/MAC, Localização, Fornecedor, Data de Aquisição, Garantia, Estado (Em Stock, Em Uso, Manutenção, Abatido).
- **Vínculos:** Utilizador responsável, departamento associado, software instalado com licença alocada, tickets associados.
- **Ciclo de Vida do Ativo:** Histórico de movimentações (quem usou, quando entregou, quando foi para reparação).

#### Módulo 6: Catálogo de Serviços e Formulários Dinâmicos
- Catálogo estruturado por categorias de negócio (ex: Onboarding de Colaborador, Acesso VPN, Novo Equipamento, Reset MFA, Criação de Conta Cloud).
- Definição de formulários com campos personalizados validados (texto, dropdowns, caixas de seleção, anexos obrigatórios).
- Workflow de Aprovação: Passos de aprovação pelo Responsável de Departamento e/ou Diretor Financeiro antes da execução pelo Service Desk.

#### Módulo 7: Módulo de IA Privada (Gemini API Server-Side)
- **Resumo Executivo do Ticket:** Sumário de conversas longas e histórico para troca de turno rápida entre técnicos.
- **Classificação e Priorização:** Sugestão inteligente de categoria, impacto e urgência baseada na descrição.
- **Sugestão de Resposta / Solução Técnica:** Análise do problema cruzada com artigos da Knowledge Base e tickets resolvidos no passado.
- **Controlo Humano Obrigatório:** Nenhuma resposta de IA é enviada ao utilizador sem clique explícito de aprovação/revisão pelo técnico humano; nenhum estado ou atribuição é alterado automaticamente por IA sem consentimento.

---

## 2. Arquitetura do Sistema

```
                    +---------------------------------------------+
                    |             Cliente Web / Browser           |
                    |        (React 19 + TypeScript + Vite)       |
                    +---------------------------------------------+
                                          |
                                   HTTPS / WSS / REST
                                          |
                    +---------------------------------------------+
                    |         Reverse Proxy (Nginx / Apache)       |
                    |          SSL Offloading + Rate Limiting     |
                    +---------------------------------------------+
                                          |
                    +---------------------------------------------+
                    |            SW Service Desk Backend          |
                    |             (Node.js + Express)             |
                    |  - Auth Middleware (JWT + Cookie HttpOnly)  |
                    |  - RBAC Enforcement Layer                   |
                    |  - Validation Layer (Zod)                   |
                    |  - Business Services (Tickets, SLA, CMDB)   |
                    |  - AI Agent Service (@google/genai)         |
                    |  - Audit & Structured Logging (JSON/Morgan) |
                    +---------------------------------------------+
                                          |
                  +-----------------------+-----------------------+
                  |                                               |
+----------------------------------+            +----------------------------------+
|      MySQL 8.0 / MariaDB 10.11   |            |      Armazenamento de Anexos     |
|      (Fonte de Verdade Transacional)  |       |        (Uploads Sanitizados)     |
|   Pool de Conexões, Migrações,  |            |   MIME Filtering, Hash SHA256,   |
|   Índices e Restrições FK ACID   |            |   Controlo de quota por ticket   |
+----------------------------------+            +----------------------------------+
```

---

## 3. Estrutura de Diretórios da Aplicação

```
sw-service-desk/
├── config/
│   ├── database.ts             # Configuração e pool MySQL + Dialeto SQLite local
│   ├── env.ts                  # Validação rigorosa de variáveis de ambiente com Zod
│   └── logger.ts               # Logger estruturado (Winston/Pino standard)
├── docs/
│   ├── 01_ESPECIFICACAO_FUNCIONAL.md
│   ├── 02_ARQUITETURA_E_ESTRUTURA.md
│   ├── 03_MODELO_BASE_DADOS_E_INDICES.md
│   ├── 04_MATRIZ_PERMISSOES_E_WORKFLOWS.md
│   ├── 05_CHECKLIST_ACEITACAO_V1.md
│   └── deploy/
│       ├── nginx-service-desk.conf
│       ├── apache-service-desk.conf
│       └── sw-service-desk.service  # Systemd daemon script
├── migrations/
│   ├── 001_initial_schema.sql  # DDL completo das tabelas, chaves e índices
│   └── runner.ts               # Executor de migrações automáticas
├── seeds/
│   ├── 001_initial_seeds.sql   # Utilizadores padrão, papéis, categorias, SLAs, CIs
│   └── seeder.ts               # Script populador inicial com passwords hasheadas
├── scripts/
│   ├── backup.ts               # Exportador de cópias de segurança (SQL Dump estruturado)
│   ├── restore.ts              # Procedimento de reposição com validação de integridade
│   ├── backup.sh               # Script Bash de cron diário com rotação e compressão gzip
│   └── restore.sh              # Script de emergência Linux
├── server/
│   ├── controllers/            # Controladores REST API (Auth, Tickets, Assets, KB, etc.)
│   ├── middleware/             # Auth, RBAC, RateLimit, CSRF, AuditLog, Upload
│   ├── routes/                 # Definição das rotas e routers Express (/api/v1/*)
│   ├── services/               # Lógica de negócio: ticketService, slaService, aiService, cmdbService
│   └── utils/                  # Hashing, geradores de token, formatadores
├── src/
│   ├── assets/                 # SVGs, logótipos e recursos estáticos
│   ├── components/             # Componentes modulares React (Navbar, Sidebar, Modais, Tabelas)
│   │   ├── auth/               # Login, 2FA, recuperação de conta
│   │   ├── tickets/            # Lista, detalhe, editor de feed, notas internas, prioridade
│   │   ├── cmdb/               # Gestão de inventário, ciclo de vida de ativos, vínculo utilizador
│   │   ├── catalog/            # Catálogo de serviços e formulários dinâmicos
│   │   ├── kb/                 # Base de conhecimento, pesquisa semântica
│   │   ├── ai/                 # Assistente IA com painel de sugestão e confirmação humana
│   │   ├── admin/              # Utilizadores, equipas, SLAs, categorias, auditoria
│   │   └── common/             # Badges, botões, tabelas com números tabulares
│   ├── context/                # Contextos globais (AuthContext, ThemeContext, NotificationContext)
│   ├── hooks/                  # Hooks personalizados de consumo de API
│   ├── types/                  # Definições de tipos TypeScript partilhados
│   ├── App.tsx                 # Router principal e casca do layout
│   ├── main.tsx                # Ponto de entrada React
│   └── index.css               # Estilos globais Tailwind CSS
├── uploads/                    # Diretório protegido de ficheiros
├── .env.example                # Exemplo completo e documentado de configuração
├── server.ts                   # Servidor de entrada Node.js Express + montagem Vite
├── package.json
└── tsconfig.json
```

---

## 4. Modelo Completo da Base de Dados (MySQL)

### 4.1 Tabelas e Chaves Estruturadas

1. **`users`**
   - `id` INT AUTO_INCREMENT PRIMARY KEY
   - `uuid` VARCHAR(36) UNIQUE NOT NULL
   - `name` VARCHAR(120) NOT NULL
   - `email` VARCHAR(191) UNIQUE NOT NULL
   - `password_hash` VARCHAR(255) NOT NULL
   - `role` ENUM('admin', 'manager', 'technician', 'user') DEFAULT 'user'
   - `department_id` INT NULL
   - `job_title` VARCHAR(100)
   - `phone` VARCHAR(30)
   - `two_factor_enabled` BOOLEAN DEFAULT FALSE
   - `two_factor_secret` VARCHAR(128) NULL
   - `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active'
   - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

2. **`departments`**
   - `id` INT AUTO_INCREMENT PRIMARY KEY
   - `name` VARCHAR(100) UNIQUE NOT NULL
   - `code` VARCHAR(20) UNIQUE NOT NULL
   - `manager_id` INT NULL
   - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

3. **`teams` & `team_members`**
   - `teams.id` INT AUTO_INCREMENT PRIMARY KEY
   - `teams.name` VARCHAR(100) NOT NULL
   - `teams.lead_id` INT NULL
   - `team_members.team_id` INT NOT NULL
   - `team_members.user_id` INT NOT NULL
   - PRIMARY KEY (`team_id`, `user_id`)

4. **`sessions`**
   - `id` VARCHAR(64) PRIMARY KEY
   - `user_id` INT NOT NULL
   - `refresh_token_hash` VARCHAR(255) NOT NULL
   - `ip_address` VARCHAR(45)
   - `user_agent` TEXT
   - `expires_at` TIMESTAMP NOT NULL
   - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

5. **`ticket_categories`**
   - `id` INT AUTO_INCREMENT PRIMARY KEY
   - `parent_id` INT NULL
   - `name` VARCHAR(100) NOT NULL
   - `code` VARCHAR(50) UNIQUE NOT NULL
   - `type` ENUM('incident', 'service_request', 'problem', 'change') NOT NULL

6. **`slas`**
   - `id` INT AUTO_INCREMENT PRIMARY KEY
   - `name` VARCHAR(100) NOT NULL
   - `priority` ENUM('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW') NOT NULL
   - `response_time_minutes` INT NOT NULL
   - `resolution_time_minutes` INT NOT NULL
   - `business_hours_only` BOOLEAN DEFAULT TRUE

7. **`tickets`**
   - `id` INT AUTO_INCREMENT PRIMARY KEY
   - `ticket_number` VARCHAR(30) UNIQUE NOT NULL
   - `type` ENUM('incident', 'service_request', 'problem', 'change') NOT NULL
   - `title` VARCHAR(255) NOT NULL
   - `description` LONGTEXT NOT NULL
   - `requester_id` INT NOT NULL
   - `assigned_to_id` INT NULL
   - `assigned_team_id` INT NULL
   - `category_id` INT NOT NULL
   - `impact` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL
   - `urgency` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL
   - `priority` ENUM('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW') NOT NULL
   - `status` ENUM('NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'NEW'
   - `sla_id` INT NULL
   - `sla_response_due` TIMESTAMP NULL
   - `sla_resolution_due` TIMESTAMP NULL
   - `sla_response_met` BOOLEAN NULL
   - `sla_resolution_met` BOOLEAN NULL
   - `asset_id` INT NULL
   - `resolution_notes` TEXT NULL
   - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   - `resolved_at` TIMESTAMP NULL
   - `closed_at` TIMESTAMP NULL

8. **`ticket_comments`**
   - `id` INT AUTO_INCREMENT PRIMARY KEY
   - `ticket_id` INT NOT NULL
   - `user_id` INT NOT NULL
   - `content` LONGTEXT NOT NULL
   - `is_internal` BOOLEAN DEFAULT FALSE
   - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

9. **`ticket_attachments`**
   - `id` INT AUTO_INCREMENT PRIMARY KEY
   - `ticket_id` INT NOT NULL
   - `comment_id` INT NULL
   - `user_id` INT NOT NULL
   - `file_name` VARCHAR(255) NOT NULL
   - `file_path` VARCHAR(500) NOT NULL
   - `file_size_bytes` INT NOT NULL
   - `mime_type` VARCHAR(100) NOT NULL
   - `sha256_hash` VARCHAR(64) NOT NULL
   - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

10. **`ticket_history`**
    - `id` INT AUTO_INCREMENT PRIMARY KEY
    - `ticket_id` INT NOT NULL
    - `user_id` INT NOT NULL
    - `action_type` VARCHAR(50) NOT NULL
    - `old_values` JSON NULL
    - `new_values` JSON NULL
    - `comment` VARCHAR(255) NULL
    - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

11. **`cmdb_assets`**
    - `id` INT AUTO_INCREMENT PRIMARY KEY
    - `asset_tag` VARCHAR(50) UNIQUE NOT NULL
    - `serial_number` VARCHAR(100) UNIQUE NULL
    - `name` VARCHAR(150) NOT NULL
    - `type` ENUM('LAPTOP', 'DESKTOP', 'SERVER', 'NETWORK', 'PRINTER', 'MOBILE', 'OTHER') NOT NULL
    - `model` VARCHAR(100)
    - `manufacturer` VARCHAR(100)
    - `specs` JSON NULL
    - `status` ENUM('IN_STOCK', 'ASSIGNED', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'IN_STOCK'
    - `assigned_user_id` INT NULL
    - `department_id` INT NULL
    - `purchase_date` DATE NULL
    - `warranty_expiration` DATE NULL
    - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

12. **`cmdb_asset_history`**
    - `id` INT AUTO_INCREMENT PRIMARY KEY
    - `asset_id` INT NOT NULL
    - `user_id` INT NOT NULL
    - `action` ENUM('CREATED', 'ASSIGNED', 'UNASSIGNED', 'MAINTENANCE_SENT', 'MAINTENANCE_RETURNED', 'RETIRED', 'SPEC_UPDATE') NOT NULL
    - `previous_user_id` INT NULL
    - `new_user_id` INT NULL
    - `notes` TEXT NULL
    - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

13. **`cmdb_software_licenses` & `cmdb_asset_software`**
    - `cmdb_software_licenses`: `id`, `software_name`, `license_key`, `total_seats`, `seats_used`, `expiration_date`
    - `cmdb_asset_software`: `id`, `asset_id`, `license_id`, `installed_date`

14. **`service_catalog` & `service_requests`**
    - Itens de catálogo estruturados com campos dinâmicos JSON Schema e nível de aprovação exigido.

15. **`knowledge_base_articles`**
    - `id` INT AUTO_INCREMENT PRIMARY KEY
    - `title` VARCHAR(255) NOT NULL
    - `slug` VARCHAR(255) UNIQUE NOT NULL
    - `content` LONGTEXT NOT NULL
    - `category_id` INT NOT NULL
    - `author_id` INT NOT NULL
    - `is_public` BOOLEAN DEFAULT FALSE
    - `views_count` INT DEFAULT 0
    - `helpful_votes` INT DEFAULT 0
    - `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') DEFAULT 'PUBLISHED'
    - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

16. **`audit_logs`**
    - `id` INT AUTO_INCREMENT PRIMARY KEY
    - `user_id` INT NULL
    - `action` VARCHAR(100) NOT NULL
    - `entity_type` VARCHAR(50) NOT NULL
    - `entity_id` VARCHAR(50) NULL
    - `ip_address` VARCHAR(45)
    - `details` JSON NULL
    - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

---

## 5. Relações e Índices de Performance

- **Índices Críticos para Escalabilidade:**
  - `tickets(status, priority, assigned_to_id)`: Pesquisa rápida no dashboard de fila de trabalho do técnico.
  - `tickets(requester_id, created_at)`: Vista rápida do portal do colaborador.
  - `tickets(ticket_number)`: Pesquisa global por código.
  - `tickets(sla_resolution_due, status)`: Monitor de violações iminentes de SLA.
  - `cmdb_assets(asset_tag)`, `cmdb_assets(serial_number)`: Rastreio unívoco de hardware.
  - `cmdb_assets(assigned_user_id)`: Consulta dos equipamentos de cada colaborador.
  - `ticket_comments(ticket_id, is_internal, created_at)`: Renderização rápida de feeds de comentários.
  - `audit_logs(created_at, action)`: Análise forense e relatórios de conformidade.

---

## 6. Matriz de Permissões (RBAC)

| Funcionalidade / Operação | Admin | Manager | Technician | End User |
| :--- | :---: | :---: | :---: | :---: |
| Criar Incidente / Pedido | Sim | Sim | Sim | Sim |
| Ver os próprios Tickets | Sim | Sim | Sim | Sim |
| Ver todos os Tickets da Empresa | Sim | Sim | Sim | Não |
| Atribuir / Reatribuir Tickets | Sim | Sim | Sim (sua equipa) | Não |
| Adicionar Comentário Público | Sim | Sim | Sim | Sim |
| Adicionar Nota Interna Privada | Sim | Sim | Sim | **Não** |
| Alterar Prioridade e SLA | Sim | Sim | Sim | Não |
| Resolver / Fechar Ticket | Sim | Sim | Sim | Apenas confirmar fecho |
| Gestão do CMDB (Criar/Abater) | Sim | Sim | Sim | Apenas consultar os seus |
| Atribuir Ativo a Utilizador | Sim | Sim | Sim | Não |
| Gestão da Knowledge Base (Publicar) | Sim | Sim | Sim | Apenas Leitura pública |
| Configurar SLAs e Categorias | Sim | Sim | Não | Não |
| Gerir Utilizadores e Equipas | Sim | Apenas equipa | Não | Não |
| Ver Logs de Auditoria do Sistema | Sim | Sim (Resumo) | Não | Não |
| Executar / Testar Backups e Restauro | Sim | Não | Não | Não |
| Utilizar IA para Resumo / Sugestão | Sim | Sim | Sim | Não (apenas FAQ) |

---

## 7. Workflows Principais

### 7.1 Ciclo de Vida do Incidente (ITIL)
1. **Registo (`NEW`):** Requerente ou técnico submete; sistema calcula prioridade automática (Impacto x Urgência) e atribui SLA de resposta e resolução.
2. **Atribuição (`ASSIGNED`):** Sistema efetua auto-atribuição com base na categoria/equipa ou o supervisor aloca manualmente.
3. **Diagnóstico & Ação (`IN_PROGRESS`):** Técnico analisa, adiciona notas internas, executa testes, consulta IA para soluções semelhantes.
4. **Dependência (`PENDING_USER` / `PENDING_VENDOR`):** SLA pausa automaticamente até nova resposta.
5. **Resolução (`RESOLVED`):** Técnico preenche notas de resolução e causa-raiz; requerente recebe notificação para validar.
6. **Fecho (`CLOSED`):** Fecho manual pelo requerente ou fecho automático após 48h sem contestação.

### 7.2 Ciclo de Vida do Ativo CMDB
1. **Registo de Aquisição (`IN_STOCK`):** Registo com Tag, Número de Série e Especificações.
2. **Atribuição a Colaborador (`ASSIGNED`):** Seleção de utilizador e departamento; registo no histórico do CI.
3. **Manutenção (`MAINTENANCE`):** Equipamento recolhido para reparação/upgrade; desassociação temporária.
4. **Reatribuição ou Abate (`RETIRED`):** Sanitização de dados, devolução de licenças de software ao pool, marcação como descontinuado.

---

## 8. Checklist de Aceitação da Versão 1.0

- [x] Especificação funcional completa, arquitetura e documentação de engenharia elaboradas.
- [x] Schema SQL relacional com integridade referencial, triggers e índices de alto desempenho.
- [x] Backend Express com validação estrita (Zod), JWT em cookies HttpOnly, rate limiting e CSRF protection.
- [x] Autenticação com 2FA (TOTP) e revogação de sessões ativas.
- [x] Motor de SLA com cálculo de Impacto x Urgência e paragem de temporizador em espera de utilizador.
- [x] Gestão completa de Tickets (Incidentes, Pedidos, Problemas, Mudanças) com feeds públicos e notas internas confidenciais.
- [x] CMDB com inventário de hardware, software, histórico de custódia e associação a tickets.
- [x] Catálogo de Serviços e fluxos de aprovação.
- [x] Knowledge Base com artigos categorizados e suporte Markdown.
- [x] Assistência de IA privada (Gemini 3.8 Flash) com resumo, classificação, sugestões e **confirmação humana obrigatória**.
- [x] Sistema de Auditoria imutável (Audit Trail) para todas as ações administrativas.
- [x] Scripts de Backup e Restauro validados (`scripts/backup.ts`, `scripts/restore.ts`, scripts shell).
- [x] Configuração para Linux + Nginx/Apache + HTTPS e Systemd service.
- [x] Testes de ponta a ponta dos fluxos críticos validados com sucesso.
