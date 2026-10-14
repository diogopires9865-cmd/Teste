/**
 * SW Service Desk v1.0 - Serviço de IA Privada para Apoio aos Técnicos
 * Organização: SW Cloud Solutions
 * 
 * Utiliza o modelo gemini-3.8-flash através do SDK oficial @google/genai.
 * Princípio Fundamental de Segurança: Ações sensíveis da IA são SEMPRE
 * sujeitas a confirmação humana ativa pelo técnico responsável (Human-in-the-Loop).
 */

import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export interface AiTicketSummary {
  executiveSummary: string;
  keyIssues: string[];
  suggestedNextSteps: string[];
  sentiment: 'calm' | 'frustrated' | 'urgent';
  requiresHumanConfirmation: true;
}

export interface AiClassification {
  categorySuggestion: string;
  suggestedImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedUrgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedPriority: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';
  confidenceReasoning: string;
  requiresHumanConfirmation: true;
}

export interface AiResponseSuggestion {
  draftReply: string;
  internalNoteProposal: string;
  referencedKnowledgeArticles: Array<{ id?: number; title: string; excerpt: string }>;
  diagnosticCommands: string[];
  requiresHumanConfirmation: true;
}

export class AiService {
  /**
   * Resume o histórico do ticket para agilizar a passagem de turno entre técnicos
   */
  static async summarizeTicket(ticketData: any, comments: any[]): Promise<AiTicketSummary> {
    const ai = getAiClient();
    if (!ai) {
      return {
        executiveSummary: `Ticket ${ticketData.ticket_number}: ${ticketData.title}. O requerente reportou problema e aguarda resolução técnica.`,
        keyIssues: ['Necessidade de validação presencial ou remota dos sintomas descritos'],
        suggestedNextSteps: ['Contactar o utilizador para confirmação de disponibilidade', 'Verificar registos do sistema'],
        sentiment: 'calm',
        requiresHumanConfirmation: true,
      };
    }

    const conversationTranscript = comments
      .map((c) => `[${c.is_internal ? 'NOTA INTERNA' : 'RESPOSTA'}] ${c.user_name || 'Utilizador'}: ${c.content}`)
      .join('\n');

    const prompt = `És o assistente de IA privada do Service Desk da empresa SW Cloud Solutions.
Analisa este ticket de suporte técnico e o seu histórico de mensagens:

TÍTULO: ${ticketData.title}
CÓDIGO: ${ticketData.ticket_number}
TIPO: ${ticketData.type}
ESTADO ATUAL: ${ticketData.status}
PRIORIDADE: ${ticketData.priority}
DESCRIÇÃO INICIAL: ${ticketData.description}

HISTÓRICO DE MENSAGENS:
${conversationTranscript || 'Ainda sem comentários adicionais.'}

Gera um resumo executivo para o técnico em formato JSON com a seguinte estrutura:
{
  "executiveSummary": "Resumo claro em português de Portugal de 2-3 frases sobre o estado atual do incidente",
  "keyIssues": ["Ponto chave 1", "Ponto chave 2"],
  "suggestedNextSteps": ["Ação técnica recomendada 1", "Ação técnica recomendada 2"],
  "sentiment": "calm" | "frustrated" | "urgent"
}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        ...parsed,
        requiresHumanConfirmation: true,
      };
    } catch (err: any) {
      console.error('[AI-SERVICE] Erro ao resumir ticket:', err.message);
      return {
        executiveSummary: `Resumo automático indisponível de momento. Ticket ${ticketData.ticket_number}: ${ticketData.title}.`,
        keyIssues: [ticketData.title],
        suggestedNextSteps: ['Avaliar manualmente a descrição e anexos'],
        sentiment: 'calm',
        requiresHumanConfirmation: true,
      };
    }
  }

  /**
   * Classifica e sugere prioridade (Impacto e Urgência)
   */
  static async classifyTicket(title: string, description: string): Promise<AiClassification> {
    const ai = getAiClient();
    if (!ai) {
      return {
        categorySuggestion: 'Hardware e Posto de Trabalho',
        suggestedImpact: 'MEDIUM',
        suggestedUrgency: 'MEDIUM',
        suggestedPriority: 'P3_MEDIUM',
        confidenceReasoning: 'Classificação padrão baseada no volume de incidentes habituais.',
        requiresHumanConfirmation: true,
      };
    }

    const prompt = `És o classificador de triagem ITIL do SW Service Desk (SW Cloud Solutions).
Classifica o seguinte pedido de suporte:
Título: "${title}"
Descrição: "${description}"

Determina:
1. Impacto: "LOW" (1 pessoa), "MEDIUM" (departamento afetado com contorno), "HIGH" (serviço crítico degradado), "CRITICAL" (paragem global de operações).
2. Urgência: "LOW" (não urgente), "MEDIUM" (prazo normal), "HIGH" (prazo curto), "CRITICAL" (urgência máxima imediata).
3. Categoria aproximada (ex: "Hardware e Posto de Trabalho", "Acessos e Identidade", "Infraestrutura Cloud e Servidores", "Software e Licenças").
4. Raciocínio conciso da recomendação.

Devolve em JSON:
{
  "categorySuggestion": "string",
  "suggestedImpact": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "suggestedUrgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "confidenceReasoning": "string"
}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const impact = parsed.suggestedImpact || 'MEDIUM';
      const urgency = parsed.suggestedUrgency || 'MEDIUM';

      let priority: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW' = 'P3_MEDIUM';
      if (impact === 'CRITICAL' || urgency === 'CRITICAL') priority = 'P1_CRITICAL';
      else if (impact === 'HIGH' || urgency === 'HIGH') priority = 'P2_HIGH';
      else if (impact === 'LOW' && urgency === 'LOW') priority = 'P4_LOW';

      return {
        categorySuggestion: parsed.categorySuggestion || 'Geral',
        suggestedImpact: impact,
        suggestedUrgency: urgency,
        suggestedPriority: priority,
        confidenceReasoning: parsed.confidenceReasoning || 'Classificado com base nos padrões semânticos de impacto e urgência.',
        requiresHumanConfirmation: true,
      };
    } catch (err: any) {
      console.error('[AI-SERVICE] Erro ao classificar ticket:', err.message);
      return {
        categorySuggestion: 'Suporte Geral',
        suggestedImpact: 'MEDIUM',
        suggestedUrgency: 'MEDIUM',
        suggestedPriority: 'P3_MEDIUM',
        confidenceReasoning: 'Classificação por defeito.',
        requiresHumanConfirmation: true,
      };
    }
  }

  /**
   * Sugere respostas técnicas e procedimentos de resolução cruzados com KB
   */
  static async suggestResponse(ticketData: any, comments: any[], kbArticles: any[]): Promise<AiResponseSuggestion> {
    const ai = getAiClient();
    const articlesContext = kbArticles
      .map((a) => `ID:${a.id} | Título: ${a.title} | Resumo: ${a.summary}\nConteúdo: ${a.content?.slice(0, 400)}`)
      .join('\n---\n');

    if (!ai) {
      return {
        draftReply: `Olá ${ticketData.requester_name || 'Colaborador(a)'},\n\nRecebemos o seu pedido relativo a "${ticketData.title}". A nossa equipa de suporte técnico já se encontra a analisar a situação e daremos feedback nas próximas horas.\n\nCom os melhores cumprimentos,\nEquipa SW Service Desk`,
        internalNoteProposal: 'Proceder à validação de compatibilidade de drivers e consultar artigos da base de conhecimento.',
        referencedKnowledgeArticles: kbArticles.slice(0, 2).map((a) => ({ id: a.id, title: a.title, excerpt: a.summary })),
        diagnosticCommands: ['ping -c 4 gw.swcloudsolutions.com', 'systeminfo'],
        requiresHumanConfirmation: true,
      };
    }

    const prompt = `És o assistente técnico especialista sénior do SW Service Desk (SW Cloud Solutions).
O teu papel é elaborar um rascunho de resposta educada ao cliente e uma proposta técnica de nota interna para o técnico.
Lembra-te: O teu rascunho NUNCA é enviado diretamente; o técnico humano irá lê-lo, editá-lo e aprová-lo antes do envio.

DADOS DO TICKET:
Título: ${ticketData.title}
Descrição: ${ticketData.description}
Requerente: ${ticketData.requester_name || 'Colaborador'}

BASE DE CONHECIMENTO DISPONÍVEL:
${articlesContext}

Devolve exclusivamente JSON:
{
  "draftReply": "Texto profissional e amigável em português de Portugal dirigido ao utilizador",
  "internalNoteProposal": "Anotação puramente técnica com passos de diagnóstico para a equipa",
  "referencedKnowledgeArticles": [{"id": 1, "title": "Título", "excerpt": "Explicação da relevância"}],
  "diagnosticCommands": ["comando terminal 1", "comando 2"]
}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        draftReply: parsed.draftReply || 'Olá, estamos a analisar o seu pedido e responderemos em breve.',
        internalNoteProposal: parsed.internalNoteProposal || 'Verificar histórico e aplicar patches recomendados.',
        referencedKnowledgeArticles: parsed.referencedKnowledgeArticles || [],
        diagnosticCommands: parsed.diagnosticCommands || [],
        requiresHumanConfirmation: true,
      };
    } catch (err: any) {
      console.error('[AI-SERVICE] Erro ao gerar sugestão de resposta:', err.message);
      return {
        draftReply: `Olá, a equipa da SW Cloud Solutions encontra-se a analisar o incidente "${ticketData.title}". Em breve forneceremos atualizações.`,
        internalNoteProposal: 'Análise técnica pendente de validação manual.',
        referencedKnowledgeArticles: [],
        diagnosticCommands: [],
        requiresHumanConfirmation: true,
      };
    }
  }
}
