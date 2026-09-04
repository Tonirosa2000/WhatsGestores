import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const rawQrValue = '2@' + Buffer.from('whatsgestores_session_' + Date.now()).toString('base64') + ',xyz,auth';
    const qrImageBase64 = await QRCode.toDataURL(rawQrValue, {
      margin: 2,
      width: 320,
      color: {
        dark: '#128C7E',
        light: '#FFFFFF'
      }
    });

    await prisma.whatsAppSession.upsert({
      where: { id: 'primary' },
      update: {
        status: 'QR_READY',
        qrCodeData: qrImageBase64,
        updatedAt: new Date()
      },
      create: {
        id: 'primary',
        status: 'QR_READY',
        qrCodeData: qrImageBase64,
      }
    });

    return NextResponse.json({ success: true, qrCode: qrImageBase64 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
