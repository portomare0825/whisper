import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const OUTFIT_CHANGE_COST = 10;

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
  } catch (e) {}
  return `PixelAPI respondió con status ${status}: ${errText}`;
}

export async function POST(req: Request) {
  try {
    const { generation_id, conversation_id, avatar_id, prompt, is_free } = await req.json();

    if (!generation_id || !conversation_id || !avatar_id || !prompt) {
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

    // 2. Cliente de Supabase con rol de servicio (admin) para transacciones
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

    // 4. Validar API Key de PixelAPI
    const PIXELAPI_KEY = process.env.PIXELAPI_KEY;
    if (!PIXELAPI_KEY || PIXELAPI_KEY === 'your_pixelapi_key_here') {
      return NextResponse.json({ error: 'PixelAPI no configurada en el servidor' }, { status: 500 });
    }

    // 5. Consultar a PixelAPI
    const pollResponse = await fetch(`https://api.pixelapi.dev/v1/image/${generation_id}`, {
      headers: {
        "Authorization": `Bearer ${PIXELAPI_KEY}`,
      }
    });

    if (!pollResponse.ok) {
      const errText = await pollResponse.text();
      return NextResponse.json({ error: parsePixelAPIError(pollResponse.status, errText) }, { status: 502 });
    }

    const pollResult = await pollResponse.json();
    const status = pollResult.status;

    if (status === 'queued' || status === 'processing') {
      return NextResponse.json({ status });
    }

    if (status === 'failed') {
      return NextResponse.json({ 
        error: `La generación de imagen falló en los servidores de PixelAPI: ${pollResult.error_message || 'Error desconocido'}` 
      }, { status: 422 });
    }

    if (status !== 'completed' || !pollResult.output_url) {
      return NextResponse.json({ 
        error: `Estado de generación desconocido: ${status}` 
      }, { status: 500 });
    }

    const newImageUrl = pollResult.output_url;

    // 6. Si no es gratuito, validar monedas y cobrar
    let finalCoinsBalance = null;
    if (!is_free) {
      const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('coins')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json({ 
          error: 'Perfil de monedas no encontrado para realizar el cobro.',
        }, { status: 404 });
      }

      if (profile.coins < OUTFIT_CHANGE_COST) {
        return NextResponse.json({ 
          error: `Saldo insuficiente. Cambiar el outfit cuesta ${OUTFIT_CHANGE_COST} monedas y tienes ${profile.coins}.`,
          code: 'INSUFFICIENT_COINS',
          current_coins: profile.coins
        }, { status: 403 });
      }

      // Descontar monedas
      const { data: newCoins, error: rpcError } = await adminSupabase.rpc('add_coins', {
        user_id_param: user.id,
        amount: -OUTFIT_CHANGE_COST
      });

      if (rpcError) {
        console.error('Error al descontar monedas RPC:', rpcError);
        return NextResponse.json({ error: 'Error procesando la transacción de monedas' }, { status: 500 });
      }

      finalCoinsBalance = newCoins;
    } else {
      // Si es gratuito, obtener saldo actual para retornarlo
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('coins')
        .eq('id', user.id)
        .maybeSingle();
      finalCoinsBalance = profile?.coins || 0;
    }

    // 7. Guardar en outfit_history
    await adminSupabase.from('outfit_history').insert([
      {
        user_id: user.id,
        avatar_id,
        conversation_id,
        image_url: newImageUrl,
        prompt: prompt.trim()
      }
    ]);

    // 8. Actualizar la imagen actual en la conversación
    const { error: updateConvoError } = await adminSupabase
      .from('conversations')
      .update({ current_avatar_image_url: newImageUrl })
      .eq('id', conversation_id);

    if (updateConvoError) {
      console.error('Error al actualizar current_avatar_image_url en la conversación:', updateConvoError);
    }

    // 9. Registrar la acción física en la conversación como un mensaje narrativo del avatar
    await adminSupabase.from('messages').insert([
      { 
        conversation_id, 
        role: 'avatar', 
        content: `*se ha cambiado de ropa y ahora viste: ${prompt.trim()}*` 
      }
    ]);

    return NextResponse.json({
      status: 'completed',
      new_image_url: newImageUrl,
      new_coins_balance: finalCoinsBalance
    });

  } catch (error: any) {
    console.error('Error en /api/outfit/status:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
