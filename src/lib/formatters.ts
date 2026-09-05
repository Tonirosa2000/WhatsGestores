// Utilitários de Formatação para o Padrão Brasileiro (pt-BR)

/**
 * Formata um número inteiro para o padrão brasileiro com separador de milhar (.)
 * Exemplo: 1141 -> "1.141"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0";
  }
  return new Intl.NumberFormat("pt-BR").format(value);
}

/**
 * Normaliza qualquer número de telefone brasileiro para o padrão canônico oficial de 13 dígitos:
 * 55 + DDD (2 dígitos) + 9 + 8 dígitos (ex: "5531984137481")
 */
export function normalizeToCanonicalPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55") && cleaned.length <= 11) {
    cleaned = "55" + cleaned;
  }
  // Se for celular brasileiro com 12 dígitos (55 + DDD + 8 dígitos onde o 1º dígito é 6, 7, 8 ou 9):
  // Adiciona o 9º dígito oficial
  if (cleaned.length === 12 && cleaned.startsWith("55")) {
    const ddd = cleaned.slice(2, 4);
    const rest = cleaned.slice(4);
    if (["6", "7", "8", "9"].includes(rest[0])) {
      return `55${ddd}9${rest}`;
    }
  }
  return cleaned;
}

/**
 * Formata um valor numérico para Moeda Brasileira (BRL)
 * Exemplo: 2500 -> "R$ 2.500,00"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "A combinar";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata uma data para o padrão brasileiro dd/mm/aaaa
 * Exemplo: 2026-09-02 -> "02/09/2026"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "--/--/----";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "--/--/----";
  
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(d);
}

/**
 * Formata data e hora para o padrão brasileiro dd/mm/aaaa às HH:mm
 * Exemplo: 2026-09-02T14:30:00 -> "02/09/2026 às 14:30"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "--/--/----";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "--/--/----";

  const datePart = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(d);

  const timePart = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(d);

  return `${datePart} às ${timePart}`;
}

/**
 * Formata um número de telefone para o padrão brasileiro
 * Exemplo: "5511988887777" -> "(11) 98888-7777"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  
  // Remove código do país 55 se houver
  const local = cleaned.startsWith("55") && cleaned.length > 11 ? cleaned.substring(2) : cleaned;

  if (local.length === 11) {
    return `(${local.substring(0, 2)}) ${local.substring(2, 7)}-${local.substring(7)}`;
  }
  if (local.length === 10) {
    return `(${local.substring(0, 2)}) ${local.substring(2, 6)}-${local.substring(6)}`;
  }
  return phone;
}

/**
 * Gera um link oficial para abrir conversa no WhatsApp com mensagem opcional
 */
export function getWhatsAppLink(phone: string | null | undefined, message?: string): string {
  if (!phone) return "#";
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55") && cleaned.length <= 11) {
    cleaned = `55${cleaned}`;
  }
  
  const encodedMsg = message ? encodeURIComponent(message) : "";
  return `https://wa.me/${cleaned}${encodedMsg ? `?text=${encodedMsg}` : ""}`;
}

/**
 * Mascara parte do telefone para exibição pública segura
 * Exemplo: "(11) 98888-7777" -> "(11) 9••••-••77"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "(••) •••••-••••";
  const formatted = formatPhone(phone);
  if (formatted.length < 14) return "(••) •••••-••••";
  return `${formatted.substring(0, 6)}••••-••${formatted.substring(formatted.length - 2)}`;
}

/**
 * Retorna as informações e formatação do período de validade/inscrição da vaga
 */
export function getJobValidityStatus(
  expiresAt: Date | string | null | undefined,
  publishedAt?: Date | string | null | undefined
): {
  isExpired: boolean;
  daysRemaining: number;
  expiresFormatted: string;
  badgeText: string;
  badgeType: 'ACTIVE' | 'WARNING' | 'EXPIRED';
} {
  const now = new Date();
  
  // Se não foi informada data de expiração, calcula 30 dias a partir da publicação ou data atual
  let expDate: Date;
  if (expiresAt) {
    expDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  } else if (publishedAt) {
    const pubDate = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
    expDate = new Date(pubDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else {
    expDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  const diffMs = expDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = diffMs < 0;
  const expiresFormatted = formatDate(expDate);

  if (isExpired) {
    return {
      isExpired: true,
      daysRemaining: 0,
      expiresFormatted,
      badgeText: `Inscrições encerradas em ${expiresFormatted}`,
      badgeType: 'EXPIRED',
    };
  }

  if (daysRemaining <= 1) {
    return {
      isExpired: false,
      daysRemaining,
      expiresFormatted,
      badgeText: `Último dia de inscrição hoje (${expiresFormatted})`,
      badgeType: 'WARNING',
    };
  }

  if (daysRemaining <= 5) {
    return {
      isExpired: false,
      daysRemaining,
      expiresFormatted,
      badgeText: `Restam ${daysRemaining} dias (até ${expiresFormatted})`,
      badgeType: 'WARNING',
    };
  }

  return {
    isExpired: false,
    daysRemaining,
    expiresFormatted,
    badgeText: `Inscrições até ${expiresFormatted}`,
    badgeType: 'ACTIVE',
  };
}

