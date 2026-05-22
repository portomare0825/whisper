import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function testOpenRouterGemini() {
  if (!OPENROUTER_API_KEY) {
    console.error('Falta OPENROUTER_API_KEY en las variables de entorno.');
    return;
  }

  const systemInstruction = `
    Eres un asistente experto en fotografía y dirección de arte en moda para generación de imágenes de IA.
    Tu trabajo es recibir una pose, una emoción y una breve descripción del estilo del personaje, y generar un prompt de imagen enriquecido y ultra-detallado exclusivamente en INGLÉS.
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

  console.log('Llamando a Google Gemini a través de OpenRouter...');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AvatarChat Pro'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: systemInstruction
        },
        {
          role: 'user',
          content: promptInput
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en OpenRouter (Status ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const enrichedPrompt = data.choices?.[0]?.message?.content?.trim();
  console.log('\n✨ Prompt Enriquecido por Gemini (vía OpenRouter):');
  console.log(enrichedPrompt);
}

testOpenRouterGemini().catch(console.error);
