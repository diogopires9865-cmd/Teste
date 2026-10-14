-- =============================================================================
-- SW Service Desk v1.0 - Seeds Iniciais do Sistema
-- Organização: SW Cloud Solutions
-- =============================================================================

-- 1. Departamentos
INSERT INTO departments (id, name, code) VALUES
(1, 'Tecnologias de Informação e Infraestrutura', 'TI-INFRA'),
(2, 'Cloud Solutions e Engenharia DevOps', 'CLOUD-ENG'),
(3, 'Recursos Humanos & Pessoas', 'RH'),
(4, 'Financeiro, Contabilidade e Compliance', 'FIN'),
(5, 'Operações e Consultoria', 'OPS')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2. Utilizadores Iniciais
-- As passwords são hasheadas com bcrypt:
-- Admin: 'Admin123!@#'  -> '$2a$12$eOa9g7.a9YVbJ8B5rZp5eu15/3LwG21dkmzXwQpD.Z0.6j1kZlmce'
-- Manager: 'Manager123!@#' -> '$2a$12$kP08Z.qY7f1e7L8.9B4O6.9E5M0F1N2O3P4Q5R6S7T8U9V0W1X2Y3'
-- Tech: 'Tech123!@#' -> '$2a$12$mQ19a.rZ8g2f8M9.0C5P7.0F6N1G2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6'
-- User: 'User123!@#' -> '$2a$12$nR20b.sA9h3g9N0.1D6Q8.1G7O2H3Q4R5S6T7U8V9W0X1Y2Z3A4B5C6D7'

INSERT INTO users (id, uuid, name, email, password_hash, role, department_id, job_title, status) VALUES
(1, 'a1b2c3d4-0001-4000-8000-000000000001', 'Administrador do Sistema', 'admin@swcloudsolutions.com', '$2b$10$3oBxP7ycNW.tmlidsFiK6OEt8ON/1nISVFYiRUp10l764BOGG.xs.', 'admin', 1, 'Chief Information Security Officer', 'active'),
(2, 'a1b2c3d4-0002-4000-8000-000000000002', 'Marta Silva (Supervisora)', 'manager@swcloudsolutions.com', '$2b$10$hn0bvcN4tWyKSw1zBtOm/.iWSVGq3dzEOKKTBihpttepVtR94ScDi', 'manager', 1, 'Service Desk Manager', 'active'),
(3, 'a1b2c3d4-0003-4000-8000-000000000003', 'Diogo Pires (Técnico Sénior)', 'tech.diogo@swcloudsolutions.com', '$2b$10$zvawPL4hSuDMpReif8pD4.jXffZ9xU9boNv8WgMHZ3ceXtw8ZV9LO', 'technician', 2, 'Senior Cloud & Systems Engineer', 'active'),
(4, 'a1b2c3d4-0004-4000-8000-000000000004', 'Ana Santos (Colaboradora)', 'colaborador@swcloudsolutions.com', '$2b$10$7cgPCNHQ77Zvy98h95TcNu9k.z.5fCvDsYGZtsHJcL4gBhWIk9gza', 'user', 4, 'Financial Analyst', 'active')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3. Equipas
INSERT INTO teams (id, name, description, lead_id) VALUES
(1, 'Service Desk Nível 1', 'Triagem, apoio a utilizadores finais e resolução de pedidos de rotina', 2),
(2, 'Infraestrutura Cloud & DevOps', 'Gestão de clusters Kubernetes, redes, VMs e servidores de produção', 3),
(3, 'Cibersegurança & Conformidade', 'Auditoria de acessos, resposta a incidentes de segurança e conformidade', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Membros das Equipas
INSERT INTO team_members (team_id, user_id) VALUES
(1, 2),
(1, 3),
(2, 3),
(3, 1)
ON DUPLICATE KEY UPDATE team_id=VALUES(team_id);

-- 4. SLAs
INSERT INTO slas (id, name, priority, response_time_minutes, resolution_time_minutes, business_hours_only) VALUES
(1, 'SLA Crítico P1 (Paragem Total de Operação)', 'P1_CRITICAL', 15, 120, FALSE),
(2, 'SLA Alto P2 (Impacto Severo / Degradação)', 'P2_HIGH', 60, 480, TRUE),
(3, 'SLA Médio P3 (Problema Parcial com Contorno)', 'P3_MEDIUM', 240, 1440, TRUE),
(4, 'SLA Baixo P4 (Dúvidas ou Pedidos Menores)', 'P4_LOW', 480, 4320, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 5. Categorias
INSERT INTO ticket_categories (id, parent_id, name, code, type, default_team_id) VALUES
(1, NULL, 'Hardware e Posto de Trabalho', 'HW_WORKPLACE', 'incident', 1),
(2, 1, 'Portáteis e Desktops', 'HW_LAPTOPS', 'incident', 1),
(3, 1, 'Monitores e Periféricos', 'HW_PERIPHERALS', 'incident', 1),
(4, NULL, 'Acessos e Identidade', 'ACCESS_ID', 'service_request', 1),
(5, 4, 'Redefinição de Password / 2FA', 'ACCESS_MFA', 'service_request', 1),
(6, 4, 'Acesso a VPN Corporativa', 'ACCESS_VPN', 'service_request', 1),
(7, NULL, 'Infraestrutura Cloud e Servidores', 'CLOUD_INFRA', 'incident', 2),
(8, 7, 'Base de Dados e Armazenamento', 'CLOUD_STORAGE', 'incident', 2),
(9, 7, 'Conectividade e Rede', 'CLOUD_NETWORK', 'incident', 2),
(10, NULL, 'Software e Licenças', 'SW_APPS', 'service_request', 1),
(11, NULL, 'Gestão de Mudanças e Manutenções', 'CHG_MAINT', 'change', 2)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 6. CMDB - Ativos de Hardware Iniciais
INSERT INTO cmdb_assets (id, asset_tag, serial_number, name, type, model, manufacturer, specs, status, assigned_user_id, department_id, location, purchase_date, warranty_expiration) VALUES
(1, 'SW-NB-001', 'C02DG789MD6R', 'MacBook Pro 16" M3 Max', 'LAPTOP', 'MacBook Pro 16', 'Apple', '{"cpu": "Apple M3 Max 16-Core", "ram": "64GB Unified", "storage": "1TB NVMe SSD", "os": "macOS Sonoma"}', 'ASSIGNED', 3, 2, 'Lisboa - Edifício Central, Piso 4', '2024-01-15', '2027-01-15'),
(2, 'SW-NB-002', '8HJ492X1', 'Dell Latitude 7440', 'LAPTOP', 'Latitude 7440 vPro', 'Dell Technologies', '{"cpu": "Intel Core i7-1365U", "ram": "32GB DDR5", "storage": "512GB PCIe 4.0 SSD", "os": "Windows 11 Pro"}', 'ASSIGNED', 4, 4, 'Porto - Polo Tecnológico', '2024-03-10', '2027-03-10'),
(3, 'SW-SRV-001', 'CZ23100AB9', 'HPE ProLiant DL380 Gen10', 'SERVER', 'ProLiant DL380 Gen10', 'Hewlett Packard Enterprise', '{"cpu": "2x Intel Xeon Gold 6248R", "ram": "256GB ECC", "storage": "8x 1.92TB SAS SSD RAID 10", "hypervisor": "VMware ESXi 8.0"}', 'ASSIGNED', 1, 1, 'Datacenter Equinix LS1 Lisboa', '2023-06-20', '2028-06-20'),
(4, 'SW-NET-001', 'FOC241920LK', 'Cisco Catalyst 9300 48P', 'NETWORK', 'Catalyst 9300 48-Port PoE+', 'Cisco Systems', '{"ports": "48x 1GbE PoE+, 4x 10GbE SFP+", "firmware": "Cisco IOS-XE 17.9"}', 'IN_STOCK', NULL, 1, 'Rack TI - Lisboa Piso 4', '2023-09-01', '2028-09-01'),
(5, 'SW-NB-003', 'PF4892KM', 'Lenovo ThinkPad T14s Gen 4', 'LAPTOP', 'ThinkPad T14s Gen 4', 'Lenovo', '{"cpu": "AMD Ryzen 7 PRO 7840U", "ram": "32GB LPDDR5x", "storage": "1TB SSD", "os": "Ubuntu 24.04 LTS"}', 'IN_STOCK', NULL, 1, 'Armazém TI Lisboa', '2024-05-12', '2027-05-12')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Histórico de Ativos
INSERT INTO cmdb_asset_history (asset_id, user_id, action, previous_user_id, new_user_id, notes) VALUES
(1, 1, 'CREATED', NULL, NULL, 'Ativo registado em inventário na receção do equipamento novo.'),
(1, 1, 'ASSIGNED', NULL, 3, 'Equipamento entregue a Diogo Pires para tarefas de desenvolvimento Cloud.'),
(2, 1, 'CREATED', NULL, NULL, 'Ativo registado em inventário.'),
(2, 2, 'ASSIGNED', NULL, 4, 'Entregue a Ana Santos com imagem corporativa Windows 11.')
ON DUPLICATE KEY UPDATE asset_id=VALUES(asset_id);

-- Licenças de Software
INSERT INTO cmdb_software_licenses (id, software_name, publisher, license_type, total_seats, seats_used, expiration_date) VALUES
(1, 'Microsoft 365 E5 Enterprise', 'Microsoft Corporation', 'SUBSCRIPTION', 100, 42, '2027-12-31'),
(2, 'CrowdStrike Falcon Endpoint Security', 'CrowdStrike', 'SUBSCRIPTION', 120, 85, '2027-06-30'),
(3, 'JetBrains All Products Pack', 'JetBrains s.r.o.', 'SUBSCRIPTION', 25, 18, '2026-11-30')
ON DUPLICATE KEY UPDATE software_name=VALUES(software_name);

-- Software Instalado nos Ativos
INSERT INTO cmdb_asset_software (asset_id, license_id, installed_version, installed_date) VALUES
(1, 1, 'Version 16.84', '2024-01-16'),
(1, 2, 'Falcon Sensor 7.14', '2024-01-16'),
(1, 3, '2024.1', '2024-01-16'),
(2, 1, 'Version 2402', '2024-03-11'),
(2, 2, 'Falcon Sensor 7.14', '2024-03-11')
ON DUPLICATE KEY UPDATE asset_id=VALUES(asset_id);

-- 7. Catálogo de Serviços
INSERT INTO service_catalog_items (id, name, description, category_id, requires_approval, approval_role, fields_schema, estimated_days) VALUES
(1, 'Pedido de Novo Posto de Trabalho (Portátil)', 'Atribuição de computador portátil homologado pela SW Cloud para novos colaboradores ou renovação de ciclo de vida.', 2, TRUE, 'manager', '{"fields": [{"name": "perfil", "label": "Perfil de Desempenho", "type": "select", "options": ["Engenharia / Cloud (MacBook Pro / ThinkPad)", "Geral / Administrativo (Dell Latitude)"]}, {"name": "justificacao", "label": "Justificação de Negócio", "type": "textarea", "required": true}]}', 3),
(2, 'Acesso à VPN e Configuração MFA', 'Concessão de túnel seguro SSL/IPsec para trabalho remoto seguro com validação por segundo fator de autenticação.', 6, TRUE, 'manager', '{"fields": [{"name": "motivo", "label": "Motivo do Acesso", "type": "text", "required": true}]}', 1),
(3, 'Criação de Conta Cloud (AWS / Azure / GCP)', 'Provisionamento de ambiente sandbox ou acesso a subscrições de projeto corporativas com controlo de custos.', 7, TRUE, 'admin', '{"fields": [{"name": "provedor", "label": "Provedor Cloud", "type": "select", "options": ["AWS", "Microsoft Azure", "Google Cloud Platform"]}, {"name": "projeto", "label": "Código do Projeto", "type": "text", "required": true}]}', 2)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 8. Base de Conhecimento (KB)
INSERT INTO knowledge_base_articles (id, title, slug, summary, content, category_id, author_id, is_public, views_count, helpful_votes, status) VALUES
(1, 'Configuração e Conexão à VPN Corporativa SW Cloud', 'configuracao-vpn-corporativa', 'Passo a passo para instalar o cliente OpenVPN / WireGuard e efetuar a autenticação segura com MFA.', '### Introdução\nTodos os acessos remotos aos servidores da SW Cloud Solutions exigem conexão cifrada via VPN e autenticação multifator (MFA).\n\n### 1. Download do Cliente\nDescarregue o cliente oficial fornecido pela equipa de TI no portal de software interno.\n\n### 2. Importação do Perfil\nImporte o ficheiro `.ovpn` recebido por email seguro.\n\n### 3. Autenticação\nInsira o seu email corporativo e o código dinâmico gerado na sua aplicação Microsoft Authenticator ou Google Authenticator.', 6, 3, TRUE, 142, 28, 'PUBLISHED'),
(2, 'Procedimento de Triagem e Resposta a Incidentes Críticos P1', 'procedimento-triagem-incidentes-p1', 'Diretrizes internas obrigatórias para os técnicos do Service Desk na gestão de incidentes críticos com SLA de 15 minutos.', '### Alerta Imediato P1\nQuando um incidente é classificado como P1:\n1. A equipa de Infraestrutura Cloud e o CISO são notificados automaticamente via canal de emergência Teams e SMS.\n2. O técnico responsável deve confirmar a receção em menos de 15 minutos alterando o estado para `IN_PROGRESS`.\n3. Deve ser aberta de imediato uma sala de conferência ("War Room") com registo contínuo em Notas Internas.', 7, 1, FALSE, 87, 19, 'PUBLISHED'),
(3, 'Resolução de Problemas Comuns de Impressão e Conectividade de Rede', 'resolucao-problemas-impressao-rede', 'Dicas rápidas de autodiagnóstico para estações de trabalho Windows e macOS.', 'Verifique sempre o cabo de rede Ethernet ou se o SSID Wi-Fi está ligado à rede `SW-Corporate` (e não `SW-Guest`). Em caso de falha de DNS corporativo, reinicie o adaptador de rede.', 3, 2, TRUE, 64, 12, 'PUBLISHED')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 9. Tickets de Exemplo (Incidentes e Pedidos Iniciais)
INSERT INTO tickets (id, ticket_number, type, title, description, requester_id, assigned_to_id, assigned_team_id, category_id, impact, urgency, priority, status, sla_id, sla_response_due, sla_resolution_due, sla_response_met, sla_resolution_met, asset_id, created_at) VALUES
(1, 'INC-2026-0001', 'incident', 'Ecrã do portátil a piscar intermitentemente após suspensão', 'Desde a atualização do sistema operativo na passada segunda-feira, ao abrir a tampa do portátil Dell Latitude, o ecrã fica com riscas horizontais e pisca durante cerca de 2 minutos até estabilizar.', 4, 3, 1, 2, 'MEDIUM', 'HIGH', 'P2_HIGH', 'IN_PROGRESS', 2, DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 8 HOUR), TRUE, NULL, 2, NOW()),
(2, 'REQ-2026-0001', 'service_request', 'Pedido de autorização e instalação do Docker Desktop para testes', 'Necessito de instalar o Docker Desktop para poder validar os novos contentores da aplicação de faturação antes da migração para o cluster de teste.', 4, 2, 1, 10, 'LOW', 'MEDIUM', 'P3_MEDIUM', 'NEW', 3, DATE_ADD(NOW(), INTERVAL 4 HOUR), DATE_ADD(NOW(), INTERVAL 24 HOUR), NULL, NULL, 2, NOW())
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- Comentários Iniciais
INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, created_at) VALUES
(1, 4, 'Enviei um pequeno vídeo em anexo onde se nota a falha no ecrã.', FALSE, NOW()),
(1, 3, 'Nota interna: suspeita de bug no driver Intel Iris Xe versão 31.0.101.4502. Já existe registo no fabricante. Vou propor atualização de BIOS e driver OEM Dell.', TRUE, NOW());

-- Histórico Inicial
INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, old_value, new_value, comment) VALUES
(1, 4, 'CREATE', 'status', NULL, 'NEW', 'Ticket registado pelo colaborador via portal'),
(1, 2, 'ASSIGN', 'assigned_to_id', NULL, 'Diogo Pires', 'Atribuído ao técnico Sénior para análise técnica'),
(1, 3, 'STATUS_CHANGE', 'status', 'ASSIGNED', 'IN_PROGRESS', 'Técnico assumiu o atendimento');

-- Configurações Globais
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('company_name', 'SW Cloud Solutions', 'Nome corporativo exibido no portal e notificações'),
('support_email', 'servicedesk@swcloudsolutions.com', 'Endereço oficial de contacto do Service Desk'),
('business_hours', '{"days": [1,2,3,4,5], "start": "09:00", "end": "18:00", "timezone": "Europe/Lisbon"}', 'Horário de suporte regular'),
('auto_close_hours', '48', 'Horas para fecho automático após resolução sem contestação'),
('mfa_enforced_technicians', 'true', 'Exigência obrigatória de 2FA para técnicos e administradores')
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value);
