'use client';

import React from 'react';
import { MapPin, Building, Calendar, DollarSign, MessageCircle, Mail, ExternalLink, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDateTime, getWhatsAppLink, getJobValidityStatus } from '@/lib/formatters';

export interface JobItem {
  id: string;
  title: string;
  company?: string | null;
  description: string;
  modality: string;
  location?: string | null;
  salary?: number | null;
  salaryFormatted?: string | null;
  benefits?: string | null;
  requirements?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  applyUrl?: string | null;
  publishedAt: string;
  expiresAt?: string | null;
  status?: string;
  groupName: string;
}

interface JobCardProps {
  job: JobItem;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  let requirementsList: string[] = [];
  if (job.requirements) {
    try {
      requirementsList = JSON.parse(job.requirements);
    } catch {
      requirementsList = job.requirements.split(',').map(r => r.trim());
    }
  }

  const validity = getJobValidityStatus(job.expiresAt, job.publishedAt);

  const modalityBadgeStyle =
    job.modality === 'Remoto'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : job.modality === 'Híbrido'
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : 'bg-slate-100 text-slate-800 border-slate-200';

  const validityBadgeStyle =
    validity.badgeType === 'EXPIRED'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : validity.badgeType === 'WARNING'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200';

  const whatsappMessage = `Olá ${job.contactName ? job.contactName : 'recrutador'}! Vi o anúncio da vaga de "${job.title}" divulgado no grupo WhatsGestores e gostaria de me candidatar.`;

  return (
    <div
      className={`glass-card rounded-3xl p-6 sm:p-7 shadow-sm transition-all duration-300 flex flex-col justify-between group relative overflow-hidden ${
        validity.isExpired
          ? 'bg-slate-50/80 border-slate-200/90'
          : 'hover:shadow-xl hover:border-emerald-300/80 bg-white/90'
      }`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-100/30 via-transparent to-transparent rounded-bl-full pointer-events-none" />

      <div>
        {/* Header do Card com Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Badge de Modalidade */}
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${modalityBadgeStyle}`}>
                {job.modality}
              </span>

              {/* Badge de Validade / Inscrição */}
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-sm ${validityBadgeStyle}`}>
                {validity.badgeType === 'EXPIRED' ? (
                  <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                ) : validity.badgeType === 'WARNING' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                <span>{validity.badgeText}</span>
              </span>

              {/* Data de Publicação */}
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100/90 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Publ: {formatDateTime(job.publishedAt)}</span>
              </span>
            </div>

            <h3
              className={`text-xl font-extrabold tracking-tight transition-colors ${
                validity.isExpired
                  ? 'text-slate-700'
                  : 'text-slate-900 group-hover:text-emerald-700'
              }`}
            >
              {job.title}
            </h3>
          </div>
        </div>

        {/* Informações da Empresa & Local */}
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 mb-4 flex-wrap">
          <span className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-lg">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            {job.company || 'Confidencial'}
          </span>
          <span className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            {job.location || 'Brasil'}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-lg font-bold">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            {job.salaryFormatted || formatCurrency(job.salary)}
          </span>
        </div>

        {/* Descrição */}
        <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
          {job.description}
        </p>

        {/* Benefícios */}
        {job.benefits && (
          <div className="mb-4 text-xs text-slate-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
            <strong className="text-emerald-900 font-bold">🎁 Benefícios: </strong>
            {job.benefits}
          </div>
        )}

        {/* Requisitos / Tags */}
        {requirementsList.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {requirementsList.slice(0, 4).map((req, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/60 flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {req}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé e Botões de Candidatura */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-slate-400 font-medium">
          Grupo: <span className="text-slate-600 font-semibold">{job.groupName.replace('Gestores - Banco de Talentos - ', '')}</span>
        </div>

        <div className="flex items-center gap-2">
          {validity.isExpired ? (
            <div className="flex items-center gap-2">
              {job.applyUrl && (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-all"
                  title="Acessar Link"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Acessar Link</span>
                </a>
              )}
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                Inscrições Encerradas
              </span>
            </div>
          ) : (
            <>
              {job.contactEmail && (
                <a
                  href={`mailto:${job.contactEmail}?subject=Candidatura: ${encodeURIComponent(job.title)}`}
                  className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-all"
                  title={`Enviar currículo para ${job.contactEmail}`}
                >
                  <Mail className="w-4 h-4" />
                </a>
              )}

              {job.contactPhone ? (
                <>
                  {job.applyUrl && (
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 p-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-all"
                      title="Acessar Link"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-600" />
                      <span className="hidden sm:inline">Acessar Link</span>
                    </a>
                  )}
                  <a
                    href={getWhatsAppLink(job.contactPhone, whatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Candidatar-se</span>
                  </a>
                </>
              ) : job.applyUrl ? (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  title="Acessar Link"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Acessar Link</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">Ver detalhes na mensagem</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
