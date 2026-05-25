import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
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

    const { subscription } = await req.json();
    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
    }

    // Usar el cliente con service role para realizar el upsert de forma segura
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Intentar buscar si ya existe la suscripción idéntica para este usuario
    const { data: existing } = await adminSupabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('subscription', JSON.stringify(subscription))
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, message: 'Suscripción ya registrada' });
    }

    // Si no existe, insertarla
    const { error: insertError } = await adminSupabase
      .from('push_subscriptions')
      .insert({
        user_id: user.id,
        subscription: subscription
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true, message: 'Suscripción registrada con éxito' });

  } catch (error: any) {
    console.error('Error en /api/notifications/subscribe:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
