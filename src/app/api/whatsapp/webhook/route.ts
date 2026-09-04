import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractDataWithGemini, FileAttachmentInput } from '@/lib/gemini';

export async function POST(request: Request) {
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
      const senderPhone = (msgData?.key?.participant || remoteJid).replace(/\D/g, '');
      const senderName = msgData?.pushName || 'Participante';
      const groupName = msgData?.groupName || (isGroup ? 'Grupo de Vagas e Currículos' : 'Mensagem Direta');

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

      const groupHint = groupName.toLowerCase().includes('curr') ? 'CURRICULOS' : 'VAGAS';

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
            groupName,
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
            groupName,
            messageType: 'JOB',
            summary: `Nova vaga detectada no WhatsApp: ${extracted.title} (${extracted.company || 'Confidencial'})`,
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
            groupName,
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
            groupName,
            messageType: 'CANDIDATE',
            summary: `Novo talento identificado no WhatsApp: ${extracted.fullName} - ${extracted.targetRole}`,
            success: true,
          }
        });

        return NextResponse.json({ success: true, type: 'CANDIDATE', id: candidate.id });
      }

      // 6. Mensagens Ignoradas / Conversas Comuns
      await prisma.syncLog.create({
        data: {
          groupName,
          messageType: 'IGNORED',
          summary: `Mensagem ignorada pela IA: ${extracted.reason}`,
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