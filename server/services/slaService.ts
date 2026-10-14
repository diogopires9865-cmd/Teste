/**
 * SW Service Desk v1.0 - Motor de SLA e Regras de Negócio
 * Organização: SW Cloud Solutions
 */

export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PriorityLevel = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';

export interface SLATimes {
  priority: PriorityLevel;
  slaId: number;
  responseMinutes: number;
  resolutionMinutes: number;
  responseDue: Date;
  resolutionDue: Date;
}

export class SlaService {
  /**
   * Matriz ITIL de Cálculo de Prioridade Automática
   * Impacto x Urgência -> Prioridade
   */
  static calculatePriority(impact: ImpactLevel, urgency: UrgencyLevel): PriorityLevel {
    if (impact === 'CRITICAL' && urgency === 'CRITICAL') {
      return 'P1_CRITICAL';
    }
    if ((impact === 'CRITICAL' && urgency === 'HIGH') || (impact === 'HIGH' && urgency === 'CRITICAL')) {
      return 'P1_CRITICAL';
    }
    if ((impact === 'HIGH' && urgency === 'HIGH') || (impact === 'CRITICAL' && urgency === 'MEDIUM') || (impact === 'MEDIUM' && urgency === 'CRITICAL')) {
      return 'P2_HIGH';
    }
    if (impact === 'HIGH' || urgency === 'HIGH') {
      return 'P2_HIGH';
    }
    if (impact === 'MEDIUM' && urgency === 'MEDIUM') {
      return 'P3_MEDIUM';
    }
    if ((impact === 'MEDIUM' && urgency === 'LOW') || (impact === 'LOW' && urgency === 'MEDIUM')) {
      return 'P3_MEDIUM';
    }
    return 'P4_LOW';
  }

  /**
   * Calcula as datas limites de SLA de Resposta e Resolução
   */
  static calculateDeadlines(priority: PriorityLevel, startDate: Date = new Date()): SLATimes {
    let responseMinutes = 480;
    let resolutionMinutes = 4320;
    let slaId = 4;

    switch (priority) {
      case 'P1_CRITICAL':
        slaId = 1;
        responseMinutes = 15; // 15 min
        resolutionMinutes = 120; // 2 horas
        break;
      case 'P2_HIGH':
        slaId = 2;
        responseMinutes = 60; // 1 hora
        resolutionMinutes = 480; // 8 horas
        break;
      case 'P3_MEDIUM':
        slaId = 3;
        responseMinutes = 240; // 4 horas
        resolutionMinutes = 1440; // 24 horas (1 dia útil)
        break;
      case 'P4_LOW':
      default:
        slaId = 4;
        responseMinutes = 480; // 8 horas
        resolutionMinutes = 4320; // 72 horas (3 dias úteis)
        break;
    }

    const responseDue = new Date(startDate.getTime() + responseMinutes * 60 * 1000);
    const resolutionDue = new Date(startDate.getTime() + resolutionMinutes * 60 * 1000);

    return {
      priority,
      slaId,
      responseMinutes,
      resolutionMinutes,
      responseDue,
      resolutionDue,
    };
  }

  /**
   * Avalia o estado de cumprimento do SLA
   */
  static evaluateSlaStatus(dueDate: string | Date | null, isResolved: boolean, resolvedAt: string | Date | null): {
    breached: boolean;
    remainingMs: number;
    label: string;
  } {
    if (!dueDate) {
      return { breached: false, remainingMs: 0, label: 'Sem SLA' };
    }

    const due = new Date(dueDate).getTime();
    const compareTime = isResolved && resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const remainingMs = due - compareTime;

    if (remainingMs < 0) {
      const hoursOver = Math.abs(Math.round(remainingMs / (1000 * 60 * 60)));
      return { breached: true, remainingMs, label: `SLA Violado (+${hoursOver}h)` };
    }

    const hoursLeft = Math.round(remainingMs / (1000 * 60 * 60));
    if (hoursLeft <= 1) {
      const minutesLeft = Math.max(1, Math.round(remainingMs / (1000 * 60)));
      return { breached: false, remainingMs, label: `${minutesLeft} min restantes` };
    }
    return { breached: false, remainingMs, label: `${hoursLeft}h restantes` };
  }
}
