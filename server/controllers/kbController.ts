/**
 * SW Service Desk v1.0 - Controlador da Base de Conhecimento (KB)
 * Organização: SW Cloud Solutions
 */

import { Request, Response } from 'express';
import { db } from '../db/connection.js';
import { recordAudit } from '../middleware/auth.js';

export class KbController {
  /**
   * GET /api/v1/kb/articles
   */
  static async list(req: Request, res: Response) {
    try {
      const { search, category_id, is_public } = req.query;

      let sql = `
        SELECT a.id, a.title, a.slug, a.summary, a.category_id, a.is_public,
               a.views_count, a.helpful_votes, a.status, a.created_at,
               cat.name as category_name,
               u.name as author_name
        FROM knowledge_base_articles a
        LEFT JOIN ticket_categories cat ON a.category_id = cat.id
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.status = 'PUBLISHED'
      `;
      const params: any[] = [];

      // Se utilizador não autenticado ou papel 'user', mostrar apenas públicos
      if (!req.user || req.user.role === 'user' || is_public === 'true') {
        sql += ` AND a.is_public = 1`;
      }

      if (category_id) {
        sql += ` AND a.category_id = ?`;
        params.push(Number(category_id));
      }

      if (search) {
        sql += ` AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      sql += ` ORDER BY a.views_count DESC, a.created_at DESC;`;

      const result = await db.query(sql, params);
      return res.status(200).json({ articles: result.rows });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao listar artigos da base de conhecimento.' });
    }
  }

  /**
   * GET /api/v1/kb/articles/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      const articleId = Number(req.params.id);

      const articleRes = await db.query(
        `SELECT a.*, cat.name as category_name, u.name as author_name
         FROM knowledge_base_articles a
         LEFT JOIN ticket_categories cat ON a.category_id = cat.id
         LEFT JOIN users u ON a.author_id = u.id
         WHERE a.id = ?;`,
        [articleId]
      );

      if (articleRes.rows.length === 0) {
        return res.status(404).json({ error: 'Artigo não encontrado.' });
      }

      const article = articleRes.rows[0];

      // Incrementar contagem de visualizações
      await db.query('UPDATE knowledge_base_articles SET views_count = views_count + 1 WHERE id = ?;', [articleId]);

      return res.status(200).json({
        article: {
          ...article,
          views_count: article.views_count + 1,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao carregar artigo da KB.' });
    }
  }

  /**
   * POST /api/v1/kb/articles
   */
  static async create(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
      if (req.user.role === 'user') return res.status(403).json({ error: 'Apenas técnicos podem publicar artigos na KB.' });

      const { title, content, summary, category_id, is_public } = req.body;
      if (!title || !content || !category_id) {
        return res.status(400).json({ error: 'Título, conteúdo e categoria são obrigatórios.' });
      }

      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

      const insertRes = await db.query(
        `INSERT INTO knowledge_base_articles (title, slug, summary, content, category_id, author_id, is_public, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', datetime('now'), datetime('now'));`,
        [title.trim(), slug, summary || title.slice(0, 150), content, category_id, req.user.id, is_public ? 1 : 0]
      );

      await recordAudit(req.user.id, 'KB_ARTICLE_CREATED', 'KB_ARTICLE', String(insertRes.insertId), { title }, req.ip);

      return res.status(201).json({
        id: insertRes.insertId,
        slug,
        message: 'Artigo da Base de Conhecimento publicado com sucesso.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao criar artigo na KB.' });
    }
  }

  /**
   * POST /api/v1/kb/articles/:id/vote
   */
  static async voteHelpful(req: Request, res: Response) {
    try {
      const articleId = Number(req.params.id);
      await db.query('UPDATE knowledge_base_articles SET helpful_votes = helpful_votes + 1 WHERE id = ?;', [articleId]);
      return res.status(200).json({ message: 'Obrigado pelo seu feedback positivo!' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao registar voto.' });
    }
  }
}
