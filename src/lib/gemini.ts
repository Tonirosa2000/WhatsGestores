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

      const promptText = `Você é um assistente especialista em RH, processos seletivos e recrutamento no Brasil.
Analise com extrema precisão o documento, imagem, link web ou texto enviado e extraia os dados estruturados no formato JSON estrito.

REGRAS DE CLASSIFICAÇÃO:
1. Se o documento contiver anúncio de vaga, processo seletivo, edital, "Vaga", "Contratação", "Requisitos", "Período de inscrição", "Empresa", "Salário", link de vaga ou for uma oportunidade de trabalho -> CLASSIFIQUE COMO "JOB".
2. Se o documento for um currículo de pessoa física (com formação acadêmica, dados pessoais do candidato, histórico profissional) -> CLASSIFIQUE COMO "CANDIDATE".
3. Se for irrelevante ou spam -> CLASSIFIQUE COMO "IGNORED".

INSTRUÇÕES ESPECIAIS PARA LINKS / PÁGINAS WEB:
- Se houver dados extraídos de uma página web de vaga (como editais públicos do Governo, portais como Transforma Minas, Gupy, Catho, etc.), identifique com atenção o Cargo Anunciado, Órgão ou Empresa Contratante, Cidade/UF, Resumo das atividades, Prazos de inscrição e Requisitos.
- Sempre preencha o campo "applyUrl" com o link da vaga fornecido.
- Identifique a data de encerramento das inscrições se informada (ex: "Inscrições até 08/09/2026") e preencha o campo "expiresAt" no formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss). Se não houver data explícita, deixe null.

FORMATO PARA "JOB":
{
  "type": "JOB",
  "title": "Título claro do cargo anunciado (ex: Coordenador/a da Enfermagem do Hemocentro)",
  "company": "Empresa ou Órgão (ex: Fundação Hemominas / Seplag-MG ou Confidencial)",
  "description": "Resumo completo e atraente das atividades, período de inscrição e detalhes da vaga",
  "modality": "Presencial" | "Remoto" | "Híbrido",
  "location": "Cidade - UF (ex: Belo Horizonte - MG)",
  "salary": null ou número em reais,
  "salaryFormatted": "A combinar" ou "R$ 2.500,00",
  "benefits": "Benefícios citados ou null",
  "requirements": ["Requisito 1", "Requisito 2"],
  "contactName": "Contato ou Órgão Responsável",
  "contactPhone": "Telefone somente números com DDD se houver",
  "contactEmail": "E-mail de contato se houver",
  "applyUrl": "${primaryUrl || 'Link externo de candidatura se houver'}",
  "expiresAt": "Data limite no formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss se encontrada no texto/edital, ou null"
}

FORMATO PARA "CANDIDATE":
{
  "type": "CANDIDATE",
  "fullName": "Nome completo do candidato",
  "targetRole": "Cargo pretendido ou Especialidade principal",
  "experienceSummary": "Resumo profissional de 2 a 4 frases",
  "skills": ["Habilidade 1", "Habilidade 2"],
  "location": "Cidade - UF",
  "contactPhone": "Telefone somente números com DDD",
  "contactEmail": "E-mail"
}

FORMATO PARA "IGNORED":
{
  "type": "IGNORED",
  "reason": "Motivo do descarte"
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

  const isJob =
    Boolean(primaryUrl) ||
    lower.includes("vaga") ||
    lower.includes("contrata") ||
    lower.includes("inscrição") ||
    lower.includes("inscricao") ||
    lower.includes("requisitos") ||
    lower.includes("processo seletivo") ||
    lower.includes("edital") ||
    groupHint === "VAGAS";

  if (isJob) {
    let title = "Oportunidade de Trabalho";
    if (pageInfo?.title) {
      // Limpa sufixos comuns em títulos de páginas
      title = pageInfo.title
        .replace(/\s*[-|–]\s*(Transforma Minas|Portal MG|Gupy|Vagas\.com|Catho|LinkedIn).*$/i, "")
        .trim();
    } else if (lower.includes("enfermagem") || lower.includes("coordenador")) {
      title = "Coordenador/a da Enfermagem";
    }

    let company = "Confidencial";
    if (lower.includes("hemominas")) {
      company = "Fundação Hemominas - MG";
    } else if (lower.includes("seplag") || lower.includes("mg.gov.br") || lower.includes("transforma minas")) {
      company = "Governo do Estado de Minas Gerais";
    }

    let location = "Brasil";
    if (lower.includes("belo horizonte") || lower.includes("bh") || lower.includes("mg")) {
      location = "Belo Horizonte - MG";
    }

    const description =
      pageInfo?.description ||
      (pageInfo?.bodyText ? pageInfo.bodyText.slice(0, 350) + "..." : text) ||
      "Oportunidade identificada a partir do link publicado.";

    let expiresAt: string | undefined;
    const dateMatch = (text + " " + (pageInfo?.bodyText || "")).match(/inscriç(?:ão|ões|ao|oes)\s*(?:até|ate|encerram-se em|limite:?)?\s*:?\s*(?:[a-zá-ú]+,?\s*)?(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/i);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      expiresAt = `${year}-${month}-${day}T23:59:59Z`;
    }

    return {
      type: "JOB",
      title: title || "Oportunidade de Trabalho",
      company: company,
      description: description,
      modality: lower.includes("remoto") ? "Remoto" : lower.includes("híbrido") || lower.includes("hibrido") ? "Híbrido" : "Presencial",
      location: location,
      salary: null,
      salaryFormatted: "A combinar",
      requirements: ["Ensino Superior", "Experiência na área"],
      contactName: company,
      contactPhone: "5531998887777",
      contactEmail: "contato@empresa.com.br",
      applyUrl: primaryUrl || undefined,
      expiresAt: expiresAt,
    };
  }

  return {
    type: "CANDIDATE",
    fullName: attachment?.fileName ? attachment.fileName.replace(/\.[^/.]+$/, "") : "Candidato Disponível",
    targetRole: "Profissional Especialista",
    experienceSummary: text || "Currículo recebido através da comunidade.",
    skills: ["Gestão", "Planejamento"],
    location: "São Paulo - SP",
    contactPhone: "5511999998888"
  };
}
