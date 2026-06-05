import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const avatarId = searchParams.get('avatarId');
    const userId = searchParams.get('userId');
    const key = searchParams.get('key');

    if (!avatarId || !userId || !key) {
      console.error('[RunPod-Webhook] Faltan parámetros de metadata (avatarId, userId o key)');
      return NextResponse.json({ error: 'Faltan parámetros de metadata' }, { status: 400 });
    }

    const body = await req.json();
    const { id: jobId, status, output, error } = body;

    console.log(`[RunPod-Webhook] Recibido evento para Job ${jobId} | Status: ${status} | Avatar: ${avatarId} | Key: ${key}`);

    if (status !== 'COMPLETED') {
      console.error(`[RunPod-Webhook] Job ${jobId} no se completó satisfactoriamente. Status: ${status}, Error: ${error}`);
      return NextResponse.json({ success: false, error: error || 'Job no completado' });
    }

    // Obtener la URL de la imagen o los datos en base64 del output de RunPod.
    // Cubrimos tanto URLs públicas como datos Base64 devueltos por plantillas ComfyUI.
    let base64Data: string | undefined;
    let imageUrl: string | undefined;

    // Si viene output.message con formato data:image/png;base64,...
    if (output?.message && typeof output.message === 'string') {
      if (output.message.startsWith('data:image/')) {
        base64Data = output.message.split(',')[1];
      } else if (output.message.startsWith('http://') || output.message.startsWith('https://')) {
        imageUrl = output.message;
      } else {
        base64Data = output.message;
      }
    } else if (output?.image_url) {
      imageUrl = output.image_url;
    } else if (output?.images?.[0]?.url) {
      imageUrl = output.images[0].url;
    } else if (output?.images?.[0]) {
      imageUrl = output.images[0];
    } else if (typeof output === 'string') {
      if (output.startsWith('http://') || output.startsWith('https://')) {
        imageUrl = output;
      } else if (output.startsWith('data:image/')) {
        base64Data = output.split(',')[1];
      } else {
        base64Data = output;
      }
    }

    if (!imageUrl && !base64Data) {
      console.error('[RunPod-Webhook] No se encontró URL de imagen ni datos Base64 en el output:', JSON.stringify(output));
      return NextResponse.json({ error: 'No se encontró una imagen válida en el output' }, { status: 422 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let imgBlob: Blob;

    if (base64Data) {
      console.log('[RunPod-Webhook] Decodificando imagen desde formato Base64...');
      const buffer = Buffer.from(base64Data, 'base64');
      imgBlob = new Blob([buffer], { type: 'image/jpeg' });
    } else {
      console.log(`[RunPod-Webhook] Descargando imagen desde URL: ${imageUrl}`);
      const imgResponse = await fetch(imageUrl!);
      if (!imgResponse.ok) {
        throw new Error(`Fallo al descargar la imagen de RunPod (${imgResponse.status})`);
      }
      imgBlob = await imgResponse.blob();
    }

    // 2. Subir a Supabase Storage
    const timestamp = Date.now();
    const fileName = `${userId}/${avatarId}_${key}_${timestamp}.jpg`;
    console.log(`[RunPod-Webhook] Subiendo imagen a Supabase Storage: ${fileName}`);
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, imgBlob, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
    console.log(`[RunPod-Webhook] Imagen disponible en URL pública: ${publicUrl}`);

    // 3. Actualizar la base de datos
    console.log(`[RunPod-Webhook] Actualizando avatar ${avatarId} con ${key} = ${publicUrl}`);
    const { error: updateError } = await supabase
      .from('avatars')
      .update({ [key]: publicUrl })
      .eq('id', avatarId);

    if (updateError) {
      throw updateError;
    }

    console.log(`[RunPod-Webhook] Actualización de avatar ${avatarId} completada para ${key}.`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[RunPod-Webhook] Error crítico procesando webhook:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
