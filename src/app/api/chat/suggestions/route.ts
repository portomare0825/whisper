import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { conversation_id, avatar_id, style = 'neutral' } = await req.json();

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

    // Definir instrucciones de estilo dinámicamente según la preferencia del usuario
    let styleInstruction = "";
    if (style === 'alpha') {
      styleInstruction = `
REGLA DE ESTILO CRÍTICA (ALFA / SEGURO / ATREVIDO):
- Las sugerencias del usuario deben sonar sumamente seguras de sí mismas, decididas, audaces, atrevidas, líderes, dominantes y proactivas. Alguien que toma la iniciativa de forma decidida y sin rodeos. Evita sonar tímido o indeciso.`;
    } else if (style === 'stoic') {
      styleInstruction = `
REGLA DE ESTILO CRÍTICA (ESTOICO / SERIO / RESERVADO):
- Las sugerencias del usuario deben sonar tranquilas, lógicas, muy maduras, reservadas, analíticas, con gran aplomo y compostura emocional. Respuestas precisas, un tanto misteriosas, directas pero elegantes.`;
    } else if (style === 'romantic') {
      styleInstruction = `
REGLA DE ESTILO CRÍTICA (COQUETO / ROMÁNTICO / DULCE):
- Las sugerencias del usuario deben ser dulces, sumamente cariñosas, coquetas, íntimas, tiernas o seductoras. Deben demostrar afecto físico o complicidad emocional con el avatar.`;
    } else if (style === 'funny') {
      styleInstruction = `
REGLA DE ESTILO CRÍTICA (DIVERTIDO / JUGUETÓN / SARCÁSTICO):
- Las sugerencias del usuario deben ser divertidas, humorísticas, ingeniosas, juguetonas o con un toque de sarcasmo ligero y bromas cómplices. Respuestas que provoquen una sonrisa.`;
    } else {
      styleInstruction = `
REGLA DE ESTILO CRÍTICA (NEUTRAL / EQUILIBRADO):
- Las sugerencias del usuario deben ser equilibradas, naturales y adaptadas de forma orgánica al curso natural de la conversación.`;
    }

    // 3. Crear el prompt para las sugerencias
    const systemPrompt = `Eres un asistente experto en roleplay y conversaciones dinámicas.
Tu tarea es leer la conversación actual entre un usuario y un personaje llamado ${avatar.name} (cuyos rasgos son: ${avatar.personality}), y generar EXACTAMENTE 2 sugerencias de lo que el USUARIO podría decir a continuación para mantener la charla interesante.
Las sugerencias pueden incluir diálogo normal o acciones físicas entre *asteriscos* (ejemplo: *sonrío y asiento*).
${styleInstruction}

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
