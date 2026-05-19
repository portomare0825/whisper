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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe brevemente y en español la apariencia física de la persona en esta foto (complexión, tipo de cuerpo, color de ojos, color de cabello, peinado, estilo, etc.). Sé directo y altamente descriptivo, usando adjetivos claros (ej. alta, delgada, esbelta, flaca, atlética, cabello largo rubio, etc.). Enfócate solo en la apariencia física para que un modelo de IA sepa exactamente cómo se ve físicamente."
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

    const text = result.choices?.[0]?.message?.content || '';
    
    return NextResponse.json({ description: text.trim() });
  } catch (err: any) {
    console.error('Error en /api/avatars/analyze:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al analizar la imagen' },
      { status: 500 }
    );
  }
}
