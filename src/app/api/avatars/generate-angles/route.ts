import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lista de generaciones a realizar
const GENERATIONS = [
  { key: 'profile_image_url', promptModifier: "side profile view, looking to the side, capturing the exact same facial structure and clothing." },
  { key: 'back_image_url', promptModifier: "view from behind, showing the back of the head and shoulders, same clothing." },
  { key: 'emotion_happy', promptModifier: "smiling brightly, happy expression, joyful, glowing with happiness, looking at camera." },
  { key: 'emotion_sad', promptModifier: "sad expression, melancholy, tears in eyes, looking down slightly, emotional." },
  { key: 'emotion_angry', promptModifier: "angry expression, furious, intense gaze, furrowed brows, upset." },
  { key: 'emotion_flirty', promptModifier: "flirty expression, seductive gaze, biting lower lip slightly, charming smile, alluring." }
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

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY no configurada' }, { status: 500 });
    }

    // Ejecutar la generación en segundo plano para no bloquear al cliente
    // y evitar que el navegador cancele la petición al hacer router.push()
    (async () => {
      try {
        console.log(`[Generate-Angles] Iniciando generación para avatar: ${avatarId}`);
        const results = await Promise.allSettled(
          GENERATIONS.map(async (gen) => {
            const finalPrompt = `Highly detailed RAW photography. ${avatar.physical_description}. The person is ${gen.promptModifier}. Photorealistic, 8k resolution, cinematic lighting, no 3d, no illustration, exactly the same person.`;
            
            const response = await fetch('https://fal.run/fal-ai/flux-pulid', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                reference_image_url: avatar.base_image_url,
                prompt: finalPrompt,
                image_size: "portrait_4_3",
                sync_mode: true,
                enable_safety_checker: false
              })
            });

            if (!response.ok) {
              throw new Error(`Error en fal.ai para ${gen.key}: ${response.status}`);
            }

            const data = await response.json();
            let imageUrl = data?.images?.[0]?.url || data?.image?.url || data?.image;

            if (!imageUrl) {
              throw new Error(`Sin imagen en respuesta para ${gen.key}`);
            }

            const imgResponse = await fetch(imageUrl);
            const imgBlob = await imgResponse.blob();
            const fileName = `${avatar.user_id}/${avatar.id}_${gen.key}.jpg`;

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
      }
    })();

    // Responder inmediatamente para que el cliente pueda navegar a /dashboard sin cancelar el fetch
    return NextResponse.json({ success: true, message: 'Procesamiento en segundo plano iniciado' }, { status: 202 });
  } catch (err: any) {
    console.error('Error en generate-angles (main):', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
