import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function testAnalyze() {
  if (!OPENROUTER_API_KEY) {
    console.error('Falta OPENROUTER_API_KEY');
    return;
  }

  const imagePath = path.join(process.cwd(), 'public', 'test_image.png');
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');
  const mimeType = 'image/png';

  console.log('Llamando a OpenRouter...');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AvatarChat Pro'
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
                "name": "Genera un nombre extremadamente atractivo, original y con gran frescura y variedad en español (evita absolutamente clichés típicos de siempre como Camila, Valeria, Lucas o Sofía). Puedes sugerir nombres modernos, elegantes, exóticos, clásicos recuperados o con un toque de fantasía que encajen a la perfección con la etnia, estilo y rasgos visuales del avatar en la foto (ejemplo: Aitana, Dante, Kenzo, Bianca, Amira, Gael, Elio, Ainhoa, Liam, Kayla, etc.).",
                "personality": "Una descripción muy atractiva de su personalidad y rasgos de comportamiento (mínimo 2 líneas).",
                "physical_description": "Describe exhaustivamente la apariencia física del personaje cubriendo los pilares de consistencia visual: Edad, contextura, estatura, estructura facial exacta (nariz, labios, mandíbula, cejas), tipo/color/estilo de cabello, color y forma de ojos, textura de la piel (lunares, pecas), ropa/estilo y vibra/iluminación general. Esta descripción debe ser lo suficientemente detallada para que un motor de IA pueda dibujar exactamente a la misma persona desde otros ángulos. PROHIBIDO usar palabras como 3D, dibujo o animación.",
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
  console.log('Result:', JSON.stringify(result, null, 2));
}

testAnalyze().catch(console.error);
