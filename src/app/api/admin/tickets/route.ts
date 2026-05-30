import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { type, value, price_label, expires_in_days } = await req.json();

    if (!type || !['daily_pass', 'coins'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de ticket inválido (debe ser daily_pass o coins)' }, { status: 400 });
    }

    // 1. Obtener al usuario autenticado de forma segura
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
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Conectar como Administrador para consultar RLS
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Verificar si el usuario es administrador real
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_admin) {
      console.warn(`[TICKETS ADMIN] Intento de acceso no autorizado de ${user.email}`);
      return NextResponse.json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' }, { status: 403 });
    }

    // 4. Generar código de ticket único y elegante
    const randomSegment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = type === 'daily_pass' ? 'VIP' : 'COIN';
    const code = `${prefix}-${randomSegment()}-${randomSegment()}`;

    // 5. Calcular fecha de vencimiento
    let expiresAt = null;
    if (expires_in_days && Number(expires_in_days) > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(expires_in_days));
    }

    // 6. Insertar en la base de datos
    const { data: newTicket, error: insertError } = await adminSupabase
      .from('tickets')
      .insert({
        code,
        type,
        value: Number(value) || 1,
        price_label: price_label || (type === 'daily_pass' ? '$3 USD' : '$5 USD'),
        expires_at: expiresAt ? expiresAt.toISOString() : null
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error al insertar ticket:', insertError);
      return NextResponse.json({ error: `Error al guardar el ticket: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ticket: newTicket
    });

  } catch (error: any) {
    console.error('Error en /api/admin/tickets:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(req: Request) {
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
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { data: tickets, error: fetchError } = await adminSupabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error al cargar tickets:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Mapear perfiles en memoria de forma segura para evitar errores de relación en Supabase/Postgrest
    const usedByUserIds = Array.from(new Set(tickets?.filter(t => t.used_by).map(t => t.used_by) || []));
    let profilesMap: Record<string, any> = {};
    
    if (usedByUserIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, email')
        .in('id', usedByUserIds);
      
      if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.id] = p;
        });
      }
    }

    const ticketsWithProfiles = tickets?.map(t => ({
      ...t,
      profiles: t.used_by ? (profilesMap[t.used_by] || { email: 'Usuario' }) : null
    })) || [];

    return NextResponse.json({
      success: true,
      tickets: ticketsWithProfiles
    });

  } catch (error: any) {
    console.error('Error en GET /api/admin/tickets:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
