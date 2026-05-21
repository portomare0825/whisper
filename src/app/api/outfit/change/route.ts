import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const OUTFIT_CHANGE_COST = 10;

export async function POST(req: Request) {
  try {
    const { conversation_id, avatar_id, prompt } = await req.json();

    if (!conversation_id || !avatar_id || !prompt) {
      return NextResponse.json({ error: 'Parámetros insuficientes' }, { status: 400 });
    }

    // 1. Obtener usuario de la sesión
    const cookieStore = await cookies();
    const clientSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await clientSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Cliente de Supabase con rol de servicio (admin) para modificar monedas y acceder a tablas protegidas
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Verificar que la conversación le pertenezca al usuario autenticado
    const { data: conversation, error: convoError } = await adminSupabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single();

    if (convoError || !conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada o acceso denegado' }, { status: 404 });
    }

    // 4. Obtener la imagen base del avatar
    const { data: avatar, error: avatarError } = await adminSupabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (avatarError || !avatar) {
      return NextResponse.json({ error: 'Avatar no encontrado' }, { status: 404 });
    }

    // 5. Verificar saldo de monedas
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ 
        error: 'No se encontró un perfil de monedas para tu usuario. Asegúrate de tener un perfil inicializado.',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    if (profile.coins < OUTFIT_CHANGE_COST) {
      return NextResponse.json({ 
        error: `Saldo insuficiente. Cambiar el outfit cuesta ${OUTFIT_CHANGE_COST} monedas y solo tienes ${profile.coins}.`,
        code: 'INSUFFICIENT_COINS',
        current_coins: profile.coins
      }, { status: 403 });
    }

    // 6. Validar API Key de PixelAPI
    const PIXELAPI_KEY = process.env.PIXELAPI_KEY;
    if (!PIXELAPI_KEY || PIXELAPI_KEY === 'your_pixelapi_key_here') {
      return NextResponse.json({ error: 'PixelAPI no configurada en el servidor' }, { status: 500 });
    }

    // 7. Llamar a PixelAPI (FireRed-Edit) con polling
    let newImageUrl = null;
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
        throw new Error(`PixelAPI respondió con status ${submitResponse.status}: ${errText}`);
      }

      const submitResult = await submitResponse.json();
      const generationId = submitResult.id;

      if (!generationId) {
        throw new Error('PixelAPI no devolvió un ID de generación válido');
      }

      // Polling para esperar la finalización del trabajo
      let status = submitResult.status;
      let attempts = 0;
      const maxAttempts = 30; // 60 segundos máx. (30 * 2s)

      while ((status === 'queued' || status === 'processing') && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;

        const pollResponse = await fetch(`https://api.pixelapi.dev/v1/image/${generationId}`, {
          headers: {
            "Authorization": `Bearer ${PIXELAPI_KEY}`,
          }
        });

        if (pollResponse.ok) {
          const pollResult = await pollResponse.json();
          status = pollResult.status;
          if (status === 'completed') {
            newImageUrl = pollResult.output_url;
            break;
          } else if (status === 'failed') {
            throw new Error(`La generación de PixelAPI falló: ${pollResult.error_message || 'Error desconocido'}`);
          }
        } else {
          console.error(`Error al consultar estado de PixelAPI (status ${pollResponse.status})`);
        }
      }

      if (status !== 'completed' || !newImageUrl) {
        throw new Error(`La generación de la imagen expiró o falló (estado final: ${status})`);
      }
    } catch (err: any) {
      console.error('PixelAPI Error:', err);
      return NextResponse.json({ error: `Error de generación de imagen: ${err.message}` }, { status: 502 });
    }

    // 8. Descontar las monedas atómicamente utilizando RPC
    const { data: newCoins, error: rpcError } = await adminSupabase.rpc('add_coins', {
      user_id_param: user.id,
      amount: -OUTFIT_CHANGE_COST
    });

    if (rpcError) {
      console.error('Error al descontar monedas RPC:', rpcError);
    }

    // 9. Actualizar la imagen actual en la conversación
    const { error: updateConvoError } = await adminSupabase
      .from('conversations')
      .update({ current_avatar_image_url: newImageUrl })
      .eq('id', conversation_id);

    if (updateConvoError) {
      console.error('Error al actualizar current_avatar_image_url en la conversación:', updateConvoError);
    }

    // 10. Guardar en el historial de outfits (vestuario/galería)
    await adminSupabase.from('outfit_history').insert([
      {
        user_id: user.id,
        avatar_id,
        conversation_id,
        image_url: newImageUrl,
        prompt: prompt.trim()
      }
    ]);

    // 11. Registrar la acción física en la conversación como un mensaje narrativo del avatar
    await adminSupabase.from('messages').insert([
      { 
        conversation_id, 
        role: 'avatar', 
        content: `*se ha cambiado de ropa y ahora viste: ${prompt.trim()}*` 
      }
    ]);

    return NextResponse.json({
      success: true,
      new_image_url: newImageUrl,
      new_coins_balance: newCoins !== null ? newCoins : (profile.coins - OUTFIT_CHANGE_COST)
    });

  } catch (error: any) {
    console.error('Error en /api/outfit/change:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
