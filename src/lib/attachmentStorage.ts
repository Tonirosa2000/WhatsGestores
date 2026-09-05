import fs from 'fs';
import path from 'path';

/**
 * Utilitário para salvar anexos de currículos (PDF, DOCX, Imagens) decodificando o base64
 * e gravando no diretório público 'public/uploads/resumes'.
 * Retorna a URL pública (ex: /uploads/resumes/cv_17199999_xyz.pdf) para acesso pelo frontend.
 */
export async function saveResumeAttachment(
  base64Data: string,
  originalFileName?: string,
  mimeType?: string,
  prefix: string = 'cv'
): Promise<string | null> {
  if (!base64Data) return null;

  try {
    // Diretório de uploads públicos de currículos
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'resumes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Identifica extensão segura do arquivo
    let ext = '.pdf';
    if (originalFileName && originalFileName.includes('.')) {
      ext = path.extname(originalFileName).toLowerCase();
    } else if (mimeType) {
      if (mimeType.includes('pdf')) ext = '.pdf';
      else if (mimeType.includes('wordprocessingml') || mimeType.includes('docx')) ext = '.docx';
      else if (mimeType.includes('msword') || mimeType.includes('doc')) ext = '.doc';
      else if (mimeType.includes('png')) ext = '.png';
      else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    }

    // Sanitiza prefixo e nome
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${cleanPrefix}_${Date.now()}_${randomSuffix}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Remove eventual prefixo de data URL base64 (ex: "data:application/pdf;base64,")
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    fs.writeFileSync(filePath, buffer);

    return `/uploads/resumes/${fileName}`;
  } catch (error) {
    console.error('[saveResumeAttachment] Erro ao salvar anexo de currículo:', error);
    return null;
  }
}
