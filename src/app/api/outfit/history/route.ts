import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const avatar_id = searchParams.get('avatar_id');

    if (!avatar_id) {
      return NextResponse.json({ error: 'avatar_id requerido' }, { status: 400 });
    }

    // Autenticación
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

    // Consultar historial de outfits del usuario para este avatar
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: outfits, error } = await adminSupabase
      .from('outfit_history')
      .select('id, image_url, prompt, created_at')
      .eq('avatar_id', avatar_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching outfit history:', error);
      return NextResponse.json({ error: 'Error al obtener el historial' }, { status: 500 });
    }

    return NextResponse.json({ outfits: outfits || [] });

  } catch (error: any) {
    console.error('Error en /api/outfit/history:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
