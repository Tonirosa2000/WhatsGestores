import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseTables } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    await ensureDatabaseTables();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const modality = searchParams.get('modality');
    const statusParam = searchParams.get('status'); // pode ser 'ACTIVE', 'EXPIRED', ou 'ALL' (default)

    const where: any = {};

    if (statusParam && statusParam !== 'ALL') {
      where.status = statusParam;
    }

    if (modality && modality !== 'ALL') {
      where.modality = modality;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { company: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const jobs = await prisma.jobOpportunity.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
    });

    const now = new Date();
    const processedJobs = jobs.map(job => {
      // Se não houver expiresAt gravado, calcula data de publicação + 30 dias
      const expDate = job.expiresAt
        ? new Date(job.expiresAt)
        : new Date(new Date(job.publishedAt).getTime() + 30 * 24 * 60 * 60 * 1000);

      const isExpired = expDate.getTime() < now.getTime();

      return {
        ...job,
        expiresAt: expDate.toISOString(),
        status: isExpired ? 'EXPIRED' : job.status,
      };
    });

    return NextResponse.json({ success: true, jobs: processedJobs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, title, company, description, modality, location, salary, benefits, requirements, contactName, contactPhone, contactEmail, status } = body;

    let salaryFormatted = 'A combinar';
    if (salary && !isNaN(Number(salary))) {
      salaryFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(salary));
    }

    if (id) {
      const updated = await prisma.jobOpportunity.update({
        where: { id },
        data: {
          title,
          company,
          description,
          modality,
          location,
          salary: salary ? Number(salary) : null,
          salaryFormatted,
          benefits,
          requirements: typeof requirements === 'object' ? JSON.stringify(requirements) : requirements,
          contactName,
          contactPhone,
          contactEmail,
          status: status || 'ACTIVE',
        }
      });
      return NextResponse.json({ success: true, job: updated });
    }

    const created = await prisma.jobOpportunity.create({
      data: {
        messageId: 'manual_' + Date.now(),
        groupName: 'Gestores - Banco de Talentos - VAGAS',
        title,
        company: company || 'Confidencial',
        description,
        modality: modality || 'Presencial',
        location: location || 'São Paulo - SP',
        salary: salary ? Number(salary) : null,
        salaryFormatted,
        benefits,
        requirements: typeof requirements === 'object' ? JSON.stringify(requirements) : requirements,
        contactName,
        contactPhone,
        contactEmail,
        originalMessage: description,
        publishedAt: new Date(),
        status: status || 'ACTIVE',
      }
    });

    return NextResponse.json({ success: true, job: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
