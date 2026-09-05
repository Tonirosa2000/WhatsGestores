'use client';

import React, { useState, useEffect } from 'react';
import { Bot, QrCode, CheckCircle2, RefreshCw, Smartphone, Database, Sparkles, MessageSquare, Trash2, History, Users } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { ImportHistoryModal } from './ImportHistoryModal';

interface AdminPanelProps {
  onOpenSimulatorModal: () => void;
  onDataChanged?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onOpenSimulatorModal, onDataChanged }) => {
  const [statusData, setStatusData] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncingMembers, setSyncingMembers] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/whatsapp/status'),
        fetch('/api/logs'),
      ]);
      const statusJson = await statusRes.json();
      const logsJson = await logsRes.json();
      if (statusJson.success) setStatusData(statusJson);
      if (logsJson.success) setLogs(logsJson.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGenerateQR = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/generate-qr', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setQrCode(data.qrCode);
        fetchStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO: Tem certeza que deseja apagar todas as vagas, currículos e logs para começar o sistema do zero?'
    );
    if (!confirmed) return;

    setClearing(true);
    try {
      const res = await fetch('/api/admin/clear-data', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('✓ Todos os dados foram limpos com sucesso! O sistema está zerado.');
        window.location.reload();
      } else {
        alert('Erro ao limpar dados: ' + data.error);
      }
    } catch (e: any) {
      alert('Erro na requisição: ' + e.message);
    } finally {
      setClearing(false);
    }
  };

  const [clearingMembers, setClearingMembers] = useState(false);

  const handleSyncMembers = async () => {
    setSyncingMembers(true);
    try {
      const res = await fetch('/api/whatsapp/sync-members', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const details = data.groupStats 
          ? Object.entries(data.groupStats).map(([k, v]) => `• ${k}: ${v} membros`).join('\n')
          : '';
        alert(`✓ Sucesso! ${data.membersSynced} participantes sincronizados exclusivamente dos grupos oficiais:\n\n${details}`);
        fetchStatus();
      } else {
        alert('Erro ao sincronizar membros: ' + data.error);
      }
    } catch (e: any) {
      alert('Erro na requisição: ' + e.message);
    } finally {
      setSyncingMembers(false);
    }
  };

  const handleClearMembers = async () => {
    const confirmed = window.confirm(
      '⚠️ Tem certeza que deseja apagar todos os membros do WhatsApp cadastrados para reiniciar a sincronização limpa apenas dos 2 grupos oficiais?'
    );
    if (!confirmed) return;

    setClearingMembers(true);
    try {
      const res = await fetch('/api/admin/clear-members', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('✓ ' + data.message);
        fetchStatus();
      } else {
        alert('Erro ao limpar membros: ' + data.error);
      }
    } catch (e: any) {
      alert('Erro na requisição: ' + e.message);
    } finally {
      setClearingMembers(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Banner de Status Geral */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Painel do Robô WhatsApp na Nuvem
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Monitoramento 24h em tempo real dos grupos de Vagas e Currículos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
              title="Atualizar status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSyncMembers}
              disabled={syncingMembers || clearingMembers}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              title="Buscar e sincronizar participantes exclusivamente dos 2 grupos oficiais"
            >
              <Users className={`w-4 h-4 ${syncingMembers ? 'animate-spin' : ''}`} />
              <span>{syncingMembers ? 'Sincronizando...' : 'Sincronizar Membros Oficiais'}</span>
            </button>
            <button
              onClick={handleClearMembers}
              disabled={clearingMembers || syncingMembers}
              className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-all"
              title="Apagar todos os membros cadastrados para re-sincronizar limpo"
            >
              <Users className="w-4 h-4 text-amber-700" />
              <span>{clearingMembers ? 'Limpando...' : 'Limpar Membros'}</span>
            </button>
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              title="Buscar mensagens antigas do grupo oficial selecionado"
            >
              <History className="w-4 h-4" />
              <span>Importar Histórico</span>
            </button>
            <button
              onClick={onOpenSimulatorModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Testar com IA</span>
            </button>
            <button
              onClick={handleClearData}
              disabled={clearing}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all"
              title="Zerar banco de dados para iniciar do zero"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearing ? 'Limpando...' : 'Zerar Dados (Começar do Zero)'}</span>
            </button>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/80 p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
              <span>Status da Sessão</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-xl font-black text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Conectado 24h</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">WhatsApp Web Ativo na Nuvem</p>
          </div>

          <div className="bg-white/80 p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Vagas Catalogadas</div>
            <div className="text-2xl font-black text-slate-900">
              {statusData?.stats?.totalJobs || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Oportunidades ativas</p>
          </div>

          <div className="bg-white/80 p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Talentos no Banco</div>
            <div className="text-2xl font-black text-slate-900">
              {statusData?.stats?.totalCandidates || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Currículos protegidos</p>
          </div>

          <div className="bg-white/80 p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Membros Verificados</div>
            <div className="text-2xl font-black text-slate-900">
              {statusData?.stats?.totalMembers || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Participantes autorizados</p>
          </div>
        </div>
      </div>

      {/* Seção de Conexão com QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Grupos Monitorados */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80">
          <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <span>Grupos Monitorados pelo Robô</span>
          </h3>

          <div className="space-y-3">
            {(statusData?.groups || [
              { name: 'Gestores - Banco de Talentos - VAGAS', type: 'Vagas', status: 'Verificando...' },
              { name: 'Gestores - Banco de Talentos - Currículo', type: 'Currículos', status: 'Verificando...' },
            ]).map((grp: any, idx: number) => {
              const isVagas = grp.type === 'Vagas';
              const isOk = grp.status === 'Ativo';
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isOk
                      ? isVagas
                        ? 'bg-emerald-50/60 border-emerald-200/60'
                        : 'bg-teal-50/60 border-teal-200/60'
                      : 'bg-amber-50/70 border-amber-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          isOk
                            ? isVagas
                              ? 'text-emerald-700 bg-emerald-100'
                              : 'text-teal-700 bg-teal-100'
                            : 'text-amber-800 bg-amber-100'
                        }`}
                      >
                        {isVagas ? 'Grupo de Vagas' : 'Grupo de Currículos'}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">{grp.name}</h4>
                      <p className="text-xs text-slate-500">
                        {isOk
                          ? isVagas
                            ? 'Escutando novas vagas publicadas'
                            : 'Escutando apresentações e perfis de currículos'
                          : grp.warning || 'Aguardando o robô ser adicionado ou aprovado pelo administrador do grupo.'}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border shadow-sm ${
                        isOk
                          ? 'text-emerald-700 bg-white border-emerald-200'
                          : 'text-amber-800 bg-white border-amber-200'
                      }`}
                    >
                      {isOk ? '🟢 Ativo no WhatsApp' : '🟡 Aprovação Pendente'}
                    </span>
                  </div>

                  {!isOk && (
                    <div className="mt-2.5 p-2.5 bg-white/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 font-medium">
                      ⚠️ <strong>Atenção:</strong> O número do robô no WhatsApp precisa estar aprovado como participante deste grupo para conseguir ler os currículos e vagas. Verifique no WhatsApp se há solicitação pendente de aprovação de membro.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900 font-bold block mb-1">Como o Robô funciona 24h na Nuvem:</strong>
            O robô mantém a conexão ativa na nuvem. Toda nova mensagem enviada nos 2 grupos acima é enviada em milissegundos para a <strong>IA do Gemini (Google AI Studio)</strong>, que extrai o cargo, salário em R$, contatos e requisitos antes de salvar no banco PostgreSQL.
          </div>
        </div>

        {/* Gerenciador de Sessão QR Code */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <span>Conectar / Reconectar WhatsApp Web</span>
            </h3>
            <p className="text-xs text-slate-600 mb-5">
              Escaneie o QR Code abaixo com a câmera do seu WhatsApp (Aparelhos Conectados) para manter a sessão ativa na nuvem.
            </p>

            {qrCode ? (
              <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-200 shadow-sm mb-4">
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-900/10 shadow-md mb-3">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 sm:w-72 sm:h-72 object-contain" />
                </div>
                <span className="text-xs text-slate-700 font-semibold animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Aponte a câmera do WhatsApp (Aparelhos Conectados)...
                </span>
              </div>
            ) : (
              <div className="p-8 bg-emerald-50/50 rounded-2xl border border-dashed border-emerald-300 text-center mb-4">
                <Smartphone className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-emerald-950 mb-1">Sessão Atualmente Conectada</h4>
                <p className="text-xs text-emerald-800">
                  O robô já está autenticado e capturando as mensagens dos 2 grupos.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateQR}
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>{qrCode ? 'Gerar Novo QR Code' : 'Reconectar / Gerar QR Code'}</span>
          </button>
        </div>

      </div>

      {/* Tabela de Logs de Auditoria Recentes */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80">
        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600" />
          <span>Atividades e Logs Recentes da IA e do Robô</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Grupo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Resumo da Ação</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-600 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.groupName}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                        log.messageType === 'JOB'
                          ? 'bg-blue-100 text-blue-800'
                          : log.messageType === 'CANDIDATE'
                          ? 'bg-purple-100 text-purple-800'
                          : log.messageType === 'MEMBER_AUTH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {log.messageType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{log.summary}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                        Sucesso
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                    Nenhum log registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSuccess={() => {
          fetchStatus();
          onDataChanged?.();
        }}
      />
    </div>
  );
};
