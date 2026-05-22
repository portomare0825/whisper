import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

async function testGemini() {
  if (!GOOGLE_API_KEY) {
    console.error('Falta GOOGLE_API_KEY en las variables de entorno.');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
  
  const systemInstruction = `
    Eres un asistente experto en fotografía y dirección de arte en moda para generación de imágenes de IA.
    Tu trabajo es recibir una pose, una emoción y una breve descripción de estilo del personaje, y generar un prompt de imagen enriquecido y ultra-detallado exclusivamente en INGLÉS.
    El prompt resultante debe describir detalladamente:
    1. La pose e inclinación corporal de forma natural.
    2. La emoción y expresión del rostro.
    3. Una vestimenta moderna, elegante y estilosa.
    4. Un fondo fotográfico profesional y coherente con una iluminación de estudio cálida y suave.
    
    Reglas estrictas:
    - Retorna ÚNICAMENTE una cadena de texto plana con el prompt final en inglés.
    - No agregues explicaciones, ni etiquetas como "Prompt:", ni comillas al inicio o final.
    - No uses palabras censuradas o explícitas.
  `;

  const promptInput = "Avatar: Elena. Estilo: Chica moderna y sofisticada. Pose: Medio cuerpo. Emoción: Alegre y riendo.";

  console.log('Llamando a Google Gemini...');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemInstruction}\n\nEntrada: ${promptInput}` }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.7,
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en API de Gemini (Status ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const enrichedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  console.log('\n✨ Prompt Enriquecido por Gemini:');
  console.log(enrichedPrompt);
}

testGemini().catch(console.error);
