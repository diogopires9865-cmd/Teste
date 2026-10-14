/**
 * SW Service Desk v1.0 - Catálogo de Serviços e Workflows de Aprovação
 * Organização: SW Cloud Solutions
 */

import { Request, Response } from 'express';
import { db } from '../db/connection.js';
import { SlaService } from '../services/slaService.js';
import { recordAudit } from '../middleware/auth.js';

export class CatalogController {
  /**
   * GET /api/v1/catalog/items
   */
  static async listItems(_req: Request, res: Response) {
    try {
      const itemsRes = await db.query(
        `SELECT c.*, cat.name as category_name
         FROM service_catalog_items c
         LEFT JOIN ticket_categories cat ON c.category_id = cat.id
         WHERE c.is_active = 1
         ORDER BY c.name ASC;`
      );

      const items = itemsRes.rows.map((row) => ({
        ...row,
        fields_schema: typeof row.fields_schema === 'string' ? JSON.parse(row.fields_schema) : row.fields_schema,
      }));

      return res.status(200).json({ items });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao listar catálogo de serviços.' });
    }
  }

  /**
   * POST /api/v1/catalog/request
   */
  static async requestService(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });

      const { item_id, custom_values, justification } = req.body;
      if (!item_id) return res.status(400).json({ error: 'ID do item do catálogo é obrigatório.' });

      const itemRes = await db.query('SELECT * FROM service_catalog_items WHERE id = ?;', [item_id]);
      if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Item de catálogo não encontrado.' });

      const item = itemRes.rows[0];

      // SLA padrão para pedidos de serviço (P3)
      const priority = 'P3_MEDIUM';
      const slaDeadlines = SlaService.calculateDeadlines(priority);

      const countRes = await db.query('SELECT COUNT(*) as total FROM tickets;');
      const seq = (Number(countRes.rows[0]?.total) || 0) + 1;
      const ticketNumber = `REQ-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

      const title = `[Pedido de Serviço] ${item.name} - ${req.user.name}`;
      const description = `Item Solicitado: ${item.name}\nJustificação: ${justification || 'Não indicada'}\nDados do Formulário:\n${JSON.stringify(custom_values || {}, null, 2)}`;

      const ticketStatus = item.requires_approval ? 'PENDING_USER' : 'NEW';

      const insertTicket = await db.query(
        `INSERT INTO tickets (
          ticket_number, type, title, description, requester_id, assigned_team_id,
          category_id, impact, urgency, priority, status, sla_id,
          sla_response_due, sla_resolution_due, created_at, updated_at
        ) VALUES (?, 'service_request', ?, ?, ?, 1, ?, 'MEDIUM', 'MEDIUM', ?, ?, ?, ?, ?, datetime('now'), datetime('now'));`,
        [ticketNumber, title, description, req.user.id, item.category_id, priority, ticketStatus, slaDeadlines.slaId, slaDeadlines.responseDue, slaDeadlines.resolutionDue]
      );

      const ticketId = insertTicket.insertId;

      // Se necessitar de aprovação, criar registo na tabela de aprovações
      if (item.requires_approval) {
        // Encontrar aprovador padrão (gerente do departamento ou admin com ID 2)
        const approverId = 2; // Marta Silva (Supervisora)
        await db.query(
          `INSERT INTO service_request_approvals (ticket_id, approver_id, status, created_at)
           VALUES (?, ?, 'PENDING', datetime('now'));`,
          [ticketId, approverId]
        );
      }

      await db.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
         VALUES (?, ?, 'CREATE_REQUEST', 'status', ?, 'Pedido de serviço submetido via catálogo', datetime('now'));`,
        [ticketId, req.user.id, ticketStatus]
      );

      await recordAudit(req.user.id, 'SERVICE_REQUEST_SUBMITTED', 'TICKET', String(ticketId), { ticketNumber, itemName: item.name }, req.ip);

      return res.status(201).json({
        id: ticketId,
        ticket_number: ticketNumber,
        requires_approval: Boolean(item.requires_approval),
        message: item.requires_approval
          ? `Pedido ${ticketNumber} submetido com sucesso. Aguarda aprovação hierárquica.`
          : `Pedido ${ticketNumber} registado e encaminhado para a equipa técnica.`,
      });
    } catch (err: any) {
      console.error('[CATALOG] Erro no pedido:', err);
      return res.status(500).json({ error: 'Erro ao submeter pedido de serviço.' });
    }
  }

  /**
   * GET /api/v1/catalog/approvals
   */
  static async listApprovals(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });

      const approvalsRes = await db.query(
        `SELECT a.id, a.ticket_id, a.status as approval_status, a.decision_notes, a.created_at,
                t.ticket_number, t.title, t.description, t.status as ticket_status,
                req.name as requester_name, req.email as requester_email
         FROM service_request_approvals a
         JOIN tickets t ON a.ticket_id = t.id
         JOIN users req ON t.requester_id = req.id
         WHERE (a.approver_id = ? OR ? IN ('admin', 'manager'))
         ORDER BY a.created_at DESC;`,
        [req.user.id, req.user.role]
      );

      return res.status(200).json({ approvals: approvalsRes.rows });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao listar aprovações.' });
    }
  }

  /**
   * POST /api/v1/catalog/approvals/:id/decide
   */
  static async decideApproval(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Apenas gestores ou administradores podem aprovar pedidos.' });
      }

      const approvalId = Number(req.params.id);
      const { decision, notes } = req.body; // 'APPROVED' ou 'REJECTED'

      if (!['APPROVED', 'REJECTED'].includes(decision)) {
        return res.status(400).json({ error: "Decisão deve ser 'APPROVED' ou 'REJECTED'." });
      }

      const approvalRes = await db.query('SELECT * FROM service_request_approvals WHERE id = ?;', [approvalId]);
      if (approvalRes.rows.length === 0) return res.status(404).json({ error: 'Registo de aprovação não encontrado.' });

      const approval = approvalRes.rows[0];
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await db.query(
        `UPDATE service_request_approvals
         SET status = ?, decision_notes = ?, decided_at = ?, approver_id = ?
         WHERE id = ?;`,
        [decision, notes || null, nowStr, req.user.id, approvalId]
      );

      // Atualizar estado do ticket associado
      const newTicketStatus = decision === 'APPROVED' ? 'ASSIGNED' : 'CANCELLED';
      await db.query(
        `UPDATE tickets
         SET status = ?, updated_at = datetime('now')
         WHERE id = ?;`,
        [newTicketStatus, approval.ticket_id]
      );

      await db.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, old_value, new_value, comment, created_at)
         VALUES (?, ?, 'APPROVAL_DECISION', 'status', ?, ?, ?, datetime('now'));`,
        [approval.ticket_id, req.user.id, approval.status, decision, notes || `Decisão de aprovação: ${decision}`]
      );

      await recordAudit(req.user.id, `REQUEST_${decision}`, 'APPROVAL', String(approvalId), { ticketId: approval.ticket_id, decision, notes }, req.ip);

      return res.status(200).json({
        message: decision === 'APPROVED' ? 'Pedido aprovado com sucesso e transferido para a fila técnica.' : 'Pedido rejeitado.',
        decision,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao processar aprovação.' });
    }
  }
}
