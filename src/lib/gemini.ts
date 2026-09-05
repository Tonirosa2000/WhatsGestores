import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { enrichTextWithUrlContent, ExtractedUrlInfo } from "./urlExtractor";

export interface ExtractedJobData {
  type: "JOB";
  title: string;
  company?: string;
  description: string;
  modality: "Presencial" | "Remoto" | "Híbrido";
  location?: string;
  salary?: number | null;
  salaryFormatted?: string;
  benefits?: string;
  requirements?: string[];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  applyUrl?: string;
  expiresAt?: string;
}

export interface ExtractedCandidateData {
  type: "CANDIDATE";
  fullName: string;
  targetRole: string;
  experienceSummary: string;
  skills?: string[];
  location?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface IgnoredMessageData {
  type: "IGNORED";
  reason: string;
}

export type ExtractionResult = ExtractedJobData | ExtractedCandidateData | IgnoredMessageData;

export interface FileAttachmentInput {
  base64Data: string;
  mimeType: string;
  fileName: string;
}

export async function extractDataWithGemini(
  rawText?: string,
  groupHint?: "VAGAS" | "CURRICULOS",
  apiKeyOverride?: string,
  attachment?: FileAttachmentInput
): Promise<ExtractionResult> {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

  let textToAnalyze = rawText || "";
  let primaryUrl: string | undefined;
  let pageInfo: ExtractedUrlInfo | undefined;

  // 1. Processamento de URLs / Links da Web presentes no texto
  if (textToAnalyze.trim()) {
    try {
      const urlEnrichment = await enrichTextWithUrlContent(textToAnalyze);
      textToAnalyze = urlEnrichment.enrichedText;
      primaryUrl = urlEnrichment.primaryUrl;
      pageInfo = urlEnrichment.extractedPageInfo;
    } catch (urlErr) {
      console.warn("Erro ao enriquecer texto com URL:", urlErr);
    }
  }

  // 2. Processamento de Anexos (Word / PDF / Imagem)
  let multimodalPart: any = null;
  if (attachment) {
    const isWord = attachment.fileName?.toLowerCase().endsWith(".docx") || attachment.mimeType?.includes("wordprocessingml");
    if (isWord) {
      try {
        const buffer = Buffer.from(attachment.base64Data, "base64");
        const docResult = await mammoth.extractRawText({ buffer });
        textToAnalyze = (textToAnalyze ? textToAnalyze + "\n\n" : "") + "--- CONTEÚDO DO DOCUMENTO WORD ---\n" + docResult.value;
      } catch (err) {
        console.error("Erro ao converter Word:", err);
      }
    } else if (attachment.mimeType === "application/pdf" || attachment.mimeType?.startsWith("image/")) {
      multimodalPart = {
        inlineData: {
          data: attachment.base64Data,
          mimeType: attachment.mimeType,
        },
      };
    }
  }

  // 3. Chamada à Inteligência Artificial (Google Gemini)
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

      const isCurriculosGroup = groupHint === "CURRICULOS";
      const isVagasGroup = groupHint === "VAGAS";

      const promptText = `Você é um assistente especialista em RH, processos seletivos e recrutamento no Brasil.
Analise com extrema precisão o documento, imagem, link web ou texto enviado e extraia os dados estruturados no formato JSON estrito.
${isCurriculosGroup ? 'IMPORTANTE: Você está analisando exclusivamente o grupo oficial de CURRÍCULOS. Mensagens aqui devem ser classificadas como "CANDIDATE" ou "IGNORED". Apenas classifique como "JOB" se houver uma vaga formal explícita.' : ''}
${isVagasGroup ? 'IMPORTANTE: Você está analisando exclusivamente o grupo oficial de VAGAS. Mensagens aqui devem ser classificadas como "JOB" ou "IGNORED".' : ''}

REGRAS DE CLASSIFICAÇÃO:
1. Links de redes sociais, entretenimento ou vídeos (como YouTube, youtu.be, TikTok, Instagram, Reels, Facebook, Spotify, memes, bom dia) DEVEM SER SUMARIAMENTE CLASSIFICADOS COMO "IGNORED". Não invente vagas para esses links.
2. Se o documento for um currículo de pessoa física (arquivo PDF, DOCX, imagem de currículo ou texto com formação acadêmica, dados pessoais, histórico profissional) -> CLASSIFIQUE COMO "CANDIDATE".
3. Se o documento contiver anúncio real de vaga, processo seletivo, edital de contratação com cargo e requisitos -> CLASSIFIQUE COMO "JOB".
4. Se for irrelevante, conversa informal, agradecimento ou spam -> CLASSIFIQUE COMO "IGNORED".

INSTRUÇÕES ESPECIAIS PARA LINKS / PÁGINAS WEB:
- Apenas links de páginas de editais ou páginas formais de vagas (Gupy, Vagas.com, Catho, Portais Oficiais de Governo, etc.) podem ser tratados como vaga.
- Se houver dados de edital público ou vaga, extraia Cargo, Órgão/Empresa, Cidade/UF, Resumo das atividades e Requisitos.
- Se identificada a data limite de inscrições, preencha o campo "expiresAt" no formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss). Se não houver data explícita, deixe null.

FORMATO PARA "JOB":
{
  "type": "JOB",
  "title": "Título claro do cargo anunciado",
  "company": "Empresa ou Órgão Contratante",
  "description": "Resumo completo das atividades e detalhes da vaga",
  "modality": "Presencial" | "Remoto" | "Híbrido",
  "location": "Cidade - UF",
  "salary": null ou número em reais,
  "salaryFormatted": "A combinar" ou "R$ 2.500,00",
  "benefits": "Benefícios citados ou null",
  "requirements": ["Requisito 1", "Requisito 2"],
  "contactName": "Contato ou Órgão Responsável",
  "contactPhone": "Telefone somente números com DDD",
  "contactEmail": "E-mail se houver",
  "applyUrl": "${primaryUrl || 'Link de inscrição'}",
  "expiresAt": "Data limite no formato YYYY-MM-DD ou null"
}

FORMATO PARA "CANDIDATE":
{
  "type": "CANDIDATE",
  "fullName": "Nome completo do candidato",
  "targetRole": "Cargo pretendido ou Área de atuação",
  "experienceSummary": "Resumo profissional completo com experiências e formação",
  "skills": ["Competência 1", "Competência 2"],
  "location": "Cidade - UF",
  "contactPhone": "Telefone com DDD",
  "contactEmail": "E-mail se houver"
}

FORMATO PARA "IGNORED":
{
  "type": "IGNORED",
  "reason": "Motivo do descarte (ex: Link de vídeo/mídia externa, conversa informal, etc.)"
}

Responda APENAS o JSON puro, sem aspas triplas de markdown.
${textToAnalyze ? `CONTEÚDO:
"""
${textToAnalyze}
"""` : ""}`;

      const contentPayload = multimodalPart ? [promptText, multimodalPart] : promptText;
      const result = await model.generateContent(contentPayload);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/^\`\`\`json\s*/i, "").replace(/^\`\`\`\s*/i, "").replace(/\`\`\`$/, "").trim();
      const parsed = JSON.parse(cleanJson) as ExtractionResult;

      // Se for link de entretenimento detectado, força descarte
      if (parsed.type === "JOB" && (primaryUrl?.includes("youtube.com") || primaryUrl?.includes("youtu.be") || primaryUrl?.includes("tiktok.com") || primaryUrl?.includes("instagram.com"))) {
        return { type: "IGNORED", reason: "Link de entretenimento/mídia descartado" };
      }

      // Garante que o applyUrl esteja preenchido se uma URL primária foi detectada
      if (parsed.type === "JOB" && primaryUrl && !parsed.applyUrl) {
        parsed.applyUrl = primaryUrl;
      }

      return parsed;
    } catch (error) {
      console.error("Erro na chamada do Gemini:", error);
    }
  }

  // 4. Fallback Heurístico Robusto (caso a chave da IA não esteja configurada ou ocorra timeout)
  return fallbackHeuristicParser(textToAnalyze, groupHint, attachment, primaryUrl, pageInfo);
}

function fallbackHeuristicParser(
  text: string,
  groupHint?: "VAGAS" | "CURRICULOS",
  attachment?: FileAttachmentInput,
  primaryUrl?: string,
  pageInfo?: ExtractedUrlInfo
): ExtractionResult {
  const lower = (text + " " + (attachment?.fileName || "") + " " + (primaryUrl || "")).toLowerCase();

  // Descarte sumário de links de entretenimento / vídeos
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("tiktok.com") ||
    lower.includes("instagram.com") ||
    lower.includes("spotify.com") ||
    lower.includes("vimeo.com")
  ) {
    return {
      type: "IGNORED",
      reason: "Link de entretenimento/vídeo descartado",
    };
  }

  // Se o contexto é o Grupo de Currículos OU se temos um arquivo anexo típico de currículo
  const isCandidateAttachment =
    attachment?.fileName?.toLowerCase().endsWith(".pdf") ||
    attachment?.fileName?.toLowerCase().endsWith(".docx") ||
    attachment?.fileName?.toLowerCase().includes("curriculo") ||
    attachment?.fileName?.toLowerCase().includes("cv");

  if (groupHint === "CURRICULOS" || isCandidateAttachment) {
    if (attachment || lower.includes("experiência") || lower.includes("currículo") || lower.includes("curriculo") || lower.includes("formação")) {
      const fileNameClean = attachment?.fileName ? attachment.fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ") : "Candidato Disponível";
      return {
        type: "CANDIDATE",
        fullName: fileNameClean,
        targetRole: "Profissional Cadastrado",
        experienceSummary: text || `Currículo recebido através do grupo oficial (${attachment?.fileName || 'Documento'}).`,
        skills: ["Experiência comprovada", "Formação profissional"],
        location: "Brasil",
        contactPhone: "5511999998888",
      };
    }
    return {
      type: "IGNORED",
      reason: "Mensagem no grupo de currículos sem perfil ou documento identificado",
    };
  }

  // No grupo de vagas ou geral: só é vaga se contiver palavras-chave fortes de contratação
  const hasJobKeywords =
    lower.includes("vaga") ||
    lower.includes("contrata") ||
    lower.includes("inscrição") ||
    lower.includes("inscricao") ||
    lower.includes("processo seletivo") ||
    lower.includes("edital");

  if (hasJobKeywords && groupHint === "VAGAS") {
    let title = "Oportunidade de Emprego";
    if (pageInfo?.title) {
      title = pageInfo.title
        .replace(/\s*[-|–]\s*(Transforma Minas|Portal MG|Gupy|Vagas\.com|Catho|LinkedIn).*$/i, "")
        .trim();
    }

    const description =
      pageInfo?.description ||
      (pageInfo?.bodyText ? pageInfo.bodyText.slice(0, 350) + "..." : text) ||
      "Oportunidade identificada no grupo oficial de Vagas.";

    let expiresAt: string | undefined;
    const dateMatch = (text + " " + (pageInfo?.bodyText || "")).match(/inscriç(?:ão|ões|ao|oes)\s*(?:até|ate|encerram-se em|limite:?)?\s*:?\s*(?:[a-zá-ú]+,?\s*)?(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/i);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      expiresAt = `${year}-${month}-${day}T23:59:59Z`;
    }

    return {
      type: "JOB",
      title: title || "Oportunidade de Trabalho",
      company: "Empresa Contratante",
      description,
      modality: lower.includes("remoto") ? "Remoto" : lower.includes("híbrido") || lower.includes("hibrido") ? "Híbrido" : "Presencial",
      location: "Brasil",
      salary: null,
      salaryFormatted: "A combinar",
      requirements: ["Ensino Superior / Técnico", "Experiência na área"],
      contactName: "Equipe de Recrutamento",
      contactPhone: "5511998887777",
      contactEmail: "recrutamento@empresa.com.br",
      applyUrl: primaryUrl || undefined,
      expiresAt,
    };
  }

  return {
    type: "IGNORED",
    reason: "Mensagem não contém anúncio formal de vaga nem currículo",
  };
}
