import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractDataWithGemini, FileAttachmentInput } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      rawMessage,
      groupName,
      senderPhone,
      senderName,
      geminiApiKey,
      attachment, // { base64Data, mimeType, fileName }
    } = body;

    if (!rawMessage && !attachment) {
      return NextResponse.json({
        success: false,
        message: 'Forneça uma mensagem em texto ou envie um arquivo anexo (PDF, Word ou Imagem).',
      }, { status: 400 });
    }

    const groupHint = groupName?.toLowerCase().includes('curr') ? 'CURRICULOS' : 'VAGAS';

    // 1. Extração Inteligente Multimodal com a IA do Gemini
    const extracted = await extractDataWithGemini(
      rawMessage,
      groupHint,
      geminiApiKey,
      attachment as FileAttachmentInput | undefined
    );

    const messageId = 'wa_msg_' + Date.now();

    // 2. Gravação no Banco de Dados
    if (extracted.type === 'JOB') {
      const publishedAt = new Date();
      let expiresAt: Date;
      if (extracted.expiresAt) {
        const parsedExp = new Date(extracted.expiresAt);
        if (!isNaN(parsedExp.getTime())) {
          expiresAt = parsedExp;
        } else {
          expiresAt = new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      } else {
        // Regra de negócio: Prazo padrão de 30 dias a partir da data de cadastro
        expiresAt = new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      const isExpired = expiresAt.getTime() < Date.now();

      const job = await prisma.jobOpportunity.create({
        data: {
          messageId,
          groupName: groupName || 'Gestores - Banco de Talentos - VAGAS',
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
          originalMessage: rawMessage || `[Arquivo Anexo]: ${attachment?.fileName || 'Documento/Imagem de Vaga'}`,
          publishedAt,
          expiresAt,
          status: isExpired ? 'EXPIRED' : 'ACTIVE',
        }
      });

      await prisma.syncLog.create({
        data: {
          groupName: groupName || 'Gestores - Banco de Talentos - VAGAS',
          messageType: 'JOB',
          summary: `Nova vaga cadastrada via IA: ${extracted.title} (${extracted.company || 'Confidencial'})${attachment ? ` [Arquivo: ${attachment.fileName}]` : ''}`,
          success: true,
        }
      });

      return NextResponse.json({ success: true, type: 'JOB', data: job });
    }

    if (extracted.type === 'CANDIDATE') {
      const candidate = await prisma.candidateProfile.create({
        data: {
          messageId,
          groupName: groupName || 'Gestores - Banco de Talentos - Currículos',
          fullName: extracted.fullName || senderName || 'Candidato Disponível',
          targetRole: extracted.targetRole,
          experienceSummary: extracted.experienceSummary,
          skills: extracted.skills ? JSON.stringify(extracted.skills) : null,
          location: extracted.location || 'São Paulo - SP',
          contactPhone: extracted.contactPhone || senderPhone || '5511999999999',
          contactEmail: extracted.contactEmail || null,
          originalMessage: rawMessage || `[Currículo Anexo]: ${attachment?.fileName || 'Arquivo de Currículo'}`,
          publishedAt: new Date(),
          status: 'ACTIVE',
        }
      });

      await prisma.syncLog.create({
        data: {
          groupName: groupName || 'Gestores - Banco de Talentos - Currículos',
          messageType: 'CANDIDATE',
          summary: `Novo talento cadastrado via IA: ${extracted.fullName} - ${extracted.targetRole}${attachment ? ` [Arquivo: ${attachment.fileName}]` : ''}`,
          success: true,
        }
      });

      return NextResponse.json({ success: true, type: 'CANDIDATE', data: candidate });
    }

    // Se for ignorado
    await prisma.syncLog.create({
      data: {
        groupName: groupName || 'Grupo Geral',
        messageType: 'IGNORED',
        summary: `Mensagem descartada pela IA: ${extracted.reason}`,
        success: true,
      }
    });

    return NextResponse.json({ success: true, type: 'IGNORED', reason: extracted.reason });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
