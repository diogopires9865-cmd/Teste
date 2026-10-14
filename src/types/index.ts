/**
 * SW Service Desk v1.0 - Definições de Tipos TypeScript
 * Organização: SW Cloud Solutions
 */

export type UserRole = 'admin' | 'manager' | 'technician' | 'user';

export interface User {
  id: number;
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
  job_title?: string;
  phone?: string;
  department_id?: number | null;
  department_name?: string;
  two_factor_enabled: boolean;
}

export type TicketType = 'incident' | 'service_request' | 'problem' | 'change';
export type TicketStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING_USER'
  | 'PENDING_VENDOR'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PriorityLevel = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';

export interface Ticket {
  id: number;
  ticket_number: string;
  type: TicketType;
  title: string;
  description: string;
  requester_id: number;
  requester_name?: string;
  requester_email?: string;
  requester_job?: string;
  requester_department?: string;
  assigned_to_id?: number | null;
  assigned_to_name?: string;
  assigned_team_id?: number | null;
  assigned_team_name?: string;
  category_id: number;
  category_name?: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: PriorityLevel;
  status: TicketStatus;
  sla_id?: number | null;
  sla_response_due?: string | null;
  sla_resolution_due?: string | null;
  sla_response_met?: boolean | null;
  sla_resolution_met?: boolean | null;
  sla_label?: string;
  sla_breached?: boolean;
  asset_id?: number | null;
  asset_tag?: string;
  asset_name?: string;
  asset_model?: string;
  asset_serial?: string;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name: string;
  user_role: UserRole;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketAttachment {
  id: number;
  ticket_id: number;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploader_name?: string;
  created_at: string;
}

export interface TicketHistoryItem {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name: string;
  action_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  comment?: string;
  created_at: string;
}

export type AssetType = 'LAPTOP' | 'DESKTOP' | 'SERVER' | 'NETWORK' | 'PRINTER' | 'MOBILE' | 'OTHER';
export type AssetStatus = 'IN_STOCK' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';

export interface CmdbAsset {
  id: number;
  asset_tag: string;
  serial_number?: string;
  name: string;
  type: AssetType;
  model?: string;
  manufacturer?: string;
  specs?: any;
  status: AssetStatus;
  assigned_user_id?: number | null;
  assigned_user_name?: string;
  assigned_user_email?: string;
  department_id?: number | null;
  department_name?: string;
  location?: string;
  purchase_date?: string;
  warranty_expiration?: string;
  tickets_count?: number;
  created_at: string;
}

export interface AssetHistoryItem {
  id: number;
  asset_id: number;
  action: string;
  notes?: string;
  actor_name: string;
  previous_user_name?: string;
  new_user_name?: string;
  created_at: string;
}

export interface SoftwareLicense {
  id: number;
  software_name: string;
  publisher?: string;
  license_type: string;
  total_seats: number;
  seats_used: number;
  expiration_date?: string;
}

export interface CatalogItem {
  id: number;
  name: string;
  description: string;
  category_id: number;
  category_name?: string;
  requires_approval: boolean;
  approval_role: 'manager' | 'admin';
  fields_schema?: {
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'textarea' | 'select';
      options?: string[];
      required?: boolean;
    }>;
  };
  estimated_days: number;
}

export interface ServiceApproval {
  id: number;
  ticket_id: number;
  ticket_number: string;
  title: string;
  description: string;
  requester_name: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decision_notes?: string;
  created_at: string;
}

export interface KbArticle {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category_id: number;
  category_name?: string;
  author_name?: string;
  is_public: boolean;
  views_count: number;
  helpful_votes: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  details?: any;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface DashboardStats {
  total_tickets: number;
  open_tickets: number;
  critical_p1: number;
  breached_sla: number;
  total_assets: number;
  assigned_assets: number;
  maintenance_assets: number;
}
