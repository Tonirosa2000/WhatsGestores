import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  matchOfficialGroup,
  invalidateOfficialGroupsCache,
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';

export async function POST() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    // 1. Busca todos os grupos e seus participantes na Evolution API
    const res = await fetch(`${evolutionUrl}/group/fetchAllGroups/whatsgestores?getParticipants=true`, {
      headers: { 'apikey': evolutionKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível consultar os grupos na Evolution API. Verifique se o WhatsApp está conectado.',
      }, { status: 400 });
    }

    const allGroups = await res.json();
    if (!Array.isArray(allGroups)) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum grupo retornado pela Evolution API.',
      }, { status: 400 });
    }

    // 2. Filtra ESTRITAMENTE os 2 grupos oficiais
    const matchedOfficialGroups: Array<{
      group: any;
      canonicalName: string;
      type: 'VAGAS' | 'CURRICULOS';
      originalSubject: string;
    }> = [];

    for (const group of allGroups) {
      const subject = group?.subject || group?.name || '';
      const match = matchOfficialGroup(subject);
      if (match.isOfficial && match.type && match.canonicalName) {
        matchedOfficialGroups.push({
          group,
          canonicalName: match.canonicalName,
          type: match.type,
          originalSubject: subject,
        });
      }
    }

    if (matchedOfficialGroups.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Nenhum dos grupos oficiais foi localizado na sua conta do WhatsApp. Certifique-se de que a conta participa de "${OFFICIAL_GROUP_VAGAS_DEFAULT}" e/ou "${OFFICIAL_GROUP_CURRICULOS_DEFAULT}".`,
        totalGroupsInspected: allGroups.length,
      }, { status: 404 });
    }

    // 3. Remove membros de grupos não oficiais da base para evitar contaminação
    await prisma.groupMember.deleteMany({
      where: {
        NOT: [
          { groupName: OFFICIAL_GROUP_VAGAS_DEFAULT },
          { groupName: OFFICIAL_GROUP_CURRICULOS_DEFAULT },
          { groupName: 'Gestores - Banco de Talentos - Currículos' },
        ],
      },
    });

    let membersSynced = 0;
    const groupStats: Record<string, number> = {};

    // 4. Sincroniza participantes apenas dos grupos oficiais identificados
    for (const item of matchedOfficialGroups) {
      const participants = item.group?.participants || [];
      let countForThisGroup = 0;

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
              groupName: item.canonicalName,
              isAuthorized: true,
              lastSeenAt: new Date(),
            },
            update: {
              groupName: item.canonicalName,
              name: p?.pushName || p?.name || undefined,
              lastSeenAt: new Date(),
            },
          });

          membersSynced++;
          countForThisGroup++;
        }
      }

      groupStats[item.canonicalName] = (groupStats[item.canonicalName] || 0) + countForThisGroup;
    }

    // Invalida cache de grupos
    invalidateOfficialGroupsCache();

    // 5. Registra log de auditoria detalhado
    const summaryDetails = Object.entries(groupStats)
      .map(([name, count]) => `${name}: ${count} membros`)
      .join(' | ');

    await prisma.syncLog.create({
      data: {
        groupName: 'Sincronização de Membros Oficiais',
        messageType: 'MEMBER_SYNC',
        summary: `Sincronização restrita aos grupos oficiais concluída: ${membersSynced} participantes no total (${summaryDetails}). Foram inspecionados ${allGroups.length} grupos no total e filtrados apenas os 2 oficiais.`,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      groupsCount: matchedOfficialGroups.length,
      totalGroupsInspected: allGroups.length,
      membersSynced,
      groupStats,
      message: `${membersSynced} membros sincronizados com sucesso exclusivamente dos grupos oficiais (${matchedOfficialGroups.map(g => g.canonicalName).join(', ')})!`,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar membros oficiais:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}