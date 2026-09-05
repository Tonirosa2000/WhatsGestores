import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getOfficialGroupsFromEvolution,
  fetchGroupParticipantsFromEvolution,
  extractParticipantData,
  invalidateOfficialGroupsCache,
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';

export async function POST() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    // 1. Busca os grupos oficiais confirmados (com fallback garantido para os JIDs conhecidos)
    const officialGroups = await getOfficialGroupsFromEvolution(evolutionUrl, evolutionKey, true);

    if (!officialGroups || officialGroups.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Nenhum dos grupos oficiais foi localizado na conta do WhatsApp conectada. Certifique-se de que o robô participa de "${OFFICIAL_GROUP_VAGAS_DEFAULT}" e/ou "${OFFICIAL_GROUP_CURRICULOS_DEFAULT}".`,
      }, { status: 404 });
    }

    let membersSynced = 0;
    const groupStats: Record<string, number> = {};

    // 2. Busca participantes especificamente de cada um dos grupos oficiais
    for (const group of officialGroups) {
      const participants = await fetchGroupParticipantsFromEvolution(group.id, evolutionUrl, evolutionKey);
      let countForThisGroup = 0;

      for (const p of participants) {
        const parsed = extractParticipantData(p);
        if (!parsed) continue;

        const phone = parsed.phone;
        const participantName = parsed.name;

        // Gera variantes brasileiras para garantir localização (com/sem 55 e com/sem 9º dígito)
        const phonesToRegister = new Set<string>([phone]);
        if (phone.length === 13 && phone.startsWith('55')) {
          phonesToRegister.add(phone.slice(0, 4) + phone.slice(5)); // sem 9
          phonesToRegister.add(phone.slice(2)); // sem 55
          phonesToRegister.add(phone.slice(2, 4) + phone.slice(5)); // sem 55 e sem 9
        } else if (phone.length === 12 && phone.startsWith('55')) {
          phonesToRegister.add(phone.slice(0, 4) + '9' + phone.slice(4)); // com 9
          phonesToRegister.add(phone.slice(2)); // sem 55
          phonesToRegister.add(phone.slice(2, 4) + '9' + phone.slice(4)); // sem 55 e com 9
        }

        for (const ph of phonesToRegister) {
          await prisma.groupMember.upsert({
            where: { phone: ph },
            create: {
              phone: ph,
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
        }

        membersSynced++;
        countForThisGroup++;
      }

      groupStats[group.canonicalName] = countForThisGroup;
    }

    // 3. Garante que os telefones de administradores estejam autorizados e registrados
    const adminPhonesEnv = process.env.ADMIN_PHONES || '';
    const defaultAdminPhones = ['5531984137481', '553184137481', '31984137481', '3184137481'];
    const allAdminPhones = [
      ...defaultAdminPhones,
      ...adminPhonesEnv.split(',').map((p) => p.trim().replace(/\D/g, '')).filter(Boolean),
    ];

    for (const adminPhone of allAdminPhones) {
      await prisma.groupMember.upsert({
        where: { phone: adminPhone },
        create: {
          phone: adminPhone,
          name: 'Toni Rosa (Administrador)',
          groupName: OFFICIAL_GROUP_VAGAS_DEFAULT,
          isAuthorized: true,
          lastSeenAt: new Date(),
        },
        update: {
          isAuthorized: true,
          lastSeenAt: new Date(),
        },
      });
    }

    // Invalida cache de grupos
    invalidateOfficialGroupsCache();

    // 4. Registra log de auditoria detalhado
    const summaryDetails = Object.entries(groupStats)
      .map(([name, count]) => `${name}: ${count} participantes`)
      .join(' | ');

    await prisma.syncLog.create({
      data: {
        groupName: 'Sincronização de Membros Oficiais',
        messageType: 'MEMBER_SYNC',
        summary: `Sincronização concluída com sucesso: ${membersSynced} participantes cadastrados (${summaryDetails}).`,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      groupsCount: officialGroups.length,
      membersSynced,
      groupStats,
      message: `${membersSynced} participantes sincronizados com sucesso dos grupos oficiais (${officialGroups.map((g) => g.canonicalName).join(', ')})!`,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar membros oficiais:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}