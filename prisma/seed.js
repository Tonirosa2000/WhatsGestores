const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Populando banco com dados de exemplo da comunidade WhatsGestores...");

  // 1. Limpar registros anteriores
  await prisma.syncLog.deleteMany({});
  await prisma.jobOpportunity.deleteMany({});
  await prisma.candidateProfile.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.whatsAppSession.deleteMany({});

  // 2. Criar Sessão do WhatsApp simulada
  await prisma.whatsAppSession.create({
    data: {
      id: "primary",
      status: "CONNECTED",
      phoneConnected: "5511998887777",
      qrCodeData: null,
      lastActiveAt: new Date()
    }
  });

  // 3. Criar Membros de Exemplo dos Grupos
  const members = [
    { phone: "5511998887777", name: "Carlos Eduardo (Admin RH)", groupName: "Gestores - Banco de Talentos - VAGAS" },
    { phone: "5511987654321", name: "Mariana Souza (Recrutadora)", groupName: "Gestores - Banco de Talentos - Currículos" },
    { phone: "5521991234567", name: "Roberto Dias (Gestor de TI)", groupName: "Gestores - Banco de Talentos - VAGAS" },
    { phone: "5531984567890", name: "Fernanda Lima (RH Tech)", groupName: "Gestores - Banco de Talentos - Currículos" },
  ];

  for (const m of members) {
    await prisma.groupMember.create({ data: m });
  }

  // 4. Criar Vagas de Emprego de Exemplo (Ativas e Inativas com expiresAt)
  const now = Date.now();
  const jobs = [
    {
      messageId: "msg_vaga_001",
      groupName: "Gestores - Banco de Talentos - VAGAS",
      title: "Gerente de Operações e Logística",
      company: "Grupo LogBrasil",
      description: "Buscamos profissional com sólida experiência em gestão de equipes operacionais, indicadores de desempenho (KPIs), roteirização e otimização de frotas. Necessário ensino superior completo e vivência no segmento de transporte.",
      modality: "Presencial",
      location: "São Paulo - SP",
      salary: 8500.00,
      salaryFormatted: "R$ 8.500,00",
      benefits: "VT + VR (R$ 45,00/dia) + Assistência Médica Bradesco + PLR",
      requirements: JSON.stringify(["Superior Completo em Logística ou Administração", "Experiência de 4+ anos em liderança", "Excel Avançado / Power BI"]),
      contactName: "Mariana - RH",
      contactPhone: "5511987654321",
      contactEmail: "vagas@logbrasil.com.br",
      originalMessage: "🔥 VAGA URGENTE: Gerente de Operações e Logística em SP!\nSalário R$ 8.500,00 + benefícios completos. Enviar CV para vagas@logbrasil.com.br ou falar no whats (11) 98765-4321.",
      publishedAt: new Date(now - 2 * 60 * 60 * 1000), // 2h atrás
      expiresAt: new Date(now + 28 * 24 * 60 * 60 * 1000), // Válida por +28 dias
      status: "ACTIVE"
    },
    {
      messageId: "msg_vaga_gov_mg",
      groupName: "Gestores - Banco de Talentos - VAGAS",
      title: "Coordenador/a da Enfermagem do Hemocentro de Belo Horizonte",
      company: "Fundação Centro de Hematologia e Hemoterapia do Estado de Minas Gerais - HEMOMINAS",
      description: "Processo seletivo para atuação como Coordenador/a da Enfermagem do Hemocentro de Belo Horizonte, setor vinculado à Gerência Técnica da HEMOMINAS, através do programa Transforma Minas. Inscrições abertas até 08/09/2026 às 11:59.",
      modality: "Presencial",
      location: "Belo Horizonte - MG",
      salary: null,
      salaryFormatted: "A combinar",
      benefits: "Benefícios estaduais conforme edital Seplag-MG",
      requirements: JSON.stringify(["Graduação em Enfermagem", "Experiência com coordenação técnica na saúde", "Registro Ativo COREN-MG"]),
      contactName: "Transforma Minas / HEMOMINAS",
      contactPhone: "5531988887777",
      contactEmail: "recrutamento@hemominas.mg.gov.br",
      applyUrl: "https://www.mg.gov.br/transforma-minas/vaga/hemominas-coordenador-da-enfermagem-do-hemocentro-de-belo-horizonte",
      originalMessage: "Oportunidade no Hemominas: https://www.mg.gov.br/transforma-minas/vaga/hemominas-coordenador-da-enfermagem-do-hemocentro-de-belo-horizonte",
      publishedAt: new Date(now - 4 * 60 * 60 * 1000),
      expiresAt: new Date(now + 4 * 24 * 60 * 60 * 1000), // 4 dias restantes
      status: "ACTIVE"
    },
    {
      messageId: "msg_vaga_002",
      groupName: "Gestores - Banco de Talentos - VAGAS",
      title: "Coordenador de Recursos Humanos (Tech Recruiter)",
      company: "Inovare Soluções Digitais",
      description: "Responsável pelo ciclo completo de atração e seleção de talentos de tecnologia, condução de entrevistas por competência, alinhamento de perfil com gestores e estratégias de retenção.",
      modality: "Híbrido",
      location: "Barueri / Alphaville - SP",
      salary: 6800.00,
      salaryFormatted: "R$ 6.800,00",
      benefits: "Cartão Caju flexível (R$ 1.200,00) + Plano de Saúde + Auxílio Home Office",
      requirements: JSON.stringify(["Experiência em recrutamento tech", "Inglês intermediário", "Conhecimento em plataformas ATS"]),
      contactName: "Roberto Gestor",
      contactPhone: "5521991234567",
      contactEmail: "rh@inovaresolucoes.com.br",
      originalMessage: "Oportunidade Híbrida em Alphaville: Coordenador de RH / Tech Recruiter. R$ 6.800 + Benefícios flexíveis. Contato com Roberto no WhatsApp (21) 99123-4567.",
      publishedAt: new Date(now - 5 * 60 * 60 * 1000),
      expiresAt: new Date(now + 15 * 24 * 60 * 60 * 1000), // Válida por +15 dias
      status: "ACTIVE"
    },
    {
      messageId: "msg_vaga_003",
      groupName: "Gestores - Banco de Talentos - VAGAS",
      title: "Analista Financeiro Pleno",
      company: "Audithax Consultoria",
      description: "Atuação com fluxo de caixa diário, contas a pagar e receber, conciliação bancária, fechamento mensal, DRE e relatórios gerenciais para diretoria.",
      modality: "Remoto",
      location: "100% Remoto (Brasil)",
      salary: 4500.00,
      salaryFormatted: "R$ 4.500,00",
      benefits: "VR (R$ 800,00) + Plano Odontológico + Gympass",
      requirements: JSON.stringify(["Graduação em Ciências Contábeis, Economia ou Administração", "Experiência com ERP TOTVS ou SAP", "Excel Avançado"]),
      contactName: "Carlos RH",
      contactPhone: "5511998887777",
      contactEmail: "talentos@audithax.com.br",
      originalMessage: "VAGA 100% HOME OFFICE: Analista Financeiro Pleno. Salário: R$ 4.500,00. Enviar CV para talentos@audithax.com.br com o assunto [FIN-PLENO].",
      publishedAt: new Date(now - 24 * 60 * 60 * 1000),
      expiresAt: new Date(now + 29 * 24 * 60 * 60 * 1000), // Válida por +29 dias
      status: "ACTIVE"
    },
    {
      messageId: "msg_vaga_004_expired",
      groupName: "Gestores - Banco de Talentos - VAGAS",
      title: "Assistente Comercial / Vendas B2B",
      company: "Prime Distribuidora",
      description: "Suporte à equipe de vendas externas, elaboração de propostas comerciais, atendimento a clientes corporativos via telefone e WhatsApp, emissão de pedidos no sistema.",
      modality: "Presencial",
      location: "Campinas - SP",
      salary: 2600.00,
      salaryFormatted: "R$ 2.600,00",
      benefits: "Comissões sobre metas + VT + VR no local",
      requirements: JSON.stringify(["Ensino Médio Completo ou Cursando Superior", "Boa comunicação verbal e escrita", "Vivência em televendas ou comercial"]),
      contactName: "Fernanda Lima",
      contactPhone: "5531984567890",
      contactEmail: "comercial@primedistribuidora.com.br",
      originalMessage: "Contratando Assistente Comercial em Campinas/SP. R$ 2.600 fixo + comissão. Falar direto com Fernanda no whats (31) 98456-7890.",
      publishedAt: new Date(now - 35 * 24 * 60 * 60 * 1000), // Publicada há 35 dias
      expiresAt: new Date(now - 5 * 24 * 60 * 60 * 1000), // Expirada há 5 dias
      status: "EXPIRED"
    }
  ];

  for (const j of jobs) {
    await prisma.jobOpportunity.create({ data: j });
  }

  // 5. Criar Candidatos / Currículos de Exemplo
  const candidates = [
    {
      messageId: "msg_cand_001",
      groupName: "Gestores - Banco de Talentos - Currículos",
      fullName: "Juliana Mendes da Silva",
      targetRole: "Supervisora Administrativa / Financeira",
      experienceSummary: "10 anos de experiência na área administrativa e financeira, com liderança de equipe, rotinas de contas a pagar/receber, faturamento, auditoria de processos e relacionamento com fornecedores e bancos.",
      skills: JSON.stringify(["Liderança de Equipes", "Fluxo de Caixa", "ERP Protheus", "Negociação", "Excel Avançado"]),
      location: "São Paulo - SP (Zona Sul)",
      contactPhone: "5511977771111",
      contactEmail: "juliana.mendes.adm@email.com",
      originalMessage: "Olá gestores! Sou a Juliana Mendes, pós-graduada em Controladoria com 10 anos liderando equipes administrativas e financeiras em SP. Disponível para novos desafios!",
      publishedAt: new Date(now - 4 * 60 * 60 * 1000),
      status: "ACTIVE"
    },
    {
      messageId: "msg_cand_002",
      groupName: "Gestores - Banco de Talentos - Currículos",
      fullName: "Lucas Ferraz Albuquerque",
      targetRole: "Product Owner / Gestor de Produtos Digitais",
      experienceSummary: "Especialista em metodologia ágil, gestão de backlog, discovery, métricas de produto (CAC, LTV, Churn) e liderança de squads multidisciplinares no segmento financeiro e de e-commerce.",
      skills: JSON.stringify(["Product Discovery", "Scrum / Kanban", "Métricas de Produto", "Jira", "UX/UI Básico"]),
      location: "Remoto / Curitiba - PR",
      contactPhone: "5541988882222",
      contactEmail: "lucas.ferraz.po@email.com",
      originalMessage: "Boa tarde comunidade! Lucas Ferraz aqui, PO / Product Manager com 6 anos de experiência em fintechs. Atualmente disponível para posições 100% remotas ou em Curitiba.",
      publishedAt: new Date(now - 12 * 60 * 60 * 1000),
      status: "ACTIVE"
    },
    {
      messageId: "msg_cand_003",
      groupName: "Gestores - Banco de Talentos - Currículos",
      fullName: "Camila Rodrigues Viana",
      targetRole: "Gerente de Recursos Humanos (BP / Generalista)",
      experienceSummary: "Mais de 12 anos em gestão estratégica de pessoas, subsistemas de R&S, T&D, clima organizacional, departamento pessoal e estruturação de cultura em empresas de médio e grande porte.",
      skills: JSON.stringify(["Planejamento Estratégico de RH", "Business Partner", "Cultura Organizacional", "Legislação Trabalhista", "People Analytics"]),
      location: "Belo Horizonte - MG",
      contactPhone: "5531999993333",
      contactEmail: "camila.viana.rh@email.com",
      originalMessage: "Olá colegas! Sou Camila Viana, Gerente de RH com foco em Business Partner e transformação cultural. Aberta a conexões e oportunidades em BH ou modelo híbrido.",
      publishedAt: new Date(now - 28 * 60 * 60 * 1000),
      status: "ACTIVE"
    }
  ];

  for (const c of candidates) {
    await prisma.candidateProfile.create({ data: c });
  }

  // 6. Criar Logs Iniciais
  await prisma.syncLog.create({
    data: {
      groupName: "Gestores - Banco de Talentos - VAGAS",
      messageType: "JOB",
      summary: "5 vagas iniciais catalogadas com período de validade configurado.",
      success: true,
    }
  });

  await prisma.syncLog.create({
    data: {
      groupName: "Gestores - Banco de Talentos - Currículos",
      messageType: "CANDIDATE",
      summary: "3 perfis de gestores e especialistas disponíveis no banco de talentos.",
      success: true,
    }
  });

  console.log("✅ Banco populado com sucesso com Vagas Ativas e Inativas!");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao popular banco:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
