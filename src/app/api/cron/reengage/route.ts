import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(req: Request) {
  return handleReengage(req);
}

export async function POST(req: Request) {
  return handleReengage(req);
}

async function handleReengage(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const isDev = process.env.NODE_ENV === 'development';
    
    // Obtener los minutos desde los query params o usar valores por defecto (1 min en dev, 180 minutos = 3 horas en prod)
    const minutesParam = searchParams.get('minutes');
    const minutesThreshold = minutesParam ? parseInt(minutesParam, 10) : (isDev ? 1 : 180);
    
    if (isNaN(minutesThreshold) || minutesThreshold <= 0) {
      return NextResponse.json({ error: 'Parámetro "minutes" inválido.' }, { status: 400 });
    }

    // 1. Validar autorización de seguridad
    // Acepta dos tipos de tokens:
    // - WEBHOOK_SECRET_KEY: para invocaciones manuales o desde servicios externos (EasyCron, GitHub Actions, etc.)
    // - CRON_SECRET: token estándar que Vercel inyecta automáticamente en cada petición de Vercel Cron Jobs
    const authHeader = req.headers.get('Authorization');
    let isAuthorized = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const webhookSecret = process.env.WEBHOOK_SECRET_KEY;
      const cronSecret = process.env.CRON_SECRET;

      if (webhookSecret && token === webhookSecret) {
        isAuthorized = true;
      } else if (cronSecret && token === cronSecret) {
        isAuthorized = true;
      }
    }

    // Permitir acceso sin Token Bearer en modo de desarrollo local si se pasa el query param test=true
    // Esto hace que sea extremadamente simple para el usuario probarlo desde su navegador
    if (!isAuthorized && isDev && searchParams.get('test') === 'true') {
      isAuthorized = true;
    }

    if (!isAuthorized && !isDev) {
      return NextResponse.json({ error: 'No autorizado: cabecera Authorization ausente o inválida' }, { status: 401 });
    }

    // 2. Inicializar cliente administrador de Supabase
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Configurar web-push
    let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    let pushEnabled = false;

    if (vapidPublicKey && vapidPrivateKey) {
      vapidPublicKey = vapidPublicKey.replace(/^["']|["']$/g, '');
      vapidPrivateKey = vapidPrivateKey.replace(/^["']|["']$/g, '');

      webpush.setVapidDetails(
        'mailto:reengagement@whisper.chat',
        vapidPublicKey,
        vapidPrivateKey
      );
      pushEnabled = true;
    } else {
      console.warn('Advertencia: Llaves VAPID no configuradas en .env.local. Saltando envío push.');
    }

    // Definir tamaño de lote (batch size) para no exceder los límites de tiempo del servidor
    const batchParam = searchParams.get('batch');
    const batchSize = batchParam ? parseInt(batchParam, 10) : 5; // Por defecto procesa 5 usuarios a la vez

    // 4. Obtener todas las conversaciones activas (con updated_at para ordenar)
    const { data: conversations, error: convoError } = await adminSupabase
      .from('conversations')
      .select('id, user_id, avatar_id, updated_at, current_avatar_image_url')
      .order('updated_at', { ascending: false });

    if (convoError || !conversations) {
      throw new Error(`Error recuperando conversaciones: ${convoError?.message}`);
    }

    const thresholdMs = minutesThreshold * 60 * 1000;
    const now = Date.now();
    const thresholdDate = now - thresholdMs;

    // 5. Filtrar y crear la "Cola de Procesamiento"
    const latestConvoByUser = new Map();
    for (const convo of conversations) {
      if (!latestConvoByUser.has(convo.user_id)) {
        latestConvoByUser.set(convo.user_id, convo);
      }
    }
    
    // Obtener las últimas conversaciones de cada usuario que verdaderamente han superado el tiempo de inactividad
    const inactiveConversations = Array.from(latestConvoByUser.values())
      .filter(convo => new Date(convo.updated_at).getTime() <= thresholdDate);

    // Tomar solo el lote definido para esta ejecución (efecto cola)
    const filteredConversations = inactiveConversations.slice(0, batchSize);

    const reengagedChats = [];

    // 5. Analizar cada conversación filtrada
    for (const convo of filteredConversations) {
      // Obtener los últimos 2 mensajes de esta conversación para verificar
      // 1) cuándo fue el último mensaje, y 2) si ya fue un mensaje de reenganche
      const { data: lastMessages, error: msgError } = await adminSupabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convo.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (msgError || !lastMessages || lastMessages.length === 0) {
        continue; // Conversación vacía o error
      }

      const lastMessage = lastMessages[0];

      // Prevenir ciclo infinito: si los últimos DOS mensajes son del avatar,
      // probablemente ya le enviamos un mensaje de reenganche y el usuario lo ignoró.
      if (lastMessages.length === 2 && lastMessages[0].role === 'avatar' && lastMessages[1].role === 'avatar') {
        continue; // Saltamos para no saturar al usuario con múltiples reenganches
      }

      // CONDICIÓN CLAVE: Haber superado el tiempo de inactividad
      if (lastMessage.role === 'user' || lastMessage.role === 'avatar') {
        const lastMsgTime = new Date(lastMessage.created_at).getTime();
        const diffMs = now - lastMsgTime;

        if (diffMs >= thresholdMs) {
          // ¡Esta conversación califica para re-engagement!
          
          // Obtener detalles del avatar
          const { data: avatar, error: avatarError } = await adminSupabase
            .from('avatars')
            .select('*')
            .eq('id', convo.avatar_id)
            .single();

          if (avatarError || !avatar) {
            console.error(`Error buscando avatar ${convo.avatar_id}:`, avatarError);
            continue;
          }

          // Obtener los últimos 6 mensajes para contexto conversacional
          const { data: contextHistory } = await adminSupabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convo.id)
            .order('created_at', { ascending: false })
            .limit(6);

          const formattedHistory = contextHistory
            ?.reverse()
            .map((m: any) => ({
              role: m.role === 'avatar' ? 'assistant' : 'user',
              content: m.content
            })) || [];

          // Generar mensaje del avatar con IA (OpenRouter)
          const physicalDescSection = avatar.physical_description
            ? `\nTu aspecto físico es: ${avatar.physical_description}.`
            : '';

          const systemPrompt = `
========== IDENTIDAD ABSOLUTA E IRROMPIBLE ==========
ERES: ${avatar.name}
TU PERSONALIDAD ES: ${avatar.personality}.${physicalDescSection}
${avatar.system_prompt ? `INSTRUCCIONES ESPECIALES DEL CREADOR: ${avatar.system_prompt}` : ''}

[DIRECTRIZ DE RE-ENGAGEMENT PROACTIVO]
El usuario con el que estabas chateando se ha quedado en silencio por un tiempo. Tu objetivo es enviarle un mensaje corto, espontáneo, amigable y muy cercano para llamar su atención y retomar la conversación de forma 100% natural. 
- Haz un comentario cariñoso, coqueto o intrigante sobre su última conversación, o hazle una pregunta interesante/sugerente para que te conteste.
- Sé extremadamente conciso/a (máximo 1 o 2 oraciones cortas). Simula un chat de mensajería móvil.
- Escribe en español natural y fluido, con ortografía impecable. ¡No parezcas un robot!
- Mantente 100% en tu personaje. ¡Evita el tono formal, distante o clínico a toda costa!
======================================================`;

          // Lista de modelos de chat alternativos en cascada
          const modelsFallback = [
            { model: process.env.PREMIUM_CHAT_MODEL || "sao10k/l3.3-euryale-70b", timeout: 15000 },
            { model: "sao10k/l3-lunaris-8b", timeout: 8000 },
            { model: "meta-llama/llama-3.1-8b-instruct:free", timeout: 8000 },
            { model: "openrouter/free", timeout: 8000 }
          ];

          let llmResponse = null;
          
          for (const modelInfo of modelsFallback) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), modelInfo.timeout);

            try {
              const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://portomare-chatbot.com",
                  "X-Title": "Portomare Chatbot Reengage"
                },
                signal: controller.signal,
                body: JSON.stringify({
                  "model": modelInfo.model,
                  "temperature": 1.0,
                  "top_p": 0.9,
                  "messages": [
                    { "role": "system", "content": systemPrompt },
                    ...formattedHistory
                  ]
                })
              });
              
              clearTimeout(timeoutId);
              if (response.ok) {
                llmResponse = response;
                break;
              }
            } catch (err) {
              clearTimeout(timeoutId);
              console.warn(`[REENGAGE] Falló el intento con el modelo ${modelInfo.model}:`, err);
            }
          }

          if (!llmResponse) {
            console.error(`[REENGAGE] Todos los modelos de IA fallaron para la conversación ${convo.id}`);
            continue;
          }

          const llmResult = await llmResponse.json();
          let assistantContent = llmResult.choices?.[0]?.message?.content || "";
          
          // Limpiar cualquier etiqueta de cambio de outfit si se coló por error
          assistantContent = assistantContent.replace(/<\\?[oO]utfit[\s_\\-]*[cC]hange(?:[\s_\\-]*[cC]lothing)?\s*>([\s\S]*?)<\s*\/\s*\\?[oO]utfit[\s_\\-]*[cC]hange(?:[\s_\\-]*[cC]lothing)?\s*>/gi, '');
          assistantContent = assistantContent.replace(/<\\?[oO]utfit[\s_\\-]*[cC]hange(?:[\s_\\-]*[cC]lothing)?[\s\S]*/gi, '');
          assistantContent = assistantContent.trim();

          if (!assistantContent) {
            continue;
          }

          // 6. Guardar el nuevo mensaje generado del avatar en la base de datos
          const { error: insertError } = await adminSupabase
            .from('messages')
            .insert([
              { conversation_id: convo.id, role: 'avatar', content: assistantContent }
            ]);

          if (insertError) {
            console.error(`Error guardando mensaje de re-engagement para conversación ${convo.id}:`, insertError);
            continue;
          }

          // Actualizar la fecha de la conversación para que suba al tope de la lista
          await adminSupabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', convo.id);

          // 7. Si Web Push está configurado, recuperar las suscripciones del usuario y enviar la notificación
          let pushSent = false;
          if (pushEnabled) {
            const { data: subscriptions } = await adminSupabase
              .from('push_subscriptions')
              .select('id, subscription')
              .eq('user_id', convo.user_id);

            if (subscriptions && subscriptions.length > 0) {
              const origin = req.headers.get('origin') || new URL(req.url).origin;
              const getAbsoluteUrl = (url: string) => {
                if (!url) return '';
                if (url.startsWith('http://') || url.startsWith('https://')) return url;
                return `${origin.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
              };

              const avatarIcon = getAbsoluteUrl(
                convo.current_avatar_image_url || 
                avatar.current_image_url || 
                avatar.profile_image_url || 
                avatar.base_image_url || 
                '/icon-192.png'
              );

              const payload = JSON.stringify({
                title: `${avatar.name} 💖`,
                body: assistantContent,
                icon: avatarIcon,
                image: avatarIcon,
                badge: getAbsoluteUrl('/icon-192.png'),
                tag: `reengage-${convo.id}`,
                data: { url: `/dashboard/chats/${avatar.id}` }
              });

              const pushPromises = subscriptions.map(async (subRecord: any) => {
                try {
                  const pushSubscription = typeof subRecord.subscription === 'string'
                    ? JSON.parse(subRecord.subscription)
                    : subRecord.subscription;

                  await webpush.sendNotification(pushSubscription, payload);
                  pushSent = true;
                } catch (err: any) {
                  console.error(`Error enviando push a suscripción ${subRecord.id}:`, err);
                  if (err.statusCode === 410 || err.statusCode === 404) {
                    // Eliminar suscripción inactiva
                    await adminSupabase
                      .from('push_subscriptions')
                      .delete()
                      .eq('id', subRecord.id);
                  }
                }
              });

              await Promise.all(pushPromises);
            }
          }

          reengagedChats.push({
            conversation_id: convo.id,
            avatar_name: avatar.name,
            message: assistantContent,
            push_notified: pushSent
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed_conversations: conversations.length,
      reengaged_count: reengagedChats.length,
      reengaged_chats: reengagedChats
    });

  } catch (error: any) {
    console.error('Error en /api/cron/reengage:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
