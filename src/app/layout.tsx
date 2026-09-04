import type { Metadata } from 'next';
import './globals.css';
import { DeveloperInspector } from '@/components/DeveloperInspector';

export const metadata: Metadata = {
  title: 'WhatsGestores - Portal de Vagas e Banco de Talentos',
  description: 'Plataforma inteligente de vagas e currículos integrada a grupos de WhatsApp com inteligência artificial.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100">
        <DeveloperInspector />
        {children}
      </body>
    </html>
  );
}
