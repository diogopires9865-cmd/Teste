-- =============================================================================
-- SW Service Desk v1.0 - Schema Inicial Relacional (MySQL / MariaDB)
-- Organização: SW Cloud Solutions
-- =============================================================================

-- 1. Departamentos
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    manager_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Utilizadores
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'technician', 'user') NOT NULL DEFAULT 'user',
    department_id INT NULL,
    job_title VARCHAR(100) NULL,
    phone VARCHAR(30) NULL,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(128) NULL,
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Equipas de Suporte
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    lead_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_teams_lead FOREIGN KEY (lead_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Membros das Equipas
CREATE TABLE IF NOT EXISTS team_members (
    team_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id),
    CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Sessões Ativas (Gestão e Revogação Segura)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Categorias e Subcategorias de Tickets
CREATE TABLE IF NOT EXISTS ticket_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    type ENUM('incident', 'service_request', 'problem', 'change') NOT NULL DEFAULT 'incident',
    default_team_id INT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES ticket_categories(id) ON DELETE CASCADE,
    CONSTRAINT fk_cat_team FOREIGN KEY (default_team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Níveis de Serviço (SLA)
CREATE TABLE IF NOT EXISTS slas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    priority ENUM('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW') NOT NULL UNIQUE,
    response_time_minutes INT NOT NULL,
    resolution_time_minutes INT NOT NULL,
    business_hours_only BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Ativos de Hardware e CMDB
CREATE TABLE IF NOT EXISTS cmdb_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_tag VARCHAR(50) NOT NULL UNIQUE,
    serial_number VARCHAR(100) NULL,
    name VARCHAR(150) NOT NULL,
    type ENUM('LAPTOP', 'DESKTOP', 'SERVER', 'NETWORK', 'PRINTER', 'MOBILE', 'OTHER') NOT NULL,
    model VARCHAR(100) NULL,
    manufacturer VARCHAR(100) NULL,
    specs JSON NULL,
    status ENUM('IN_STOCK', 'ASSIGNED', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'IN_STOCK',
    assigned_user_id INT NULL,
    department_id INT NULL,
    location VARCHAR(100) NULL,
    purchase_date DATE NULL,
    warranty_expiration DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_asset_user FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_assets_user (assigned_user_id),
    INDEX idx_assets_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Histórico e Rastreabilidade do CMDB
CREATE TABLE IF NOT EXISTS cmdb_asset_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    user_id INT NOT NULL,
    action ENUM('CREATED', 'ASSIGNED', 'UNASSIGNED', 'MAINTENANCE_SENT', 'MAINTENANCE_RETURNED', 'RETIRED', 'SPEC_UPDATE') NOT NULL,
    previous_user_id INT NULL,
    new_user_id INT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ah_asset FOREIGN KEY (asset_id) REFERENCES cmdb_assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_ah_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ah_asset_created (asset_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Licenças de Software
CREATE TABLE IF NOT EXISTS cmdb_software_licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    software_name VARCHAR(150) NOT NULL,
    publisher VARCHAR(100) NULL,
    license_key VARCHAR(255) NULL,
    license_type ENUM('PERPETUAL', 'SUBSCRIPTION', 'OPEN_SOURCE') NOT NULL DEFAULT 'SUBSCRIPTION',
    total_seats INT NOT NULL DEFAULT 1,
    seats_used INT NOT NULL DEFAULT 0,
    expiration_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Software Instalado por Ativo
CREATE TABLE IF NOT EXISTS cmdb_asset_software (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    license_id INT NOT NULL,
    installed_version VARCHAR(50) NULL,
    installed_date DATE NOT NULL,
    CONSTRAINT fk_as_asset FOREIGN KEY (asset_id) REFERENCES cmdb_assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_as_license FOREIGN KEY (license_id) REFERENCES cmdb_software_licenses(id) ON DELETE CASCADE,
    UNIQUE KEY uk_asset_license (asset_id, license_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Tabela Principal de Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(30) NOT NULL UNIQUE,
    type ENUM('incident', 'service_request', 'problem', 'change') NOT NULL DEFAULT 'incident',
    title VARCHAR(255) NOT NULL,
    description LONGTEXT NOT NULL,
    requester_id INT NOT NULL,
    assigned_to_id INT NULL,
    assigned_team_id INT NULL,
    category_id INT NOT NULL,
    impact ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    urgency ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    priority ENUM('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW') NOT NULL DEFAULT 'P3_MEDIUM',
    status ENUM('NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    sla_id INT NULL,
    sla_response_due TIMESTAMP NULL,
    sla_resolution_due TIMESTAMP NULL,
    sla_response_met BOOLEAN NULL,
    sla_resolution_met BOOLEAN NULL,
    asset_id INT NULL,
    resolution_notes TEXT NULL,
    resolved_at TIMESTAMP NULL,
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tickets_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_assignee FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_team FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_sla FOREIGN KEY (sla_id) REFERENCES slas(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_asset FOREIGN KEY (asset_id) REFERENCES cmdb_assets(id) ON DELETE SET NULL,
    INDEX idx_tickets_status_priority (status, priority),
    INDEX idx_tickets_requester (requester_id),
    INDEX idx_tickets_assignee (assigned_to_id),
    INDEX idx_tickets_sla_res (status, sla_resolution_due)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Comentários e Notas Internas do Ticket
CREATE TABLE IF NOT EXISTS ticket_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    content LONGTEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tc_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_tc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_tc_ticket_internal (ticket_id, is_internal, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Anexos de Ficheiros Protegidos
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    comment_id INT NULL,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ta_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_ta_comment FOREIGN KEY (comment_id) REFERENCES ticket_comments(id) ON DELETE SET NULL,
    CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Auditoria e Histórico Imutável de Tickets
CREATE TABLE IF NOT EXISTS ticket_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(50) NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    comment VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_th_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_th_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_th_ticket (ticket_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Catálogo de Serviços
CREATE TABLE IF NOT EXISTS service_catalog_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category_id INT NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approval_role ENUM('manager', 'admin') NOT NULL DEFAULT 'manager',
    fields_schema JSON NULL,
    estimated_days INT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sci_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Aprovações de Pedidos de Serviço
CREATE TABLE IF NOT EXISTS service_request_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    approver_id INT NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    decision_notes TEXT NULL,
    decided_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sra_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_sra_approver FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Artigos da Base de Conhecimento (KB)
CREATE TABLE IF NOT EXISTS knowledge_base_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content LONGTEXT NOT NULL,
    summary VARCHAR(500) NULL,
    category_id INT NOT NULL,
    author_id INT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    views_count INT NOT NULL DEFAULT 0,
    helpful_votes INT NOT NULL DEFAULT 0,
    status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_kb_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE RESTRICT,
    CONSTRAINT fk_kb_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_kb_category_status (category_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Auditoria do Sistema
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NULL,
    ip_address VARCHAR(45) NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_created (created_at, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Configurações Globais do Sistema
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value LONGTEXT NOT NULL,
    description VARCHAR(255) NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Modelos de Email Transacionais
CREATE TABLE IF NOT EXISTS email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_code VARCHAR(100) NOT NULL UNIQUE,
    subject VARCHAR(255) NOT NULL,
    body_html LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
