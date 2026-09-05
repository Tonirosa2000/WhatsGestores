import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractDataWithGemini, FileAttachmentInput } from '@/lib/gemini';
import {
  matchOfficialGroup,
  getOfficialGroupsFromEvolution,
  OfficialGroupType,
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';

interface ParsedMessage {
  messageId: string;
  senderName: string;
  senderPhone?: string;
  publishedAt: Date;
  content: string;
  groupName: string;
  groupType: OfficialGroupType;
  attachment?: FileAttachmentInput;
}

// Utilitário para pausar entre chamadas da IA e respeitar a quota
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type = 'API', fileContent, groupName, limit = 50, geminiApiKey } = body;

    const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
    const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

    // =========================================================================
    // 1. MODO ARQUIVO (.txt exportado do WhatsApp)
    // =========================================================================
    if (type === 'FILE') {
      if (!fileContent || typeof fileContent !== 'string') {
        return NextResponse.json({ success: false, error: 'Conteúdo do arquivo não fornecido.' }, { status: 400 });
      }

      const match = matchOfficialGroup(groupName || OFFICIAL_GROUP_CURRICULOS_DEFAULT);
      const canonicalGroup = match.canonicalName || OFFICIAL_GROUP_CURRICULOS_DEFAULT;
      const groupType = match.type || 'CURRICULOS';

      const fileMessages = parseWhatsAppExportedText(fileContent, canonicalGroup, groupType);
      const result = await processMessagesWithAI(fileMessages, geminiApiKey);

      return NextResponse.json({
        success: true,
        groupName: canonicalGroup,
        stats: result.stats,
        items: result.processedItems,
      });
    }

    // =========================================================================
    // 2. MODO API (Evolution API v2) COM VARREDURA SEQUENCIAL
    // =========================================================================
    // Se o usuário selecionou 'ALL_OFFICIAL' ou grupo vazio, executa a sequência completa:
    // 1º Currículos -> 2º Vagas
    const isSequentialFull = !groupName || groupName === 'ALL_OFFICIAL';

    const groupsToProcess: Array<{ type: OfficialGroupType; canonicalName: string }> = isSequentialFull
      ? [
          { type: 'CURRICULOS', canonicalName: OFFICIAL_GROUP_CURRICULOS_DEFAULT },
          { type: 'VAGAS', canonicalName: OFFICIAL_GROUP_VAGAS_DEFAULT },
        ]
      : (() => {
          const m = matchOfficialGroup(groupName);
          if (!m.isOfficial || !m.type || !m.canonicalName) {
            throw new Error(`Grupo selecionado inválido. Escolha "${OFFICIAL_GROUP_CURRICULOS_DEFAULT}" ou "${OFFICIAL_GROUP_VAGAS_DEFAULT}".`);
          }
          return [{ type: m.type, canonicalName: m.canonicalName }];
        })();

    // Busca grupos oficiais na Evolution API com timeout tolerante
    const officialGroups = await getOfficialGroupsFromEvolution(evolutionUrl, evolutionKey);

    let totalJobsCreated = 0;
    let totalCandidatesCreated = 0;
    let totalIgnored = 0;
    let totalAnalyzed = 0;
    const allProcessedItems: any[] = [];
    const groupSummaries: Array<{ name: string; jobs: number; candidates: number; analyzed: number }> = [];

    for (const target of groupsToProcess) {
      const groupInfo = officialGroups.find(
        (g) => g.type === target.type || g.canonicalName === target.canonicalName
      );

      // BLINDAGEM ESTRITA: Se o grupo não tiver remoteJid confirmado, NUNCA busca para não capturar de outros grupos!
      if (!groupInfo?.id) {
        console.warn(`[import-history] Grupo oficial "${target.canonicalName}" não localizado com JID na Evolution API.`);
        groupSummaries.push({
          name: target.canonicalName,
          jobs: 0,
          candidates: 0,
          analyzed: 0,
        });
        continue;
      }

      // Busca mensagens estritamente do JID deste grupo
      const requestBody = {
        where: {
          key: {
            remoteJid: groupInfo.id,
          },
        },
        limit: Number(limit) || 50,
      };

      let messagesList: any[] = [];
      try {
        const res = await fetch(`${evolutionUrl}/chat/findMessages/whatsgestores`, {
          method: 'POST',
          headers: {
            'apikey': evolutionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const data = await res.json();
          messagesList = Array.isArray(data) ? data : data?.messages?.records || data?.records || [];
        }
      } catch (fetchErr) {
        console.error(`Erro ao buscar mensagens do grupo ${target.canonicalName}:`, fetchErr);
      }

      // Filtra estritamente pelo JID do grupo oficial correspondente
      const filteredByGroup = messagesList.filter(
        (m: any) => !m?.key?.fromMe && m?.key?.remoteJid === groupInfo.id
      );

      totalAnalyzed += filteredByGroup.length;

      // Converte e extrai anexos quando disponíveis
      const groupMessages: ParsedMessage[] = [];

      for (const m of filteredByGroup) {
        const msgContent = m?.message;
        const docMessage = msgContent?.documentMessage || msgContent?.documentWithCaptionMessage?.message?.documentMessage;
        const imgMessage = msgContent?.imageMessage;

        let content =
          msgContent?.conversation ||
          msgContent?.extendedTextMessage?.text ||
          docMessage?.caption ||
          imgMessage?.caption ||
          '';

        let attachment: FileAttachmentInput | undefined;

        // Se houver anexo de documento (PDF, DOCX) ou imagem, tenta resgatar base64 da Evolution API
        if (docMessage || imgMessage) {
          const fileName = docMessage?.fileName || (imgMessage ? 'foto_anexo.jpg' : 'anexo.pdf');
          const mimeType = docMessage?.mimetype || imgMessage?.mimetype || 'application/pdf';

          // Se a mensagem já veio com base64
          if (m?.base64 || docMessage?.base64 || imgMessage?.base64) {
            attachment = {
              base64Data: m?.base64 || docMessage?.base64 || imgMessage?.base64,
              mimeType,
              fileName,
            };
          } else {
            // Chama endpoint de download de mídia da Evolution API
            try {
              const mediaRes = await fetch(`${evolutionUrl}/chat/getBase64FromMediaMessage/whatsgestores`, {
                method: 'POST',
                headers: {
                  'apikey': evolutionKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: m, convertToMp4: false }),
                signal: AbortSignal.timeout(15000),
              });

              if (mediaRes.ok) {
                const mediaData = await mediaRes.json();
                const base64 = mediaData?.base64 || mediaData?.data?.base64;
                if (base64) {
                  attachment = {
                    base64Data: base64,
                    mimeType,
                    fileName,
                  };
                }
              }
            } catch (mediaErr) {
              console.warn(`[import-history] Não foi possível baixar mídia da mensagem ${m?.key?.id}:`, mediaErr);
            }
          }

          if (!content && attachment) {
            content = `[Arquivo Anexo]: ${fileName}`;
          }
        }

        const timestamp = m?.messageTimestamp ? new Date(m.messageTimestamp * 1000) : new Date();
        const sender = m?.pushName || m?.key?.participant?.replace(/\D/g, '') || 'Participante';

        if (content.trim().length > 0 || attachment) {
          groupMessages.push({
            messageId: m?.key?.id || ('wa_hist_' + Math.random().toString(36).substring(7)),
            senderName: sender,
            senderPhone: m?.key?.participant?.replace(/\D/g, '') || undefined,
            publishedAt: timestamp,
            content: content.trim(),
            groupName: target.canonicalName,
            groupType: target.type,
            attachment,
          });
        }
      }

      // Processa as mensagens desse grupo específico com IA
      const stepResult = await processMessagesWithAI(groupMessages, geminiApiKey);

      totalJobsCreated += stepResult.stats.jobsCreated;
      totalCandidatesCreated += stepResult.stats.candidatesCreated;
      totalIgnored += stepResult.stats.ignored + (filteredByGroup.length - groupMessages.length);
      allProcessedItems.push(...stepResult.processedItems);

      groupSummaries.push({
        name: target.canonicalName,
        jobs: stepResult.stats.jobsCreated,
        candidates: stepResult.stats.candidatesCreated,
        analyzed: filteredByGroup.length,
      });

      // Pausa suave entre grupos
      await delay(1000);
    }

    // Registra log geral no banco
    const summaryText = isSequentialFull
      ? `Varredura Completa Oficial concluída: ${totalCandidatesCreated} talentos no grupo de Currículos e ${totalJobsCreated} vagas no grupo de Vagas (${totalAnalyzed} mensagens inspecionadas).`
      : `Varredura no grupo "${groupsToProcess[0]?.canonicalName}" concluída: ${totalJobsCreated} vagas e ${totalCandidatesCreated} talentos cadastrados.`;

    await prisma.syncLog.create({
      data: {
        groupName: isSequentialFull ? 'Varredura Completa Oficial' : groupsToProcess[0]?.canonicalName,
        messageType: 'MEMBER_SYNC',
        summary: summaryText,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      mode: isSequentialFull ? 'SEQUENTIAL_FULL' : 'SINGLE_GROUP',
      stats: {
        totalAnalyzed,
        jobsCreated: totalJobsCreated,
        candidatesCreated: totalCandidatesCreated,
        ignored: totalIgnored,
        groupSummaries,
      },
      items: allProcessedItems,
      message: summaryText,
    });
  } catch (error: any) {
    console.error('Erro na importação histórica do WhatsApp:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =========================================================================
// PROCESSAMENTO SEQUENCIAL COM IA (Respeitando Quota e Regras de Negócio)
// =========================================================================
async function processMessagesWithAI(messages: ParsedMessage[], geminiApiKey?: string) {
  let jobsCreated = 0;
  let candidatesCreated = 0;
  let ignored = 0;
  const processedItems: any[] = [];

  for (let i = 0; i < messages.length; i++) {
    const item = messages[i];
    const hint = item.groupType;

    // Pré-filtro inteligente: descarta mensagens triviais que não tenham anexos
    const textLower = item.content.toLowerCase();
    const isTrivial =
      !item.attachment &&
      (textLower.length < 15 ||
        textLower === 'bom dia' ||
        textLower === 'boa tarde' ||
        textLower === 'boa noite' ||
        textLower === 'obrigado' ||
        textLower.includes('youtube.com') ||
        textLower.includes('youtu.be') ||
        textLower.includes('tiktok.com') ||
        textLower.includes('<arquivo de mídia oculto>'));

    if (isTrivial) {
      ignored++;
      continue;
    }

    try {
      const extracted = await extractDataWithGemini(
        item.content,
        hint,
        geminiApiKey || process.env.GEMINI_API_KEY,
        item.attachment
      );

      // 1. Gravação de Vagas (Apenas se confirmada e apropriada)
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
        processedItems.push({ type: 'JOB', title: extracted.title, group: item.groupName });
      }
      // 2. Gravação de Talentos / Currículos
      else if (extracted.type === 'CANDIDATE') {
        await prisma.candidateProfile.upsert({
          where: { messageId: item.messageId },
          create: {
            messageId: item.messageId,
            groupName: item.groupName,
            fullName: extracted.fullName || item.senderName,
            targetRole: extracted.targetRole || 'Profissional Disponível',
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
        processedItems.push({ type: 'CANDIDATE', name: extracted.fullName, group: item.groupName });
      } else {
        ignored++;
      }
    } catch (procErr) {
      console.error('Erro ao analisar mensagem com IA:', procErr);
      ignored++;
    }

    if (i < messages.length - 1) {
      await delay(1200);
    }
  }

  return {
    stats: {
      jobsCreated,
      candidatesCreated,
      ignored,
    },
    processedItems,
  };
}

// =========================================================================
// PARSER DE TEXTO EXPORTADO DO WHATSAPP (.txt)
// =========================================================================
function parseWhatsAppExportedText(
  text: string,
  defaultGroupName: string,
  groupType: OfficialGroupType
): ParsedMessage[] {
  const lines = text.split(/\r?\n/);
  const messages: ParsedMessage[] = [];

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
        groupType,
      };
    } else if (currentMsg) {
      currentMsg.content += '\n' + line;
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }

  return messages;
}