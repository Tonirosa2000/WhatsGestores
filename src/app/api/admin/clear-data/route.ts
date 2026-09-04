import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    await prisma.jobOpportunity.deleteMany({});
    await prisma.candidateProfile.deleteMany({});
    await prisma.groupMember.deleteMany({});
    await prisma.syncLog.deleteMany({});
    await prisma.authOtp.deleteMany({});

    return NextResponse.json({
      success: true,
      message: 'Todos os dados de vagas, currículos e logs foram limpos com sucesso!',
    });
  } catch (error: any) {
    console.error('Erro ao limpar dados:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}