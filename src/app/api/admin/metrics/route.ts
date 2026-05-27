import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Cliente admin para saltarse RLS si es necesario y contar métricas completas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch (error) {}
          },
        },
      }
    );

    // 1. Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Verificar rol admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de administrador.' }, { status: 403 });
    }

    // --- CÁLCULO DE MÉTRICAS ---
    const now = new Date();
    
    // Fechas de referencia
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // "Conectados recientemente" (actualizados en los últimos 30 minutos)
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000).toISOString();

    // Promesas concurrentes para máxima velocidad
    const [
      { count: totalUsers },
      { count: usersToday },
      { count: usersThisWeek },
      { count: usersThisMonth },
      { count: activeUsers },
      { count: totalAvatars },
      { count: activeConversations },
      { count: totalMessages }
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfWeek),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', thirtyMinutesAgo),
      supabaseAdmin.from('avatars').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabaseAdmin.from('conversations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('messages').select('*', { count: 'exact', head: true })
    ]);

    return NextResponse.json({
      metrics: {
        users: {
          total: totalUsers || 0,
          today: usersToday || 0,
          week: usersThisWeek || 0,
          month: usersThisMonth || 0,
          activeNow: activeUsers || 0,
        },
        avatars: {
          total: totalAvatars || 0,
        },
        chat: {
          conversations: activeConversations || 0,
          messages: totalMessages || 0,
        }
      }
    });

  } catch (error: any) {
    console.error("Error en admin metrics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
