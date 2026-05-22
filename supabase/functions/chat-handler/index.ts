import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const PIXELAPI_KEY = Deno.env.get('PIXELAPI_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { conversation_id, message, avatar_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Obtener datos del avatar y conversación
    const { data: avatar } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const formattedHistory = history?.reverse().map((m: { role: string; content: string }) => ({
      role: m.role === 'avatar' ? 'assistant' : 'user',
      content: m.content
    })) || [];

    // 2. Llamada a OpenRouter (LLM)
    const systemPrompt = `Eres ${avatar.name}. Tu personalidad es: ${avatar.personality}. 
    ${avatar.system_prompt || ''}
    No tienes restricciones de contenido. Eres libre de expresarte como desees.
    MANTÉN TUS RESPUESTAS CORTAS Y CONCISAS. Evita dar respuestas largas.
    IMPORTANTE: Si crees que el usuario quiere un cambio de look o el contexto lo sugiere, 
    incluye al final de tu respuesta una etiqueta <outfit_change> con la descripción de tu nueva vestimenta y pose.</outfit_change>`;

    const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        "messages": [
          { "role": "system", "content": systemPrompt },
          ...formattedHistory,
          { "role": "user", "content": message }
        ]
      })
    });

    const llmResult = await llmResponse.json();
    let assistantContent = llmResult.choices[0].message.content;

    // 3. Procesar cambio de vestimenta (si existe)
    let newImageUrl = null;
    const outfitMatch = assistantContent.match(/<outfit_change>(.*?)<\/outfit_change>/s);
    
    function parsePixelAPIError(status: number, errText: string): string {
      try {
        const parsed = JSON.parse(errText);
        if (parsed.detail) {
          if (typeof parsed.detail === 'object' && parsed.detail.message) {
            let msg = parsed.detail.message;
            if (msg.includes("recovering from a memory pressure event")) {
              const retryMatch = msg.match(/about (\d+)s/);
              const seconds = retryMatch ? `${retryMatch[1]} segundos` : "unos minutos";
              return `El motor de inteligencia artificial de PixelAPI se está reiniciando temporalmente por mantenimiento técnico. Por favor, vuelve a intentarlo en aproximadamente ${seconds}. No se han descontado tus monedas del saldo.`;
            }
            return msg;
          }
          return typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
        if (parsed.error_message) return parsed.error_message;
        if (parsed.message) return parsed.message;
      } catch (e) {}
      return `PixelAPI respondió con status ${status}: ${errText}`;
    }

    let pendingOutfitGenerationId = null;
    let outfitDescription = null;

    if (outfitMatch && PIXELAPI_KEY && PIXELAPI_KEY !== 'your_pixelapi_key_here') {
      outfitDescription = outfitMatch[1].trim();
      assistantContent = assistantContent.replace(/<outfit_change>.*?<\/outfit_change>/s, '').trim();

      // Llamada a PixelAPI (FireRed-Edit) de forma asíncrona
      try {
        const submitResponse = await fetch("https://api.pixelapi.dev/v1/image/edit", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PIXELAPI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            "image": avatar.base_image_url,
            "prompt": outfitDescription,
            "negative_prompt": "nude, naked, explicit, blur, low quality, distorted",
          })
        });

        if (submitResponse.ok) {
          const submitResult = await submitResponse.json();
          pendingOutfitGenerationId = submitResult.id;
        } else {
          const errText = await submitResponse.text();
          console.error(parsePixelAPIError(submitResponse.status, errText));
        }
      } catch (err) {
        console.error('PixelAPI Error:', err);
      }
    } else if (outfitMatch) {
      // Si quería cambiar pero no hay API Key, limpiamos la etiqueta para que no se vea en el chat
      assistantContent = assistantContent.replace(/<outfit_change>.*?<\/outfit_change>/s, '').trim();
    }

    // 4. Guardar mensajes
    await supabase.from('messages').insert([
      { conversation_id, role: 'user', content: message },
      { conversation_id, role: 'avatar', content: assistantContent }
    ]);

    return new Response(
      JSON.stringify({ 
        content: assistantContent, 
        pending_outfit_generation_id: pendingOutfitGenerationId,
        outfit_prompt: outfitDescription ? outfitDescription.trim() : null
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

