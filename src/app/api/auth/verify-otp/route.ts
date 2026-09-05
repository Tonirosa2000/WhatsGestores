import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeToCanonicalPhone } from '@/lib/formatters';

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json();
    if (!phone || !code) {
      return NextResponse.json({ success: false, message: 'Telefone e código são obrigatórios' }, { status: 400 });
    }

    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }

    const canonical = normalizeToCanonicalPhone(cleaned);

    const otpRecord = await prisma.authOtp.findFirst({
      where: {
        phone: cleaned,
        code: code.trim(),
        used: false,
        expiresAt: { gte: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      return NextResponse.json({ success: false, message: 'Código inválido ou expirado. Solicite um novo código.' }, { status: 400 });
    }

    await prisma.authOtp.update({
      where: { id: otpRecord.id },
      data: { used: true }
    });

    const phoneVariants = [cleaned, cleaned.replace(/^55/, ''), canonical, canonical.replace(/^55/, '')];
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      phoneVariants.push(cleaned.slice(0, 4) + cleaned.slice(5));
      phoneVariants.push(cleaned.slice(2, 4) + cleaned.slice(5));
    } else if (cleaned.length === 12 && cleaned.startsWith('55')) {
      phoneVariants.push(cleaned.slice(0, 4) + '9' + cleaned.slice(4));
      phoneVariants.push(cleaned.slice(2, 4) + '9' + cleaned.slice(4));
    }

    const member = await prisma.groupMember.findFirst({
      where: {
        phone: { in: phoneVariants },
        isAuthorized: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Autenticação realizada com sucesso!',
      member: {
        name: member?.name || 'Membro do Grupo',
        phone: cleaned,
        groupName: member?.groupName || 'Gestores Comunidade',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
