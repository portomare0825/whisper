import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const POSE_CHANGE_COST = 10;


export async function POST(req: Request) {
  try {
    const { conversation_id, avatar_id, emotion, pose, mask_image, normalized_image, outfit_hint } = await req.json();

    if (!conversation_id || !avatar_id || !emotion || !pose) {
      return NextResponse.json({ error: 'Parámetros insuficientes' }, { status: 400 });
    }

    // 1. Cliente de Supabase con rol de servicio (admin)
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

    // 3. Obtener el avatar para acceder a su imagen base y personalidad
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
        error: 'No se encontró un perfil de monedas para tu usuario.',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    if (profile.coins < POSE_CHANGE_COST) {
      return NextResponse.json({
        error: `Saldo insuficiente. Cambiar la pose cuesta ${POSE_CHANGE_COST} monedas y solo tienes ${profile.coins}.`,
        code: 'INSUFFICIENT_COINS',
        current_coins: profile.coins
      }, { status: 403 });
    }

    // 5. Enriquecer el prompt inteligentemente con Google Gemini
    // Gemini analiza el estilo de ropa del avatar, la emoción y la pose para generar el prompt perfecto de moda
    const styleDescription = avatar.personality 
      ? `A beautiful young woman matching style: ${avatar.personality}` 
      : 'A stylish and elegant young woman';

    // Descripción física del avatar: pelo, ojos, piel — obligatoria para que FLUX respete la identidad
    const physicalDescription = avatar.physical_description || '';
      
    const { enrichPosePrompt } = await import('@/lib/prompt-enricher');
    const finalPrompt = await enrichPosePrompt({
      avatarName: avatar.name,
      pose,
      emotion,
      styleDescription,
      outfitHint: outfit_hint || undefined,
      physicalDescription: physicalDescription || undefined
    });


    // 6. Iniciar la generación usando FLUX Inpainting para mantener el rostro intacto al 100%
    // Si no hay máscara, cae en el fallback de pose y face swap oficial
    const { submitFalInpainting, submitFalPoseWithFaceSwap } = await import('@/lib/fal-inpainting');
    
    console.log(`Usando generación de pose libre con FLUX Dev + Face Swap oficial de Fal.ai para consistencia absoluta del rostro (${pose}).`);
    falResult = await submitFalPoseWithFaceSwap({
      baseImage: normalized_image || avatar.base_image_url,
      prompt: finalPrompt,
      physicalDescription: physicalDescription || undefined,
    });


    if (!falResult.success) {
      return NextResponse.json({ error: falResult.error }, { status: 502 });
    }

    // 7. Responder con el ID del trabajo en estado de cola (polling)
    return NextResponse.json({
      success: true,
      status: 'queued',
      generation_id: falResult.generationId
    });

  } catch (err) {
    console.error('Error en /api/avatar/pose:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno del servidor' }, { status: 500 });
  }
}
