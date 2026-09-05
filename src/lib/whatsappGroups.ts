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

// Grupos Oficiais Conhecidos e Confirmados na Evolution API
export const KNOWN_OFFICIAL_GROUPS: OfficialGroupInfo[] = [
  {
    id: '120363425890387747@g.us',
    subject: 'Gestores - Banco de Talentos - VAGAS',
    canonicalName: OFFICIAL_GROUP_VAGAS_DEFAULT,
    type: 'VAGAS',
  },
  {
    id: '120363409519414139@g.us',
    subject: 'Gestores - Banco de Talentos - Currículos',
    canonicalName: OFFICIAL_GROUP_CURRICULOS_DEFAULT,
    type: 'CURRICULOS',
  },
];

export interface ParsedGroupParticipant {
  phone: string;
  name: string | null;
  isAdmin: boolean;
}

/**
 * Extrai telefone e nome real do participante da Evolution API v2.
 * Atenção: Na Evolution API v2, 'p.phoneNumber' contém o número real (ex: "553184137481@s.whatsapp.net"),
 * enquanto 'p.id' muitas vezes contém o LID interno (ex: "187926361194607@lid").
 */
export function extractParticipantData(p: any): ParsedGroupParticipant | null {
  if (!p) return null;

  let target = (p.phoneNumber || p.phone || p.user || '').toString();
  if (!target && p.id && !p.id.includes('@lid')) {
    target = p.id;
  }
  if (!target && p.jid && !p.jid.includes('@lid')) {
    target = p.jid;
  }

  if (!target) {
    const fallback = (p.id || p.jid || '').toString();
    const cleanFallback = fallback.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (cleanFallback.startsWith('55') && (cleanFallback.length === 12 || cleanFallback.length === 13)) {
      target = cleanFallback;
    } else {
      return null;
    }
  }

  const rawPhone = target.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (rawPhone.length < 8) return null;

  let phone = rawPhone;
  if (!phone.startsWith('55') && phone.length <= 11) {
    phone = '55' + phone;
  }

  const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
  const name = p.pushName || p.name || null;

  return {
    phone,
    name,
    isAdmin,
  };
}

// Cache em memória dos metadados dos grupos da Evolution API (TTL: 15 minutos)
let cachedOfficialGroups: { timestamp: number; data: OfficialGroupInfo[] } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Busca grupos na Evolution API e filtra ESTRITAMENTE os 2 grupos oficiais,
 * com fallback imediato para os grupos conhecidos em caso de lentidão da rede.
 */
export async function getOfficialGroupsFromEvolution(
  evolutionUrl: string,
  evolutionKey: string,
  forceRefresh = false
): Promise<OfficialGroupInfo[]> {
  const now = Date.now();
  if (!forceRefresh && cachedOfficialGroups && cachedOfficialGroups.data.length >= 2 && (now - cachedOfficialGroups.timestamp < CACHE_TTL_MS)) {
    return cachedOfficialGroups.data;
  }

  const matched: OfficialGroupInfo[] = [];

  try {
    const res = await fetch(`${evolutionUrl}/group/fetchAllGroups/whatsgestores?getParticipants=false`, {
      headers: { apikey: evolutionKey },
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const groups = await res.json();
      if (Array.isArray(groups)) {
        for (const g of groups) {
          const subject = g?.subject || g?.name || '';
          const match = matchOfficialGroup(subject);
          if (match.isOfficial && match.type && match.canonicalName) {
            matched.push({
              id: g?.id || g?.jid || '',
              subject,
              canonicalName: match.canonicalName,
              type: match.type,
              participantsCount: Array.isArray(g?.participants) ? g.participants.length : (typeof g?.size === 'number' ? g.size : undefined),
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[whatsappGroups] fetchAllGroups demorou ou falhou, usando grupos conhecidos:', err);
  }

  // Completa com grupos oficiais conhecidos caso algum não tenha vindo
  for (const known of KNOWN_OFFICIAL_GROUPS) {
    if (!matched.some((m) => m.type === known.type || m.id === known.id)) {
      matched.push(known);
    }
  }

  if (matched.length > 0) {
    cachedOfficialGroups = {
      timestamp: now,
      data: matched,
    };
  }

  return matched;
}

/**
 * Localiza de forma segura as informações e o JID do grupo oficial específico.
 */
export async function resolveOfficialGroup(
  type: OfficialGroupType,
  evolutionUrl: string,
  evolutionKey: string
): Promise<OfficialGroupInfo | null> {
  const groups = await getOfficialGroupsFromEvolution(evolutionUrl, evolutionKey);
  const found = groups.find((g) => g.type === type && !!g.id);
  if (found) return found;
  return KNOWN_OFFICIAL_GROUPS.find((g) => g.type === type) || null;
}

/**
 * Invalida o cache manual quando necessário
 */
export function invalidateOfficialGroupsCache(): void {
  cachedOfficialGroups = null;
}

/**
 * Busca participantes de um grupo específico de forma ultrarrápida (findGroupInfos leva ~1.5s)
 */
export async function fetchGroupParticipantsFromEvolution(
  groupJid: string,
  evolutionUrl: string,
  evolutionKey: string
): Promise<any[]> {
  // 1. Tenta findGroupInfos com groupJid (método mais rápido e com phoneNumber real na v2)
  try {
    const res = await fetch(`${evolutionUrl}/group/findGroupInfos/whatsgestores?groupJid=${encodeURIComponent(groupJid)}`, {
      headers: { apikey: evolutionKey },
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = await res.json();
      let parts: any[] = [];
      if (Array.isArray(data)) {
        parts = Array.isArray(data[0]?.participants) ? data[0].participants : data;
      } else if (Array.isArray(data?.participants)) {
        parts = data.participants;
      } else if (Array.isArray(data?.group?.participants)) {
        parts = data.group.participants;
      }
      if (parts.length > 0) {
        return parts;
      }
    }
  } catch (err) {
    console.warn(`[whatsappGroups] Falha no findGroupInfos para ${groupJid}:`, err);
  }

  // 2. Tenta rota /group/participants
  try {
    const res = await fetch(`${evolutionUrl}/group/participants/whatsgestores?groupJid=${encodeURIComponent(groupJid)}`, {
      headers: { apikey: evolutionKey },
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = await res.json();
      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data?.participants)) {
        list = data.participants;
      }
      if (list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    console.warn(`[whatsappGroups] Falha em /group/participants para ${groupJid}:`, err);
  }

  return [];
}
