import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseTables } from '@/lib/prisma';
import { maskPhone } from '@/lib/formatters';

export async function GET(request: Request) {
  try {
    await ensureDatabaseTables();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const isMember = searchParams.get('isMember') === 'true';

    const where: any = { status: 'ACTIVE' };

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { targetRole: { contains: search } },
        { education: { contains: search } },
        { experienceSummary: { contains: search } },
        { location: { contains: search } },
        { skills: { contains: search } },
      ];
    }

    const candidatesRaw = await prisma.candidateProfile.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
    });

    // Se NÃO for membro verificado, protege os dados de contato e arquivo original (LGPD)
    const candidates = candidatesRaw.map(c => {
      if (!isMember) {
        return {
          ...c,
          contactPhone: maskPhone(c.contactPhone),
          contactEmail: c.contactEmail ? '•••••@••••.com' : null,
          hasAttachment: !!c.attachmentUrl,
          attachmentUrl: null, // Bloqueado para não membros
          isLocked: true,
        };
      }
      return {
        ...c,
        hasAttachment: !!c.attachmentUrl,
        isLocked: false,
      };
    });

    return NextResponse.json({ success: true, candidates, isMemberAuthenticated: isMember });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
