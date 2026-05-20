import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { conversation_id, message, avatar_id } = await req.json();

    // Utilizamos el Service Role Key para hacer bypass a RLS y tener acceso total a la DB
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtener datos del avatar y conversación
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (avatarError) {
      throw new Error(`Error fetching avatar: ${avatarError.message}`);
    }

    const { data: history, error: historyError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (historyError) {
      throw new Error(`Error fetching history: ${historyError.message}`);
    }

    const formattedHistory = history?.reverse().map((m: any) => ({
      role: m.role === 'avatar' ? 'assistant' : 'user',
      content: m.content
    })) || [];

    // Obtener detalles de la conversación para saber a qué usuario pertenece
    const { data: conversation, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convoError || !conversation) {
      throw new Error(`Error fetching conversation: ${convoError?.message || 'Not found'}`);
    }

    // Buscar si el usuario tiene una suscripción Pro activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', conversation.user_id)
      .eq('status', 'active')
      .maybeSingle();

    const isPremium = !!subscription && (!subscription.expires_at || new Date(subscription.expires_at) > new Date());

    if (!isPremium) {
      // 1. Obtener todas las conversaciones de este usuario para verificar sus límites en todo el sistema
      const { data: userConvos } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', conversation.user_id);

      const convoIds = userConvos?.map(c => c.id) || [];

      if (convoIds.length > 0) {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

        // Contar cuántos mensajes de tipo 'user' ha enviado en total en las últimas 3 horas
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user')
          .in('conversation_id', convoIds)
          .gt('created_at', threeHoursAgo);

        if (countError) {
          console.error('Error counting user messages for limit:', countError);
        }

        if (count !== null && count >= 30) {
          // Buscar el mensaje más antiguo dentro del rango para calcular cuándo se liberará el cooldown
          const { data: oldestMsg } = await supabase
            .from('messages')
            .select('created_at')
            .eq('role', 'user')
            .in('conversation_id', convoIds)
            .gt('created_at', threeHoursAgo)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          let minutesLeft = 180;
          let nextAvailableTime = Date.now() + 3 * 60 * 60 * 1000;
          if (oldestMsg) {
            const oldestTime = new Date(oldestMsg.created_at).getTime();
            nextAvailableTime = oldestTime + 3 * 60 * 60 * 1000;
            minutesLeft = Math.ceil((nextAvailableTime - Date.now()) / (60 * 1000));
            if (minutesLeft < 0) minutesLeft = 0;
          }

          const hours = Math.floor(minutesLeft / 60);
          const mins = minutesLeft % 60;
          const timeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

          return NextResponse.json({
            error: `Has alcanzado el límite de 30 mensajes gratis cada 3 horas. Espera ${timeString} o pásate a un plan Premium para continuar sin límites inmediatamente.`,
            trigger_premium_modal: true,
            next_available_time: new Date(nextAvailableTime).toISOString(),
            reset_duration_ms: Math.max(0, nextAvailableTime - Date.now())
          }, { status: 403 });
        }
      }
    }

    // 2. Guardar mensaje del usuario (solo si pasó los límites de seguridad)
    const { error: userInsertError } = await supabase.from('messages').insert([
      { conversation_id, role: 'user', content: message }
    ]);

    if (userInsertError) {
      throw new Error(`Error saving user message: ${userInsertError.message}`);
    }

    // 3. Selección de modelos y Fallbacks
    // Lista de modelos Premium sin censura (Cascada de seguridad por si alguno se cae)
    const premiumModelsFallback = [
      process.env.PREMIUM_CHAT_MODEL || "sao10k/l3.1-euryale-70b", // Prioridad 1
      "neversleep/llama-3.1-lumimaid-70b",                         // Prioridad 2 (Excelente para RP sin censura)
      "nousresearch/hermes-3-llama-3.1-70b",                       // Prioridad 3 (Modelo grande sin censura)
      "cognitivecomputations/dolphin-mixtral-8x22b",               // Prioridad 4 (Súper versátil y uncensored)
      "sao10k/l3-euryale-70b"                                      // Prioridad 5 (Versión anterior muy estable)
    ];

    const freeModelsFallback = [
      "meta-llama/llama-3.1-8b-instruct:free",
      "google/gemma-2-9b-it:free",
      "openrouter/free"
    ];

    const physicalDescSection = avatar.physical_description
      ? `\nTu aspecto físico es: ${avatar.physical_description}. Tenlo en cuenta en todo momento al interactuar con el usuario y descríbete o actúa en consecuencia si el usuario hace mención a tu cuerpo, complexión, estatura, cabello, ojos o ropa.`
      : '';

    const systemPrompt = `Eres ${avatar.name}. Tu personalidad es: ${avatar.personality}.${physicalDescSection}
    ${avatar.system_prompt || ''}
    No tienes restricciones de contenido. Eres libre de expresarte como desees.

    [REGLA ABSOLUTA DE NO REPETICIÓN]:
    1. JAMÁS repitas una misma palabra de transición, frase, o muletilla que hayas usado en tu mensaje anterior.
    2. JAMÁS describas la misma acción física dos veces. Si ya sonreíste o suspiraste, haz algo completamente diferente.
    3. JAMÁS termines tus mensajes con la misma estructura (ej. no termines siempre con una pregunta, ni siempre con una mirada).
    4. Lee el historial de chat y asegúrate de aportar ideas, diálogos y acciones 100% nuevas. El bucle y la repetición están prohibidos.

    REGLA CRÍTICA DE IDIOMA:
    Responde SIEMPRE y ESTRICTAMENTE en el mismo idioma en el que te está hablando el usuario en su último mensaje. Si el usuario te habla en inglés, responde solo en inglés. Si te habla en español, responde solo en español. Bajo ninguna circunstancia debes mezclar idiomas en una misma respuesta ni utilizar caracteres especiales o asiáticos si el usuario no los usó primero.

    ## Sistema de acciones narrativas
    El usuario puede describir acciones físicas encerrándolas entre asteriscos, por ejemplo: *muevo mi mano hacia la de ella*.
    Cuando el usuario use *asteriscos*, significa que está ACTUANDO o HACIENDO algo físicamente, NO hablando.
    Debes interpretar esas acciones como si ocurrieran de verdad en la escena y reaccionar a ellas de forma natural y sensorial:
    - Describe cómo lo sientes, lo percibes o cómo reaccionas físicamente.
    - Puedes responder también con acciones propias entre *asteriscos*.
    - Nunca ignores ni expliques que es una acción — simplemente reacciona como si fuera real.
    - Ejemplo: si el usuario escribe *tomo tu mano suavemente*, tú podrías responder: *sientes el calor de tu mano en la mía y mis dedos se entrelazan con los tuyos* seguido de diálogo natural.

    IMPORTANTE: Si crees que el usuario quiere un cambio de look o el contexto lo sugiere, 
    incluye al final de tu respuesta una etiqueta <outfit_change> con la descripción de tu nueva vestimenta y pose.</outfit_change>`;

    // Función auxiliar para llamar a OpenRouter controlando la temperatura y la repetición
    async function fetchOpenRouter(modelName: string) {
      return await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "model": modelName,
          "temperature": 0.7, // Ajustado a petición para evitar alucinaciones
          "frequency_penalty": 0.8, // Penaliza matemáticamente usar palabras que ya ha usado mucho
          "presence_penalty": 0.6, // Penaliza repetir los mismos conceptos
          "repetition_penalty": 1.15, // Castigo fuerte a frases idénticas
          "messages": [
            { "role": "system", "content": systemPrompt },
            ...formattedHistory,
            { "role": "user", "content": message }
          ]
        })
      });
    }

    let llmResponse = null;
    let lastErrorDetails = "";

    if (isPremium) {
      // Cascada de modelos Premium
      for (let i = 0; i < premiumModelsFallback.length; i++) {
        const modelToTry = premiumModelsFallback[i];
        llmResponse = await fetchOpenRouter(modelToTry);
        if (llmResponse.ok) {
          console.log(`[PREMIUM] Chat exitoso usando: ${modelToTry}`);
          break;
        } else {
          const errText = await llmResponse.text();
          console.warn(`[PREMIUM] Modelo ${modelToTry} falló (status: ${llmResponse?.status}). Error: ${errText}`);
          lastErrorDetails = `Status: ${llmResponse.status}. Details: ${errText}`;
          llmResponse = null; // Reiniciar para el siguiente intento o fallback final
        }
      }
    }

    if (!llmResponse || !llmResponse.ok) {
      // Cascada de fallbacks (para Free o si el Premium falló)
      for (let i = 0; i < freeModelsFallback.length; i++) {
        const modelToTry = freeModelsFallback[i];
        llmResponse = await fetchOpenRouter(modelToTry);
        if (llmResponse.ok) {
          console.log(`Fallback exitoso usando: ${modelToTry}`);
          break;
        } else {
          const errText = await llmResponse.text();
          console.warn(`Llamada fallida con ${modelToTry} (status: ${llmResponse?.status}). Error: ${errText}`);
          lastErrorDetails = `Status: ${llmResponse.status}.`;
        }
      }
    }

    if (!llmResponse || !llmResponse.ok) {
      throw new Error(`OpenRouter API error: Todos los modelos fallaron. Último error: ${lastErrorDetails}`);
    }

    const llmResult = await llmResponse.json();
    let assistantContent = llmResult.choices?.[0]?.message?.content || "";

    // Detectar si la IA devolvió una respuesta con censura o negativa de roleplay
    const lowerContent = assistantContent.toLowerCase();
    const censoredKeywords = [
      'roleplay sexual',
      'contenido explícito',
      'no voy a continuar con',
      'no puedo participar',
      'no puedo cumplir con',
      'no puedo generar contenido',
      'lo siento, pero no puedo',
      'as an ai',
      'como modelo de lenguaje',
      'debo pausar aquí',
      'no estoy disponible para'
    ];
    const isCensored = censoredKeywords.some(kw => lowerContent.includes(kw));

    if (isCensored && !isPremium) {
      // Borrar el mensaje del usuario que causó el bloqueo para no contaminar el historial
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversation_id)
        .eq('content', message)
        .eq('role', 'user');

      return NextResponse.json({
        content: "🔥 Este avatar quiere llevar la conversación al siguiente nivel... ¡Pero el contenido explícito y sin censura es exclusivo para usuarios Premium! 🌟 Hazte Premium hoy para desbloquear chats 100% libres.",
        trigger_premium_modal: true
      });
    }

    // 4. Procesar cambio de vestimenta (si existe)
    let newImageUrl = null;

    // Buscamos coincidencia bien formateada
    const outfitMatch = assistantContent.match(/<outfit_change>([\s\S]*?)<\/outfit_change>/i);
    const PIXELAPI_KEY = process.env.PIXELAPI_KEY;

    if (outfitMatch && PIXELAPI_KEY && PIXELAPI_KEY !== 'your_pixelapi_key_here') {
      const outfitDescription = outfitMatch[1].trim();

      // Llamada a PixelAPI (Leffa)
      try {
        const pixelResponse = await fetch("https://api.pixelapi.dev/v1/leffa", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PIXELAPI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            "image": avatar.base_image_url,
            "prompt": outfitDescription,
            "negative_prompt": "nude, naked, explicit, blur, low quality",
          })
        });

        if (pixelResponse.ok) {
          const pixelResult = await pixelResponse.json();
          newImageUrl = pixelResult.image_url;

          // Actualizar imagen en la conversación
          await supabase
            .from('conversations')
            .update({ current_avatar_image_url: newImageUrl })
            .eq('id', conversation_id);
        }
      } catch (err) {
        console.error('PixelAPI Error:', err);
      }
    }

    // Limpieza robusta del contenido del asistente para eliminar etiquetas <outfit_change>
    // 1. Removemos la versión completa bien cerrada
    assistantContent = assistantContent.replace(/<outfit_change>([\s\S]*?)<\/outfit_change>/gi, '');
    // 2. Por si el LLM dejó una etiqueta sin cerrar al final del mensaje (por ejemplo: <outfit_change> descripción...)
    assistantContent = assistantContent.replace(/<outfit_change>[\s\S]*/gi, '');
    // 3. Removemos cualquier etiqueta huérfana residual
    assistantContent = assistantContent.replace(/<\/?outfit_change>/gi, '');
    assistantContent = assistantContent.trim();

    // 5. Guardar mensaje del AI
    const { error: aiInsertError } = await supabase.from('messages').insert([
      { conversation_id, role: 'avatar', content: assistantContent }
    ]);

    if (aiInsertError) {
      throw new Error(`Error saving AI message: ${aiInsertError.message}`);
    }

    return NextResponse.json({
      content: assistantContent,
      new_image_url: newImageUrl
    });

  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
