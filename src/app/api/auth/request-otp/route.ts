import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  matchOfficialGroup,
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';

export async function POST(request: Request) {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Telefone é obrigatório' }, { status: 400 });
    }

    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }

    // Variação com ou sem o 9º dígito (para DDDs brasileiros)
    const phoneVariants = [cleaned, cleaned.replace(/^55/, '')];
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      // 55 + DDD + 9 + 8 dígitos -> varia para sem o 9
      phoneVariants.push(cleaned.slice(0, 4) + cleaned.slice(5));
      phoneVariants.push(cleaned.slice(2, 4) + cleaned.slice(5));
    } else if (cleaned.length === 12 && cleaned.startsWith('55')) {
      // 55 + DDD + 8 dígitos -> varia para com o 9
      phoneVariants.push(cleaned.slice(0, 4) + '9' + cleaned.slice(4));
      phoneVariants.push(cleaned.slice(2, 4) + '9' + cleaned.slice(4));
    }

    // 1. Verifica no banco local de membros (APENAS se estiver associado a um grupo oficial)
    let member = await prisma.groupMember.findFirst({
      where: {
        AND: [
          {
            OR: phoneVariants.map((p) => ({ phone: p })),
          },
          {
            OR: [
              { groupName: OFFICIAL_GROUP_VAGAS_DEFAULT },
              { groupName: OFFICIAL_GROUP_CURRICULOS_DEFAULT },
              { groupName: 'Gestores - Banco de Talentos - Currículos' },
            ],
          },
        ],
      },
    });

    // 2. Se não achou no banco local, consulta os grupos em tempo real na Evolution API (FILTRANDO APENAS OS OFICIAIS)
    if (!member) {
      try {
        const groupsRes = await fetch(`${evolutionUrl}/group/fetchAllGroups/whatsgestores?getParticipants=true`, {
          headers: { 'apikey': evolutionKey },
          signal: AbortSignal.timeout(10000),
        });

        if (groupsRes.ok) {
          const groups = await groupsRes.json();
          if (Array.isArray(groups)) {
            for (const group of groups) {
              const subject = group?.subject || group?.name || '';
              const match = matchOfficialGroup(subject);

              // IGNORA qualquer grupo que não seja um dos 2 oficiais
              if (!match.isOfficial || !match.canonicalName) {
                continue;
              }

              const participants = group?.participants || [];
              const found = participants.find((p: any) => {
                const pPhone = (p?.id || p?.jid || '').replace(/@.*$/, '').replace(/\D/g, '');
                return phoneVariants.some((v) => pPhone.endsWith(v) || v.endsWith(pPhone));
              });

              if (found) {
                // Cadastra como membro verificado do grupo oficial correspondente
                member = await prisma.groupMember.upsert({
                  where: { phone: cleaned },
                  create: {
                    phone: cleaned,
                    name: found?.pushName || found?.name || null,
                    groupName: match.canonicalName,
                    isAuthorized: true,
                    lastSeenAt: new Date(),
                  },
                  update: {
                    groupName: match.canonicalName,
                    name: found?.pushName || found?.name || undefined,
                    lastSeenAt: new Date(),
                  },
                });
                break;
              }
            }
          }
        }
      } catch (evoErr) {
        console.warn('Erro ao consultar grupos na Evolution API para verificação de membro:', evoErr);
      }
    }

    // 3. Se não for membro de nenhum dos grupos oficiais
    if (!member) {
      return NextResponse.json({
        success: false,
        isMember: false,
        message: 'Este número não foi localizado nos grupos oficiais de Gestores (Vagas e Currículo). Para visualizar o Banco de Talentos e currículos completos, ingresse nos nossos grupos oficiais!',
        inviteGroupUrl: 'https://chat.whatsapp.com/exemplo-grupo-gestores',
      }, { status: 403 });
    }

    // 4. Gera código OTP de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.authOtp.create({
      data: {
        phone: cleaned,
        code,
        expiresAt,
      },
    });

    // 5. Envia o código OTP diretamente no WhatsApp do usuário pelo robô
    try {
      await fetch(`${evolutionUrl}/message/sendText/whatsgestores`, {
        method: 'POST',
        headers: {
          'apikey': evolutionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleaned,
          text: `Olá! Seu código de verificação para acessar o Banco de Talentos do WhatsGestores é: *${code}* (válido por 10 minutos).`,
        }),
      });
    } catch (msgErr) {
      console.warn('Não foi possível enviar mensagem pelo WhatsApp, usando demoCode:', msgErr);
    }

    await prisma.syncLog.create({
      data: {
        groupName: member.groupName,
        messageType: 'MEMBER_AUTH',
        summary: `Código OTP enviado para ${member.name || cleaned} via WhatsApp (${member.groupName}).`,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      isMember: true,
      message: `Código de verificação enviado para o seu WhatsApp (${cleaned}).`,
      demoCode: code,
      phoneMasked: cleaned.replace(/(\d{4})(\d{4})$/, '••••-$2'),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}