/**
 * SW Service Desk v1.0 - Controlador de Inteligência Artificial Privada
 * Organização: SW Cloud Solutions
 * 
 * Garante que todas as ações e sugestões da IA requeiram validação humana ativa
 * antes de qualquer comunicação ou alteração de estado no sistema.
 */

import { Request, Response } from 'express';
import { db } from '../db/connection.js';
import { AiService } from '../services/aiService.js';
import { recordAudit } from '../middleware/auth.js';

export class AiController {
  /**
   * POST /api/v1/ai/summarize/:ticketId
   */
  static async summarize(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (req.user.role === 'user') return res.status(403).json({ error: 'Funcionalidade restrita a técnicos de suporte.' });

      const ticketId = Number(req.params.ticketId);

      const ticketRes = await db.query(
        `SELECT t.*, req.name as requester_name
         FROM tickets t
         LEFT JOIN users req ON t.requester_id = req.id
         WHERE t.id = ?;`,
        [ticketId]
      );

      if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket não encontrado.' });

      const commentsRes = await db.query(
        `SELECT c.content, c.is_internal, u.name as user_name
         FROM ticket_comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.ticket_id = ?
         ORDER BY c.created_at ASC;`,
        [ticketId]
      );

      const summary = await AiService.summarizeTicket(ticketRes.rows[0], commentsRes.rows);

      await recordAudit(req.user.id, 'AI_TICKET_SUMMARIZED', 'TICKET', String(ticketId), null, req.ip);

      return res.status(200).json(summary);
    } catch (err: any) {
      console.error('[AI-CONTROLLER] Erro:', err);
      return res.status(500).json({ error: 'Erro ao gerar resumo por IA.' });
    }
  }

  /**
   * POST /api/v1/ai/classify
   */
  static async classify(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });

      const { title, description } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'Título e descrição são necessários para classificação.' });
      }

      const classification = await AiService.classifyTicket(title, description);
      return res.status(200).json(classification);
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao classificar por IA.' });
    }
  }

  /**
   * POST /api/v1/ai/suggest-response/:ticketId
   */
  static async suggestResponse(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (req.user.role === 'user') return res.status(403).json({ error: 'Permissão insuficiente.' });

      const ticketId = Number(req.params.ticketId);

      const ticketRes = await db.query(
        `SELECT t.*, req.name as requester_name
         FROM tickets t
         LEFT JOIN users req ON t.requester_id = req.id
         WHERE t.id = ?;`,
        [ticketId]
      );

      if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket não encontrado.' });

      const commentsRes = await db.query(
        `SELECT c.content, c.is_internal, u.name as user_name
         FROM ticket_comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.ticket_id = ?
         ORDER BY c.created_at ASC;`,
        [ticketId]
      );

      const kbRes = await db.query('SELECT id, title, summary, content FROM knowledge_base_articles WHERE status = "PUBLISHED" LIMIT 5;');

      const suggestions = await AiService.suggestResponse(ticketRes.rows[0], commentsRes.rows, kbRes.rows);

      await recordAudit(req.user.id, 'AI_SUGGESTION_REQUESTED', 'TICKET', String(ticketId), null, req.ip);

      return res.status(200).json(suggestions);
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao gerar sugestões por IA.' });
    }
  }
}
