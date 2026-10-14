/**
 * SW Service Desk v1.0 - Controlador de CMDB e Gestão de Ativos
 * Organização: SW Cloud Solutions
 */

import { Request, Response } from 'express';
import { db } from '../db/connection.js';
import { recordAudit } from '../middleware/auth.js';

export class CmdbController {
  /**
   * GET /api/v1/cmdb/assets
   */
  static async list(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });

      const { status, type, department_id, search, my_assets } = req.query;

      let sql = `
        SELECT a.id, a.asset_tag, a.serial_number, a.name, a.type, a.model, a.manufacturer,
               a.status, a.location, a.purchase_date, a.warranty_expiration,
               u.id as user_id, u.name as assigned_user_name, u.email as assigned_user_email,
               d.name as department_name,
               (SELECT COUNT(*) FROM tickets t WHERE t.asset_id = a.id) as tickets_count
        FROM cmdb_assets a
        LEFT JOIN users u ON a.assigned_user_id = u.id
        LEFT JOIN departments d ON a.department_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // Se utilizador final ou filtro my_assets
      if (req.user.role === 'user' || my_assets === 'true') {
        sql += ` AND a.assigned_user_id = ?`;
        params.push(req.user.id);
      }

      if (status) {
        sql += ` AND a.status = ?`;
        params.push(status);
      }
      if (type) {
        sql += ` AND a.type = ?`;
        params.push(type);
      }
      if (department_id) {
        sql += ` AND a.department_id = ?`;
        params.push(Number(department_id));
      }
      if (search) {
        sql += ` AND (a.asset_tag LIKE ? OR a.name LIKE ? OR a.serial_number LIKE ? OR a.model LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }

      sql += ` ORDER BY a.asset_tag ASC;`;

      const result = await db.query(sql, params);
      return res.status(200).json({ assets: result.rows });
    } catch (err: any) {
      console.error('[CMDB] Erro ao listar ativos:', err);
      return res.status(500).json({ error: 'Erro ao listar ativos do inventário.' });
    }
  }

  /**
   * GET /api/v1/cmdb/assets/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      const assetId = Number(req.params.id);

      const assetRes = await db.query(
        `SELECT a.*,
                u.name as assigned_user_name, u.email as assigned_user_email,
                d.name as department_name
         FROM cmdb_assets a
         LEFT JOIN users u ON a.assigned_user_id = u.id
         LEFT JOIN departments d ON a.department_id = d.id
         WHERE a.id = ?;`,
        [assetId]
      );

      if (assetRes.rows.length === 0) return res.status(404).json({ error: 'Ativo não encontrado.' });
      const asset = assetRes.rows[0];

      // Histórico de Movimentações
      const historyRes = await db.query(
        `SELECT h.id, h.action, h.notes, h.created_at,
                u.name as actor_name,
                prev.name as previous_user_name,
                next_u.name as new_user_name
         FROM cmdb_asset_history h
         LEFT JOIN users u ON h.user_id = u.id
         LEFT JOIN users prev ON h.previous_user_id = prev.id
         LEFT JOIN users next_u ON h.new_user_id = next_u.id
         WHERE h.asset_id = ?
         ORDER BY h.created_at DESC;`,
        [assetId]
      );

      // Software Instalado
      const softwareRes = await db.query(
        `SELECT s.id as link_id, s.installed_version, s.installed_date,
                l.id as license_id, l.software_name, l.publisher, l.license_type
         FROM cmdb_asset_software s
         JOIN cmdb_software_licenses l ON s.license_id = l.id
         WHERE s.asset_id = ?;`,
        [assetId]
      );

      // Tickets Associados a este Ativo
      const ticketsRes = await db.query(
        `SELECT t.id, t.ticket_number, t.title, t.priority, t.status, t.created_at,
                req.name as requester_name
         FROM tickets t
         LEFT JOIN users req ON t.requester_id = req.id
         WHERE t.asset_id = ?
         ORDER BY t.created_at DESC;`,
        [assetId]
      );

      return res.status(200).json({
        asset,
        history: historyRes.rows,
        software: softwareRes.rows,
        tickets: ticketsRes.rows,
      });
    } catch (err: any) {
      console.error('[CMDB] Erro ao carregar detalhes:', err);
      return res.status(500).json({ error: 'Erro ao carregar detalhes do ativo.' });
    }
  }

  /**
   * POST /api/v1/cmdb/assets
   */
  static async create(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (req.user.role === 'user') {
        return res.status(403).json({ error: 'Apenas a equipa técnica pode criar ativos no CMDB.' });
      }

      const { asset_tag, serial_number, name, type, model, manufacturer, specs, department_id, location, purchase_date, warranty_expiration } = req.body;

      if (!asset_tag || !name || !type) {
        return res.status(400).json({ error: 'Etiqueta de Ativo (Asset Tag), Nome e Tipo são obrigatórios.' });
      }

      // Verificar se tag já existe
      const checkTag = await db.query('SELECT id FROM cmdb_assets WHERE asset_tag = ?;', [asset_tag.trim()]);
      if (checkTag.rows.length > 0) {
        return res.status(409).json({ error: `A etiqueta de ativo ${asset_tag} já se encontra registada.` });
      }

      const insertRes = await db.query(
        `INSERT INTO cmdb_assets (
          asset_tag, serial_number, name, type, model, manufacturer, specs,
          status, department_id, location, purchase_date, warranty_expiration,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?, ?, datetime('now'), datetime('now'));`,
        [
          asset_tag.trim(),
          serial_number ? serial_number.trim() : null,
          name.trim(),
          type,
          model || null,
          manufacturer || null,
          specs || null,
          department_id || null,
          location || null,
          purchase_date || null,
          warranty_expiration || null,
        ]
      );

      const assetId = insertRes.insertId;

      // Registar criação no histórico
      await db.query(
        `INSERT INTO cmdb_asset_history (asset_id, user_id, action, notes, created_at)
         VALUES (?, ?, 'CREATED', 'Equipamento registado no inventário CMDB.', datetime('now'));`,
        [assetId, req.user.id]
      );

      await recordAudit(req.user.id, 'ASSET_CREATED', 'CMDB_ASSET', String(assetId), { asset_tag, name }, req.ip);

      return res.status(201).json({
        id: assetId,
        asset_tag,
        message: `Ativo ${asset_tag} criado com sucesso e catalogado como IN_STOCK.`,
      });
    } catch (err: any) {
      console.error('[CMDB] Erro ao criar ativo:', err);
      return res.status(500).json({ error: 'Erro ao registar ativo no inventário.' });
    }
  }

  /**
   * PATCH /api/v1/cmdb/assets/:id/assign
   */
  static async assignUser(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (req.user.role === 'user') return res.status(403).json({ error: 'Permissão insuficiente.' });

      const assetId = Number(req.params.id);
      const { user_id, notes } = req.body;

      const currentRes = await db.query('SELECT assigned_user_id, asset_tag, name FROM cmdb_assets WHERE id = ?;', [assetId]);
      if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Ativo não encontrado.' });

      const current = currentRes.rows[0];
      const previousUserId = current.assigned_user_id;
      const newUserId = user_id ? Number(user_id) : null;
      const newStatus = newUserId ? 'ASSIGNED' : 'IN_STOCK';

      await db.query(
        `UPDATE cmdb_assets
         SET assigned_user_id = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?;`,
        [newUserId, newStatus, assetId]
      );

      const action = newUserId ? 'ASSIGNED' : 'UNASSIGNED';
      await db.query(
        `INSERT INTO cmdb_asset_history (asset_id, user_id, action, previous_user_id, new_user_id, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'));`,
        [assetId, req.user.id, action, previousUserId, newUserId, notes || 'Alteração de atribuição de utilizador']
      );

      await recordAudit(req.user.id, `ASSET_${action}`, 'CMDB_ASSET', String(assetId), { previousUserId, newUserId, notes }, req.ip);

      return res.status(200).json({
        message: newUserId ? 'Equipamento atribuído ao utilizador com sucesso.' : 'Equipamento devolvido ao stock.',
        status: newStatus,
        assigned_user_id: newUserId,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao atribuir utilizador ao ativo.' });
    }
  }

  /**
   * PATCH /api/v1/cmdb/assets/:id/retire
   */
  static async retireAsset(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Apenas gestores ou administradores podem retirar equipamentos de serviço (RETIRED).' });
      }

      const assetId = Number(req.params.id);
      const { notes } = req.body;

      const currentRes = await db.query('SELECT assigned_user_id, asset_tag FROM cmdb_assets WHERE id = ?;', [assetId]);
      if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Ativo não encontrado.' });

      const current = currentRes.rows[0];

      // Atualizar estado e remover atribuição de utilizador
      await db.query(
        `UPDATE cmdb_assets
         SET status = 'RETIRED', assigned_user_id = NULL, updated_at = datetime('now')
         WHERE id = ?;`,
        [assetId]
      );

      // Desassociar licenças de software e libertar seats
      const installedSoft = await db.query('SELECT license_id FROM cmdb_asset_software WHERE asset_id = ?;', [assetId]);
      for (const row of installedSoft.rows) {
        await db.query('UPDATE cmdb_software_licenses SET seats_used = MAX(0, seats_used - 1) WHERE id = ?;', [row.license_id]);
      }
      await db.query('DELETE FROM cmdb_asset_software WHERE asset_id = ?;', [assetId]);

      // Registar no histórico
      await db.query(
        `INSERT INTO cmdb_asset_history (asset_id, user_id, action, previous_user_id, notes, created_at)
         VALUES (?, ?, 'RETIRED', ?, ?, datetime('now'));`,
        [assetId, req.user.id, current.assigned_user_id, notes || 'Equipamento retirado de serviço e abatido do parque informático.']
      );

      await recordAudit(req.user.id, 'ASSET_RETIRED', 'CMDB_ASSET', String(assetId), { asset_tag: current.asset_tag, notes }, req.ip);

      return res.status(200).json({
        message: `Equipamento ${current.asset_tag} retirado de serviço com sucesso. Licenças de software devolvidas ao pool.`,
        status: 'RETIRED',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao retirar ativo de serviço.' });
    }
  }

  /**
   * GET /api/v1/cmdb/licenses
   */
  static async listLicenses(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      const licensesRes = await db.query('SELECT * FROM cmdb_software_licenses ORDER BY software_name ASC;');
      return res.status(200).json({ licenses: licensesRes.rows });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao listar licenças de software.' });
    }
  }
}
