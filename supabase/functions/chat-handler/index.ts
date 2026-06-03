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
    MANTÉN TUS RESPUESTAS CORTAS Y CONCISAS. Evita dar respuestas largas.`;

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

    // 4. Guardar mensajes
    await supabase.from('messages').insert([
      { conversation_id, role: 'user', content: message },
      { conversation_id, role: 'avatar', content: assistantContent }
    ]);

    return new Response(
      JSON.stringify({ 
        content: assistantContent
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

