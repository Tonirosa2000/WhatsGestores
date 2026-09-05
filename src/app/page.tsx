'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { JobCard, JobItem } from '@/components/JobCard';
import { CandidateCard, CandidateItem } from '@/components/CandidateCard';
import { AdminPanel } from '@/components/AdminPanel';
import { MemberAuthModal } from '@/components/MemberAuthModal';
import { NewMessageSimulatorModal } from '@/components/NewMessageSimulatorModal';
import { Search, Briefcase, Users, Sparkles, Flame, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { getJobValidityStatus } from '@/lib/formatters';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'candidates' | 'admin'>('jobs');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState('ALL');
  
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados dos Accordions de Vagas
  const [isOpenActive, setIsOpenActive] = useState(true); // Vagas ativas sempre abre expandido por padrão
  const [isOpenInactive, setIsOpenInactive] = useState(false); // Vagas inativas inicia fechado por padrão

  const [authMember, setAuthMember] = useState<{ name: string; phone: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('whatsgestores_member');
    if (saved) {
      try {
        setAuthMember(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const isMember = !!authMember;
      const [jobsRes, candidatesRes] = await Promise.all([
        fetch(`/api/jobs?search=${encodeURIComponent(searchQuery)}&modality=${modalityFilter}`),
        fetch(`/api/candidates?search=${encodeURIComponent(searchQuery)}&isMember=${isMember}`),
      ]);

      const jobsData = await jobsRes.json();
      const candidatesData = await candidatesRes.json();

      if (jobsData.success) setJobs(jobsData.jobs);
      if (candidatesData.success) setCandidates(candidatesData.candidates);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, modalityFilter, authMember, activeTab]);

  const handleAuthSuccess = (member: { name: string; phone: string }) => {
    setAuthMember(member);
    localStorage.setItem('whatsgestores_member', JSON.stringify(member));
  };

  const handleLogout = () => {
    setAuthMember(null);
    localStorage.removeItem('whatsgestores_member');
  };

  // Separação dinâmica entre Vagas Ativas e Inativas
  const activeJobs = jobs.filter(j => {
    const v = getJobValidityStatus(j.expiresAt, j.publishedAt);
    return !v.isExpired && j.status !== 'EXPIRED';
  });

  const inactiveJobs = jobs.filter(j => {
    const v = getJobValidityStatus(j.expiresAt, j.publishedAt);
    return v.isExpired || j.status === 'EXPIRED';
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar Superior */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        jobsCount={activeJobs.length}
        candidatesCount={candidates.length}
        authMember={authMember}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenSimulatorModal={() => setIsSimulatorModalOpen(true)}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Seção de Busca e Filtros */}
        {activeTab !== 'admin' && (
          <div className="mb-8 space-y-4">
            
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {activeTab === 'jobs' ? 'Oportunidades de Emprego' : 'Banco de Talentos & Currículos'}
              </h1>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                {activeTab === 'jobs'
                  ? 'Vagas capturadas e estruturadas automaticamente com controle de validade'
                  : 'Profissionais e especialistas disponíveis para novas oportunidades'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'jobs'
                      ? 'Buscar por cargo, empresa, requisitos ou cidade...'
                      : 'Buscar por cargo pretendido, competências ou localização...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 font-semibold placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all"
                />
              </div>

              {activeTab === 'jobs' && (
                <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-sm">
                  {['ALL', 'Remoto', 'Híbrido', 'Presencial'].map((mod) => (
                    <button
                      key={mod}
                      onClick={() => setModalityFilter(mod)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                        modalityFilter === mod
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {mod === 'ALL' ? 'Todas' : mod}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 💼 Aba: Vagas de Emprego com Accordions */}
        {activeTab === 'jobs' && (
          <div className="space-y-6 animate-fadeIn">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-64 bg-slate-200/60 rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">Nenhuma vaga encontrada</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Tente alterar os termos de busca ou aguarde novas postagens nos grupos do WhatsApp.
                </p>
              </div>
            ) : (
              <>
                {/* 🟢 ACCORDION 1: VAGAS ATIVAS (Inscrições Abertas - Aberto por padrão) */}
                <div className="glass-card bg-white/95 rounded-3xl border border-emerald-200 shadow-sm overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setIsOpenActive(!isOpenActive)}
                    className="w-full px-6 py-4.5 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/50 hover:bg-emerald-50 flex items-center justify-between gap-4 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                        <Flame className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                            Vagas com Inscrições Abertas
                          </h2>
                          <span className="px-2.5 py-0.5 text-xs font-black bg-emerald-600 text-white rounded-full shadow-sm">
                            {activeJobs.length}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Oportunidades válidas dentro do período de inscrição
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 hidden sm:inline">
                        {isOpenActive ? 'Recolher' : 'Expandir'}
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-white border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-sm">
                        {isOpenActive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {isOpenActive && (
                    <div className="p-6 pt-2 border-t border-emerald-100 animate-fadeIn">
                      {activeJobs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          {activeJobs.map((job) => (
                            <JobCard key={job.id} job={job} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">
                          <p className="text-xs font-semibold text-slate-500">
                            Nenhuma vaga ativa encontrada com os filtros atuais.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ⏳ ACCORDION 2: VAGAS INATIVAS / ENCERRADAS (Inicia recolhido por padrão) */}
                <div className="glass-card bg-slate-50/70 rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setIsOpenInactive(!isOpenInactive)}
                    className="w-full px-6 py-4.5 bg-slate-100/70 hover:bg-slate-100 flex items-center justify-between gap-4 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-slate-600 text-white flex items-center justify-center shadow-md shadow-slate-600/20">
                        <Clock className="w-5 h-5 text-slate-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-base sm:text-lg font-black text-slate-700 tracking-tight">
                            Vagas com Inscrições Encerradas / Inativas
                          </h2>
                          <span className="px-2.5 py-0.5 text-xs font-black bg-slate-500 text-white rounded-full shadow-sm">
                            {inactiveJobs.length}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          Histórico de vagas com prazo de inscrição expirado ou finalizadas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                        {isOpenInactive ? 'Recolher Histórico' : 'Ver Histórico'}
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                        {isOpenInactive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {isOpenInactive && (
                    <div className="p-6 pt-2 border-t border-slate-200 animate-fadeIn">
                      {inactiveJobs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          {inactiveJobs.map((job) => (
                            <JobCard key={job.id} job={job} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">
                          <p className="text-xs font-semibold text-slate-500">
                            Nenhuma vaga inativa registrada até o momento.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 👤 Aba: Banco de Talentos */}
        {activeTab === 'candidates' && (
          <div>
            {!authMember && (
              <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl shadow-lg shadow-emerald-700/15 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h4 className="text-base font-extrabold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-300" />
                    <span>Acesso Exclusivo para Membros dos Grupos</span>
                  </h4>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Faça login com seu WhatsApp para ver os contatos diretos e currículos completos dos talentos.
                  </p>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-black rounded-2xl shadow transition-all hover:scale-[1.02]"
                >
                  Liberar Acesso
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-64 bg-slate-200/60 rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : candidates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map((cand) => (
                  <CandidateCard
                    key={cand.id}
                    candidate={cand}
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">Nenhum candidato encontrado</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Tente outros filtros de busca ou verifique se os membros já postaram seus perfis.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 🤖 Aba: Painel do Robô & Admin */}
        {activeTab === 'admin' && (
          <AdminPanel
            onOpenSimulatorModal={() => setIsSimulatorModalOpen(true)}
            onDataChanged={fetchData}
          />
        )}

      </main>

      {/* Modais */}
      <MemberAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <NewMessageSimulatorModal
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        onMessageProcessed={fetchData}
      />

      {/* Rodapé Moderno */}
      <footer className="glass-header border-t border-slate-200/80 py-6 mt-12 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WhatsGestores &copy; 2026 - Plataforma Inteligente de Recrutamento</span>
          <span className="text-emerald-700 font-semibold">Integrado aos Grupos de WhatsApp via Google Gemini AI</span>
        </div>
      </footer>
    </div>
  );
}
