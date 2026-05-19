import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { conversation_id, avatar_id } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtener datos del avatar
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (avatarError) {
      throw new Error(`Error fetching avatar: ${avatarError.message}`);
    }

    // 2. Obtener historial reciente
    const { data: history, error: historyError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(6); // Menos mensajes para no gastar tantos tokens

    if (historyError) {
       throw new Error(`Error fetching history: ${historyError.message}`);
    }

    const formattedHistory = history?.reverse().map((m: any) => ({
      role: m.role === 'avatar' ? 'assistant' : 'user',
      content: m.content
    })) || [];

    // 3. Crear el prompt para las sugerencias
    const systemPrompt = `Eres un asistente experto en roleplay y conversaciones dinámicas.
Tu tarea es leer la conversación actual entre un usuario y un personaje llamado ${avatar.name} (cuyos rasgos son: ${avatar.personality}), y generar EXACTAMENTE 2 sugerencias de lo que el USUARIO podría decir a continuación para mantener la charla interesante.
Las sugerencias pueden incluir diálogo normal o acciones físicas entre *asteriscos* (ejemplo: *sonrío y asiento*).

REGLAS ESTRICTAS DE FORMATO:
- Debes devolver SOLO un objeto JSON válido, sin Markdown, sin explicaciones, sin texto adicional.
- El formato exacto debe ser:
{
  "suggestions": [
    "Primera sugerencia corta aquí",
    "Segunda sugerencia diferente aquí"
  ]
}

No incluyas nada más en tu respuesta que el JSON puro.`;

    const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": "openai/gpt-4o-mini",
        "response_format": { "type": "json_object" },
        "messages": [
          { "role": "system", "content": systemPrompt },
          ...formattedHistory
        ]
      })
    });

    if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error("OpenRouter Error Body:", errorText);
        throw new Error(`OpenRouter API error: ${llmResponse.statusText} - ${errorText}`);
    }

    const llmResult = await llmResponse.json();
    console.log("LLM Raw Result:", JSON.stringify(llmResult));
    let content = llmResult.choices?.[0]?.message?.content || "";
    
    // Intentar limpiar la respuesta en caso de que el LLM devuelva markdown (ej: ```json ... ```)
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json({ suggestions: parsed.suggestions || [] });
    } catch (parseError) {
      console.error('Error parsing JSON from LLM:', content);
      return NextResponse.json({ suggestions: [] }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Suggestions Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
