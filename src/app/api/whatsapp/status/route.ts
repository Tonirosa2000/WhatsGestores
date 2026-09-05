import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  OFFICIAL_GROUP_VAGAS_DEFAULT,
  OFFICIAL_GROUP_CURRICULOS_DEFAULT,
} from '@/lib/whatsappGroups';

export async function GET() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    let session = await prisma.whatsAppSession.findUnique({
      where: { id: 'primary' }
    });

    // Consulta status real na Evolution API
    try {
      const evoRes = await fetch(`${evolutionUrl}/instance/connectionState/whatsgestores`, {
        headers: { 'apikey': evolutionKey }
      });
      if (evoRes.ok) {
        const evoData = await evoRes.json();
        const isConnected = evoData?.instance?.state === 'open';
        
        session = await prisma.whatsAppSession.upsert({
          where: { id: 'primary' },
          create: {
            id: 'primary',
            status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
            lastActiveAt: new Date()
          },
          update: {
            status: isConnected ? 'CONNECTED' : session?.status || 'DISCONNECTED',
            lastActiveAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    } catch (evoErr) {
      console.warn('Evolution API ainda inicializando ou offline:', evoErr);
    }

    if (!session) {
      session = await prisma.whatsAppSession.create({
        data: {
          id: 'primary',
          status: 'DISCONNECTED',
          lastActiveAt: new Date()
        }
      });
    }

    const totalJobs = await prisma.jobOpportunity.count();
    const totalCandidates = await prisma.candidateProfile.count();
    const totalMembers = await prisma.groupMember.count();

    const groupVagas = process.env.WHATSAPP_GROUP_VAGAS || OFFICIAL_GROUP_VAGAS_DEFAULT;
    const groupCurriculos = process.env.WHATSAPP_GROUP_CURRICULOS || OFFICIAL_GROUP_CURRICULOS_DEFAULT;

    // Consulta grupos oficiais reais na Evolution API
    let officialGroups: any[] = [];
    let allAvailableGroups: Array<{ id: string; subject: string }> = [];

    try {
      const evoGroupsRes = await fetch(`${evolutionUrl}/group/fetchAllGroups/whatsgestores?getParticipants=false`, {
        headers: { 'apikey': evolutionKey },
        signal: AbortSignal.timeout(15000),
      });
      if (evoGroupsRes.ok) {
        const groupsJson = await evoGroupsRes.json();
        if (Array.isArray(groupsJson)) {
          allAvailableGroups = groupsJson.map((g: any) => ({
            id: g?.id || g?.jid || '',
            subject: g?.subject || g?.name || 'Sem nome',
          }));
        }
      }
    } catch (e) {
      console.warn('Não foi possível listar todos os grupos para status:', e);
    }

    const { getOfficialGroupsFromEvolution } = await import('@/lib/whatsappGroups');
    try {
      officialGroups = await getOfficialGroupsFromEvolution(evolutionUrl, evolutionKey);
    } catch {}

    const vagasFound = officialGroups.find(g => g.type === 'VAGAS');
    const curriculosFound = officialGroups.find(g => g.type === 'CURRICULOS');

    return NextResponse.json({
      success: true,
      session,
      groups: [
        {
          name: groupVagas,
          type: 'Vagas',
          status: vagasFound ? 'Ativo' : 'Não Ingressado / Pendente',
          isJoined: !!vagasFound,
          jid: vagasFound?.id || null,
          participantsCount: vagasFound?.participantsCount,
          warning: vagasFound ? undefined : 'O robô não está no grupo ou aguarda aprovação de entrada do administrador.',
        },
        {
          name: groupCurriculos,
          type: 'Currículos',
          status: curriculosFound ? 'Ativo' : 'Não Ingressado / Pendente',
          isJoined: !!curriculosFound,
          jid: curriculosFound?.id || null,
          participantsCount: curriculosFound?.participantsCount,
          warning: curriculosFound ? undefined : 'O robô não está no grupo ou aguarda aprovação de entrada do administrador.',
        },
      ],
      debug: {
        totalGroupsOnWhatsApp: allAvailableGroups.length,
        groupsList: allAvailableGroups,
      },
      stats: {
        totalJobs,
        totalCandidates,
        totalMembers,
        hasGeminiKey: !!process.env.GEMINI_API_KEY
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}