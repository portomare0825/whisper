/**
 * Enriquecedor de Prompts Inteligente mediante Google Gemini (vía OpenRouter)
 * 
 * Permite generar prompts en inglés con un nivel extraordinario de detalle y realismo
 * fotográfico para el inpainting de poses y outfits.
 * 
 * Incluye un fallback estricto de alta calidad por si la API falla o está caída.
 */

const FALLBACK_POSES: Record<string, string> = {
  portrait: 'portrait close-up photography of the face and shoulders',
  medium: 'medium shot photography showing waist up, relaxed body language',
  full: 'full body shot photography standing, showing whole body and footwear'
};

const FALLBACK_EMOTIONS: Record<string, string> = {
  smiling: 'smiling and laughing happily, cheerful expression, warm smile, friendly look',
  angry: 'looking angry and upset, irritated expression, annoyed look, furrowed brow',
  sad: 'looking sad and melancholic, emotional expression, looking down slightly',
  winking: 'winking playfully, flirting expression, cute smirk, charming look',
  neutral: 'with a calm neutral expression, thoughtful look, serene face, serious look'
};

export async function enrichPosePrompt(params: {
  avatarName: string;
  pose: string;
  emotion: string;
  styleDescription?: string;
  outfitHint?: string;
  /** Descripción física del avatar: color de pelo, ojos, piel, etc. Extraída de la BD */
  physicalDescription?: string;
}): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterKey) {
    console.warn('OPENROUTER_API_KEY no configurado, utilizando prompt fallback determinista.');
    return getFallbackPrompt(params);
  }

  const systemInstruction = `
    Eres un asistente experto en fotografía y dirección de arte en moda para generación de imágenes de IA.
    Tu trabajo es recibir una pose, una emoción, la descripción física de un personaje y generar un prompt de imagen enriquecido y ultra-detallado exclusivamente en INGLÉS.
    El prompt resultante debe describir detalladamente:
    1. Los rasgos físicos EXACTOS del personaje (color de cabello, ojos, piel) — DEBES incluirlos siempre, son obligatorios.
    2. La pose e inclinación corporal de forma natural (retrato, medio cuerpo o cuerpo entero).
    3. La emoción y expresión del rostro.
    4. Una vestimenta moderna, elegante, estilosa y a la moda (o la ropa específica si se indica).
    5. Un fondo fotográfico profesional y coherente con una iluminación de estudio cálida y suave.
    
    Reglas estrictas:
    - Retorna ÚNICAMENTE una cadena de texto plana con el prompt final en inglés.
    - No agregues explicaciones, ni etiquetas como "Prompt:", ni comillas al inicio o final.
    - No uses palabras censuradas o explícitas.
    - Los rasgos físicos del personaje (cabello, piel, ojos) deben aparecer SIEMPRE en el resultado final.
  `.trim();

  const promptInput = `
    Avatar: ${params.avatarName}
    Descripción física (OBLIGATORIA, debe aparecer en el prompt): ${params.physicalDescription || 'beautiful young woman'}
    Estilo base: ${params.styleDescription || 'Moderna y sofisticada'}
    ${params.outfitHint ? `Ropa específica solicitada: ${params.outfitHint}` : ''}
    Pose: ${params.pose === 'portrait' ? 'Primer plano / Retrato' : params.pose === 'full' ? 'Cuerpo entero' : 'Medio cuerpo'}
    Emoción: ${params.emotion}
  `.trim();

  try {
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
        max_tokens: 200
      })
    });

    if (!response.ok) {
      console.warn(`Respuesta no exitosa de OpenRouter (${response.status}), aplicando fallback.`);
      return getFallbackPrompt(params);
    }

    const data = await response.json();
    const enriched = data.choices?.[0]?.message?.content?.trim();

    if (enriched && enriched.length > 10) {
      // Asegurar que la descripción física esté presente en el prompt final
      // aunque Gemini la haya omitido por brevedad
      if (params.physicalDescription && !enriched.toLowerCase().includes('hair') && !enriched.toLowerCase().includes('eyes')) {
        return `${params.physicalDescription}, ${enriched}`;
      }
      return enriched;
    }

    return getFallbackPrompt(params);
  } catch (error) {
    console.error('Error al llamar a OpenRouter en enrichPosePrompt:', error);
    return getFallbackPrompt(params);
  }
}

function getFallbackPrompt(params: {
  pose: string;
  emotion: string;
  styleDescription?: string;
  outfitHint?: string;
  physicalDescription?: string;
}): string {
  const posePrompt = FALLBACK_POSES[params.pose] || FALLBACK_POSES.medium;
  const emotionPrompt = FALLBACK_EMOTIONS[params.emotion] || FALLBACK_EMOTIONS.smiling;
  const clothing = params.outfitHint?.trim()
    ? params.outfitHint.trim()
    : (params.styleDescription || 'stylish matching fashion outfit');
  const physical = params.physicalDescription ? `${params.physicalDescription}, ` : '';
  
  return `${physical}${posePrompt}, ${emotionPrompt}, wearing ${clothing}`;
}
