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
      { count: totalMessages },
      { data: dbSizeResult },
      { data: financialResult }
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfWeek),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', thirtyMinutesAgo),
      supabaseAdmin.from('avatars').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabaseAdmin.from('conversations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }),
      supabaseAdmin.rpc('get_database_size'),
      supabaseAdmin.rpc('get_admin_financials')
    ]);

    const dbBytes = dbSizeResult && dbSizeResult[0] ? dbSizeResult[0].total_bytes : 0;
    const dbPretty = dbSizeResult && dbSizeResult[0] ? dbSizeResult[0].total_pretty : '0 B';
    // Límite gratuito de Supabase: 500 MB (524,288,000 bytes)
    const limitBytes = 524288000;
    const percentUsed = Number(((dbBytes / limitBytes) * 100).toFixed(2));

    const finData = financialResult && financialResult[0] ? financialResult[0] : {
      total_coins_remaining: 0,
      total_coins_sold: 0,
      total_coins_used: 0,
      active_subscribers: 0
    };

    // Resguardo inteligente para el histórico si la tabla de transacciones es nueva
    const coinsSold = finData.total_coins_sold > 0 
      ? finData.total_coins_sold 
      : finData.total_coins_remaining;

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
        },
        db: {
          bytes: dbBytes,
          pretty: dbPretty,
          limitBytes: limitBytes,
          percentUsed: percentUsed > 100 ? 100 : percentUsed
        },
        financials: {
          coinsRemaining: finData.total_coins_remaining,
          coinsSold: coinsSold,
          coinsUsed: finData.total_coins_used,
          activeSubscribers: finData.active_subscribers
        }
      }
    });

  } catch (error: any) {
    console.error("Error en admin metrics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
