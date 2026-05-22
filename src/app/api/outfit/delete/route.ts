import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { imageId } = await req.json();

    if (!imageId) {
      return NextResponse.json({ error: 'imageId requerido' }, { status: 400 });
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

    // Cliente admin para saltar RLS si es necesario
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar que la imagen pertenezca al usuario
    const { data: outfit, error: fetchError } = await adminSupabase
      .from('outfit_history')
      .select('user_id')
      .eq('id', imageId)
      .single();

    if (fetchError || !outfit) {
      return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });
    }

    if (outfit.user_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar esta imagen' }, { status: 403 });
    }

    // Eliminar el registro
    const { error: deleteError } = await adminSupabase
      .from('outfit_history')
      .delete()
      .eq('id', imageId);

    if (deleteError) {
      console.error('Error al eliminar outfit:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar la imagen' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error en /api/outfit/delete:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
