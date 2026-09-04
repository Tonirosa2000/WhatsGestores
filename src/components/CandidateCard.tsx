'use client';

import React from 'react';
import { MapPin, Calendar, Lock, MessageCircle, CheckCircle2 } from 'lucide-react';
import { formatDateTime, getWhatsAppLink } from '@/lib/formatters';

export interface CandidateItem {
  id: string;
  fullName: string;
  targetRole: string;
  experienceSummary: string;
  skills?: string | null;
  location?: string | null;
  contactPhone: string;
  contactEmail?: string | null;
  publishedAt: string;
  groupName: string;
  isLocked?: boolean;
}

interface CandidateCardProps {
  candidate: CandidateItem;
  onOpenAuthModal: () => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, onOpenAuthModal }) => {
  let skillsList: string[] = [];
  if (candidate.skills) {
    try {
      skillsList = JSON.parse(candidate.skills);
    } catch {
      skillsList = candidate.skills.split(',').map(s => s.trim());
    }
  }

  const whatsappMessage = `Olá ${candidate.fullName.split(' ')[0]}! Encontrei seu perfil no Banco de Talentos WhatsGestores e temos uma oportunidade compatível com o seu perfil de ${candidate.targetRole}.`;

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-xl hover:border-emerald-300/80 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-100/40 via-transparent to-transparent rounded-bl-full pointer-events-none" />

      <div>
        {/* Header do Perfil */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-600 to-emerald-400 text-white flex items-center justify-center font-black text-xl shadow-md shadow-teal-600/20 shrink-0">
            {candidate.fullName.substring(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {formatDateTime(candidate.publishedAt)}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
              {candidate.fullName}
            </h3>
            <p className="text-sm font-bold text-emerald-700">
              {candidate.targetRole}
            </p>
          </div>
        </div>

        {/* Localização */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-3.5">
          <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            {candidate.location || 'São Paulo - SP'}
          </span>
        </div>

        {/* Resumo Profissional */}
        <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
          {candidate.experienceSummary}
        </p>

        {/* Tags de Competências */}
        {skillsList.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {skillsList.map((skill, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200/50 flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Área de Contato e Proteção LGPD */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        {candidate.isLocked ? (
          <div className="w-full flex items-center justify-between gap-2 bg-slate-100/90 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">
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
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>{candidate.contactPhone}</span>
            </div>

            <a
              href={getWhatsAppLink(candidate.contactPhone, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02]"
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
