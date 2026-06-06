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

    if (!avatar.base_image_url || !avatar.physical_description) {
      return NextResponse.json({ error: 'Faltan datos base para generar ángulos' }, { status: 400 });
    }



    // Si RunPod está configurado, usamos la ejecución asíncrona con webhooks
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
    const APP_WEBHOOK_URL = process.env.APP_WEBHOOK_URL;

    if (RUNPOD_ENDPOINT_ID && APP_WEBHOOK_URL) {
      console.log(`[Generate-Angles] Usando RunPod Serverless asíncrono para avatar: ${avatarId}`);
      try {
        const { queueRunPodJob } = await import('@/lib/runpod');
        await Promise.all(
          GENERATIONS.map(async (gen) => {
            const finalPrompt = `Highly detailed RAW photography. ${avatar.physical_description}. The person is wearing a simple white tank top, ${gen.promptModifier}. Photorealistic, 8k resolution, cinematic lighting, no 3d, no illustration, exactly the same person.`;
            
            // Construimos la URL de webhook enviando el contexto en query parameters
            const webhookUrl = `${APP_WEBHOOK_URL.replace(/\/$/, '')}/api/webhook/runpod?avatarId=${avatar.id}&userId=${avatar.user_id}&key=${gen.key}`;
            
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

    // Fallback: Si no está configurado RunPod, usamos fal.ai de forma síncrona
    console.log('[Generate-Angles] RunPod no configurado. Usando fallback síncrono de Fal.ai.');
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY no configurada' }, { status: 500 });
    }

    try {
      console.log(`[Generate-Angles] Iniciando generación con Fal.ai para avatar: ${avatarId}`);
      
      const useInstantId = process.env.USE_INSTANT_ID !== 'false';
      console.log(`[Generate-Angles] Usando modelo de Fal.ai: ${useInstantId ? 'fal-ai/instantid' : 'fal-ai/flux-pulid'}`);

      const results = await Promise.allSettled(
        GENERATIONS.map(async (gen) => {
          const finalPrompt = `Highly detailed RAW photography. ${avatar.physical_description}. The person is wearing a simple white tank top, ${gen.promptModifier}. Photorealistic, 8k resolution, cinematic lighting, no 3d, no illustration, exactly the same person.`;
          
          const endpoint = useInstantId ? 'https://fal.run/fal-ai/instantid' : 'https://fal.run/fal-ai/flux-pulid';
          
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
            throw new Error(`Error en fal.ai para ${gen.key}: ${response.status}`);
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
      for (const result of results) {
        if (result.status === 'fulfilled') {
          updates[result.value.key] = result.value.url;
        } else {
          console.error(`[Generate-Angles] Error generando ángulo:`, result.reason);
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
        } else {
          console.log(`[Generate-Angles] Avatar ${avatarId} actualizado correctamente.`);
        }
      }
    } catch (bgError) {
      console.error('[Generate-Angles] Error crítico en background:', bgError);
      return NextResponse.json({ error: 'Error interno en generación' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Procesamiento completado' }, { status: 200 });
  } catch (err: any) {
    console.error('Error en generate-angles (main):', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
