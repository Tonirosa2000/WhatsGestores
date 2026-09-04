import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const deleted = await prisma.groupMember.deleteMany({});

    await prisma.syncLog.create({
      data: {
        groupName: 'Administração',
        messageType: 'MEMBER_SYNC',
        summary: `Limpeza de membros executada: ${deleted.count} membros removidos para nova sincronização estrita.`,
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      message: `${deleted.count} membros removidos com sucesso. A base de membros está zerada.`,
    });
  } catch (error: any) {
    console.error('Erro ao limpar membros:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
