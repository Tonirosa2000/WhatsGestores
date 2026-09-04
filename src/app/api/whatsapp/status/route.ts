import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let session = await prisma.whatsAppSession.findUnique({
      where: { id: 'primary' }
    });

    if (!session) {
      session = await prisma.whatsAppSession.create({
        data: {
          id: 'primary',
          status: 'CONNECTED',
          phoneConnected: '5511998887777',
          lastActiveAt: new Date()
        }
      });
    }

    const totalJobs = await prisma.jobOpportunity.count();
    const totalCandidates = await prisma.candidateProfile.count();
    const totalMembers = await prisma.groupMember.count();

    const groupVagas = process.env.WHATSAPP_GROUP_VAGAS || 'Gestores - Banco de Talentos - VAGAS';
    const groupCurriculos = process.env.WHATSAPP_GROUP_CURRICULOS || 'Gestores - Banco de Talentos - Currículos';

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
