'use client';

import React from 'react';
import {
  MapPin,
  Calendar,
  Lock,
  MessageCircle,
  CheckCircle2,
  GraduationCap,
  Briefcase,
  FileText,
  ExternalLink,
  ChevronRight,
  Mail,
  FileDown
} from 'lucide-react';
import { formatDateTime, getWhatsAppLink } from '@/lib/formatters';

export interface CandidateItem {
  id: string;
  fullName: string;
  targetRole: string;
  education?: string | null;
  experienceSummary: string;
  skills?: string | null;
  location?: string | null;
  contactPhone: string;
  contactEmail?: string | null;
  attachmentUrl?: string | null;
  hasAttachment?: boolean;
  originalMessage?: string | null;
  publishedAt: string;
  groupName: string;
  isLocked?: boolean;
}

interface CandidateCardProps {
  candidate: CandidateItem;
  onOpenAuthModal: () => void;
  onViewDetails?: (candidate: CandidateItem) => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({
  candidate,
  onOpenAuthModal,
  onViewDetails,
}) => {
  let skillsList: string[] = [];
  if (candidate.skills) {
    try {
      skillsList = JSON.parse(candidate.skills);
    } catch {
      skillsList = candidate.skills.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  const whatsappMessage = `Olá ${candidate.fullName.split(' ')[0]}! Encontrei seu perfil no Banco de Talentos WhatsGestores e temos uma oportunidade compatível com o seu perfil de ${candidate.targetRole}.`;

  const hasCvDocument = Boolean(candidate.attachmentUrl || candidate.hasAttachment);

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-xl hover:border-emerald-300/80 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden bg-white/95">
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-teal-100/50 via-emerald-50/20 to-transparent rounded-bl-full pointer-events-none" />

      <div>
        {/* Cabeçalho do Card */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-600 to-emerald-400 text-white flex items-center justify-center font-black text-xl shadow-md shadow-teal-600/20 shrink-0">
            {candidate.fullName.substring(0, 1).toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {formatDateTime(candidate.publishedAt)}
              </span>
              {candidate.groupName && (
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/50 truncate max-w-[170px]">
                  {candidate.groupName.replace('Gestores - Banco de Talentos - ', '')}
                </span>
              )}
            </div>

            <h3 className="text-lg font-black text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
              {candidate.fullName}
            </h3>

            <div className="mt-0.5">
              <span className="inline-block text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-lg">
                {candidate.targetRole}
              </span>
            </div>
          </div>
        </div>

        {/* Localização e E-mail */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-3.5 flex-wrap">
          <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            {candidate.location || 'Brasil'}
          </span>
          {candidate.contactEmail && (
            <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg text-slate-500">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate max-w-[140px]">{candidate.contactEmail}</span>
            </span>
          )}
        </div>

        {/* 🎓 Bloco de Formação Acadêmica */}
        {candidate.education ? (
          <div className="mb-3.5 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
              <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Formação Acadêmica</span>
            </div>
            <p className="text-slate-700 font-medium leading-relaxed line-clamp-2">
              {candidate.education}
            </p>
          </div>
        ) : null}

        {/* 💼 Bloco de Experiência Anterior */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Experiência Anterior</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 pl-1">
            {candidate.experienceSummary}
          </p>
        </div>

        {/* Tags de Competências e Habilidades */}
        {skillsList.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {skillsList.slice(0, 4).map((skill, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/60 flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {skill}
              </span>
            ))}
            {skillsList.length > 4 && (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/50">
                +{skillsList.length - 4} mais
              </span>
            )}
          </div>
        )}

        {/* Botão de Visualização do Documento Original / Detalhes */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {hasCvDocument && (
            candidate.isLocked ? (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all"
                title="Acesso exclusivo para membros"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Currículo Original (PDF)</span>
              </button>
            ) : candidate.attachmentUrl ? (
              <a
                href={candidate.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl border border-teal-200/70 transition-all"
              >
                <FileDown className="w-3.5 h-3.5 text-teal-600" />
                <span>Currículo Original (PDF)</span>
                <ExternalLink className="w-3 h-3 text-teal-500" />
              </a>
            ) : null
          )}

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(candidate)}
              className="flex items-center gap-1 text-xs font-extrabold text-emerald-700 hover:text-emerald-800 hover:underline ml-auto py-1"
            >
              <span>Ver perfil completo</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Área de Contato e Proteção LGPD */}
      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
        {candidate.isLocked ? (
          <div className="w-full flex items-center justify-between gap-2 bg-slate-100/90 p-2.5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 font-mono">
                {candidate.contactPhone}
              </span>
            </div>
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:scale-[1.02]"
            >
              Liberar Contato
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>{candidate.contactPhone}</span>
            </div>

            <a
              href={getWhatsAppLink(candidate.contactPhone, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02]"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Falar no WhatsApp</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
