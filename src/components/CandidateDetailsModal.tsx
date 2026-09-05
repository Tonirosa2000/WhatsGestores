'use client';

import React from 'react';
import {
  X,
  MapPin,
  Calendar,
  Lock,
  MessageCircle,
  Mail,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  FileText,
  Download,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import { formatDateTime, getWhatsAppLink } from '@/lib/formatters';
import { CandidateItem } from './CandidateCard';

interface CandidateDetailsModalProps {
  candidate: CandidateItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenAuthModal: () => void;
}

export const CandidateDetailsModal: React.FC<CandidateDetailsModalProps> = ({
  candidate,
  isOpen,
  onClose,
  onOpenAuthModal,
}) => {
  if (!isOpen || !candidate) return null;

  let skillsList: string[] = [];
  if (candidate.skills) {
    try {
      skillsList = JSON.parse(candidate.skills);
    } catch {
      skillsList = candidate.skills.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  const whatsappMessage = `Olá ${candidate.fullName.split(' ')[0]}! Encontrei seu currículo no Banco de Talentos WhatsGestores e temos interesse no seu perfil de ${candidate.targetRole}.`;

  const isPdf = candidate.attachmentUrl?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors z-10"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Topo / Header com Identificação */}
        <div className="flex items-start gap-4 pb-5 border-b border-slate-100 shrink-0">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-600 to-emerald-400 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-600/25 shrink-0">
            {candidate.fullName.substring(0, 1).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Publicado em {formatDateTime(candidate.publishedAt)}
              </span>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                {candidate.groupName || 'Banco de Talentos'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {candidate.fullName}
            </h2>

            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-extrabold rounded-xl border border-emerald-200/60">
                {candidate.targetRole}
              </span>
              {candidate.location && (
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xl">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {candidate.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1 custom-scrollbar">
          
          {/* Seção 1: Formação Acadêmica */}
          <div className="bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-transparent p-4 sm:p-5 rounded-2xl border border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm mb-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span>Formação Acadêmica</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium pl-9">
              {candidate.education || 'Formação acadêmica e cursos profissionais informados no currículo.'}
            </p>
          </div>

          {/* Seção 2: Histórico e Experiência Anterior */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm mb-2">
              <div className="w-7 h-7 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-sm">
                <Briefcase className="w-4 h-4" />
              </div>
              <span>Histórico e Experiência Profissional</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line pl-9">
              {candidate.experienceSummary || 'Nenhuma experiência detalhada informada.'}
            </p>
          </div>

          {/* Seção 3: Habilidades e Competências */}
          {skillsList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm mb-3">
                <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span>Habilidades & Competências Identificadas</span>
              </div>
              <div className="flex flex-wrap gap-2 pl-9">
                {skillsList.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-semibold bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/70 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Seção 4: Documento Original do Currículo */}
          {(candidate.attachmentUrl || candidate.hasAttachment) && (
            <div className="p-4 sm:p-5 bg-teal-50/60 rounded-2xl border border-teal-200/80">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Documento Original do Currículo Anexado
                    </h4>
                    <p className="text-xs text-slate-500">
                      {isPdf ? 'Documento em formato PDF pronto para visualização' : 'Arquivo original enviado pelo candidato no WhatsApp'}
                    </p>
                  </div>
                </div>

                {candidate.isLocked ? (
                  <button
                    onClick={onOpenAuthModal}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all hover:scale-[1.02]"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Liberar Documento Original</span>
                  </button>
                ) : candidate.attachmentUrl ? (
                  <a
                    href={candidate.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow transition-all hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Ver / Baixar Currículo Original</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {/* Seção 5: Mensagem Original do WhatsApp */}
          {candidate.originalMessage && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <span>Mensagem Original Registrada no Grupo</span>
              </div>
              <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed font-mono bg-white p-3 rounded-xl border border-slate-200">
                {candidate.originalMessage}
              </p>
            </div>
          )}

        </div>

        {/* Rodapé / Ações e Contato com Proteção LGPD */}
        <div className="pt-4 border-t border-slate-100 shrink-0 flex items-center justify-between gap-3 flex-wrap bg-white">
          {candidate.isLocked ? (
            <div className="w-full sm:w-auto flex-1 flex items-center justify-between gap-3 p-3 bg-slate-100/90 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{candidate.contactPhone}</span>
                  </div>
                  {candidate.contactEmail && (
                    <div className="text-[11px] text-slate-400">
                      {candidate.contactEmail}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={onOpenAuthModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition-all hover:scale-[1.02]"
              >
                Liberar Contato & Currículo
              </button>
            </div>
          ) : (
            <div className="w-full sm:w-auto flex-1 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>{candidate.contactPhone}</span>
                </div>
                {candidate.contactEmail && (
                  <a
                    href={`mailto:${candidate.contactEmail}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{candidate.contactEmail}</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={getWhatsAppLink(candidate.contactPhone, whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Conversar no WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
