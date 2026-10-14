/**
 * SW Service Desk v1.0 - Agrupador de Rotas REST API (/api/v1)
 * Organização: SW Cloud Solutions
 */

import { Router } from 'express';
import { HealthController } from '../controllers/healthController.js';
import { AuthController } from '../controllers/authController.js';
import { TicketController } from '../controllers/ticketController.js';
import { CmdbController } from '../controllers/cmdbController.js';
import { CatalogController } from '../controllers/catalogController.js';
import { KbController } from '../controllers/kbController.js';
import { AiController } from '../controllers/aiController.js';
import { AdminController } from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { secureUpload } from '../middleware/upload.js';

export const apiRouter = Router();

// 1. Health Checks
apiRouter.get('/health', HealthController.check);

// 2. Autenticação e Gestão de Sessões
apiRouter.post('/auth/login', AuthController.login);
apiRouter.get('/auth/me', authenticateToken, AuthController.me);
apiRouter.post('/auth/logout', authenticateToken, AuthController.logout);
apiRouter.get('/auth/sessions', authenticateToken, AuthController.getSessions);
apiRouter.delete('/auth/sessions/:sessionId', authenticateToken, AuthController.revokeSession);
apiRouter.post('/auth/2fa/toggle', authenticateToken, AuthController.toggle2FA);

// 3. Gestão de Tickets (Incidentes, Pedidos, Problemas, Mudanças)
apiRouter.get('/tickets', authenticateToken, TicketController.list);
apiRouter.post('/tickets', authenticateToken, TicketController.create);
apiRouter.get('/tickets/:id', authenticateToken, TicketController.getById);
apiRouter.patch('/tickets/:id/status', authenticateToken, TicketController.updateStatus);
apiRouter.patch('/tickets/:id/assign', authenticateToken, TicketController.assign);
apiRouter.patch('/tickets/:id/priority', authenticateToken, TicketController.changePriority);
apiRouter.post('/tickets/:id/comments', authenticateToken, TicketController.addComment);
apiRouter.post('/tickets/:id/attachments', authenticateToken, secureUpload.single('file'), TicketController.uploadAttachment);
apiRouter.get('/tickets/:ticketId/attachments/:attachmentId', authenticateToken, TicketController.downloadAttachment);

// 4. CMDB & Gestão de Ativos
apiRouter.get('/cmdb/assets', authenticateToken, CmdbController.list);
apiRouter.post('/cmdb/assets', authenticateToken, CmdbController.create);
apiRouter.get('/cmdb/assets/:id', authenticateToken, CmdbController.getById);
apiRouter.patch('/cmdb/assets/:id/assign', authenticateToken, CmdbController.assignUser);
apiRouter.patch('/cmdb/assets/:id/retire', authenticateToken, CmdbController.retireAsset);
apiRouter.get('/cmdb/licenses', authenticateToken, CmdbController.listLicenses);

// 5. Catálogo de Serviços e Aprovações
apiRouter.get('/catalog/items', authenticateToken, CatalogController.listItems);
apiRouter.post('/catalog/request', authenticateToken, CatalogController.requestService);
apiRouter.get('/catalog/approvals', authenticateToken, CatalogController.listApprovals);
apiRouter.post('/catalog/approvals/:id/decide', authenticateToken, CatalogController.decideApproval);

// 6. Base de Conhecimento (KB)
apiRouter.get('/kb/articles', KbController.list);
apiRouter.get('/kb/articles/:id', KbController.getById);
apiRouter.post('/kb/articles', authenticateToken, KbController.create);
apiRouter.post('/kb/articles/:id/vote', KbController.voteHelpful);

// 7. Módulo de IA Privada (Apoio aos Técnicos com Validação Humana)
apiRouter.post('/ai/summarize/:ticketId', authenticateToken, AiController.summarize);
apiRouter.post('/ai/classify', authenticateToken, AiController.classify);
apiRouter.post('/ai/suggest-response/:ticketId', authenticateToken, AiController.suggestResponse);

// 8. Administração, Relatórios e Auditoria
apiRouter.get('/admin/dashboard-stats', authenticateToken, AdminController.getDashboardStats);
apiRouter.get('/admin/audit-logs', authenticateToken, AdminController.getAuditLogs);
apiRouter.get('/admin/users', authenticateToken, AdminController.listUsers);
apiRouter.patch('/admin/users/:id/role', authenticateToken, AdminController.updateUserRole);
apiRouter.get('/admin/departments', AdminController.listDepartments);
apiRouter.get('/admin/teams', AdminController.listTeams);
apiRouter.get('/admin/slas', AdminController.listSlas);
apiRouter.get('/admin/categories', AdminController.listCategories);
apiRouter.post('/admin/backup/test', authenticateToken, AdminController.testBackup);
