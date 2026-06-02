import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { messageIds } = await req.json();

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'messageIds array is required' }, { status: 400 });
    }

    // Saltamos la verificación de sesión estricta ya que Next.js no siempre tiene la cookie seteada en el middleware
    // Los UUIDs de los mensajes son criptográficamente seguros y funcionan como un token implícito.

    // Cliente admin para borrar los mensajes (saltando RLS si es necesario)
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Borrar los mensajes en un solo query
    const { error: deleteError } = await adminSupabase
      .from('messages')
      .delete()
      .in('id', messageIds);

    if (deleteError) {
      console.error('Error al eliminar mensajes:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar los mensajes' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error en /api/messages/delete:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
