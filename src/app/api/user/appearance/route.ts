import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { conversation_id, image } = await req.json();

    if (!conversation_id) {
      return NextResponse.json({ error: 'Falta el ID de conversación' }, { status: 400 });
    }

    if (!image) {
      return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: 'API Key de OpenRouter no configurada en el servidor' }, { status: 500 });
    }

    // 1. Crear cliente de Supabase con Service Role Key (bypass RLS)
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Obtener la conversación para verificar a qué usuario pertenece de forma segura
    const { data: conversation, error: convoError } = await adminSupabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convoError || !conversation) {
      console.error('Error al obtener conversación:', convoError);
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const userId = conversation.user_id;

    // 3. Normalizar la imagen base64
    let base64Image = image;
    if (!base64Image.startsWith('data:')) {
      // Por defecto asumimos que es jpeg si no viene el prefijo de data URI
      base64Image = `data:image/jpeg;base64,${base64Image}`;
    }

    // 4. Preparar payload multimodal para Gemini 2.5 Flash en OpenRouter
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analiza la siguiente foto de perfil del usuario y genera una descripción física muy detallada, objetiva y amigable en español (de aproximadamente 20 a 30 palabras). Concéntrate en características físicas visibles y rasgos estables como: color y estilo de cabello (liso, rizado, castaño, rubio, etc.), color de ojos, complexión, si usa gafas, vello facial (barba/bigote), sonrisa, rasgos faciales y estilo de vestir general. Esta descripción servirá para que avatares de IA lo recuerden y reconozcan su aspecto físico de forma realista durante el chat de rol. Responde únicamente con la descripción física directa en español sin añadir introducciones ni explicaciones secundarias.'
          },
          {
            type: 'image_url',
            image_url: {
              url: base64Image
            }
          }
        ]
      }
    ];

    console.log(`[USER APPEARANCE] Enviando imagen a Gemini para el usuario: ${userId}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AvatarChat Pro'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.5,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error de OpenRouter al analizar imagen:', errText);
      return NextResponse.json({ error: `Error de OpenRouter al analizar la imagen: ${response.statusText}` }, { status: 502 });
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim();

    if (!description || description.length < 5) {
      console.error('La respuesta de Gemini está vacía o es inválida:', data);
      return NextResponse.json({ error: 'La IA no pudo generar una descripción válida de la imagen.' }, { status: 502 });
    }

    console.log(`[USER APPEARANCE] Descripción generada: "${description}"`);

    // 5. Guardar la descripción en la tabla de perfiles del usuario
    const { error: updateError } = await adminSupabase
      .from('profiles')
      .upsert({ id: userId, user_physical_description: description }, { onConflict: 'id' });

    if (updateError) {
      console.error('Error al guardar descripción física en Supabase:', updateError);
      return NextResponse.json({ error: `Error al guardar los datos: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      description
    });

  } catch (error: any) {
    console.error('Error en /api/user/appearance:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
