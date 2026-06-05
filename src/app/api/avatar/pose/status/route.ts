import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkFalInpaintingStatus } from '@/lib/fal-inpainting';

const POSE_CHANGE_COST = 10;

// Mapeos en español para los mensajes narrativos en el chat
const EMOTION_DESCRIPTIONS: Record<string, string> = {
  smiling: 'sonriendo alegremente',
  angry: 'con una mirada de enojo y molestia',
  sad: 'con expresión triste y melancólica',
  winking: 'guiñando un ojo de forma pícara',
  neutral: 'seria y pensativa'
};

const POSE_DESCRIPTIONS: Record<string, string> = {
  portrait: 'en primer plano (retrato)',
  medium: 'de medio cuerpo',
  full: 'de cuerpo entero'
};

const EMOTION_LABELS: Record<string, string> = {
  smiling: 'Feliz / Riendo',
  angry: 'Enojada / Molesta',
  sad: 'Triste',
  winking: 'Coqueta / Pícara',
  neutral: 'Seria / Pensativa'
};

const POSE_LABELS: Record<string, string> = {
  portrait: 'Primer Plano',
  medium: 'Medio Cuerpo',
  full: 'Cuerpo Entero'
};

export async function POST(req: Request) {
  try {
    const { generation_id, conversation_id, avatar_id, emotion, pose, is_free } = await req.json();

    if (!generation_id || !conversation_id || !avatar_id || !emotion || !pose) {
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

    let newImageUrl: string;

    // 3. Consultar el estado del trabajo de Fal.ai FLUX Inpainting
    const falResult = checkFalInpaintingStatus({ generationId: generation_id });

      if (falResult.status === 'failed') {
        return NextResponse.json({
          error: falResult.error || 'La generación de pose falló en los servidores de Fal.ai'
        }, { status: 422 });
      }

      if (!falResult.imageUrl) {
        return NextResponse.json({
          error: 'Fal.ai no devolvió una imagen de pose válida'
        }, { status: 500 });
      }

      newImageUrl = falResult.imageUrl;

    // 4. Si no es gratuito, validar monedas y cobrar
    let finalCoinsBalance = null;
    if (!is_free) {
      const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('coins')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json({ 
          error: 'Perfil de monedas no encontrado para realizar el cobro.',
        }, { status: 404 });
      }

      if (profile.coins < POSE_CHANGE_COST) {
        return NextResponse.json({ 
          error: `Saldo insuficiente. Cambiar la pose cuesta ${POSE_CHANGE_COST} monedas y tienes ${profile.coins}.`,
          code: 'INSUFFICIENT_COINS',
          current_coins: profile.coins
        }, { status: 403 });
      }

      // Descontar monedas
      const { data: newCoins, error: rpcError } = await adminSupabase.rpc('add_coins', {
        user_id_param: userId,
        amount: -POSE_CHANGE_COST,
        reason_param: 'pose_change'
      });

      if (rpcError) {
        console.error('Error al descontar monedas RPC:', rpcError);
        return NextResponse.json({ error: 'Error procesando la transacción de monedas' }, { status: 500 });
      }

      finalCoinsBalance = newCoins;
    } else {
      // Si es gratuito, obtener saldo actual
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('coins')
        .eq('id', userId)
        .maybeSingle();
      finalCoinsBalance = profile?.coins || 0;
    }

    // 5. Guardar en el historial de outfits para que aparezca en el Armario/Vestuario
    const promptDescr = `Pose: ${POSE_LABELS[pose] || pose}, Emoción: ${EMOTION_LABELS[emotion] || emotion}`;
    await adminSupabase.from('outfit_history').insert([
      {
        user_id: userId,
        avatar_id,
        conversation_id,
        image_url: newImageUrl,
        prompt: promptDescr
      }
    ]);

    // 6. Actualizar la imagen en la conversación
    const { error: updateConvoError } = await adminSupabase
      .from('conversations')
      .update({ current_avatar_image_url: newImageUrl })
      .eq('id', conversation_id);

    if (updateConvoError) {
      console.error('Error al actualizar current_avatar_image_url:', updateConvoError);
    }

    // 7. Insertar el mensaje narrativo del avatar
    const poseText = POSE_DESCRIPTIONS[pose] || 'en una nueva pose';
    const emotionText = EMOTION_DESCRIPTIONS[emotion] || 'con expresión cambiada';
    const narrativeMessage = `*se muestra ahora ${poseText} y ${emotionText}*`;

    await adminSupabase.from('messages').insert([
      { 
        conversation_id, 
        role: 'avatar', 
        content: narrativeMessage
      }
    ]);

    return NextResponse.json({
      status: 'completed',
      new_image_url: newImageUrl,
      new_coins_balance: finalCoinsBalance
    });

  } catch (error) {
    console.error('Error en /api/avatar/pose/status:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno del servidor' }, { status: 500 });
  }
}
