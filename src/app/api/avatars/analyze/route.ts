import { NextResponse } from 'next/server';

// Helper para obtener dimensiones de JPEG y PNG
function getImageDimensions(buffer: Buffer) {
  // PNG signature
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    try {
      return {
        width: buffer.readInt32BE(16),
        height: buffer.readInt32BE(20),
        format: 'png'
      };
    } catch {}
  }
  // JPEG signature
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    try {
      let i = 2;
      while (i < buffer.length) {
        if (buffer[i] !== 0xFF) return null;
        let marker = buffer[i + 1];
        if (marker === 0xC0 || marker === 0xC2) { // SOF0 or SOF2
          let height = buffer.readUInt16BE(i + 5);
          let width = buffer.readUInt16BE(i + 7);
          return { width, height, format: 'jpeg' };
        } else {
          let length = buffer.readUInt16BE(i + 2);
          i += 2 + length;
        }
      }
    } catch {}
  }
  return null;
}

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

    // 1. Obtener dimensiones de la imagen original
    const buffer = Buffer.from(imageBase64, 'base64');
    const dims = getImageDimensions(buffer);

    // Usar OpenRouter con Gemini 2.5 Flash
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
                text: `Analiza detalladamente esta foto de avatar. Genera un perfil creativo completo y localiza el rostro principal.
                Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (todas las respuestas de texto en español):
                {
                  "name": "Un nombre atractivo en español (ej. Camila, Valeria, Lucas) que encaje con la apariencia de la foto.",
                  "personality": "Una descripción muy atractiva de su personalidad y rasgos de comportamiento (mínimo 2 líneas).",
                  "physical_description": "Calcula y describe explícitamente tres cosas: 1) Edad aproximada en años, 2) Contextura física (ej. delgada, curvilínea, robusta, atlética) y 3) Tamaño/Estatura estimada (ej. pequeña, alta, mediana). PROHIBIDO usar palabras como 3D, dibujo, ilustración, avatar o animación. Descríbelo como si fuera un humano real.",
                  "system_prompt": "Instrucciones de comportamiento detalladas (3-4 líneas) escritas en segunda persona para guiar a la IA.",
                  "ymin": integer (0-1000 indicating the top edge of the face),
                  "xmin": integer (0-1000 indicating the left edge of the face),
                  "ymax": integer (0-1000 indicating the bottom edge of the face),
                  "xmax": integer (0-1000 indicating the right edge of the face)
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
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(text);

      let faceBox = null;
      if (dims && parsed.ymin !== undefined && parsed.xmin !== undefined && parsed.ymax !== undefined && parsed.xmax !== undefined) {
        // Calcular proyección cover-fit a 576x1024
        const W_tgt = 576;
        const H_tgt = 1024;

        const s = Math.max(W_tgt / dims.width, H_tgt / dims.height);
        const W_scaled = dims.width * s;
        const H_scaled = dims.height * s;

        const dx = (W_scaled - W_tgt) / 2;
        const dy = (H_scaled - H_tgt) / 2;

        const x_left_orig = (parsed.xmin / 1000) * dims.width;
        const y_top_orig = (parsed.ymin / 1000) * dims.height;
        const x_right_orig = (parsed.xmax / 1000) * dims.width;
        const y_bottom_orig = (parsed.ymax / 1000) * dims.height;

        const x_left_tgt = x_left_orig * s - dx;
        const y_top_tgt = y_top_orig * s - dy;
        const x_right_tgt = x_right_orig * s - dx;
        const y_bottom_tgt = y_bottom_orig * s - dy;

        faceBox = {
          face_box_x: Math.round(x_left_tgt),
          face_box_y: Math.round(y_top_tgt),
          face_box_width: Math.round(x_right_tgt - x_left_tgt),
          face_box_height: Math.round(y_bottom_tgt - y_top_tgt)
        };
      }

      return NextResponse.json({
        name: parsed.name?.trim(),
        personality: parsed.personality?.trim(),
        physical_description: parsed.physical_description?.trim(),
        system_prompt: parsed.system_prompt?.trim(),
        ...(faceBox || {})
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
