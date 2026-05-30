import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const src = "C:\\Users\\adm-09\\.gemini\\antigravity-ide\\brain\\2c40802f-913d-446c-8f18-ccb8f5647d4e\\media__1780153380659.jpg";
    const dest = path.join(process.cwd(), 'public', 'pago_movil_qr.jpg');
    
    // Asegurar que exista la carpeta public
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.copyFileSync(src, dest);
    return NextResponse.json({ success: true, message: '¡Imagen de Pago Móvil copiada con éxito!' });
  } catch (err: any) {
    console.error('Error al copiar QR desde API:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
