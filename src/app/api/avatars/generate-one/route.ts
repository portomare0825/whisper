import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mapa de configuración de expresiones para cada tipo
const EXPRESSION_CONFIGS: Record<string, { start_step: number; id_weight: number }> = {
  intrigued: { start_step: 4, id_weight: 0.93 },
  excited:   { start_step: 4, id_weight: 0.90 },
  happy:     { start_step: 5, id_weight: 0.95 },
  sad:       { start_step: 5, id_weight: 0.95 },
  angry:     { start_step: 5, id_weight: 0.95 },
  flirty:    { start_step: 4, id_weight: 0.93 },
};

export async function POST(req: Request) {
  try {
    const { avatarId, key, expressionType } = await req.json();

    if (!avatarId || !key || !expressionType) {
      return NextResponse.json({ error: 'Faltan parámetros: avatarId, key, expressionType' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, base_image_url, user_id, physical_description')
      .eq('id', avatarId)
      .single();

    if (avatarError || !avatar || !avatar.base_image_url) {
      return NextResponse.json({ error: 'Avatar no encontrado o sin imagen base' }, { status: 404 });
    }

    const { submitReplicatePose } = await import('@/lib/replicate');

    const config = EXPRESSION_CONFIGS[expressionType] || { start_step: 5, id_weight: 0.93 };

    // Resolver URL base para el webhook
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host') || '';
    const isHostLocal = host.includes('localhost') || host.includes('127.0.0.1') || !host;
    const protocol = isHostLocal ? 'http' : 'https';
    const webhookBaseUrl = `${protocol}://${host || 'localhost:3000'}`;
    const webhookUrl = `${webhookBaseUrl}/api/webhook/replicate?avatarId=${avatar.id}&userId=${avatar.user_id}&key=${key}`;

    const repResult = await submitReplicatePose({
      faceImageUrl: avatar.base_image_url,
      prompt: `Photorealistic, 8k resolution, cinematic lighting, no 3d, no illustration, exactly the same person.`,
      physicalDescription: avatar.physical_description || '',
      width: 768,
      height: 1024,
      isAngle: true,
      webhook: isHostLocal ? undefined : webhookUrl,
      startStep: config.start_step,
      idWeight: config.id_weight,
      expressionType: expressionType as any,
    });

    if (!repResult.success || !repResult.generationId) {
      const errMsg = repResult.error || 'Error encolando en Replicate';
      // Detectar throttle 429 y retornarlo correctamente para que el cliente pueda esperar
      const isThrottle = errMsg.includes('429') || errMsg.toLowerCase().includes('throttled') || errMsg.toLowerCase().includes('rate limit');
      if (isThrottle) {
        // Extraer retry_after si está disponible en el mensaje
        const retryMatch = errMsg.match(/"retry_after"\s*:\s*(\d+)/);
        const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 10;
        console.warn(`[Generate-One] Throttle de Replicate para ${key}. retry_after: ${retryAfter}s`);
        return NextResponse.json({ error: errMsg, throttled: true, retry_after: retryAfter }, { status: 429 });
      }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const predictionId = repResult.generationId.replace('replicate_pose_p_', '');
    console.log(`[Generate-One] Predicción encolada OK: ${predictionId} para ${key}`);

    return NextResponse.json({ success: true, predictionId }, { status: 202 });
  } catch (err: any) {
    console.error('[Generate-One] Error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
