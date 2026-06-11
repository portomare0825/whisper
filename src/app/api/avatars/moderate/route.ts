import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function POST(req: Request) {
  try {
    const { avatar_id, action, reason } = await req.json();

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
    
    // Si se rechaza, devolvemos la visibilidad a privado por seguridad para que el creador lo revise y corregimos su razón
    const updateFields: any = { 
      moderation_status: status,
      moderation_reason: action === 'reject' ? (reason || 'No cumple con las pautas de visibilidad pública.') : null
    };
    
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

    // 6. Notificar al creador del avatar en segundo plano vía Web Push si está suscrito
    let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (vapidPublicKey && vapidPrivateKey) {
      vapidPublicKey = vapidPublicKey.replace(/^["']|["']$/g, '');
      vapidPrivateKey = vapidPrivateKey.replace(/^["']|["']$/g, '');

      try {
        webpush.setVapidDetails(
          'mailto:moderacion@whisper.chat',
          vapidPublicKey,
          vapidPrivateKey
        );

        // Buscar suscripciones push del creador original del avatar
        const { data: creatorSubs } = await adminSupabase
          .from('push_subscriptions')
          .select('id, subscription')
          .eq('user_id', avatar.user_id);

        if (creatorSubs && creatorSubs.length > 0) {
          const pushPayload = JSON.stringify({
            title: action === 'approve' ? '¡Avatar Aprobado! 🎉' : 'Avatar Rechazado ❌',
            body: action === 'approve' 
              ? `Tu avatar "${avatar.name}" ha sido aprobado y ya es público para la comunidad.` 
              : `Tu avatar "${avatar.name}" fue rechazado para ser público. Razón: ${reason || 'No cumple las pautas comunitarias.'}`,
            icon: avatar.current_image_url || avatar.base_image_url || '/icon-192.png',
            badge: '/icon-192.png',
            tag: avatar.id,
            data: { url: '/dashboard' } // Al tocar la notificación le enviará directo a su panel
          });

          const pushPromises = creatorSubs.map(async (subRecord: any) => {
            try {
              const pushSubscription = typeof subRecord.subscription === 'string'
                ? JSON.parse(subRecord.subscription)
                : subRecord.subscription;

              await webpush.sendNotification(pushSubscription, pushPayload);
            } catch (err: any) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await adminSupabase.from('push_subscriptions').delete().eq('id', subRecord.id);
              }
            }
          });

          await Promise.all(pushPromises);
        }
      } catch (pushErr) {
        console.error('Error enviando notificación push al creador en moderación:', pushErr);
      }
    }

    return NextResponse.json({ success: true, status });

  } catch (error: any) {
    console.error('Error en /api/avatars/moderate:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
