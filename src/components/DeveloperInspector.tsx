'use client';

import React, { useEffect, useState, useRef } from 'react';

/**
 * DeveloperInspector - Seletor de Elementos com Alt + Botão Esquerdo do Mouse
 * Exibe: Componente > Tag#id.classe | arquivo.tsx:linha
 * Copia para a área de transferência ao clicar com Alt pressionado.
 */
export const DeveloperInspector: React.FC = () => {
  const [hoverInfo, setHoverInfo] = useState<{
    component: string;
    file: string;
    line: string;
    tag: string;
    id: string;
    classes: string;
    x: number;
    y: number;
  } | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const lastTarget = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Ativo apenas no ambiente do navegador
    if (typeof window === 'undefined') return;

    const getMetadata = (el: HTMLElement | null) => {
      if (!el) return null;
      let current: HTMLElement | null = el;

      const targetInfo = {
        tag: el.tagName.toLowerCase(),
        id: el.id ? `#${el.id}` : '',
        classes:
          el.className && typeof el.className === 'string'
            ? el.className
                .split(' ')
                .filter((c) => c && !c.includes(':') && !c.includes('/'))
                .slice(0, 2)
                .join('.')
            : '',
      };

      // 1. Verifica atributos data-* explícitos (se houver tagger)
      while (current) {
        const componentPath = current.getAttribute('data-component-path');
        const componentLine = current.getAttribute('data-component-line');
        const lovId = current.getAttribute('data-lov-id');
        const componentName =
          current.getAttribute('data-component-name') ||
          current.getAttribute('data-lov-name');

        if (componentPath || lovId) {
          const rawPath = componentPath || lovId || '';
          const parts = rawPath.split(':');
          return {
            ...targetInfo,
            file: parts[0] || 'Arquivo Desconhecido',
            line: componentLine || parts[1] || '1',
            component: componentName || 'Component',
          };
        }
        current = current.parentElement;
      }

      // 2. Extrai metadados através do React Fiber em tempo de desenvolvimento
      try {
        const fiberKey = Object.keys(el).find(
          (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
        );

        if (fiberKey && (el as any)[fiberKey]) {
          let fiber = (el as any)[fiberKey];
          let compName = '';
          let sourceFile = '';
          let sourceLine = '';

          while (fiber) {
            if (!compName && typeof fiber.type === 'function') {
              compName = fiber.type.displayName || fiber.type.name || '';
            }
            if (fiber._debugSource) {
              sourceFile = fiber._debugSource.fileName || '';
              sourceLine = String(fiber._debugSource.lineNumber || '');
              if (compName) break;
            }
            if (!compName && fiber._debugOwner && typeof fiber._debugOwner.type === 'function') {
              compName = fiber._debugOwner.type.displayName || fiber._debugOwner.type.name || '';
            }
            if (!sourceFile && fiber._debugOwner?._debugSource) {
              sourceFile = fiber._debugOwner._debugSource.fileName || '';
              sourceLine = String(fiber._debugOwner._debugSource.lineNumber || '');
            }
            fiber = fiber.return;
          }

          if (sourceFile || compName) {
            // Normaliza o caminho do arquivo para o formato relativo do projeto
            let cleanFile = sourceFile;
            if (cleanFile.includes('src')) {
              cleanFile = 'src' + cleanFile.split('src')[1];
            } else if (cleanFile.includes('components')) {
              cleanFile = 'src/components/' + cleanFile.split('components')[1].replace(/^[\\/]+/, '');
            } else if (cleanFile.includes('app')) {
              cleanFile = 'src/app/' + cleanFile.split('app')[1].replace(/^[\\/]+/, '');
            }

            cleanFile = cleanFile.replace(/\\/g, '/');

            return {
              ...targetInfo,
              file: cleanFile || (compName ? `src/components/${compName}.tsx` : 'src/app/page.tsx'),
              line: sourceLine || '1',
              component: compName || el.tagName.toLowerCase(),
            };
          }
        }
      } catch (err) {
        // Fallback silencioso
      }

      // 3. Fallback inteligente baseado em elementos comuns
      let inferredComponent = 'Page';
      let inferredFile = 'src/app/page.tsx';

      if (el.closest('nav') || el.closest('header')) {
        inferredComponent = 'Navbar';
        inferredFile = 'src/components/Navbar.tsx';
      } else if (el.closest('.glass-card') || el.closest('[data-job-id]')) {
        inferredComponent = 'JobCard';
        inferredFile = 'src/components/JobCard.tsx';
      } else if (el.closest('[data-candidate-id]')) {
        inferredComponent = 'CandidateCard';
        inferredFile = 'src/components/CandidateCard.tsx';
      } else if (el.closest('form') || el.closest('.fixed')) {
        inferredComponent = 'Modal';
        inferredFile = 'src/components/NewMessageSimulatorModal.tsx';
      }

      return {
        ...targetInfo,
        file: inferredFile,
        line: '1',
        component: inferredComponent,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!e.altKey) {
        if (hoverInfo) setHoverInfo(null);
        return;
      }

      const target = e.target as HTMLElement;
      if (target === lastTarget.current && hoverInfo) {
        setHoverInfo((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
        return;
      }

      const metadata = getMetadata(target);
      if (metadata) {
        lastTarget.current = target;
        setHoverInfo({ ...metadata, x: e.clientX, y: e.clientY });
      } else {
        setHoverInfo(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!e.altKey) return;

      const metadata = getMetadata(e.target as HTMLElement);
      if (metadata) {
        e.preventDefault();
        e.stopPropagation();

        // Formato padrão para o assistente: caminho/do/arquivo.tsx:linha
        const textToCopy = `${metadata.file}:${metadata.line}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
          setCopyFeedback(`Localização copiada: ${textToCopy}`);
          setTimeout(() => setCopyFeedback(null), 2500);

          const target = e.target as HTMLElement;
          target.style.outline = '3px solid #10b981';
          target.style.outlineOffset = '2px';
          setTimeout(() => {
            target.style.outline = '';
            target.style.outlineOffset = '';
          }, 600);
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setHoverInfo(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('click', handleClick, true);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hoverInfo]);

  return (
    <>
      {/* Tooltip HUD Flutuante ao segurar ALT */}
      {hoverInfo && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(hoverInfo.x + 16, window.innerWidth - 320),
            top: Math.min(hoverInfo.y + 16, window.innerHeight - 150),
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(16px)',
            color: '#10b981',
            padding: '12px 16px',
            borderRadius: '16px',
            border: '1.5px solid rgba(16, 185, 129, 0.6)',
            zIndex: 99999999,
            fontSize: '11px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            pointerEvents: 'none',
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            minWidth: '240px',
            maxWidth: '340px',
          }}
        >
          {/* Elemento HTML & Classes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span style={{ color: '#34d399', fontWeight: 800 }}>
              &lt;{hoverInfo.tag}{hoverInfo.id}&gt;
            </span>
            {hoverInfo.classes && (
              <span style={{ color: '#64748b', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                .{hoverInfo.classes}
              </span>
            )}
          </div>

          {/* Nome do Componente React */}
          <div
            style={{
              fontSize: '13px',
              fontWeight: 900,
              color: '#f8fafc',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '5px',
              letterSpacing: '-0.02em',
            }}
          >
            {hoverInfo.component}
          </div>

          {/* Caminho do Arquivo & Linha */}
          <div
            style={{
              color: '#94a3b8',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: '3px 6px',
              borderRadius: '6px',
            }}
          >
            <span>📂</span>
            <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>
              {hoverInfo.file.split('/').pop()}
            </span>
            <span style={{ color: '#10b981', fontWeight: 800 }}>:{hoverInfo.line}</span>
          </div>

          <div style={{ marginTop: '2px', color: '#10b981', fontSize: '9px', fontWeight: 'bold', opacity: 0.9 }}>
            ⚡ ALT + BOTÃO ESQUERDO PARA COPIAR
          </div>
        </div>
      )}

      {/* Notificação Visual de Sucesso ao Copiar */}
      {copyFeedback && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#10b981',
            color: '#064e3b',
            padding: '10px 24px',
            borderRadius: '9999px',
            border: '2px solid #34d399',
            zIndex: 999999999,
            fontSize: '12px',
            fontWeight: 900,
            letterSpacing: '0.02em',
            boxShadow: '0 20px 40px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <span>🎯</span>
          <span>{copyFeedback}</span>
        </div>
      )}
    </>
  );
};

export default DeveloperInspector;
