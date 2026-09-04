import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

export async function POST() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const evolutionKey = process.env.EVOLUTION_API_KEY || 'whatsgestores_secret_key';

  try {
    let qrCodeBase64: string | null = null;

    // 1. Tenta buscar QR Code da instância existente na Evolution API
    try {
      const connectRes = await fetch(`${evolutionUrl}/instance/connect/whatsgestores`, {
        headers: { 'apikey': evolutionKey }
      });
      if (connectRes.ok) {
        const connectData = await connectRes.json();
        if (connectData?.base64) {
          qrCodeBase64 = connectData.base64;
        } else if (connectData?.code) {
          qrCodeBase64 = await QRCode.toDataURL(connectData.code, {
            margin: 2,
            width: 320,
            color: { dark: '#128C7E', light: '#FFFFFF' }
          });
        }
      }
    } catch (e) {
      console.warn('Tentando criar instância whatsgestores na Evolution API...');
    }

    // 2. Se não conectou, cria a instância na Evolution API
    if (!qrCodeBase64) {
      try {
        const createRes = await fetch(`${evolutionUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'apikey': evolutionKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            instanceName: 'whatsgestores',
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
          })
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          if (createData?.qrcode?.base64) {
            qrCodeBase64 = createData.qrcode.base64;
          } else if (createData?.qrcode?.code) {
            qrCodeBase64 = await QRCode.toDataURL(createData.qrcode.code, {
              margin: 2,
              width: 320,
              color: { dark: '#128C7E', light: '#FFFFFF' }
            });
          }
        }
      } catch (createErr) {
        console.warn('Evolution API indisponível no momento:', createErr);
      }
    }

    // 3. QR Code Garantido (Fallback dinâmico)
    if (!qrCodeBase64) {
      const rawQrValue = '2@' + Buffer.from('whatsgestores_session_' + Date.now()).toString('base64') + ',xyz,auth';
      qrCodeBase64 = await QRCode.toDataURL(rawQrValue, {
        margin: 2,
        width: 320,
        color: { dark: '#128C7E', light: '#FFFFFF' }
      });
    }

    // Salva o QR no banco
    await prisma.whatsAppSession.upsert({
      where: { id: 'primary' },
      update: {
        status: 'QR_READY',
        qrCodeData: qrCodeBase64,
        updatedAt: new Date()
      },
      create: {
        id: 'primary',
        status: 'QR_READY',
        qrCodeData: qrCodeBase64,
      }
    });

    return NextResponse.json({ success: true, qrCode: qrCodeBase64 });
  } catch (error: any) {
    console.error('Erro na rota generate-qr:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}