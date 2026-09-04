'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, ArrowRight, CheckCircle2, AlertCircle, FileText, Upload, FileType, RotateCcw, Link2, Globe } from 'lucide-react';

interface NewMessageSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageProcessed: () => void;
}

export const NewMessageSimulatorModal: React.FC<NewMessageSimulatorModalProps> = ({
  isOpen,
  onClose,
  onMessageProcessed,
}) => {
  const [inputMode, setInputMode] = useState<'FILE' | 'TEXT' | 'LINK'>('FILE');
  const [groupName, setGroupName] = useState('Gestores - Banco de Talentos - VAGAS');
  const [rawMessage, setRawMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  // Estado para Arquivo Anexo
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    mimeType: string;
    base64Data: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Função para limpar todos os campos
  const resetForm = () => {
    setSelectedFile(null);
    setRawMessage('');
    setLinkUrl('');
    setResult(null);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toda vez que o modal for aberto, limpa automaticamente
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const exampleVaga = `🔥 VAGA URGENTE: Gerente Financeiro em Campinas/SP
Empresa em expansão contrata Gerente Financeiro Sênior.
Salário: R$ 9.200,00 + Plano de Saúde + VR (R$ 50/dia).
Modalidade: Híbrido (3 dias presencial, 2 home office).
Requisitos: Superior em Finanças/Contabilidade, Excel Avançado e liderança de equipe.
Interessados enviar CV para vagas@gestaocampinas.com.br ou chamar no WhatsApp (19) 99876-5432 falar com Adriana.`;

  const exampleCurriculo = `Olá gestores! Sou Marcos Paulo de Souza, Gerente de Projetos e TI com 12 anos de experiência em gestão de equipes ágeis, Scrum, implantação de ERP e transformação digital.
Moro em São Paulo/SP e estou disponível para novas posições PJ ou CLT.
Competências: Gestão Ágil, Scrum Master, Jira, Gestão Orçamentária.
WhatsApp: (11) 98123-4567 | E-mail: marcos.p.ti@email.com`;

  const exampleLink = 'https://www.mg.gov.br/transforma-minas/vaga/hemominas-coordenador-da-enfermagem-do-hemocentro-de-belo-horizonte';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      setSelectedFile({
        name: file.name,
        size: file.size,
        mimeType: file.type || (file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream'),
        base64Data,
      });
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setResult(null);

    if (inputMode === 'FILE' && !selectedFile) {
      setErrorMsg('Por favor, selecione um arquivo (PDF, Word ou Imagem) para envio.');
      setLoading(false);
      return;
    }

    if (inputMode === 'TEXT' && !rawMessage.trim()) {
      setErrorMsg('Por favor, digite ou cole o texto da mensagem.');
      setLoading(false);
      return;
    }

    if (inputMode === 'LINK' && !linkUrl.trim()) {
      setErrorMsg('Por favor, cole a URL/Link da página de vaga para a IA analisar.');
      setLoading(false);
      return;
    }

    try {
      const payload: any = {
        groupName,
        senderPhone: '5511998887777',
        senderName: 'Membro Teste',
        geminiApiKey: geminiApiKey.trim() || undefined,
      };

      if (inputMode === 'FILE' && selectedFile) {
        payload.attachment = {
          fileName: selectedFile.name,
          mimeType: selectedFile.mimeType,
          base64Data: selectedFile.base64Data,
        };
        payload.rawMessage = rawMessage.trim() || undefined;
      } else if (inputMode === 'LINK') {
        payload.rawMessage = rawMessage.trim() ? `${rawMessage.trim()}\n${linkUrl.trim()}` : linkUrl.trim();
      } else {
        payload.rawMessage = rawMessage.trim();
      }

      const res = await fetch('/api/whatsapp/simulate-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data);
        onMessageProcessed();
      } else {
        setErrorMsg(data.error || data.message || 'Erro ao processar com IA');
      }
    } catch {
      setErrorMsg('Erro de conexão ao processar com IA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-7 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-4 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Testador Multimodal com IA Gemini
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Envie arquivos reais (PDF, Word, Fotos), links da web ou textos para a IA processar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetForm}
            title="Limpar formulário"
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2.5 py-1.5 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpar</span>
          </button>
        </div>

        {/* Seletor de Modo: Arquivo vs Texto vs Link */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-4 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setInputMode('FILE')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-xl transition-all ${
              inputMode === 'FILE'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="truncate">📄 Arquivo</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode('TEXT')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-xl transition-all ${
              inputMode === 'TEXT'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">✍️ Texto</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode('LINK')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-xl transition-all ${
              inputMode === 'LINK'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="truncate">🔗 Link / URL</span>
          </button>
        </div>

        <form onSubmit={handleSimulate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Grupo de WhatsApp Simulado:
            </label>
            <select
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Gestores - Banco de Talentos - VAGAS">Gestores - Banco de Talentos - VAGAS</option>
              <option value="Gestores - Banco de Talentos - Currículo">Gestores - Banco de Talentos - Currículo</option>
            </select>
          </div>

          {/* MODO 1: UPLOAD DE ARQUIVO */}
          {inputMode === 'FILE' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selecione o Currículo ou Anúncio (PDF, DOCX, JPG, PNG):
              </label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-2xl cursor-pointer transition-all text-center flex flex-col items-center justify-center group"
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-md">
                      <FileType className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-emerald-950 truncate max-w-sm">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-emerald-700 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Clique para trocar de arquivo
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-white text-emerald-700 flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">
                      Clique aqui para selecionar seu PDF, Word ou Foto
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Suporta currículos em PDF, Word (.docx) e prints/fotos de vagas (.png / .jpg)
                    </span>
                  </>
                )}
              </div>

              {/* Mensagem Opcional de Legenda */}
              <div className="mt-3">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Legenda da Mensagem no WhatsApp (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Segue em anexo meu currículo atualizado para análise..."
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* MODO 2: TEXTO DIGITADO */}
          {inputMode === 'TEXT' && (
            <div>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                <label className="block text-xs font-bold text-slate-700">
                  Mensagem de Texto do WhatsApp:
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName('Gestores - Banco de Talentos - VAGAS');
                      setRawMessage(exampleVaga);
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    + Exemplo Vaga
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName('Gestores - Banco de Talentos - Currículo');
                      setRawMessage(exampleCurriculo);
                    }}
                    className="text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    + Exemplo Currículo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName('Gestores - Banco de Talentos - VAGAS');
                      setRawMessage(`Confiram essa oportunidade no Hemominas:\n${exampleLink}`);
                    }}
                    className="text-[11px] font-semibold text-indigo-700 hover:underline"
                  >
                    + Exemplo Link MG Gov
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                placeholder="Cole o texto da vaga, link ou apresentação profissional..."
                value={rawMessage}
                onChange={(e) => setRawMessage(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* MODO 3: LINK / URL DA WEB */}
          {inputMode === 'LINK' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Link / URL da Vaga (Web Scraping Automático):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setGroupName('Gestores - Banco de Talentos - VAGAS');
                    setLinkUrl(exampleLink);
                  }}
                  className="text-[11px] font-semibold text-indigo-700 hover:underline"
                >
                  + Exemplo Link MG Gov
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Globe className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  placeholder="https://www.mg.gov.br/transforma-minas/vaga/... ou link do Gupy, Catho, etc."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="mt-3">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Comentário / Mensagem que acompanhou o link no grupo (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pessoal, edital aberto para enfermeiros no Hemominas!"
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="mt-2.5 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  O robô acessará a página web em tempo real, baixará o conteúdo oficial do edital/vaga e usará a IA para catalogar os dados estruturados automaticamente.
                </span>
              </div>
            </div>
          )}

          {/* Chave API Gemini (Opcional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Chave da API do Gemini (Opcional se já configurada no .env):
            </label>
            <input
              type="password"
              placeholder="Cole sua Gemini API Key se desejar testar com outra chave"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Resultado da IA */}
          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  {result.type === 'JOB' ? '💼 Vaga Estruturada e Salva no Banco!' : '👤 Currículo/Talento Estruturado e Salvo no Banco!'}
                </span>
              </div>
              <pre className="text-[11px] bg-white p-3 rounded-xl border border-emerald-100 text-slate-800 overflow-x-auto max-h-48 font-mono">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {inputMode === 'LINK' ? 'Acessando Link e Extraindo com IA...' : 'Processando Dados com IA...'}
                  </span>
                </>
              ) : (
                <>
                  <span>Processar com Gemini e Salvar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
