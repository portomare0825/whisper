import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function POST(req: Request) {
  try {
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

    // 1. Validar que la petición venga de un usuario autenticado
    const { data: { user } } = await clientSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { avatarId } = await req.json();
    if (!avatarId) {
      return NextResponse.json({ error: 'Falta el ID del avatar' }, { status: 400 });
    }

    // 2. Cliente de Supabase con privilegios administrativos
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Obtener detalles del avatar que requiere moderación
    const { data: avatar, error: avatarError } = await adminSupabase
      .from('avatars')
      .select('name, base_image_url, current_image_url, visibility, moderation_status')
      .eq('id', avatarId)
      .maybeSingle();

    if (avatarError || !avatar) {
      return NextResponse.json({ error: 'Avatar no encontrado' }, { status: 404 });
    }

    // 4. Validar que el avatar verdaderamente sea público y esté en revisión
    if (avatar.visibility !== 'public' || avatar.moderation_status !== 'pending') {
      return NextResponse.json({ error: 'El avatar no está en estado pendiente de moderación pública' }, { status: 400 });
    }

    // 5. Configurar web-push si las variables de entorno están presentes
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('Advertencia: Llaves VAPID no configuradas en .env.local. Saltando envío push.');
      return NextResponse.json({ success: true, message: 'Advertencia: Claves VAPID ausentes en el servidor. Proceso omitido.' });
    }

    webpush.setVapidDetails(
      'mailto:moderacion@whisper.chat',
      vapidPublicKey,
      vapidPrivateKey
    );

    // 6. Obtener la lista de usuarios administradores
    const { data: admins, error: adminsError } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);

    if (adminsError || !admins || admins.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay administradores registrados para notificar.' });
    }

    const adminIds = admins.map(a => a.id);

    // 7. Recuperar todas las suscripciones push de estos administradores
    const { data: subscriptions, error: subsError } = await adminSupabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .in('user_id', adminIds);

    if (subsError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay dispositivos móviles o navegadores suscritos para los administradores.' });
    }

    // 8. Payload de la notificación push nativa
    const payload = JSON.stringify({
      title: 'Avatar Pendiente de Aprobación ⚖️',
      body: `El avatar "${avatar.name}" requiere tu aprobación para ser público.`,
      icon: avatar.current_image_url || avatar.base_image_url || '/icon-192.png',
      badge: '/icon-192.png',
      tag: avatarId,
      data: { url: '/dashboard/moderation' }
    });

    // 9. Enviar notificaciones en paralelo y procesar respuestas
    const pushPromises = subscriptions.map(async (subRecord: any) => {
      try {
        // En web-push, la suscripción guardada como JSONB debe pasarse estructurada
        const pushSubscription = typeof subRecord.subscription === 'string' 
          ? JSON.parse(subRecord.subscription) 
          : subRecord.subscription;

        await webpush.sendNotification(pushSubscription, payload);
      } catch (err: any) {
        console.error(`Error enviando push a suscripción ${subRecord.id} del administrador:`, err);
        // Si el servidor de push retorna 410 o 404, la suscripción expiró o el usuario la removió de su navegador.
        // La removemos de la base de datos para mantenerla limpia y óptima.
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Eliminando suscripción push inactiva ${subRecord.id} de la base de datos.`);
          await adminSupabase
            .from('push_subscriptions')
            .delete()
            .eq('id', subRecord.id);
        }
      }
    });

    await Promise.all(pushPromises);

    return NextResponse.json({ success: true, message: `Notificaciones push enviadas a ${subscriptions.length} dispositivos administradores.` });

  } catch (error: any) {
    console.error('Error en /api/avatars/notify-pending:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
