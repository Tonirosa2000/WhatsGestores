import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    // 1. Busca todos os grupos e seus participantes na Evolution API
    const res = await fetch(`${evolutionUrl}/group/fetchAllGroups/whatsgestores?getParticipants=true`, {
      headers: { 'apikey': evolutionKey },
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível consultar os grupos na Evolution API. Verifique se o WhatsApp está conectado.',
      }, { status: 400 });
    }

    const groups = await res.json();
    if (!Array.isArray(groups)) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum grupo retornado pela Evolution API.',
      }, { status: 400 });
    }

    let membersSynced = 0;

    for (const group of groups) {
      const groupName = group?.subject || group?.name || 'Grupo de Gestores';
      const participants = group?.participants || [];

      for (const p of participants) {
        const rawId = p?.id || p?.jid || '';
        let phone = rawId.replace(/@.*$/, '').replace(/\D/g, '');

        if (phone && phone.length >= 8) {
          if (!phone.startsWith('55') && phone.length <= 11) {
            phone = '55' + phone;
          }

          await prisma.groupMember.upsert({
            where: { phone },
            create: {
              phone,
              name: p?.pushName || p?.name || null,
              groupName,
              isAuthorized: true,
              lastSeenAt: new Date(),
            },
            update: {
              groupName,
              lastSeenAt: new Date(),
            },
          });

          membersSynced++;
        }
      }
    }

    // Registra log
    await prisma.syncLog.create({
      data: {
        groupName: 'Sincronização de Membros',
        messageType: 'MEMBER_SYNC',
        summary: `Sincronizados ${membersSynced} membros de ${groups.length} grupos do WhatsApp.`,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      groupsCount: groups.length,
      membersSynced,
      message: `${membersSynced} membros sincronizados com sucesso de ${groups.length} grupos!`,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar membros:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}