import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Un PNG de 1x1 blanco sólido en Base64 compatible al 100% con decodificadores estrictos de PIL (Python)
const MOCK_WHITE_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Implementación autónoma de enrichPosePrompt para el test en JS Puro
async function testEnrichPosePrompt(params) {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) throw new Error('Falta OPENROUTER_API_KEY');

  const systemInstruction = `
    Eres un asistente experto en fotografía y dirección de arte en moda para generación de imágenes de IA.
    Tu trabajo es recibir una pose, una emoción y una breve descripción del estilo de un personaje, y generar un prompt de imagen enriquecido y ultra-detallado exclusivamente en INGLÉS.
    El prompt resultante debe describir detalladamente:
    1. La pose e inclinación corporal de forma natural.
    2. La emoción y expresión del rostro.
    3. Una vestimenta moderna, elegante, estilosa y a la moda.
    4. Un fondo fotográfico profesional y coherente con una iluminación de estudio cálida y suave.
    
    Reglas estrictas:
    - Retorna ÚNICAMENTE una cadena de texto plana con el prompt final en inglés.
    - No agregues explicaciones, ni etiquetas como "Prompt:", ni comillas al inicio o final.
    - No uses palabras censuradas o explícitas.
  `;

  const promptInput = `
    Avatar: ${params.avatarName}
    Estilo: ${params.styleDescription}
    Pose: ${params.pose}
    Emoción: ${params.emotion}
  `;

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
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: promptInput }
      ],
      temperature: 0.7,
      max_tokens: 150
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

// Implementación autónoma de submitFalInpainting para el test en JS Puro
async function testSubmitFalInpainting(params) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) throw new Error('Falta FAL_KEY');

  const response = await fetch(
    'https://fal.run/fal-ai/flux-general/inpainting',
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: params.baseImageUrl,
        mask_url: params.maskImageBase64,
        prompt: params.prompt,
        negative_prompt: 'nsfw, nude, naked, explicit, bad eyes, bad hands, deformed faces',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        image_size: {
          width: 576,
          height: 1024
        }
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Fal.ai HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const imageUrl = data.images?.[0]?.url || data.image?.url;
  if (!imageUrl) throw new Error('No se recibió URL de imagen de Fal.ai');
  return imageUrl;
}

async function runIntegrationTest() {
  console.log('🧪 Iniciando Test de Integración: Inpainting Híbrido (Google + Fal.ai)...');

  // 1. Cliente de Supabase Admin
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 2. Obtener el avatar de Elena
  console.log('\n1. Consultando avatar de Elena en Supabase...');
  const { data: avatar, error: avatarError } = await adminSupabase
    .from('avatars')
    .select('*')
    .eq('name', 'Elena')
    .limit(1)
    .single();

  if (avatarError || !avatar) {
    throw new Error(`No se pudo obtener el avatar de Elena: ${avatarError?.message}`);
  }

  console.log(`✅ Avatar encontrado: Elena`);
  console.log(`   - ID: ${avatar.id}`);
  console.log(`   - Imagen Base: ${avatar.base_image_url}`);
  console.log(`   - Coordenadas de Rostro: x=${avatar.face_box_x}, y=${avatar.face_box_y}, w=${avatar.face_box_width}, h=${avatar.face_box_height}`);

  // 3. Enriquecer el prompt con Google Gemini (OpenRouter)
  console.log('\n2. Llamando a Google Gemini (OpenRouter) para enriquecer el prompt...');
  const styleDescription = avatar.personality 
    ? `A beautiful young woman matching style: ${avatar.personality}` 
    : 'A stylish and elegant young woman';

  const enrichedPrompt = await testEnrichPosePrompt({
    avatarName: avatar.name,
    pose: 'medium', // Medio Cuerpo
    emotion: 'smiling', // Alegre/Riendo
    styleDescription
  });

  console.log('✅ Prompt Enriquecido por Gemini con éxito:');
  console.log(`   > "${enrichedPrompt}"`);

  // 4. Ejecutar Fal.ai FLUX Inpainting
  console.log('\n3. Enviando petición de Inpainting a Fal.ai FLUX (esto tardará unos 15-30s)...');
  const imageUrl = await testSubmitFalInpainting({
    baseImageUrl: avatar.base_image_url,
    maskImageBase64: MOCK_WHITE_PNG_BASE64,
    prompt: enrichedPrompt
  });

  console.log('\n🎉 ¡Test de Integración Completado Exitosamente!');
  console.log(`   - URL de la Imagen Resultante: ${imageUrl}`);
}

runIntegrationTest().catch((err) => {
  console.error('\n❌ El test de integración falló:');
  console.error(err);
  process.exit(1);
});
