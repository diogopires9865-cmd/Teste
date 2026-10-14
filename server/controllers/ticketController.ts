/**
 * SW Service Desk v1.0 - Controlador de Tickets e Ciclo de Vida ITIL
 * Organização: SW Cloud Solutions
 */

import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../db/connection.js';
import { SlaService, ImpactLevel, UrgencyLevel, PriorityLevel } from '../services/slaService.js';
import { recordAudit } from '../middleware/auth.js';
import { computeFileSha256 } from '../middleware/upload.js';

export class TicketController {
  /**
   * GET /api/v1/tickets
   */
  static async list(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });

      const { status, priority, type, category_id, assigned_to_id, search } = req.query;

      let sql = `
        SELECT t.id, t.ticket_number, t.type, t.title, t.impact, t.urgency, t.priority,
               t.status, t.sla_id, t.sla_response_due, t.sla_resolution_due,
               t.sla_response_met, t.sla_resolution_met, t.created_at, t.resolved_at,
               req.name as requester_name, req.email as requester_email,
               tech.name as assigned_to_name,
               cat.name as category_name,
               tm.name as assigned_team_name,
               ast.asset_tag, ast.name as asset_name
        FROM tickets t
        LEFT JOIN users req ON t.requester_id = req.id
        LEFT JOIN users tech ON t.assigned_to_id = tech.id
        LEFT JOIN ticket_categories cat ON t.category_id = cat.id
        LEFT JOIN teams tm ON t.assigned_team_id = tm.id
        LEFT JOIN cmdb_assets ast ON t.asset_id = ast.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // RBAC: Utilizadores finais só vêem os seus próprios tickets
      if (req.user.role === 'user') {
        sql += ` AND t.requester_id = ?`;
        params.push(req.user.id);
      }

      if (status) {
        sql += ` AND t.status = ?`;
        params.push(status);
      }
      if (priority) {
        sql += ` AND t.priority = ?`;
        params.push(priority);
      }
      if (type) {
        sql += ` AND t.type = ?`;
        params.push(type);
      }
      if (category_id) {
        sql += ` AND t.category_id = ?`;
        params.push(Number(category_id));
      }
      if (assigned_to_id) {
        sql += ` AND t.assigned_to_id = ?`;
        params.push(Number(assigned_to_id));
      }
      if (search) {
        sql += ` AND (t.ticket_number LIKE ? OR t.title LIKE ? OR t.description LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      sql += ` ORDER BY t.created_at DESC;`;

      const result = await db.query(sql, params);

      // Enriquecer com cálculo dinâmico de SLA
      const enrichedTickets = result.rows.map((t) => {
        const slaEval = SlaService.evaluateSlaStatus(
          t.sla_resolution_due,
          ['RESOLVED', 'CLOSED'].includes(t.status),
          t.resolved_at
        );
        return {
          ...t,
          sla_label: slaEval.label,
          sla_breached: slaEval.breached,
        };
      });

      return res.status(200).json({ tickets: enrichedTickets });
    } catch (err: any) {
      console.error('[TICKETS] Erro ao listar tickets:', err);
      return res.status(500).json({ error: 'Erro ao listar tickets.' });
    }
  }

  /**
   * GET /api/v1/tickets/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      const ticketId = Number(req.params.id);

      const ticketRes = await db.query(
        `SELECT t.*,
                req.name as requester_name, req.email as requester_email, req.job_title as requester_job,
                dept.name as requester_department,
                tech.name as assigned_to_name, tech.email as assigned_to_email,
                cat.name as category_name,
                tm.name as assigned_team_name,
                ast.asset_tag, ast.name as asset_name, ast.model as asset_model, ast.serial_number as asset_serial
         FROM tickets t
         LEFT JOIN users req ON t.requester_id = req.id
         LEFT JOIN departments dept ON req.department_id = dept.id
         LEFT JOIN users tech ON t.assigned_to_id = tech.id
         LEFT JOIN ticket_categories cat ON t.category_id = cat.id
         LEFT JOIN teams tm ON t.assigned_team_id = tm.id
         LEFT JOIN cmdb_assets ast ON t.asset_id = ast.id
         WHERE t.id = ?;`,
        [ticketId]
      );

      if (ticketRes.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket não encontrado.' });
      }

      const ticket = ticketRes.rows[0];

      // Verificação de permissão
      if (req.user.role === 'user' && ticket.requester_id !== req.user.id) {
        return res.status(403).json({ error: 'Não tem permissão para aceder a este ticket.' });
      }

      // Obter comentários (filtrar notas internas se perfil 'user')
      let commentsSql = `
        SELECT c.id, c.content, c.is_internal, c.created_at,
               u.id as user_id, u.name as user_name, u.role as user_role
        FROM ticket_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = ?
      `;
      const commentParams: any[] = [ticketId];

      if (req.user.role === 'user') {
        commentsSql += ` AND c.is_internal = 0`;
      }
      commentsSql += ` ORDER BY c.created_at ASC;`;

      const commentsRes = await db.query(commentsSql, commentParams);

      // Obter Anexos
      const attachmentsRes = await db.query(
        `SELECT a.id, a.file_name, a.file_size_bytes, a.mime_type, a.created_at,
                u.name as uploader_name
         FROM ticket_attachments a
         LEFT JOIN users u ON a.user_id = u.id
         WHERE a.ticket_id = ?
         ORDER BY a.created_at ASC;`,
        [ticketId]
      );

      // Obter Histórico de Auditoria
      const historyRes = await db.query(
        `SELECT h.id, h.action_type, h.field_name, h.old_value, h.new_value, h.comment, h.created_at,
                u.name as user_name
         FROM ticket_history h
         LEFT JOIN users u ON h.user_id = u.id
         WHERE h.ticket_id = ?
         ORDER BY h.created_at DESC;`,
        [ticketId]
      );

      const slaEval = SlaService.evaluateSlaStatus(
        ticket.sla_resolution_due,
        ['RESOLVED', 'CLOSED'].includes(ticket.status),
        ticket.resolved_at
      );

      return res.status(200).json({
        ticket: {
          ...ticket,
          sla_label: slaEval.label,
          sla_breached: slaEval.breached,
        },
        comments: commentsRes.rows,
        attachments: attachmentsRes.rows,
        history: historyRes.rows,
      });
    } catch (err: any) {
      console.error('[TICKETS] Erro ao obter detalhe do ticket:', err);
      return res.status(500).json({ error: 'Erro ao carregar ticket.' });
    }
  }

  /**
   * POST /api/v1/tickets
   */
  static async create(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });

      const { title, description, type, category_id, impact, urgency, asset_id } = req.body;

      if (!title || !description || !category_id) {
        return res.status(400).json({ error: 'Título, descrição e categoria são obrigatórios.' });
      }

      const ticketType = type || 'incident';
      const ticketImpact: ImpactLevel = impact || 'MEDIUM';
      const ticketUrgency: UrgencyLevel = urgency || 'MEDIUM';

      // Cálculo automático de prioridade e prazos de SLA
      const calculatedPriority = SlaService.calculatePriority(ticketImpact, ticketUrgency);
      const slaDeadlines = SlaService.calculateDeadlines(calculatedPriority);

      // Gerar número de ticket sequencial
      const countRes = await db.query('SELECT COUNT(*) as total FROM tickets;');
      const seq = (Number(countRes.rows[0]?.total) || 0) + 1;
      const prefix = ticketType === 'service_request' ? 'REQ' : ticketType === 'problem' ? 'PRB' : ticketType === 'change' ? 'CHG' : 'INC';
      const year = new Date().getFullYear();
      const ticketNumber = `${prefix}-${year}-${String(seq).padStart(4, '0')}`;

      // Verificar se a categoria tem equipa padrão para auto-atribuição
      const catRes = await db.query('SELECT default_team_id FROM ticket_categories WHERE id = ?;', [category_id]);
      const defaultTeamId = catRes.rows[0]?.default_team_id || 1;

      const insertRes = await db.query(
        `INSERT INTO tickets (
          ticket_number, type, title, description, requester_id, assigned_team_id,
          category_id, impact, urgency, priority, status, sla_id,
          sla_response_due, sla_resolution_due, asset_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, datetime('now'), datetime('now'));`,
        [
          ticketNumber,
          ticketType,
          title.trim(),
          description.trim(),
          req.user.id,
          defaultTeamId,
          category_id,
          ticketImpact,
          ticketUrgency,
          calculatedPriority,
          slaDeadlines.slaId,
          slaDeadlines.responseDue,
          slaDeadlines.resolutionDue,
          asset_id || null,
        ]
      );

      const newTicketId = insertRes.insertId;

      // Registar no Histórico
      await db.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
         VALUES (?, ?, 'CREATE', 'status', 'NEW', 'Ticket criado no sistema', datetime('now'));`,
        [newTicketId, req.user.id]
      );

      await recordAudit(req.user.id, 'TICKET_CREATED', 'TICKET', String(newTicketId), { ticketNumber, title }, req.ip);

      return res.status(201).json({
        id: newTicketId,
        ticket_number: ticketNumber,
        priority: calculatedPriority,
        sla_response_due: slaDeadlines.responseDue,
        sla_resolution_due: slaDeadlines.resolutionDue,
        message: `Ticket ${ticketNumber} registado com sucesso com prioridade ${calculatedPriority}.`,
      });
    } catch (err: any) {
      console.error('[TICKETS] Erro ao criar ticket:', err);
      return res.status(500).json({ error: 'Erro ao criar ticket.' });
    }
  }

  /**
   * PATCH /api/v1/tickets/:id/status
   */
  static async updateStatus(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      const ticketId = Number(req.params.id);
      const { status, resolution_notes } = req.body;

      if (!status) return res.status(400).json({ error: 'Novo estado é obrigatório.' });

      const currentTicketRes = await db.query('SELECT status, requester_id, resolved_at FROM tickets WHERE id = ?;', [ticketId]);
      if (currentTicketRes.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket não encontrado.' });
      }

      const currentTicket = currentTicketRes.rows[0];

      // Utilizadores finais só podem confirmar fecho
      if (req.user.role === 'user' && !['CLOSED', 'CANCELLED'].includes(status)) {
        return res.status(403).json({ error: 'Apenas os técnicos podem alterar o estado técnico do ticket.' });
      }

      let resolvedAt = currentTicket.resolved_at;
      let closedAt = null;

      if (status === 'RESOLVED') {
        resolvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      } else if (status === 'CLOSED') {
        closedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }

      await db.query(
        `UPDATE tickets
         SET status = ?, resolution_notes = COALESCE(?, resolution_notes),
             resolved_at = COALESCE(?, resolved_at), closed_at = COALESCE(?, closed_at),
             updated_at = datetime('now')
         WHERE id = ?;`,
        [status, resolution_notes || null, resolvedAt, closedAt, ticketId]
      );

      // Registar histórico
      await db.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, old_value, new_value, comment, created_at)
         VALUES (?, ?, 'STATUS_CHANGE', 'status', ?, ?, ?, datetime('now'));`,
        [ticketId, req.user.id, currentTicket.status, status, resolution_notes || 'Transição de estado']
      );

      await recordAudit(req.user.id, 'TICKET_STATUS_CHANGED', 'TICKET', String(ticketId), { from: currentTicket.status, to: status }, req.ip);

      return res.status(200).json({ message: `Estado alterado para ${status}.`, status });
    } catch (err: any) {
      console.error('[TICKETS] Erro ao atualizar estado:', err);
      return res.status(500).json({ error: 'Erro ao atualizar estado.' });
    }
  }

  /**
   * PATCH /api/v1/tickets/:id/assign
   */
  static async assign(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (req.user.role === 'user') {
        return res.status(403).json({ error: 'Não tem permissão para atribuir tickets.' });
      }

      const ticketId = Number(req.params.id);
      const { assigned_to_id, assigned_team_id } = req.body;

      const currentTicketRes = await db.query('SELECT assigned_to_id, status FROM tickets WHERE id = ?;', [ticketId]);
      if (currentTicketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket não encontrado.' });

      const current = currentTicketRes.rows[0];

      // Se estava em NEW e foi atribuído, muda automaticamente para ASSIGNED
      const newStatus = current.status === 'NEW' ? 'ASSIGNED' : current.status;

      await db.query(
        `UPDATE tickets
         SET assigned_to_id = ?, assigned_team_id = COALESCE(?, assigned_team_id),
             status = ?, updated_at = datetime('now')
         WHERE id = ?;`,
        [assigned_to_id || null, assigned_team_id || null, newStatus, ticketId]
      );

      // Obter nome do novo técnico
      let assigneeName = 'Nenhum';
      if (assigned_to_id) {
        const u = await db.query('SELECT name FROM users WHERE id = ?;', [assigned_to_id]);
        assigneeName = u.rows[0]?.name || String(assigned_to_id);
      }

      await db.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
         VALUES (?, ?, 'ASSIGN', 'assigned_to_id', ?, 'Atribuição de responsabilidade técnica', datetime('now'));`,
        [ticketId, req.user.id, assigneeName]
      );

      await recordAudit(req.user.id, 'TICKET_ASSIGNED', 'TICKET', String(ticketId), { assigned_to_id, assigneeName }, req.ip);

      return res.status(200).json({ message: `Ticket atribuído a ${assigneeName}.`, assigned_to_id, status: newStatus });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao atribuir ticket.' });
    }
  }

  /**
   * PATCH /api/v1/tickets/:id/priority
   */
  static async changePriority(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (req.user.role === 'user') {
        return res.status(403).json({ error: 'Permissão insuficiente para alterar prioridade e SLA.' });
      }

      const ticketId = Number(req.params.id);
      const { impact, urgency } = req.body;

      if (!impact || !urgency) {
        return res.status(400).json({ error: 'Impacto e Urgência são obrigatórios.' });
      }

      const calculatedPriority = SlaService.calculatePriority(impact, urgency);
      const slaDeadlines = SlaService.calculateDeadlines(calculatedPriority);

      await db.query(
        `UPDATE tickets
         SET impact = ?, urgency = ?, priority = ?, sla_id = ?,
             sla_response_due = ?, sla_resolution_due = ?, updated_at = datetime('now')
         WHERE id = ?;`,
        [impact, urgency, calculatedPriority, slaDeadlines.slaId, slaDeadlines.responseDue, slaDeadlines.resolutionDue, ticketId]
      );

      await db.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
         VALUES (?, ?, 'PRIORITY_CHANGE', 'priority', ?, 'Recalculado por alteração de Impacto e Urgência', datetime('now'));`,
        [ticketId, req.user.id, calculatedPriority]
      );

      await recordAudit(req.user.id, 'TICKET_PRIORITY_RECALCULATED', 'TICKET', String(ticketId), { impact, urgency, priority: calculatedPriority }, req.ip);

      return res.status(200).json({
        message: `Prioridade recalculada com sucesso para ${calculatedPriority}.`,
        priority: calculatedPriority,
        sla_resolution_due: slaDeadlines.resolutionDue,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao alterar prioridade.' });
    }
  }

  /**
   * POST /api/v1/tickets/:id/comments
   */
  static async addComment(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      const ticketId = Number(req.params.id);
      const { content, is_internal } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'O conteúdo do comentário não pode estar vazio.' });
      }

      const isInternal = Boolean(is_internal);

      // Apenas técnicos, gestores e administradores podem criar notas internas
      if (isInternal && req.user.role === 'user') {
        return res.status(403).json({ error: 'Utilizadores finais não têm permissão para criar notas internas confidenciais.' });
      }

      const insertRes = await db.query(
        `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, created_at)
         VALUES (?, ?, ?, ?, datetime('now'));`,
        [ticketId, req.user.id, content.trim(), isInternal ? 1 : 0]
      );

      // Se for a primeira resposta pública de um técnico, marca cumprimento do SLA de resposta
      if (!isInternal && ['technician', 'manager', 'admin'].includes(req.user.role)) {
        await db.query(
          `UPDATE tickets
           SET sla_response_met = TRUE, updated_at = datetime('now')
           WHERE id = ? AND sla_response_met IS NULL;`,
          [ticketId]
        );
      }

      await recordAudit(req.user.id, isInternal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED', 'TICKET', String(ticketId), null, req.ip);

      return res.status(201).json({
        id: insertRes.insertId,
        content: content.trim(),
        is_internal: isInternal,
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao adicionar comentário.' });
    }
  }

  /**
   * POST /api/v1/tickets/:id/attachments
   */
  static async uploadAttachment(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      const ticketId = Number(req.params.id);

      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });
      }

      const file = req.file;
      const sha256 = await computeFileSha256(file.path);

      const insertRes = await db.query(
        `INSERT INTO ticket_attachments (ticket_id, user_id, file_name, stored_name, file_path, file_size_bytes, mime_type, sha256_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
        [ticketId, req.user.id, file.originalname, file.filename, file.path, file.size, file.mimetype, sha256]
      );

      await db.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
         VALUES (?, ?, 'ATTACHMENT_ADDED', 'file_name', ?, 'Novo anexo anexado ao ticket', datetime('now'));`,
        [ticketId, req.user.id, file.originalname]
      );

      await recordAudit(req.user.id, 'ATTACHMENT_UPLOADED', 'TICKET', String(ticketId), { fileName: file.originalname, sha256 }, req.ip);

      return res.status(201).json({
        id: insertRes.insertId,
        file_name: file.originalname,
        file_size_bytes: file.size,
        mime_type: file.mimetype,
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[ATTACHMENT] Erro:', err);
      return res.status(500).json({ error: 'Erro ao processar ficheiro anexo.' });
    }
  }

  /**
   * GET /api/v1/tickets/:ticketId/attachments/:attachmentId
   */
  static async downloadAttachment(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      const attachmentId = Number(req.params.attachmentId);

      const attRes = await db.query('SELECT * FROM ticket_attachments WHERE id = ?;', [attachmentId]);
      if (attRes.rows.length === 0) return res.status(404).json({ error: 'Anexo não encontrado.' });

      const att = attRes.rows[0];
      if (!fs.existsSync(att.file_path)) {
        return res.status(404).json({ error: 'Ficheiro físico não encontrado no servidor.' });
      }

      res.setHeader('Content-Type', att.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.file_name)}"`);
      return fs.createReadStream(att.file_path).pipe(res);
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao descarregar anexo.' });
    }
  }
}
