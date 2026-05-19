import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: 'Faltan datos de la imagen (imageBase64 y mimeType son requeridos)' },
        { status: 400 }
      );
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY no está configurada en el servidor' },
        { status: 500 }
      );
    }

    // Usar OpenRouter con Gemini 2.5 Flash (soporta visión, es ultrarrápido y extremadamente económico)
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza detalladamente esta foto de avatar y genera un perfil creativo completo que se adapte perfectamente a la persona de la imagen.
                Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (todas las respuestas deben estar en español):
                {
                  "name": "Un nombre atractivo, moderno o exótico en español (ej. Camila, Sofía, Valeria, Dante, Lucas, Liam) que encaje a la perfección con la apariencia, etnia, edad y vibración de la persona en la foto.",
                  "personality": "Una descripción muy atractiva de su personalidad y rasgos de comportamiento (mínimo 2 líneas). Ejemplo: 'Sociable, con un sentido del humor travieso, amante de la moda retro y un poco protectora...'",
                  "physical_description": "Una descripción física detallada enfocada en que un modelo de IA la entienda (ej: chica esbelta, delgada, cabello largo castaño ondulado, ojos almendrados oscuros, viste una chaqueta casual...)",
                  "system_prompt": "Instrucciones de comportamiento detalladas (3-4 líneas) escritas en segunda persona para guiar a la IA a interpretar a este avatar. Ej: 'Actúas como Camila. Eres juguetona pero madura. Te gusta flirtear sutilmente y te entusiasman las conversaciones profundas. Háblale al usuario de forma cercana y cariñosa.'"
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      })
    });

    const result = await response.json();

    if (result.error) {
      console.error('Error de OpenRouter Vision API:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    let text = result.choices?.[0]?.message?.content || '';
    
    // Limpieza robusta por si el LLM devuelve bloques de formato markdown
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json({
        name: parsed.name?.trim(),
        personality: parsed.personality?.trim(),
        physical_description: parsed.physical_description?.trim(),
        system_prompt: parsed.system_prompt?.trim()
      });
    } catch (parseError) {
      console.error('Error parsing JSON from Vision API:', parseError, text);
      return NextResponse.json({ description: text.trim() });
    }
  } catch (err: any) {
    console.error('Error en /api/avatars/analyze:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al analizar la imagen' },
      { status: 500 }
    );
  }
}
