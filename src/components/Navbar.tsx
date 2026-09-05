'use client';

import React from 'react';
import { Briefcase, Users, Bot, ShieldCheck, LogOut, MessageSquare, Sparkles } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';

interface NavbarProps {
  activeTab: 'jobs' | 'candidates' | 'admin';
  setActiveTab: (tab: 'jobs' | 'candidates' | 'admin') => void;
  jobsCount: number;
  candidatesCount: number;
  authMember: { name: string; phone: string } | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onOpenSimulatorModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  jobsCount,
  candidatesCount,
  authMember,
  onOpenAuthModal,
  onLogout,
  onOpenSimulatorModal,
}) => {
  return (
    <header className="sticky top-0 z-40 glass-header shadow-sm transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('jobs')}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  Whats<span className="text-emerald-600">Gestores</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 rounded-full">
                  <Sparkles className="w-3 h-3" /> IA 24h
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Oportunidades & Talentos da Comunidade de Gestores
              </p>
            </div>
          </div>

          {/* Abas Centrais */}
          <nav className="flex items-center gap-1 sm:gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 shadow-inner">
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === 'jobs'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-200 border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Vagas</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'jobs' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {formatNumber(jobsCount)}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('candidates')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === 'candidates'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-200 border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Talentos</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'candidates' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {formatNumber(candidatesCount)}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === 'admin'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-200 border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span className="hidden md:inline">Robô WhatsApp</span>
            </button>
          </nav>

          {/* Área de Autenticação / Ações */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenSimulatorModal}
              title="Testar Processamento de Mensagem com IA"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Testar Mensagem</span>
            </button>

            {authMember ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-2xl shadow-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  {authMember.name.substring(0, 1).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-950">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{authMember.name.split(' ')[0]}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">Membro Verificado</span>
                </div>
                <button
                  onClick={onLogout}
                  title="Sair da sessão"
                  className="p-1.5 text-emerald-700 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Sou Membro</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
