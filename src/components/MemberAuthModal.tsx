'use client';

import React, { useState } from 'react';
import { ShieldCheck, MessageSquare, X, ArrowRight, Lock, AlertCircle, Sparkles } from 'lucide-react';

interface MemberAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (member: { name: string; phone: string }) => void;
}

export const MemberAuthModal: React.FC<MemberAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'NOT_MEMBER'>('PHONE');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [demoCodeHint, setDemoCodeHint] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (data.success) {
        setDemoCodeHint(data.demoCode);
        setStep('OTP');
      } else {
        if (!data.isMember) {
          setErrorMsg(data.message);
          setStep('NOT_MEMBER');
        } else {
          setErrorMsg(data.message || 'Erro ao enviar código');
        }
      }
    } catch {
      setErrorMsg('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();

      if (data.success) {
        onSuccess(data.member);
        onClose();
      } else {
        setErrorMsg(data.message || 'Código incorreto ou expirado');
      }
    } catch {
      setErrorMsg('Erro ao validar código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-100 relative overflow-hidden">
        
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Conteúdo: Passo 1 (Digitar Telefone) */}
        {step === 'PHONE' && (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              Acesso Exclusivo para Membros
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Para proteger a privacidade dos candidatos (LGPD), o acesso aos contatos e currículos completos é restrito aos membros dos grupos oficiais de Gestores.
            </p>

            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Seu WhatsApp com DDD:
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="(11) 98888-7777"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Exemplo: 11998887777 (números cadastrados no grupo)
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Verificando...' : (
                  <>
                    <span>Enviar Código no WhatsApp</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Conteúdo: Passo 2 (Digitar OTP) */}
        {step === 'OTP' && (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              Digite o Código de 6 Dígitos
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Enviamos um código de verificação para o seu WhatsApp cadastrado.
            </p>

            {demoCodeHint && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
                <span className="font-bold flex items-center gap-1 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Código gerado para validação:
                </span>
                <span className="text-xl font-black tracking-widest text-emerald-700">{demoCodeHint}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-2xl font-black tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Validando...' : 'Desbloquear Acesso Completo'}
              </button>
            </form>
          </div>
        )}

        {/* Conteúdo: Passo 3 (Não é membro do grupo) */}
        {step === 'NOT_MEMBER' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">
              Número Não Localizado no Grupo
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Este número de WhatsApp ainda não faz parte dos grupos oficiais de Gestores. Para liberar o acesso gratuito ao Banco de Talentos, ingresse na nossa comunidade oficial!
            </p>

            <a
              href="https://chat.whatsapp.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 mb-3"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Entrar no Grupo de WhatsApp</span>
            </a>

            <button
              onClick={() => setStep('PHONE')}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
            >
              Tentar outro número de telefone
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
