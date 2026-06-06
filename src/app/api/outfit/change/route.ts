import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { submitFalVTON, parseFalAPIError } from '@/lib/fal-vton';
import { generatePosePremium } from '@/lib/fal-instantid';
import { ESTILOS_PREMIUM } from '@/lib/constants/catalog';
import { submitReplicatePose, submitReplicateVTON } from '@/lib/replicate';

const OUTFIT_CHANGE_COST = 10;
const OUTFIT_CHANGE_PREMIUM_COST = 15;

export async function POST(req: Request) {
  try {
    const { conversation_id, avatar_id, prompt, action = 'outfit_change', premium_style_id, complexion } = await req.json();

    if (!conversation_id || !avatar_id || (!prompt && action === 'outfit_change') || (!premium_style_id && action === 'pose_change')) {
      return NextResponse.json({ error: 'Parámetros insuficientes' }, { status: 400 });
    }

    // 1. Cliente de Supabase con rol de servicio (admin) para modificar monedas y acceder a tablas protegidas
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Obtener la conversación para verificar a qué usuario pertenece
    const { data: conversation, error: convoError } = await adminSupabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convoError || !conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const userId = conversation.user_id;

    // 3. Obtener la imagen base del avatar
    const { data: avatar, error: avatarError } = await adminSupabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (avatarError || !avatar) {
      return NextResponse.json({ error: 'Avatar no encontrado' }, { status: 404 });
    }

    // 4. Verificar saldo de monedas
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({
        error: 'No se encontró un perfil de monedas para tu usuario. Asegúrate de tener un perfil inicializado.',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    const isPremium = action === 'pose_change';
    const currentCost = isPremium ? OUTFIT_CHANGE_PREMIUM_COST : OUTFIT_CHANGE_COST;

    if (profile.coins < currentCost) {
      return NextResponse.json({
        error: `Saldo insuficiente. Esta acción cuesta ${currentCost} monedas y solo tienes ${profile.coins}.`,
        code: 'INSUFFICIENT_COINS',
        current_coins: profile.coins
      }, { status: 403 });
    }


    // 6. Ejecutar la acción correspondiente (Replicate o Fal.ai)
    const VTON_PROVIDER = process.env.VTON_PROVIDER || 'pixel';

    if (isPremium) {
      const estilo = ESTILOS_PREMIUM.find(e => e.id === premium_style_id);
      if (!estilo) {
        return NextResponse.json({ error: 'Estilo premium no encontrado en el catálogo' }, { status: 400 });
      }

      if (VTON_PROVIDER === 'replicate') {
        const repResult = await submitReplicatePose({
          faceImageUrl: avatar.base_image_url,
          prompt: estilo.prompt_base,
          complexion: complexion,
          physicalDescription: avatar.physical_description || ''
        });

        if (!repResult.success) {
          return NextResponse.json({ error: repResult.error }, { status: 502 });
        }

        return NextResponse.json({
          success: true,
          status: 'queued',
          generation_id: repResult.generationId
        });
      } else {
        const falResult = await generatePosePremium({
          faceImageUrl: avatar.base_image_url,
          templatePoseUrl: estilo.imagen_plantilla,
          basePrompt: estilo.prompt_base,
          complexion: complexion,
          physicalDescription: avatar.physical_description || ''
        });

        if (!falResult.success) {
          return NextResponse.json({ error: falResult.error }, { status: 502 });
        }

        return NextResponse.json({
          success: true,
          status: 'queued',
          generation_id: falResult.generationId
        });
      }
    }

    // 7. Obtener el proveedor de VTON configurado (Flujo clásico)
    if (VTON_PROVIDER === 'replicate') {
      try {
        const repResult = await submitReplicateVTON({
          humanImageUrl: avatar.base_image_url,
          description: prompt.trim(),
        });

        if (!repResult.success) {
          return NextResponse.json({ error: repResult.error }, { status: 502 });
        }

        return NextResponse.json({
          success: true,
          status: 'queued',
          generation_id: repResult.generationId
        });
      } catch (err: any) {
        console.error('Replicate VTON Error:', err);
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
    }

    // --- Fal.ai IDM-VTON (nuevo proveedor) ---
    if (VTON_PROVIDER === 'fal') {
      try {
        const falResult = await submitFalVTON({
          humanImageUrl: avatar.base_image_url,
          description: prompt.trim(),
        });

        if (!falResult.success) {
          return NextResponse.json({ error: falResult.error }, { status: 502 });
        }

        return NextResponse.json({
          success: true,
          status: 'queued',
          generation_id: falResult.generationId
        });

      } catch (err: any) {
        console.error('Fal.ai VTON Error:', err);
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
    }

    // --- PixelAPI (proveedor original / fallback) ---
    // Validar API Key de PixelAPI
    const PIXELAPI_KEY = process.env.PIXELAPI_KEY;
    if (!PIXELAPI_KEY || PIXELAPI_KEY === 'your_pixelapi_key_here') {
      return NextResponse.json({ error: 'PixelAPI no configurada en el servidor' }, { status: 500 });
    }

    function parsePixelAPIError(status: number, errText: string): string {
      try {
        const parsed = JSON.parse(errText);
        if (parsed.detail) {
          if (typeof parsed.detail === 'object' && parsed.detail.message) {
            let msg = parsed.detail.message;
            if (msg.includes("recovering from a memory pressure event")) {
              const retryMatch = msg.match(/about (\d+)s/);
              const seconds = retryMatch ? `${retryMatch[1]} segundos` : "unos minutos";
              return `El motor de inteligencia artificial de PixelAPI se está reiniciando temporalmente por mantenimiento técnico. Por favor, vuelve a intentarlo en aproximadamente ${seconds}. No se han descontado tus monedas del saldo.`;
            }
            return msg;
          }
          return typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
        if (parsed.error_message) return parsed.error_message;
        if (parsed.message) return parsed.message;
      } catch (e) { }

      if (status === 502 || status === 503) {
        return `El proveedor de generación de imágenes está temporalmente saturado o en mantenimiento (Error ${status}). Por favor, intenta de nuevo en unos minutos. No se han descontado tus monedas.`;
      }

      return `PixelAPI respondió con status ${status}: ${errText}`;
    }

    // --- PixelAPI FireRed-Edit (proveedor original) ---
    try {
      const submitResponse = await fetch("https://api.pixelapi.dev/v1/image/edit", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PIXELAPI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "image": avatar.base_image_url,
          "prompt": prompt.trim(),
          "negative_prompt": "nude, naked, explicit, blur, low quality, distorted",
        })
      });

      if (!submitResponse.ok) {
        const errText = await submitResponse.text();
        throw new Error(parsePixelAPIError(submitResponse.status, errText));
      }

      const submitResult = await submitResponse.json();
      const generationId = submitResult.id;

      if (!generationId) {
        throw new Error('PixelAPI no devolvió un ID de generación válido');
      }

      return NextResponse.json({
        success: true,
        status: submitResult.status || 'queued',
        generation_id: generationId
      });

    } catch (err: any) {
      console.error('PixelAPI Error:', err);
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Error en /api/outfit/change:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

