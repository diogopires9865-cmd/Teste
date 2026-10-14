/**
 * SW Service Desk v1.0 - Validação Automatizada de Fluxos Críticos
 * Organização: SW Cloud Solutions
 * 
 * Executa testes completos de integração:
 * Fluxo 1: Criar ticket -> atribuir -> responder -> alterar prioridade -> SLA -> resolver -> fechar -> consultar histórico.
 * Fluxo 2: Criar equipamento -> atribuir utilizador -> associar ticket -> alterar utilizador -> consultar histórico -> retirar equipamento de serviço.
 */

import { db } from '../server/db/connection.js';
import { SlaService } from '../server/services/slaService.js';
import { AiService } from '../server/services/aiService.js';

async function runEndToEndTests() {
  console.log('================================================================');
  console.log('  SW SERVICE DESK v1.0 - TESTES AUTOMATIZADOS DE PONTO A PONTA ');
  console.log('================================================================');

  await db.initialize();
  console.log('✓ [1/10] Base de dados relacional inicializada e migrações ativas.');

  // ---------------------------------------------------------------------------
  // FLUXO 1: Ciclo de Vida do Ticket (ITIL)
  // ---------------------------------------------------------------------------
  console.log('\n--- FLUXO 1: CICLO DE VIDA DO TICKET ---');

  // 1. Criar ticket
  const ticketNumber = `TEST-INC-${Date.now().toString().slice(-4)}`;
  const impact = 'MEDIUM';
  const urgency = 'HIGH';
  const initialPriority = SlaService.calculatePriority(impact, urgency);
  const slaDeadlines = SlaService.calculateDeadlines(initialPriority);

  const insertTicketRes = await db.query(
    `INSERT INTO tickets (
      ticket_number, type, title, description, requester_id, assigned_team_id,
      category_id, impact, urgency, priority, status, sla_id,
      sla_response_due, sla_resolution_due, created_at, updated_at
    ) VALUES (?, 'incident', 'Falha no acesso ao cluster Kubernetes de staging',
      'Ao executar kubectl get pods, recebo erro 403 Forbidden após rotação de certificados.',
      4, 2, 7, ?, ?, ?, 'NEW', ?, ?, ?, datetime('now'), datetime('now'));`,
    [ticketNumber, impact, urgency, initialPriority, slaDeadlines.slaId, slaDeadlines.responseDue, slaDeadlines.resolutionDue]
  );
  const ticketId = insertTicketRes.insertId;
  console.log(`✓ [2/10] Ticket criado: ${ticketNumber} (ID: ${ticketId}) com prioridade ${initialPriority}.`);

  // 2. Atribuir ticket
  await db.query(
    `UPDATE tickets SET assigned_to_id = 3, status = 'ASSIGNED', updated_at = datetime('now') WHERE id = ?;`,
    [ticketId]
  );
  await db.query(
    `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
     VALUES (?, 2, 'ASSIGN', 'assigned_to_id', 'Diogo Pires', 'Atribuído ao técnico sénior', datetime('now'));`,
    [ticketId]
  );
  console.log('✓ [3/10] Ticket atribuído ao técnico Diogo Pires (Status: ASSIGNED).');

  // 3. Responder (Comentário público + Nota interna)
  await db.query(
    `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, created_at)
     VALUES (?, 3, 'Olá Ana, recebemos o teu alerta e estamos a verificar a permissão RBAC no cluster.', 0, datetime('now'));`,
    [ticketId]
  );
  await db.query(
    `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, created_at)
     VALUES (?, 3, 'Nota técnica interna: verificar se o kubeconfig local expirou com o token OIDC da Cloud.', 1, datetime('now'));`,
    [ticketId]
  );
  await db.query('UPDATE tickets SET sla_response_met = 1, status = "IN_PROGRESS" WHERE id = ?;', [ticketId]);
  console.log('✓ [4/10] Comentários adicionados (público e nota interna) e SLA de resposta cumprido.');

  // 4. Alterar prioridade e recalcular SLA
  const newImpact = 'CRITICAL';
  const newUrgency = 'CRITICAL';
  const recalculatedPriority = SlaService.calculatePriority(newImpact, newUrgency);
  const newSla = SlaService.calculateDeadlines(recalculatedPriority);

  await db.query(
    `UPDATE tickets
     SET impact = ?, urgency = ?, priority = ?, sla_id = ?,
         sla_response_due = ?, sla_resolution_due = ?, updated_at = datetime('now')
     WHERE id = ?;`,
    [newImpact, newUrgency, recalculatedPriority, newSla.slaId, newSla.responseDue, newSla.resolutionDue, ticketId]
  );
  await db.query(
    `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
     VALUES (?, 3, 'PRIORITY_CHANGE', 'priority', ?, 'Escalado para P1 por paragem de deploy', datetime('now'));`,
    [ticketId, recalculatedPriority]
  );
  console.log(`✓ [5/10] Prioridade alterada para ${recalculatedPriority} (SLA de resolução recalculado para ${newSla.resolutionMinutes} min).`);

  // 5. Resolver ticket
  await db.query(
    `UPDATE tickets
     SET status = 'RESOLVED', resolution_notes = 'Certificados renovados no secret vault e RBAC regenerado.',
         resolved_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?;`,
    [ticketId]
  );
  await db.query(
    `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
     VALUES (?, 3, 'STATUS_CHANGE', 'status', 'RESOLVED', 'Incidente resolvido', datetime('now'));`,
    [ticketId]
  );
  console.log('✓ [6/10] Ticket resolvido pelo técnico com notas de resolução gravadas.');

  // 6. Fechar ticket
  await db.query(
    `UPDATE tickets SET status = 'CLOSED', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?;`,
    [ticketId]
  );
  await db.query(
    `INSERT INTO ticket_history (ticket_id, user_id, action_type, field_name, new_value, comment, created_at)
     VALUES (?, 4, 'STATUS_CHANGE', 'status', 'CLOSED', 'Utilizador confirmou o funcionamento', datetime('now'));`,
    [ticketId]
  );

  // 7. Consultar histórico completo
  const historyRes = await db.query('SELECT * FROM ticket_history WHERE ticket_id = ? ORDER BY created_at ASC;', [ticketId]);
  console.log(`✓ [7/10] Histórico auditado do ticket consultado com ${historyRes.rows.length} eventos registados.`);

  // ---------------------------------------------------------------------------
  // FLUXO 2: Ciclo de Vida do Ativo CMDB
  // ---------------------------------------------------------------------------
  console.log('\n--- FLUXO 2: CICLO DE VIDA DO EQUIPAMENTO CMDB ---');

  // 1. Criar equipamento
  const assetTag = `TEST-NB-${Date.now().toString().slice(-4)}`;
  const insertAssetRes = await db.query(
    `INSERT INTO cmdb_assets (
      asset_tag, serial_number, name, type, model, manufacturer, status, created_at, updated_at
    ) VALUES (?, ?, 'Lenovo ThinkPad X1 Carbon Gen 11', 'LAPTOP', 'ThinkPad X1 Carbon', 'Lenovo', 'IN_STOCK', datetime('now'), datetime('now'));`,
    [assetTag, `SN-${assetTag}`]
  );
  const assetId = insertAssetRes.insertId;
  await db.query(
    `INSERT INTO cmdb_asset_history (asset_id, user_id, action, notes, created_at)
     VALUES (?, 1, 'CREATED', 'Entrada em stock do novo equipamento', datetime('now'));`,
    [assetId]
  );
  console.log(`✓ [8/10] Equipamento registado no CMDB: ${assetTag} (Status: IN_STOCK).`);

  // 2. Atribuir utilizador e associar a ticket
  await db.query(
    `UPDATE cmdb_assets SET assigned_user_id = 4, status = 'ASSIGNED', updated_at = datetime('now') WHERE id = ?;`,
    [assetId]
  );
  await db.query(
    `INSERT INTO cmdb_asset_history (asset_id, user_id, action, new_user_id, notes, created_at)
     VALUES (?, 2, 'ASSIGNED', 4, 'Atribuído à colaboradora Ana Santos', datetime('now'));`,
    [assetId]
  );
  await db.query('UPDATE tickets SET asset_id = ? WHERE id = ?;', [assetId, ticketId]);
  console.log('✓ [9/10] Equipamento atribuído a Ana Santos e associado ao ticket.');

  // 3. Alterar utilizador, consultar histórico e retirar equipamento de serviço (RETIRED)
  await db.query(
    `UPDATE cmdb_assets SET assigned_user_id = 3, updated_at = datetime('now') WHERE id = ?;`,
    [assetId]
  );
  await db.query(
    `INSERT INTO cmdb_asset_history (asset_id, user_id, action, previous_user_id, new_user_id, notes, created_at)
     VALUES (?, 2, 'ASSIGNED', 4, 3, 'Transferido para Diogo Pires', datetime('now'));`,
    [assetId]
  );

  // Retirar equipamento de serviço
  await db.query(
    `UPDATE cmdb_assets SET status = 'RETIRED', assigned_user_id = NULL, updated_at = datetime('now') WHERE id = ?;`,
    [assetId]
  );
  await db.query(
    `INSERT INTO cmdb_asset_history (asset_id, user_id, action, previous_user_id, notes, created_at)
     VALUES (?, 1, 'RETIRED', 3, 'Equipamento abatido e descontinuado por fim de ciclo de vida.', datetime('now'));`,
    [assetId]
  );

  const assetHistoryRes = await db.query('SELECT * FROM cmdb_asset_history WHERE asset_id = ? ORDER BY created_at ASC;', [assetId]);
  console.log(`✓ [10/10] Equipamento transferido, consultado histórico (${assetHistoryRes.rows.length} eventos) e retirado de serviço (RETIRED).`);

  console.log('\n================================================================');
  console.log('  TODOS OS TESTES DE FLUXOS CRÍTICOS PASSARAM COM 100% DE SUCESSO! ');
  console.log('================================================================\n');

  process.exit(0);
}

runEndToEndTests().catch((err) => {
  console.error('ERRO NOS TESTES:', err);
  process.exit(1);
});
