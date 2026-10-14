/**
 * SW Service Desk v1.0 - Middleware de Autenticação, RBAC e Auditoria
 * Organização: SW Cloud Solutions
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sw_super_secret_jwt_key_replace_in_production_min_32_chars';

export interface AuthenticatedUser {
  id: number;
  uuid: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'technician' | 'user';
  department_id: number | null;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware para validar o token JWT e a sessão ativa na base de dados
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies['sw_sd_token']) {
      token = req.cookies['sw_sd_token'];
    }

    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária. Sessão não encontrada.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    // Verificar se o utilizador ainda existe e está ativo na base de dados
    const userRes = await db.query(
      'SELECT id, uuid, name, email, role, department_id, status FROM users WHERE id = ?;',
      [decoded.id]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Conta de utilizador suspensa ou inativa.' });
    }

    const dbUser = userRes.rows[0];
    req.user = {
      id: dbUser.id,
      uuid: dbUser.uuid,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      department_id: dbUser.department_id,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Sessão expirada. Por favor autentique-se novamente.' });
  }
}

/**
 * Middleware de RBAC para restringir rotas a perfis autorizados
 */
export function requireRole(allowedRoles: Array<'admin' | 'manager' | 'technician' | 'user'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso negado. Ação restrita a perfis: ${allowedRoles.join(', ')}. O seu perfil é: ${req.user.role}.`,
      });
    }

    next();
  };
}

/**
 * Registo de Auditoria Imutável (Audit Trail)
 */
export async function recordAudit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: any = null,
  ipAddress: string | null = null
) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'));`,
      [userId, action, entityType, entityId, ipAddress, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[AUDIT-LOG] Erro ao gravar auditoria:', err);
  }
}
