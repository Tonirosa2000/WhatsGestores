/**
 * Utilitário para detecção, download e extração de conteúdo de páginas web
 * Suporta portais de vagas públicos (MG Gov, Gupy, Catho, Vagas.com, LinkedIn, etc.)
 */

export interface ExtractedUrlInfo {
  url: string;
  title?: string;
  description?: string;
  bodyText: string;
  success: boolean;
}

/**
 * Detecta e extrai URLs válidas de qualquer texto de mensagem
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/gi;
  const matches = text.match(urlRegex) || [];
  
  // Limpa caracteres residuais de pontuação no final da URL (como . , ; : ! ?)
  const cleaned = matches.map(u => u.replace(/[.,;:!?)]+$/, ''));
  return Array.from(new Set(cleaned));
}

/**
 * Decodifica entidades HTML comuns
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&acirc;/g, 'â')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * Limpa o HTML e extrai o texto estruturado com título e descrição
 */
export function parseHtmlContent(html: string): { title: string; description: string; text: string } {
  // 1. Extração de Metadados
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const twitterTitleMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
  
  const title = decodeHtmlEntities(
    (ogTitleMatch?.[1] || titleTagMatch?.[1] || twitterTitleMatch?.[1] || '').trim()
  );

  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const twitterDescMatch = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);

  const description = decodeHtmlEntities(
    (ogDescMatch?.[1] || metaDescMatch?.[1] || twitterDescMatch?.[1] || '').trim()
  );

  // 2. Remoção de blocos não-textuais (scripts, styles, svg, canvas, noscript, iframes, comentários)
  let clean = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');

  // 3. Conversão de quebras estruturais
  clean = clean.replace(/<(?:br|hr)[^>]*>/gi, '\n');
  clean = clean.replace(/<\/(?:p|div|section|article|header|footer|aside|nav|main|h[1-6]|li|tr|td|th|blockquote)>/gi, '\n');
  clean = clean.replace(/<(?:li|h[1-6])[^>]*>/gi, '\n• ');

  // 4. Remoção de todas as outras tags HTML
  clean = clean.replace(/<[^>]+>/g, ' ');

  // 5. Decodificação de entidades
  clean = decodeHtmlEntities(clean);

  // 6. Normalização de espaçamentos e linhas
  const lines = clean
    .split('\n')
    .map(l => l.trim().replace(/[ \t]+/g, ' '))
    .filter(l => l.length > 0);

  // Limita o tamanho do texto da página em cerca de 12.000 caracteres para manter objetividade
  const text = lines.join('\n').slice(0, 12000);

  return { title, description, text };
}

/**
 * Realiza a requisição HTTP e extrai as informações da página web
 */
export async function fetchUrlContent(url: string, timeoutMs = 10000): Promise<ExtractedUrlInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[URL Extractor] Falha ao acessar ${url}: HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const bodyText = JSON.stringify(json, null, 2).slice(0, 10000);
      return {
        url,
        title: 'Dados Estruturados',
        bodyText,
        success: true,
      };
    }

    const html = await response.text();
    const { title, description, text } = parseHtmlContent(html);

    return {
      url,
      title,
      description,
      bodyText: text,
      success: true,
    };
  } catch (error: any) {
    console.warn(`[URL Extractor] Erro ao carregar página de ${url}:`, error.message);
    return null;
  }
}

/**
 * Encontra todas as URLs na mensagem, baixa seus conteúdos e anexa ao texto a ser analisado pela IA
 */
export async function enrichTextWithUrlContent(rawText: string): Promise<{
  enrichedText: string;
  detectedUrls: string[];
  primaryUrl?: string;
  extractedPageInfo?: ExtractedUrlInfo;
}> {
  const detectedUrls = extractUrls(rawText);
  if (detectedUrls.length === 0) {
    return {
      enrichedText: rawText,
      detectedUrls: [],
    };
  }

  const primaryUrl = detectedUrls[0];
  let enrichedText = rawText;
  let firstExtractedInfo: ExtractedUrlInfo | undefined;

  // Busca o conteúdo das URLs (no máximo as 2 primeiras para evitar sobrecarga)
  for (const url of detectedUrls.slice(0, 2)) {
    const info = await fetchUrlContent(url);
    if (info && info.bodyText) {
      if (!firstExtractedInfo) {
        firstExtractedInfo = info;
      }

      enrichedText += `\n\n--- CONTEÚDO EXTRAÍDO DA PÁGINA WEB DO LINK (${url}) ---\n`;
      if (info.title) enrichedText += `Título da Página: ${info.title}\n`;
      if (info.description) enrichedText += `Resumo/Descrição: ${info.description}\n`;
      enrichedText += `Texto da Página:\n${info.bodyText}\n`;
      enrichedText += `-----------------------------------------------------------\n`;
    }
  }

  return {
    enrichedText,
    detectedUrls,
    primaryUrl,
    extractedPageInfo: firstExtractedInfo,
  };
}
