'use client';

import React, { useState } from 'react';
import { X, Upload, Bot, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles, Database } from 'lucide-react';

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'API' | 'FILE'>('API');
  const [groupName, setGroupName] = useState('Gestores - Banco de Talentos - VAGAS');
  const [limit, setLimit] = useState(50);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: any = {
        type: activeTab,
        groupName,
      };

      if (activeTab === 'FILE') {
        if (!fileContent.trim()) {
          throw new Error('Por favor, selecione um arquivo de conversa .txt válido.');
        }
        payload.fileContent = fileContent;
      } else {
        payload.limit = limit;
      }

      const res = await fetch('/api/whatsapp/import-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar importação histórica.');
      }

      setResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Importação Histórica do WhatsApp
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Recupere mensagens antigas e alimente o mural com IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs de Seleção */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            onClick={() => { setActiveTab('API'); setResult(null); setError(null); }}
            disabled={loading}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'API'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Via Robô na Nuvem (Evolution API)</span>
          </button>

          <button
            onClick={() => { setActiveTab('FILE'); setResult(null); setError(null); }}
            disabled={loading}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'FILE'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Via Arquivo Exportado (.txt)</span>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-6">

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-800 font-semibold">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Importação Concluída com Sucesso!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Vagas Cadastradas</span>
                  <div className="text-xl font-black text-emerald-700">{result.stats?.jobsCreated || 0}</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Talentos Salvos</span>
                  <div className="text-xl font-black text-teal-700">{result.stats?.candidatesCreated || 0}</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Ignoradas/Spam</span>
                  <div className="text-xl font-black text-slate-600">{result.stats?.ignored || 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Seleção de Grupo Oficial */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase">Grupo Oficial do WhatsApp</label>
            <select
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={loading}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Gestores - Banco de Talentos - VAGAS">Gestores - Banco de Talentos - VAGAS</option>
              <option value="Gestores - Banco de Talentos - Currículo">Gestores - Banco de Talentos - Currículo</option>
            </select>
            <p className="text-[11px] text-slate-400">
              O robô busca e processa exclusivamente mensagens do grupo oficial selecionado.
            </p>
          </div>

          {/* Aba 1: API */}
          {activeTab === 'API' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Quantidade de Mensagens Recentes para Ler
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[30, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setLimit(num)}
                      disabled={loading}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        limit === num
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num} mensagens
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-900 block mb-1">Como funciona a busca na nuvem:</strong>
                O robô consulta a Evolution API para resgatar as mensagens anteriores que o WhatsApp sincronizou na nuvem, filtra o que é relevante e envia para a IA do Gemini extrair as oportunidades retroativas.
              </div>
            </div>
          )}

          {/* Aba 2: FILE */}
          {activeTab === 'FILE' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50">
                <input
                  type="file"
                  accept=".txt"
                  id="whatsapp-file"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                />
                <label htmlFor="whatsapp-file" className="cursor-pointer flex flex-col items-center justify-center">
                  <Upload className="w-8 h-8 text-emerald-600 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    {fileName ? fileName : 'Clique aqui para carregar o arquivo .txt da conversa'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    Exportado do WhatsApp (sem mídia)
                  </span>
                </label>
              </div>

              <div className="p-4 bg-emerald-50/60 border border-emerald-200/60 rounded-2xl text-xs text-slate-700 space-y-1">
                <strong className="text-emerald-900 font-bold block">Como exportar a conversa no celular:</strong>
                <p>1. No WhatsApp do celular, abra o grupo de Vagas ou Currículos.</p>
                <p>2. Toque nos <strong>3 pontinhos</strong> (ou no nome do grupo) &gt; <strong>Mais</strong> &gt; <strong>Exportar conversa</strong>.</p>
                <p>3. Escolha <strong>Sem Mídia</strong> e envie o arquivo <code>.txt</code> para cá!</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            Fechar
          </button>

          <button
            onClick={handleStartImport}
            disabled={loading || (activeTab === 'FILE' && !fileContent)}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando com IA (Aguarde)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Iniciar Importação com IA</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};