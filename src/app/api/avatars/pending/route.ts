import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    // 1. Autenticar al usuario que hace la solicitud
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

    // 2. Cliente de Supabase con Service Role (admin) para verificar roles y leer de forma segura
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Verificar si el usuario es verdaderamente administrador
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json({ error: 'Acceso denegado: Se requieren privilegios de administrador' }, { status: 403 });
    }

    // 4. Traer avatares en estado de moderación 'pending' (usando Service Role para saltar RLS del select)
    const { data: avatars, error: fetchError } = await adminSupabase
      .from('avatars')
      .select('*')
      .eq('visibility', 'public')
      .eq('moderation_status', 'pending')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    return NextResponse.json({ avatars });

  } catch (error: any) {
    console.error('Error en /api/avatars/pending:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
