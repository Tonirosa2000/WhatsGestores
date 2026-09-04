import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractDataWithGemini, FileAttachmentInput } from '@/lib/gemini';
import {
  matchOfficialGroup,
  getOfficialGroupsFromEvolution,
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';

export async function POST(request: Request) {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    const payload = await request.json();
    const event = payload?.event || payload?.type;

    // 1. Atualização do Status da Conexão / QR Code
    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
      const qrData = payload?.data?.qrcode?.base64 || payload?.data?.qrcode;
      if (qrData) {
        await prisma.whatsAppSession.upsert({
          where: { id: 'primary' },
          create: { id: 'primary', status: 'QR_READY', qrCodeData: qrData },
          update: { status: 'QR_READY', qrCodeData: qrData, updatedAt: new Date() },
        });
      }
      return NextResponse.json({ success: true, message: 'QR Code atualizado' });
    }

    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = payload?.data?.state || payload?.data?.status;
      const isConnected = state === 'open' || state === 'CONNECTED';
      await prisma.whatsAppSession.upsert({
        where: { id: 'primary' },
        create: {
          id: 'primary',
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
          phoneConnected: payload?.data?.phone || null,
        },
        update: {
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
          phoneConnected: payload?.data?.phone || undefined,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, message: 'Status de conexão atualizado' });
    }

    // 2. Recepção de Novas Mensagens do WhatsApp
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      const msgData = payload?.data;
      if (!msgData || msgData?.key?.fromMe) {
        return NextResponse.json({ success: true, ignored: true, reason: 'Mensagem enviada por mim ou vazia' });
      }

      const remoteJid = msgData?.key?.remoteJid || '';
      const isGroup = remoteJid.endsWith('@g.us');

      // Descarta sumariamente se NÃO for grupo (mensagens diretas/privadas)
      if (!isGroup) {
        return NextResponse.json({
          success: true,
          ignored: true,
          reason: 'Mensagem individual descartada: o robô monitora apenas os grupos oficiais de Vagas e Currículos',
        });
      }

      // =======================================================================
      // FILTRO ESTRITO: Apenas os 2 Grupos Oficiais
      // =======================================================================
      const rawGroupName = msgData?.groupName || payload?.data?.groupName || '';
      let officialMatch = matchOfficialGroup(rawGroupName);
      let canonicalGroupName = officialMatch.canonicalName;
      let groupType = officialMatch.type;

      // Se o payload não trouxe o nome do grupo, valida pelo JID na Evolution API
      if (!officialMatch.isOfficial) {
        const officialGroups = await getOfficialGroupsFromEvolution(evolutionUrl, evolutionKey);
        const foundByJid = officialGroups.find((g) => g.id === remoteJid);

        if (foundByJid) {
          officialMatch = {
            isOfficial: true,
            type: foundByJid.type,
            canonicalName: foundByJid.canonicalName,
          };
          canonicalGroupName = foundByJid.canonicalName;
          groupType = foundByJid.type;
        }
      }

      // Se não for nenhum dos 2 grupos oficiais, descarta imediatamente sem consumir IA
      if (!officialMatch.isOfficial || !canonicalGroupName || !groupType) {
        return NextResponse.json({
          success: true,
          ignored: true,
          reason: `Grupo não autorizado ignorado (${rawGroupName || remoteJid}). Apenas os 2 grupos oficiais são monitorados.`,
        });
      }

      const senderPhone = (msgData?.key?.participant || remoteJid).replace(/\D/g, '');
      const senderName = msgData?.pushName || 'Participante';

      // Extração de texto de diferentes tipos de mensagem
      const messageContent = msgData?.message;
      let rawText =
        messageContent?.conversation ||
        messageContent?.extendedTextMessage?.text ||
        messageContent?.imageMessage?.caption ||
        messageContent?.documentMessage?.caption ||
        messageContent?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        '';

      // Tratamento de Mídia Anexa (Word, PDF, Imagem com base64 da Evolution API)
      let attachment: FileAttachmentInput | undefined;
      const docMessage = messageContent?.documentMessage || messageContent?.documentWithCaptionMessage?.message?.documentMessage;
      const imgMessage = messageContent?.imageMessage;

      if (docMessage && (msgData?.base64 || docMessage?.base64)) {
        attachment = {
          base64Data: msgData?.base64 || docMessage?.base64,
          mimeType: docMessage.mimetype || 'application/pdf',
          fileName: docMessage.fileName || 'documento.pdf',
        };
      } else if (imgMessage && (msgData?.base64 || imgMessage?.base64)) {
        attachment = {
          base64Data: msgData?.base64 || imgMessage?.base64,
          mimeType: imgMessage.mimetype || 'image/jpeg',
          fileName: 'foto_vaga.jpg',
        };
      }

      if (!rawText.trim() && !attachment) {
        return NextResponse.json({ success: true, ignored: true, reason: 'Sem texto legível ou anexo' });
      }

      const groupHint = groupType === 'CURRICULOS' ? 'CURRICULOS' : 'VAGAS';

      // 3. Processamento pela Inteligência Artificial do Gemini
      const extracted = await extractDataWithGemini(
        rawText,
        groupHint,
        process.env.GEMINI_API_KEY,
        attachment
      );

      const messageId = msgData?.key?.id || ('wa_' + Date.now());

      // 4. Gravação de Vagas
      if (extracted.type === 'JOB') {
        const publishedAt = new Date(msgData?.messageTimestamp ? msgData.messageTimestamp * 1000 : Date.now());
        let expiresAt: Date;
        if (extracted.expiresAt) {
          const parsed = new Date(extracted.expiresAt);
          expiresAt = !isNaN(parsed.getTime()) ? parsed : new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          expiresAt = new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        const isExpired = expiresAt.getTime() < Date.now();

        const job = await prisma.jobOpportunity.upsert({
          where: { messageId },
          create: {
            messageId,
            groupName: canonicalGroupName,
            title: extracted.title,
            company: extracted.company || 'Confidencial',
            description: extracted.description,
            modality: extracted.modality || 'Presencial',
            location: extracted.location || 'Brasil',
            salary: extracted.salary || null,
            salaryFormatted: extracted.salaryFormatted || (extracted.salary ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(extracted.salary) : 'A combinar'),
            benefits: extracted.benefits || null,
            requirements: extracted.requirements ? JSON.stringify(extracted.requirements) : null,
            contactName: extracted.contactName || senderName,
            contactPhone: extracted.contactPhone || senderPhone,
            contactEmail: extracted.contactEmail || null,
            applyUrl: extracted.applyUrl || null,
            originalMessage: rawText || `[Arquivo Anexo]: ${attachment?.fileName || 'Documento/Imagem de Vaga'}`,
            publishedAt,
            expiresAt,
            status: isExpired ? 'EXPIRED' : 'ACTIVE',
          },
          update: {
            title: extracted.title,
            description: extracted.description,
            expiresAt,
          }
        });

        await prisma.syncLog.create({
          data: {
            groupName: canonicalGroupName,
            messageType: 'JOB',
            summary: `Nova vaga detectada no grupo oficial "${canonicalGroupName}": ${extracted.title} (${extracted.company || 'Confidencial'})`,
            success: true,
          }
        });

        return NextResponse.json({ success: true, type: 'JOB', id: job.id });
      }

      // 5. Gravação de Currículos / Talentos
      if (extracted.type === 'CANDIDATE') {
        const candidate = await prisma.candidateProfile.upsert({
          where: { messageId },
          create: {
            messageId,
            groupName: canonicalGroupName,
            fullName: extracted.fullName || senderName || 'Candidato Disponível',
            targetRole: extracted.targetRole,
            experienceSummary: extracted.experienceSummary,
            skills: extracted.skills ? JSON.stringify(extracted.skills) : null,
            location: extracted.location || 'Brasil',
            contactPhone: extracted.contactPhone || senderPhone || 'Não informado',
            contactEmail: extracted.contactEmail || null,
            originalMessage: rawText || `[Currículo Anexo]: ${attachment?.fileName || 'Arquivo de Currículo'}`,
            publishedAt: new Date(),
            status: 'ACTIVE',
          },
          update: {
            fullName: extracted.fullName,
            experienceSummary: extracted.experienceSummary,
          }
        });

        await prisma.syncLog.create({
          data: {
            groupName: canonicalGroupName,
            messageType: 'CANDIDATE',
            summary: `Novo talento identificado no grupo oficial "${canonicalGroupName}": ${extracted.fullName} - ${extracted.targetRole}`,
            success: true,
          }
        });

        return NextResponse.json({ success: true, type: 'CANDIDATE', id: candidate.id });
      }

      // 6. Mensagens Ignoradas / Conversas Comuns dentro do grupo oficial
      await prisma.syncLog.create({
        data: {
          groupName: canonicalGroupName,
          messageType: 'IGNORED',
          summary: `Mensagem no grupo "${canonicalGroupName}" descartada pela IA: ${extracted.reason}`,
          success: true,
        }
      });

      return NextResponse.json({ success: true, type: 'IGNORED', reason: extracted.reason });
    }

    return NextResponse.json({ success: true, message: 'Evento recebido sem ação necessária' });
  } catch (error: any) {
    console.error('Erro no processamento do webhook Evolution API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}