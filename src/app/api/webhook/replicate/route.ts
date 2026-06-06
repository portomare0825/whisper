import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const avatarId = searchParams.get('avatarId');
    const userId = searchParams.get('userId');
    const key = searchParams.get('key');

    if (!avatarId || !userId || !key) {
      console.error('[Replicate-Webhook] Faltan parámetros de metadata (avatarId, userId o key)');
      return NextResponse.json({ error: 'Faltan parámetros de metadata' }, { status: 400 });
    }

    const body = await req.json();
    const { id: jobId, status, output, error } = body;

    console.log(`[Replicate-Webhook] Recibido evento para Predicción ${jobId} | Status: ${status} | Avatar: ${avatarId} | Key: ${key}`);

    if (status !== 'succeeded') {
      console.error(`[Replicate-Webhook] Predicción ${jobId} no se completó satisfactoriamente. Status: ${status}, Error: ${error}`);
      return NextResponse.json({ success: false, error: error || 'Predicción no completada' });
    }

    let imageUrl: string | undefined;
    if (Array.isArray(output)) {
      imageUrl = output[0];
    } else if (typeof output === 'string') {
      imageUrl = output;
    }

    if (!imageUrl) {
      console.error('[Replicate-Webhook] No se encontró URL de imagen en el output:', JSON.stringify(output));
      return NextResponse.json({ error: 'No se encontró una imagen válida en el output' }, { status: 422 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`[Replicate-Webhook] Descargando imagen desde URL: ${imageUrl}`);
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(`Fallo al descargar la imagen de Replicate (${imgResponse.status})`);
    }
    const imgBlob = await imgResponse.blob();

    // Subir a Supabase Storage
    const timestamp = Date.now();
    const fileName = `${userId}/${avatarId}_${key}_${timestamp}.jpg`;
    console.log(`[Replicate-Webhook] Subiendo imagen a Supabase Storage: ${fileName}`);
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, imgBlob, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
    console.log(`[Replicate-Webhook] Imagen disponible en URL pública: ${publicUrl}`);

    // Actualizar la base de datos
    console.log(`[Replicate-Webhook] Actualizando avatar ${avatarId} con ${key} = ${publicUrl}`);
    const { error: updateError } = await supabase
      .from('avatars')
      .update({ [key]: publicUrl })
      .eq('id', avatarId);

    if (updateError) {
      throw updateError;
    }

    console.log(`[Replicate-Webhook] Actualización de avatar ${avatarId} completada para ${key}.`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Replicate-Webhook] Error crítico procesando webhook:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
