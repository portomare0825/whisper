import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkReplicateStatus } from '@/lib/replicate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const predictionId = searchParams.get('predictionId');
    const avatarId = searchParams.get('avatarId');
    const userId = searchParams.get('userId');
    const key = searchParams.get('key');

    if (!predictionId || !avatarId || !userId || !key) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos (predictionId, avatarId, userId, key)' },
        { status: 400 }
      );
    }

    console.log(`[Check-Status] Consultando predicción ${predictionId} para avatar ${avatarId} (${key})`);

    const statusResult = await checkReplicateStatus(predictionId);

    if (statusResult.status === 'completed' && statusResult.imageUrl) {
      // 1. Verificar primero si el campo en la base de datos ya está actualizado
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: avatar } = await supabase
        .from('avatars')
        .select(key)
        .eq('id', avatarId)
        .single();

      if (avatar && avatar[key]) {
        console.log(`[Check-Status] El campo ${key} ya estaba actualizado con la URL: ${avatar[key]}`);
        return NextResponse.json({ status: 'completed', url: avatar[key] });
      }

      // 2. Descargar la imagen
      console.log(`[Check-Status] Descargando imagen de Replicate: ${statusResult.imageUrl}`);
      const imgResponse = await fetch(statusResult.imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Fallo al descargar la imagen de Replicate (${imgResponse.status})`);
      }
      const imgBlob = await imgResponse.blob();

      // 3. Subir a Supabase Storage
      const timestamp = Date.now();
      const fileName = `${userId}/${avatarId}_${key}_${timestamp}.webp`;
      console.log(`[Check-Status] Subiendo a Supabase Storage: ${fileName}`);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, imgBlob, { contentType: 'image/webp', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      console.log(`[Check-Status] Imagen disponible en URL pública: ${publicUrl}`);

      // 4. Actualizar la base de datos
      const { error: updateError } = await supabase
        .from('avatars')
        .update({ [key]: publicUrl })
        .eq('id', avatarId);

      if (updateError) throw updateError;

      console.log(`[Check-Status] Avatar ${avatarId} actualizado correctamente para ${key}.`);
      return NextResponse.json({ status: 'completed', url: publicUrl });
    }

    if (statusResult.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: statusResult.error });
    }

    return NextResponse.json({ status: 'processing' });
  } catch (err: any) {
    console.error('[Check-Status] Error en GET handler:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
