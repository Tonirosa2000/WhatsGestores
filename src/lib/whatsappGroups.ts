/**
 * Gerenciamento centralizado dos Grupos Oficiais do WhatsGestores no WhatsApp
 * 
 * Grupos Monitorados Exclusivamente:
 * 1. Gestores - Banco de Talentos - VAGAS
 * 2. Gestores - Banco de Talentos - Currículo (suporta também "Currículos")
 */

export const OFFICIAL_GROUP_VAGAS_DEFAULT = 'Gestores - Banco de Talentos - VAGAS';
export const OFFICIAL_GROUP_CURRICULOS_DEFAULT = 'Gestores - Banco de Talentos - Currículo';

export type OfficialGroupType = 'VAGAS' | 'CURRICULOS';

export interface OfficialGroupMatch {
  isOfficial: boolean;
  type: OfficialGroupType | null;
  canonicalName: string | null;
}

export interface OfficialGroupInfo {
  id: string; // remoteJid (ex: 120363xxx@g.us)
  subject: string; // Nome retornado pela Evolution API
  canonicalName: string;
  type: OfficialGroupType;
  participantsCount?: number;
}

/**
 * Remove acentuação e padroniza string para comparação tolerante
 */
export function normalizeGroupName(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Valida se uma string de nome de grupo pertence a um dos grupos oficiais
 */
export function matchOfficialGroup(groupName: string): OfficialGroupMatch {
  if (!groupName || typeof groupName !== 'string') {
    return { isOfficial: false, type: null, canonicalName: null };
  }

  const normalized = normalizeGroupName(groupName);

  // Nomes configurados no ambiente (com fallback)
  const envVagas = process.env.WHATSAPP_GROUP_VAGAS || OFFICIAL_GROUP_VAGAS_DEFAULT;
  const envCurriculos = process.env.WHATSAPP_GROUP_CURRICULOS || OFFICIAL_GROUP_CURRICULOS_DEFAULT;

  const normEnvVagas = normalizeGroupName(envVagas);
  const normEnvCurriculos = normalizeGroupName(envCurriculos);

  // 1. Verificação do Grupo de Vagas
  if (
    normalized === normEnvVagas ||
    normalized.includes('banco de talentos - vagas') ||
    (normalized.includes('gestores') && normalized.includes('vagas'))
  ) {
    return {
      isOfficial: true,
      type: 'VAGAS',
      canonicalName: OFFICIAL_GROUP_VAGAS_DEFAULT,
    };
  }

  // 2. Verificação do Grupo de Currículos (tolerante a singular/plural: "curriculo" e "curriculos")
  if (
    normalized === normEnvCurriculos ||
    normalized.includes('banco de talentos - curriculo') ||
    normalized.includes('banco de talentos - curriculos') ||
    (normalized.includes('gestores') && (normalized.includes('curriculo') || normalized.includes('curriculos')))
  ) {
    return {
      isOfficial: true,
      type: 'CURRICULOS',
      canonicalName: OFFICIAL_GROUP_CURRICULOS_DEFAULT,
    };
  }

  return { isOfficial: false, type: null, canonicalName: null };
}

// Cache em memória dos metadados dos grupos da Evolution API (TTL: 5 minutos)
let cachedOfficialGroups: { timestamp: number; data: OfficialGroupInfo[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Busca grupos na Evolution API e filtra ESTRITAMENTE os 2 grupos oficiais,
 * mapeando seus IDs/JIDs reais na nuvem.
 */
export async function getOfficialGroupsFromEvolution(
  evolutionUrl: string,
  evolutionKey: string,
  forceRefresh = false
): Promise<OfficialGroupInfo[]> {
  const now = Date.now();
  if (!forceRefresh && cachedOfficialGroups && (now - cachedOfficialGroups.timestamp < CACHE_TTL_MS)) {
    return cachedOfficialGroups.data;
  }

  try {
    const res = await fetch(`${evolutionUrl}/group/fetchAllGroups/whatsgestores?getParticipants=false`, {
      headers: { apikey: evolutionKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[whatsappGroups] Evolution API retornou status ${res.status} ao listar grupos.`);
      return cachedOfficialGroups?.data || [];
    }

    const groups = await res.json();
    if (!Array.isArray(groups)) {
      return cachedOfficialGroups?.data || [];
    }

    const matched: OfficialGroupInfo[] = [];

    for (const g of groups) {
      const subject = g?.subject || g?.name || '';
      const match = matchOfficialGroup(subject);
      if (match.isOfficial && match.type && match.canonicalName) {
        matched.push({
          id: g?.id || g?.jid || '',
          subject,
          canonicalName: match.canonicalName,
          type: match.type,
          participantsCount: Array.isArray(g?.participants) ? g.participants.length : undefined,
        });
      }
    }

    cachedOfficialGroups = {
      timestamp: now,
      data: matched,
    };

    return matched;
  } catch (err) {
    console.warn('[whatsappGroups] Erro ao buscar grupos na Evolution API:', err);
    return cachedOfficialGroups?.data || [];
  }
}

/**
 * Invalida o cache manual quando necessário (ex: após sincronização)
 */
export function invalidateOfficialGroupsCache(): void {
  cachedOfficialGroups = null;
}
