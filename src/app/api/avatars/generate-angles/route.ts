import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { queueRunPodJob } from '@/lib/runpod';

// Lista de generaciones a realizar (con parámetros ajustados para forzar expresiones)
const GENERATIONS = [
  { key: 'profile_image_url', promptModifier: "side profile view, looking to the side, side face.", start_step: 1, id_weight: 1.0 },
  { key: 'back_image_url', promptModifier: "view from directly behind, showing the back of the head and shoulders, facing away from camera.", start_step: 3, id_weight: 0.9 },
  { key: 'emotion_happy', promptModifier: "EXTREMELY HAPPY, LAUGHING OUT LOUD, HUGE WIDE SMILE, showing teeth, joyous expression, eyes crinkled with laughter.", start_step: 4, id_weight: 0.85 },
  { key: 'emotion_sad', promptModifier: "CRYING, DEEPLY SAD, tears streaming down face, extremely miserable, heartbreaking expression, looking down.", start_step: 4, id_weight: 0.85 },
  { key: 'emotion_angry', promptModifier: "FURIOUS, EXTREMELY ANGRY, screaming, raging, deeply furrowed brows, intense aggressive expression.", start_step: 4, id_weight: 0.85 },
  { key: 'emotion_flirty', promptModifier: "winking expression, playful wink, cute charming smile, friendly flirty look.", start_step: 4, id_weight: 0.85 }
];

// Función de sondeo en segundo plano para entorno local (evita fallos de webhooks en localhost)
async function pollAndSaveReplicate(
  predictionId: string,
  avatarId: string,
  userId: string,
  key: string,
  supabaseUrl: string,
  supabaseKey: string
) {
  console.log(`[Generate-Angles] [Local-Poll] Iniciando sondeo local en background para predicción Replicate: ${predictionId}`);
  let checkReplicateStatus;
  try {
    const replicateLib = await import('@/lib/replicate');
    checkReplicateStatus = replicateLib.checkReplicateStatus;
  } catch (err) {
    console.error('[Generate-Angles] [Local-Poll] Error importando checkReplicateStatus:', err);
    return;
  }

  // Crear cliente Supabase dinámicamente en background
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  let attempts = 0;
  const maxAttempts = 60; // 60 intentos * 4 segundos = 240 segundos (4 minutos)
  const interval = 4000; // 4 segundos

  const timer = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      console.error(`[Generate-Angles] [Local-Poll] Se alcanzó el máximo de intentos para predicción: ${predictionId}`);
      clearInterval(timer);
      return;
    }

    try {
      const statusResult = await checkReplicateStatus(predictionId);
      console.log(`[Generate-Angles] [Local-Poll] Predicción ${predictionId} estado: ${statusResult.status} (intento ${attempts})`);

      if (statusResult.status === 'completed' && statusResult.imageUrl) {
        clearInterval(timer);
        console.log(`[Generate-Angles] [Local-Poll] Predicción ${predictionId} completada. Descargando imagen...`);

        const imgResponse = await fetch(statusResult.imageUrl);
        if (!imgResponse.ok) {
          throw new Error(`Fallo al descargar la imagen (${imgResponse.status})`);
        }
        const imgBlob = await imgResponse.blob();

        const timestamp = Date.now();
        const fileName = `${userId}/${avatarId}_${key}_${timestamp}.webp`;
        console.log(`[Generate-Angles] [Local-Poll] Subiendo imagen a Supabase Storage: ${fileName}`);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, imgBlob, { contentType: 'image/webp', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        console.log(`[Generate-Angles] [Local-Poll] Imagen disponible en URL pública: ${publicUrl}`);

        const { error: updateError } = await supabase
          .from('avatars')
          .update({ [key]: publicUrl })
          .eq('id', avatarId);

        if (updateError) throw updateError;

        console.log(`[Generate-Angles] [Local-Poll] Avatar ${avatarId} actualizado correctamente en DB para ${key}.`);
      } else if (statusResult.status === 'failed') {
        clearInterval(timer);
        console.error(`[Generate-Angles] [Local-Poll] La predicción ${predictionId} falló: ${statusResult.error}`);
      }
    } catch (err) {
      console.error(`[Generate-Angles] [Local-Poll] Error en el intento ${attempts} de sondeo:`, err);
    }
  }, interval);
}

export async function POST(req: Request) {
  try {
    const { avatarId } = await req.json();

    if (!avatarId) {
      return NextResponse.json({ error: 'Falta avatarId' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, base_image_url, physical_description, user_id')
      .eq('id', avatarId)
      .single();

    if (avatarError || !avatar) {
      return NextResponse.json({ error: 'Avatar no encontrado' }, { status: 404 });
    }

    if (!avatar.base_image_url) {
      return NextResponse.json({ error: 'Faltan datos base para generar ángulos' }, { status: 400 });
    }

    const physicalDesc = avatar.physical_description || 'a beautiful young person';

    // Resolver la URL base del webhook de forma dinámica y tolerante a fallos
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host') || '';
    const isHostLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1') || !host;
    
    let webhookBaseUrl = '';
    const protocol = isHostLocal ? 'http' : 'https';
    
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      // Priorizar el host real de la petición en producción
      webhookBaseUrl = `${protocol}://${host}`;
    } else if (process.env.APP_WEBHOOK_URL) {
      webhookBaseUrl = process.env.APP_WEBHOOK_URL.replace(/\/$/, '');
    } else {
      webhookBaseUrl = `${protocol}://${host || 'localhost:3000'}`;
    }

    console.log(`[Generate-Angles] URL base para webhooks resuelta: ${webhookBaseUrl}`);

    // Si RunPod está configurado, usamos la ejecución asíncrona con webhooks
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

    if (RUNPOD_ENDPOINT_ID) {
      console.log(`[Generate-Angles] Usando RunPod Serverless asíncrono para avatar: ${avatarId}`);
      try {
        const { queueRunPodJob } = await import('@/lib/runpod');
        await Promise.all(
          GENERATIONS.map(async (gen) => {
            const finalPrompt = `Highly detailed RAW photography. ${physicalDesc}. The person is wearing a simple white tank top, ${gen.promptModifier}. Photorealistic, 8k resolution, cinematic lighting, no 3d, no illustration, exactly the same person.`;
            
            // Construimos la URL de webhook enviando el contexto en query parameters
            const webhookUrl = `${webhookBaseUrl}/api/webhook/runpod?avatarId=${avatar.id}&userId=${avatar.user_id}&key=${gen.key}`;
            
            // Payload de entrada para el worker de RunPod
            const inputPayload = {
              face_image: avatar.base_image_url,
              prompt: finalPrompt,
              negative_prompt: "cartoon, 3d, painting, illustration, anime, sketch, low quality, worst quality, blurry, deformed face, bad eyes",
              image_size: "portrait_4_3",
              identity_strength: gen.id_weight || 0.85,
              adapter_strength: 0.8,
              key: gen.key // Opcional: pasar la llave al worker
            };

            const job = await queueRunPodJob(inputPayload, webhookUrl);
            console.log(`[Generate-Angles] Job encolado en RunPod para ${gen.key}: ${job.id}`);
          })
        );

        return NextResponse.json({
          success: true,
          message: 'Generación iniciada con éxito en RunPod Serverless (los resultados se recibirán vía webhook).'
        }, { status: 202 });
      } catch (runpodErr: any) {
        console.error('[Generate-Angles] Error iniciando jobs en RunPod:', runpodErr);
        return NextResponse.json({ error: `Fallo al encolar en RunPod: ${runpodErr.message}` }, { status: 500 });
      }
    }

    // Fallback: Si no está configurado RunPod, usamos Replicate o Fal.ai
    const VTON_PROVIDER = process.env.VTON_PROVIDER || 'pixel';

    if (VTON_PROVIDER === 'replicate') {
      const { submitReplicatePose } = await import('@/lib/replicate');
      console.log(`[Generate-Angles] Iniciando generación asíncrona con Replicate para avatar: ${avatarId} | Modo local: ${isHostLocal}`);
      const enqueuedPredictions: { key: string; predictionId: string }[] = [];
      try {
        await Promise.all(
          GENERATIONS.map(async (gen) => {
            const finalPrompt = `The person is wearing a simple white tank top, ${gen.promptModifier}. Photorealistic, 8k resolution, cinematic lighting, no 3d, no illustration, exactly the same person.`;

            const webhookUrl = `${webhookBaseUrl}/api/webhook/replicate?avatarId=${avatar.id}&userId=${avatar.user_id}&key=${gen.key}`;

            const repResult = await submitReplicatePose({
              faceImageUrl: avatar.base_image_url,
              prompt: finalPrompt,
              physicalDescription: physicalDesc,
              width: 768,
              height: 1024,
              isAngle: true,
              webhook: isHostLocal ? undefined : webhookUrl
            });

            if (!repResult.success || !repResult.generationId) {
              throw new Error(`Fallo en Replicate para ${gen.key}: ${repResult.error}`);
            }

            const predId = repResult.generationId.replace('replicate_pose_p_', '');
            console.log(`[Generate-Angles] Encolada predicción Replicate para ${gen.key} con ID: ${predId}`);

            enqueuedPredictions.push({ key: gen.key, predictionId: predId });

            if (isHostLocal) {
              pollAndSaveReplicate(
                predId,
                avatar.id,
                avatar.user_id,
                gen.key,
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              );
            }
          })
        );

        return NextResponse.json({
          success: true,
          message: isHostLocal
            ? 'Generación iniciada con éxito en Replicate (ambiente local detectado: sondeando resultados en background).'
            : 'Generación iniciada con éxito en Replicate (los resultados se recibirán vía webhook).',
          predictions: enqueuedPredictions,
          avatarId: avatar.id,
          userId: avatar.user_id
        }, { status: 202 });
      } catch (bgError: any) {
        console.error('[Generate-Angles] Error crítico al encolar en Replicate:', bgError);
        return NextResponse.json({ error: `Fallo al iniciar generación: ${bgError.message}` }, { status: 500 });
      }
    }

    console.log('[Generate-Angles] RunPod/Replicate no configurado. Usando fallback síncrono de Fal.ai.');
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY no configurada' }, { status: 500 });
    }

    try {
      console.log(`[Generate-Angles] Iniciando generación con Fal.ai para avatar: ${avatarId}`);
      
      const useInstantId = process.env.USE_INSTANT_ID !== 'false';
      console.log(`[Generate-Angles] Usando modelo de Fal.ai: ${useInstantId ? 'fal-ai/instant-id' : 'fal-ai/flux-pulid'}`);

      const results = await Promise.allSettled(
        GENERATIONS.map(async (gen) => {
          const finalPrompt = `Highly detailed RAW photography. ${physicalDesc}. The person is wearing a simple white tank top, ${gen.promptModifier}. Photorealistic, 8k resolution, cinematic lighting, no 3d, no illustration, exactly the same person.`;
          
          const endpoint = useInstantId ? 'https://fal.run/fal-ai/instant-id' : 'https://fal.run/fal-ai/flux-pulid';
          
          const bodyPayload = useInstantId ? {
            face_image_url: avatar.base_image_url,
            prompt: finalPrompt,
            negative_prompt: "cartoon, 3d, painting, illustration, anime, sketch, low quality, worst quality, blurry, deformed face, bad eyes",
            image_size: "portrait_4_3",
            sync_mode: true,
            enable_safety_checker: false,
            disable_safety_checker: true,
            safety_tolerance: 6,
            identity_strength: gen.id_weight || 0.85,
            adapter_strength: 0.8
          } : {
            reference_image_url: avatar.base_image_url,
            prompt: finalPrompt,
            image_size: "portrait_4_3",
            sync_mode: true,
            enable_safety_checker: false,
            disable_safety_checker: true,
            safety_tolerance: 6,
            id_weight: gen.id_weight || 1.0,
            start_step: gen.start_step || 0
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Key ${FAL_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyPayload)
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Error en fal.ai para ${gen.key}: HTTP ${response.status} - ${errText}`);
          }

          let data = await response.json();

          if (data?.has_nsfw_concepts?.[0] === true) {
            console.warn(`[Generate-Angles] Fal.ai detectó contenido NSFW en ángulo ${gen.key}. Reintentando con prompt seguro...`);
            const safePrompt = `A RAW realistic photograph of a young woman, smiling politely, wearing a simple white tank top, neutral background, photorealistic, professional clean lighting, looking at the camera.`;
            const retryResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(useInstantId ? {
                face_image_url: avatar.base_image_url,
                prompt: safePrompt,
                negative_prompt: "cartoon, 3d, painting, illustration, anime, sketch, low quality, worst quality, blurry, deformed face, bad eyes",
                image_size: "portrait_4_3",
                sync_mode: true,
                enable_safety_checker: false,
                disable_safety_checker: true,
                safety_tolerance: 6,
                identity_strength: gen.id_weight || 0.85,
                adapter_strength: 0.8
              } : {
                reference_image_url: avatar.base_image_url,
                prompt: safePrompt,
                image_size: "portrait_4_3",
                sync_mode: true,
                enable_safety_checker: false,
                disable_safety_checker: true,
                safety_tolerance: 6,
                id_weight: gen.id_weight || 1.0,
                start_step: gen.start_step || 0
              })
            });
            if (retryResponse.ok) {
              data = await retryResponse.json();
            }
          }

          let imageUrl = data?.images?.[0]?.url || data?.image?.url || data?.image;

          if (!imageUrl) {
            throw new Error(`Sin imagen en respuesta para ${gen.key}`);
          }

          const imgResponse = await fetch(imageUrl);
          const imgBlob = await imgResponse.blob();
          const timestamp = Date.now();
          const fileName = `${avatar.user_id}/${avatar.id}_${gen.key}_${timestamp}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, imgBlob, { contentType: 'image/jpeg', upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

          return { key: gen.key, url: publicUrl };
        })
      );

      const updates: Record<string, string> = {};
      const errors: string[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          updates[result.value.key] = result.value.url;
        } else {
          const errMsg = result.reason?.message || String(result.reason);
          console.error(`[Generate-Angles] Error generando ángulo:`, errMsg);
          errors.push(errMsg);
        }
      }

      if (Object.keys(updates).length > 0) {
        console.log(`[Generate-Angles] Guardando actualizaciones en DB para ${avatarId}`);
        const { error: updateError } = await supabase
          .from('avatars')
          .update(updates)
          .eq('id', avatarId);

        if (updateError) {
          console.error('[Generate-Angles] Error actualizando DB:', updateError);
          return NextResponse.json({ error: `Error actualizando base de datos con las imágenes generadas: ${updateError.message}` }, { status: 500 });
        } else {
          console.log(`[Generate-Angles] Avatar ${avatarId} actualizado correctamente.`);
        }
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({
          error: `No se pudo generar ninguna imagen de expresiones del avatar. Errores de Fal.ai:\n${errors.join('\n')}`
        }, { status: 500 });
      } else if (errors.length > 0) {
        console.warn(`[Generate-Angles] Se generaron con éxito ${Object.keys(updates).length} de ${GENERATIONS.length} imágenes. Errores en las demás:`, errors);
      }
    } catch (bgError: any) {
      console.error('[Generate-Angles] Error crítico en background:', bgError);
      return NextResponse.json({ error: `Error interno de servidor en generación: ${bgError.message || bgError}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Procesamiento completado' }, { status: 200 });
  } catch (err: any) {
    console.error('Error en generate-angles (main):', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
