import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseTables } from '@/lib/prisma';
import {
  getOfficialGroupsFromEvolution,
  fetchGroupParticipantsFromEvolution,
  extractParticipantData,
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';
import { normalizeToCanonicalPhone } from '@/lib/formatters';

export async function POST(request: Request) {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    await ensureDatabaseTables();
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Telefone é obrigatório' }, { status: 400 });
    }

    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }

    const canonical = normalizeToCanonicalPhone(cleaned);

    // Gera todas as variações possíveis para busca segura no Brasil
    const phoneVariantsSet = new Set<string>([cleaned, cleaned.replace(/^55/, ''), canonical, canonical.replace(/^55/, '')]);
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      // 55 + DDD + 9 + 8 dígitos -> sem o 9
      phoneVariantsSet.add(cleaned.slice(0, 4) + cleaned.slice(5));
      phoneVariantsSet.add(cleaned.slice(2, 4) + cleaned.slice(5));
    } else if (cleaned.length === 12 && cleaned.startsWith('55')) {
      // 55 + DDD + 8 dígitos -> com o 9
      phoneVariantsSet.add(cleaned.slice(0, 4) + '9' + cleaned.slice(4));
      phoneVariantsSet.add(cleaned.slice(2, 4) + '9' + cleaned.slice(4));
    }

    const allVariants = Array.from(phoneVariantsSet);

    // Identificação de Administrador do Sistema / Gestor dos Grupos
    const adminPhonesEnv = process.env.ADMIN_PHONES || '';
    const defaultAdminPhones = ['5531984137481', '553184137481', '31984137481', '3184137481'];
    const allowedAdminPhones = [
      ...defaultAdminPhones,
      ...adminPhonesEnv.split(',').map((p) => p.trim().replace(/\D/g, '')).filter(Boolean),
    ];

    const isAdminPhone = allVariants.some((v) => allowedAdminPhones.includes(v));

    // 1. Verifica no banco local de membros autorizados
    let member = await prisma.groupMember.findFirst({
      where: {
        phone: { in: allVariants },
        isAuthorized: true,
      },
    });

    // 2. Se não achou no banco local, consulta diretamente os grupos oficiais em tempo real na Evolution API
    if (!member) {
      try {
        const officialGroups = await getOfficialGroupsFromEvolution(evolutionUrl, evolutionKey);
        for (const group of officialGroups) {
          const participants = await fetchGroupParticipantsFromEvolution(group.id, evolutionUrl, evolutionKey);

          for (const p of participants) {
            const parsed = extractParticipantData(p);
            if (!parsed) continue;

            const matches = allVariants.some((v) => parsed.phone.endsWith(v) || v.endsWith(parsed.phone));
            if (matches) {
              const participantName = parsed.name || (isAdminPhone ? 'Toni Rosa (Administrador)' : null);

              // Cadastra como membro verificado no banco
              member = await prisma.groupMember.upsert({
                where: { phone: cleaned },
                create: {
                  phone: cleaned,
                  name: participantName,
                  groupName: group.canonicalName,
                  isAuthorized: true,
                  lastSeenAt: new Date(),
                },
                update: {
                  groupName: group.canonicalName,
                  name: participantName || undefined,
                  isAuthorized: true,
                  lastSeenAt: new Date(),
                },
              });
              break;
            }
          }

          if (member) break;
        }
      } catch (evoErr) {
        console.warn('[request-otp] Erro ao consultar grupos na Evolution API:', evoErr);
      }
    }

    // 3. Se for administrador conhecido mas ainda não constava na base, autoriza automaticamente
    if (!member && isAdminPhone) {
      member = await prisma.groupMember.upsert({
        where: { phone: cleaned },
        create: {
          phone: cleaned,
          name: 'Toni Rosa (Administrador)',
          groupName: OFFICIAL_GROUP_VAGAS_DEFAULT,
          isAuthorized: true,
          lastSeenAt: new Date(),
        },
        update: {
          groupName: OFFICIAL_GROUP_VAGAS_DEFAULT,
          isAuthorized: true,
          lastSeenAt: new Date(),
        },
      });
    }

    // 4. Se realmente não for membro dos grupos oficiais
    if (!member) {
      return NextResponse.json({
        success: false,
        isMember: false,
        message: 'Este número não foi localizado nos grupos oficiais de Gestores (Vagas e Currículo). Para visualizar o Banco de Talentos e currículos completos, ingresse nos nossos grupos oficiais!',
        inviteGroupUrl: 'https://chat.whatsapp.com/120363425890387747',
      }, { status: 403 });
    }

    // 5. Gera código OTP de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.authOtp.create({
      data: {
        phone: cleaned,
        code,
        expiresAt,
      },
    });

    // 6. Envia o código OTP via WhatsApp
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
        summary: `Código OTP gerado para ${member.name || cleaned} (${member.groupName}).`,
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
    console.error('Erro em request-otp:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}