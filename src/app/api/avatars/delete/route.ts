import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { avatar_id } = await req.json();
    if (!avatar_id) {
      return NextResponse.json({ error: 'Falta el ID del avatar' }, { status: 400 });
    }

    // Autenticar al usuario
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtener detalles del avatar antes de borrarlo
    const { data: avatar, error: fetchError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (fetchError || !avatar) {
      return NextResponse.json({ error: 'Avatar no encontrado o ya eliminado' }, { status: 404 });
    }

    // Verificar que el usuario sea el dueño del avatar
    if (avatar.user_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar este avatar' }, { status: 403 });
    }

    // 2. Soft Delete: En lugar de borrar de la base de datos y de storage, 
    // simplemente actualizamos la fecha de borrado.
    // Mantenemos las imágenes en storage para que los chats antiguos sigan viéndolo.
    const { error: deleteError } = await supabase
      .from('avatars')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', avatar_id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error completo en /api/avatars/delete:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
