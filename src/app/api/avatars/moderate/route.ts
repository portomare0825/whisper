import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { avatar_id, action } = await req.json();

    if (!avatar_id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos o acción inválida' }, { status: 400 });
    }

    // 1. Autenticar al usuario
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

    // 2. Cliente de Supabase con Service Role (admin) para verificar roles y aplicar cambios
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Verificar si el usuario actual es verdaderamente administrador
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json({ error: 'Acceso denegado: Se requieren privilegios de administrador' }, { status: 403 });
    }

    // 4. Obtener detalles del avatar
    const { data: avatar, error: fetchError } = await adminSupabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (fetchError || !avatar) {
      return NextResponse.json({ error: 'Avatar no encontrado' }, { status: 404 });
    }

    // 5. Aplicar la moderación
    const status = action === 'approve' ? 'approved' : 'rejected';
    
    // Si se rechaza, devolvemos la visibilidad a privado por seguridad para que el creador lo revise
    const updateFields: any = { moderation_status: status };
    if (action === 'reject') {
      updateFields.visibility = 'private';
    }

    const { error: updateError } = await adminSupabase
      .from('avatars')
      .update(updateFields)
      .eq('id', avatar_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, status });

  } catch (error: any) {
    console.error('Error en /api/avatars/moderate:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
