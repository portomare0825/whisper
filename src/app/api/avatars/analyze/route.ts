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

interface VisionProfile {
  name?: string;
  personality?: string;
  physical_description?: string;
  system_prompt?: string;
  ymin?: number;
  xmin?: number;
  ymax?: number;
  xmax?: number;
}

function parseRobustJSON(text: string): VisionProfile {
  // 1. Limpieza inicial: quitar fences de markdown
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 2. Intento de parseo directo
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (e) {}

  // 3. Intento de extraer el bloque {...} principal (remueve texto introductorio/conclusión)
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonSub = cleaned.slice(start, end + 1);
      const parsed = JSON.parse(jsonSub);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {}

  // 4. Intento con limpieza de saltos de línea dentro de las cadenas del JSON
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      let jsonSub = cleaned.slice(start, end + 1);
      // Reemplazar saltos de línea reales dentro de valores de comillas por \n
      jsonSub = jsonSub.replace(/:\s*"([^"]*)"/g, (match, p1) => {
        return ': "' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
      });
      // Quitar comas colgadas (trailing commas) antes de llaves de cierre
      jsonSub = jsonSub.replace(/,\s*([}\]])/g, '$1');
      
      const parsed = JSON.parse(jsonSub);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {}

  // 5. Fallback definitivo: extracción por expresiones regulares (Regex) campo por campo
  console.warn('Fallo el parseo JSON en /api/avatars/analyze, aplicando extracción por Regex.');
  
  const extractString = (field: string): string => {
    // 1. Intento estándar con comillas bien formadas y escapes
    const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*(?:\\\\"[^"]*)*)"`, 's');
    const match = cleaned.match(regex);
    if (match && match[1]) {
      return match[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .trim();
    }

    // 2. Fallback súper robusto en caso de comillas internas no escapadas:
    // Captura todo desde el inicio del valor hasta el inicio de la siguiente clave conocida (o llave de cierre)
    const fallbackRegex = new RegExp(`"${field}"\\s*:\\s*["']?(.*?)(?:["']?\\s*(?:,\\s*"[a-zA-Z0-9_-]+"\\s*:|\\s*}))`, 's');
    const fallbackMatch = cleaned.match(fallbackRegex);
    if (fallbackMatch && fallbackMatch[1]) {
      return fallbackMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .trim();
    }

    return '';
  };

  const extractNumber = (field: string): number | undefined => {
    const regex = new RegExp(`"${field}"\\s*:\\s*(\\d+)`, 'i');
    const match = cleaned.match(regex);
    return match && match[1] ? parseInt(match[1], 10) : undefined;
  };

  return {
    name: extractString('name'),
    personality: extractString('personality'),
    physical_description: extractString('physical_description'),
    system_prompt: extractString('system_prompt'),
    ymin: extractNumber('ymin'),
    xmin: extractNumber('xmin'),
    ymax: extractNumber('ymax'),
    xmax: extractNumber('xmax'),
  };
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

    const systemInstruction = `
      Eres un psicólogo y escritor creativo experto en perfiles de personajes para juegos de rol de inteligencia artificial.
      Tu tarea es analizar la imagen proporcionada de un avatar y generar un perfil creativo completo y localizar el rostro principal.
      
      Debes responder ÚNICAMENTE con un objeto JSON válido (sin formato Markdown, sin texto introductorio ni de conclusión) con la siguiente estructura (todas las respuestas de texto en español):
      {
        "name": "Un nombre extremadamente atractivo, original y con gran frescura y variedad en español (evita absolutamente clichés típicos de siempre como Camila, Valeria, Lucas o Sofía). Sugiere nombres modernos, elegantes, exóticos, clásicos recuperados o con un toque de fantasía que encajen a la perfección con la etnia, estilo y rasgos visuales del avatar en la foto (ejemplo: Aitana, Dante, Kenzo, Bianca, Amira, Gael, Elio, Ainhoa, Liam, Kayla, etc.).",
        "personality": "Una descripción muy atractiva de su personalidad y rasgos de comportamiento (mínimo 2 líneas).",
        "physical_description": "Describe de forma exhaustiva pero amigable la apariencia física del personaje en español cubriendo: Edad estimada, complexión/contextura, estatura, rasgos faciales (labios, nariz, ojos, cejas), color y tipo de cabello, color de ojos, ropa/estilo y vibra/iluminación general. Esta descripción servirá para recrear al avatar de forma consistente. Prohibido usar palabras como 3D, dibujo o animación.",
        "system_prompt": "Instrucciones de comportamiento detalladas (3-4 líneas) escritas en segunda persona para guiar a la IA durante el chat de rol.",
        "ymin": entero de 0 a 1000 (borde superior del rostro),
        "xmin": entero de 0 a 1000 (borde izquierdo del rostro),
        "ymax": entero de 0 a 1000 (borde inferior del rostro),
        "xmax": entero de 0 a 1000 (borde derecho del rostro)
      }
    `.trim();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AvatarChat Pro'
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: systemInstruction
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analiza detalladamente esta foto de avatar, genera su perfil y localiza su rostro en formato JSON."
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

    try {
      const parsed = parseRobustJSON(text);

      // Si no logramos extraer absolutamente nada de texto, lanzar error
      if (!parsed.name && !parsed.personality && !parsed.physical_description) {
        throw new Error('No se pudo extraer ningún campo válido de la respuesta.');
      }

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
        name: parsed.name?.trim() || '',
        personality: parsed.personality?.trim() || '',
        physical_description: parsed.physical_description?.trim() || '',
        system_prompt: parsed.system_prompt?.trim() || '',
        ...(faceBox || {})
      });
    } catch (parseError: any) {
      console.error('Error parsing JSON from Vision API:', parseError, text);
      return NextResponse.json(
        { error: `Error al analizar la estructura del perfil: ${parseError.message || parseError}` },
        { status: 422 }
      );
    }
  } catch (err: any) {
    console.error('Error en /api/avatars/analyze:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al analizar la imagen' },
      { status: 500 }
    );
  }
}
