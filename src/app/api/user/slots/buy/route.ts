import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    );

    // 1. Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Cliente admin para ejecutar la función de descuento de monedas y asignación de slot
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Llamar a la función RPC 'buy_avatar_slot'
    const { data: newExtraSlots, error: rpcError } = await adminSupabase.rpc('buy_avatar_slot', {
      user_id_param: user.id
    });

    if (rpcError) {
      console.error('Error al comprar slot adicional RPC:', rpcError);
      return NextResponse.json({ error: rpcError.message || 'Error procesando la transacción de monedas' }, { status: 500 });
    }

    // Obtener saldo de monedas restante
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      extra_avatar_slots: newExtraSlots,
      new_coins_balance: profile?.coins || 0
    });

  } catch (error: any) {
    console.error('Error en /api/user/slots/buy:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
