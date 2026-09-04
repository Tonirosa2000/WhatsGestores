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

    return NextResponse.json({
      success: true,
      session,
      groups: [
        { name: groupVagas, type: 'Vagas', status: 'Ativo' },
        { name: groupCurriculos, type: 'Currículos', status: 'Ativo' },
      ],
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