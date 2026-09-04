import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractDataWithGemini } from '@/lib/gemini';

interface ParsedMessage {
  messageId: string;
  senderName: string;
  senderPhone?: string;
  publishedAt: Date;
  content: string;
  groupName: string;
}

// Utilitário para pausar entre chamadas da IA e respeitar a quota
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, fileContent, groupName, limit = 50, geminiApiKey } = body;

    let rawMessages: ParsedMessage[] = [];

    // =========================================================================
    // 1. MODO ARQUIVO (.txt exportado do WhatsApp)
    // =========================================================================
    if (type === 'FILE') {
      if (!fileContent || typeof fileContent !== 'string') {
        return NextResponse.json({ success: false, error: 'Conteúdo do arquivo não fornecido.' }, { status: 400 });
      }

      rawMessages = parseWhatsAppExportedText(fileContent, groupName || 'Grupo WhatsApp');
    } 
    // =========================================================================
    // 2. MODO API (Evolution API v2 na nuvem)
    // =========================================================================
    else if (type === 'API') {
      const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
      const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

      try {
        // Busca mensagens históricas da instância
        const res = await fetch(`${evolutionUrl}/chat/findMessages/whatsgestores`, {
          method: 'POST',
          headers: {
            'apikey': evolutionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            limit: Number(limit) || 50,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const messagesList = Array.isArray(data) ? data : data?.messages?.records || data?.records || [];

          rawMessages = messagesList
            .filter((m: any) => !m?.key?.fromMe)
            .map((m: any) => {
              const content =
                m?.message?.conversation ||
                m?.message?.extendedTextMessage?.text ||
                m?.message?.imageMessage?.caption ||
                m?.message?.documentMessage?.caption ||
                '';

              const timestamp = m?.messageTimestamp ? new Date(m.messageTimestamp * 1000) : new Date();
              const sender = m?.pushName || m?.key?.participant?.replace(/\D/g, '') || 'Participante';

              return {
                messageId: m?.key?.id || ('wa_hist_' + Math.random().toString(36).substring(7)),
                senderName: sender,
                senderPhone: m?.key?.participant?.replace(/\D/g, '') || undefined,
                publishedAt: timestamp,
                content: content.trim(),
                groupName: groupName || m?.groupName || 'Grupo WhatsApp',
              };
            })
            .filter((m: ParsedMessage) => m.content.length > 0);
        }
      } catch (err: any) {
        console.error('Erro ao consultar Evolution API para mensagens históricas:', err);
      }
    }

    if (rawMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma mensagem relevante encontrada no lote informado.',
        stats: { total: 0, jobsCreated: 0, candidatesCreated: 0, ignored: 0 },
      });
    }

    // =========================================================================
    // 3. PRÉ-FILTRAGEM INTELIGENTE (Economiza Quota da IA)
    // =========================================================================
    const relevantMessages = rawMessages.filter((msg) => {
      const text = msg.content.toLowerCase();
      // Descarta mensagens muito curtas ou comuns
      if (text.length < 15) return false;
      if (
        text === 'bom dia' ||
        text === 'boa tarde' ||
        text === 'boa noite' ||
        text === 'obrigado' ||
        text === 'valeu' ||
        text.includes('<arquivo de mídia oculto>') ||
        text.includes('mensagens e chamadas são protegidas')
      ) {
        return false;
      }

      // Procura termos de oportunidade ou perfil profissional
      const hasJobKeywords =
        text.includes('vaga') ||
        text.includes('contrat') ||
        text.includes('oportunidade') ||
        text.includes('salário') ||
        text.includes('salario') ||
        text.includes('requisito') ||
        text.includes('edital') ||
        text.includes('processo seletivo') ||
        text.includes('http://') ||
        text.includes('https://');

      const hasCandidateKeywords =
        text.includes('currículo') ||
        text.includes('curriculo') ||
        text.includes('experiência') ||
        text.includes('experiencia') ||
        text.includes('formação') ||
        text.includes('graduação') ||
        text.includes('disponível') ||
        text.includes('cargo pretendido');

      return hasJobKeywords || hasCandidateKeywords;
    });

    let jobsCreated = 0;
    let candidatesCreated = 0;
    let ignored = 0;
    const processedItems: any[] = [];

    // =========================================================================
    // 4. PROCESSAMENTO SEQUENCIAL COM IA (Respeitando Quota)
    // =========================================================================
    for (let i = 0; i < relevantMessages.length; i++) {
      const item = relevantMessages[i];
      const hint = item.groupName.toLowerCase().includes('curr') ? 'CURRICULOS' : 'VAGAS';

      try {
        const extracted = await extractDataWithGemini(
          item.content,
          hint,
          geminiApiKey || process.env.GEMINI_API_KEY
        );

        if (extracted.type === 'JOB') {
          const publishedAt = item.publishedAt;
          let expiresAt: Date;
          if (extracted.expiresAt) {
            const parsed = new Date(extracted.expiresAt);
            expiresAt = !isNaN(parsed.getTime()) ? parsed : new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else {
            expiresAt = new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
          }

          const isExpired = expiresAt.getTime() < Date.now();

          await prisma.jobOpportunity.upsert({
            where: { messageId: item.messageId },
            create: {
              messageId: item.messageId,
              groupName: item.groupName,
              title: extracted.title,
              company: extracted.company || 'Confidencial',
              description: extracted.description,
              modality: extracted.modality || 'Presencial',
              location: extracted.location || 'Brasil',
              salary: extracted.salary || null,
              salaryFormatted: extracted.salaryFormatted || (extracted.salary ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(extracted.salary) : 'A combinar'),
              benefits: extracted.benefits || null,
              requirements: extracted.requirements ? JSON.stringify(extracted.requirements) : null,
              contactName: extracted.contactName || item.senderName,
              contactPhone: extracted.contactPhone || item.senderPhone || null,
              contactEmail: extracted.contactEmail || null,
              applyUrl: extracted.applyUrl || null,
              originalMessage: item.content,
              publishedAt,
              expiresAt,
              status: isExpired ? 'EXPIRED' : 'ACTIVE',
            },
            update: {
              title: extracted.title,
              description: extracted.description,
              expiresAt,
              status: isExpired ? 'EXPIRED' : 'ACTIVE',
            },
          });

          jobsCreated++;
          processedItems.push({ type: 'JOB', title: extracted.title, date: publishedAt });
        } else if (extracted.type === 'CANDIDATE') {
          await prisma.candidateProfile.upsert({
            where: { messageId: item.messageId },
            create: {
              messageId: item.messageId,
              groupName: item.groupName,
              fullName: extracted.fullName || item.senderName,
              targetRole: extracted.targetRole,
              experienceSummary: extracted.experienceSummary,
              skills: extracted.skills ? JSON.stringify(extracted.skills) : null,
              location: extracted.location || 'Brasil',
              contactPhone: extracted.contactPhone || item.senderPhone || 'Não informado',
              contactEmail: extracted.contactEmail || null,
              originalMessage: item.content,
              publishedAt: item.publishedAt,
              status: 'ACTIVE',
            },
            update: {
              fullName: extracted.fullName,
              experienceSummary: extracted.experienceSummary,
            },
          });

          candidatesCreated++;
          processedItems.push({ type: 'CANDIDATE', name: extracted.fullName, date: item.publishedAt });
        } else {
          ignored++;
        }
      } catch (procErr) {
        console.error('Erro ao processar mensagem com IA:', procErr);
        ignored++;
      }

      // Pausa suave de 1.5s entre chamadas da IA para proteger limites de requisições
      if (i < relevantMessages.length - 1) {
        await delay(1500);
      }
    }

    // Registra log de sincronização histórica
    await prisma.syncLog.create({
      data: {
        groupName: groupName || 'Importação Histórica',
        messageType: 'MEMBER_SYNC',
        summary: `Importação retroativa concluída: ${jobsCreated} vagas e ${candidatesCreated} talentos cadastrados (${rawMessages.length} mensagens analisadas).`,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalAnalyzed: rawMessages.length,
        relevantFound: relevantMessages.length,
        jobsCreated,
        candidatesCreated,
        ignored: ignored + (rawMessages.length - relevantMessages.length),
      },
      items: processedItems,
    });
  } catch (error: any) {
    console.error('Erro geral na importação histórica:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =========================================================================
// PARSER DE TEXTO EXPORTADO DO WHATSAPP (dd/mm/aaaa, hh:mm - Nome: Mensagem)
// =========================================================================
function parseWhatsAppExportedText(text: string, defaultGroupName: string): ParsedMessage[] {
  const lines = text.split(/\r?\n/);
  const messages: ParsedMessage[] = [];

  // Padrões de timestamp comuns no Brasil:
  // 1) 04/09/2026 14:30 - Nome: Mensagem
  // 2) 04/09/2026, 14:30 - Nome: Mensagem
  // 3) [04/09/2026, 14:30:15] Nome: Mensagem
  const regexPattern = /^(\[?(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})[\s,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\]?)\s*[-–]?\s*([^:]+):\s*(.*)$/;

  let currentMsg: ParsedMessage | null = null;

  for (const line of lines) {
    const match = line.match(regexPattern);

    if (match) {
      if (currentMsg) {
        messages.push(currentMsg);
      }

      const [, , dayStr, monthStr, yearStr, hourStr, minuteStr, secStr, author, messageText] = match;

      let year = parseInt(yearStr, 10);
      if (year < 100) year += 2000;
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      const second = secStr ? parseInt(secStr, 10) : 0;

      const date = new Date(year, month, day, hour, minute, second);

      currentMsg = {
        messageId: 'wa_hist_' + date.getTime() + '_' + Math.random().toString(36).substring(7),
        senderName: author.trim(),
        publishedAt: date,
        content: messageText.trim(),
        groupName: defaultGroupName,
      };
    } else if (currentMsg) {
      // Linhas seguintes de mensagens com múltiplas linhas
      currentMsg.content += '\n' + line;
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }

  return messages;
}