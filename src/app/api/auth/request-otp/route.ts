import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Telefone é obrigatório' }, { status: 400 });
    }

    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }

    // 1. Verifica se o telefone é membro do grupo
    const member = await prisma.groupMember.findFirst({
      where: {
        OR: [
          { phone: cleaned },
          { phone: cleaned.replace(/^55/, '') },
        ]
      }
    });

    if (!member) {
      return NextResponse.json({
        success: false,
        isMember: false,
        message: 'Este número não foi localizado nos grupos oficiais de Gestores. Para visualizar o Banco de Talentos e currículos completos, ingresse no nosso grupo do WhatsApp!',
        inviteGroupUrl: 'https://chat.whatsapp.com/exemplo-grupo-gestores'
      }, { status: 403 });
    }

    // 2. Gera código OTP de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.authOtp.create({
      data: {
        phone: cleaned,
        code,
        expiresAt,
      }
    });

    await prisma.syncLog.create({
      data: {
        groupName: member.groupName,
        messageType: 'MEMBER_AUTH',
        summary: `Código OTP ${code} enviado com sucesso para ${member.name || cleaned} via WhatsApp.`,
        success: true,
      }
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
