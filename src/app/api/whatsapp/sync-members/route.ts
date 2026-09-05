import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseTables } from '@/lib/prisma';
import {
  getOfficialGroupsFromEvolution,
  fetchGroupParticipantsFromEvolution,
  extractParticipantData,
  invalidateOfficialGroupsCache,
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';
import { formatNumber, normalizeToCanonicalPhone } from '@/lib/formatters';

export async function POST() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    await ensureDatabaseTables();

    // 1. Busca os grupos oficiais confirmados (usando cache / grupos conhecidos para resposta instantânea)
    const officialGroups = await getOfficialGroupsFromEvolution(evolutionUrl, evolutionKey, false);

    if (!officialGroups || officialGroups.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Nenhum dos grupos oficiais foi localizado na conta do WhatsApp conectada. Certifique-se de que o robô participa de "${OFFICIAL_GROUP_VAGAS_DEFAULT}" e/ou "${OFFICIAL_GROUP_CURRICULOS_DEFAULT}".`,
      }, { status: 404 });
    }

    // Limpa a base de membros anterior para remover variações duplicadas e garantir contagem exata
    await prisma.groupMember.deleteMany({});

    // 2. Busca participantes dos grupos oficiais e consolida em um mapa único pelo telefone canônico
    const groupStats: Record<string, number> = {};
    const memberMap = new Map<string, {
      phone: string;
      name: string | null;
      groups: Set<string>;
      isAdmin: boolean;
    }>();

    for (const group of officialGroups) {
      const participants = await fetchGroupParticipantsFromEvolution(group.id, evolutionUrl, evolutionKey);
      let countForThisGroup = 0;

      for (const p of participants) {
        const parsed = extractParticipantData(p);
        if (!parsed) continue;

        const canonical = normalizeToCanonicalPhone(parsed.phone);
        if (!canonical || canonical.length < 10) continue;

        const existing = memberMap.get(canonical);
        if (existing) {
          existing.groups.add(group.canonicalName);
          if (parsed.name && !existing.name) existing.name = parsed.name;
          if (parsed.isAdmin) existing.isAdmin = true;
        } else {
          memberMap.set(canonical, {
            phone: canonical,
            name: parsed.name,
            groups: new Set([group.canonicalName]),
            isAdmin: parsed.isAdmin,
          });
        }

        countForThisGroup++;
      }

      groupStats[group.canonicalName] = countForThisGroup;
    }

    // 3. Garante que os telefones de administradores estejam cadastrados
    const adminPhonesEnv = process.env.ADMIN_PHONES || '';
    const defaultAdminPhones = ['5531984137481'];
    const allAdminPhones = [
      ...defaultAdminPhones,
      ...adminPhonesEnv.split(',').map((p) => normalizeToCanonicalPhone(p.trim())).filter(Boolean),
    ];

    for (const adminPhone of allAdminPhones) {
      const existing = memberMap.get(adminPhone);
      if (existing) {
        existing.isAdmin = true;
        if (!existing.name) existing.name = 'Toni Rosa (Administrador)';
      } else {
        memberMap.set(adminPhone, {
          phone: adminPhone,
          name: 'Toni Rosa (Administrador)',
          groups: new Set([OFFICIAL_GROUP_VAGAS_DEFAULT]),
          isAdmin: true,
        });
      }
    }

    // 4. Grava exatamente 1 registro por participante no banco de dados SQLite
    const dbOperations = Array.from(memberMap.values()).map((m) => {
      const groupLabel = m.groups.size > 1
        ? 'Gestores (Vagas e Currículos)'
        : Array.from(m.groups)[0];

      return prisma.groupMember.create({
        data: {
          phone: m.phone,
          name: m.name,
          groupName: groupLabel,
          isAuthorized: true,
          lastSeenAt: new Date(),
        },
      });
    });

    const CHUNK_SIZE = 100;
    for (let i = 0; i < dbOperations.length; i += CHUNK_SIZE) {
      const chunk = dbOperations.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(chunk);
    }

    const membersSynced = memberMap.size;

    // Invalida cache de grupos
    invalidateOfficialGroupsCache();

    // 5. Registra log de auditoria detalhado
    const summaryDetails = Object.entries(groupStats)
      .map(([name, count]) => `${name}: ${formatNumber(count as number)} participantes`)
      .join(' | ');

    await prisma.syncLog.create({
      data: {
        groupName: 'Sincronização de Membros Oficiais',
        messageType: 'MEMBER_SYNC',
        summary: `Sincronização concluída com sucesso: ${formatNumber(membersSynced)} participantes únicos cadastrados (${summaryDetails}).`,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      groupsCount: officialGroups.length,
      membersSynced,
      groupStats,
      message: `${formatNumber(membersSynced)} participantes sincronizados com sucesso dos grupos oficiais (${officialGroups.map((g) => g.canonicalName).join(', ')})!`,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar membros oficiais:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}