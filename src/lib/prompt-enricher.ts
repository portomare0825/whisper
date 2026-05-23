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
  full: 'full body shot photography standing, showing the complete person from head to toe, explicitly showing shoes and footwear on the ground'
};

const FALLBACK_EMOTIONS: Record<string, string> = {
  smiling: 'smiling and laughing happily, cheerful expression, warm smile, friendly look',
  angry: 'looking angry and upset, irritated expression, annoyed look, furrowed brow',
  sad: 'looking sad and melancholic, emotional expression, looking down slightly',
  winking: 'winking playfully, flirting expression, cute smirk, charming look',
  neutral: 'with a calm neutral expression, thoughtful look, serene face, serious look'
};

/**
 * Traduce descriptores físicos básicos en español a inglés para que FLUX no los ignore.
 */
/**
 * Traduce descriptores físicos básicos en español a inglés para que FLUX no los ignore.
 */
export function translatePhysicalDescriptionToEnglish(text: string): string {
  if (!text) return '';
  let eng = text.toLowerCase();
  
  // Diccionario de traducción español -> inglés robusto para rasgos físicos
  const dict: Record<string, string> = {
    // Cabello - Frases específicas compuestas primero para evitar sustituciones parciales erróneas
    'cabello castaño oscuro': 'dark brown hair',
    'cabello castano oscuro': 'dark brown hair',
    'pelo castaño oscuro': 'dark brown hair',
    'pelo castano oscuro': 'dark brown hair',
    'cabello castaño claro': 'light brown hair',
    'cabello castano claro': 'light brown hair',
    'pelo castaño claro': 'light brown hair',
    'pelo castano claro': 'light brown hair',
    
    'cabello rubio oscuro': 'dark blonde hair',
    'pelo rubio oscuro': 'dark blonde hair',
    'cabello rubio claro': 'light blonde hair',
    'pelo rubio claro': 'light blonde hair',

    'cabello castaño': 'dark brown hair',
    'cabello castano': 'dark brown hair',
    'pelo castaño': 'dark brown hair',
    'pelo castano': 'dark brown hair',
    'cabello rubio': 'blonde hair',
    'pelo rubio': 'blonde hair',
    'cabello negro': 'black hair',
    'pelo negro': 'black hair',
    'cabello rojo': 'red hair',
    'pelo rojo': 'red hair',
    'cabello pelirrojo': 'red hair',
    'pelo pelirrojo': 'red hair',
    'cabello cobrizo': 'copper hair',
    'pelo cobrizo': 'copper hair',
    
    // Ojos
    'ojos marrones': 'brown eyes',
    'ojos castaños': 'brown eyes',
    'ojos castanos': 'brown eyes',
    'ojos verdes': 'green eyes',
    'ojos azules': 'blue eyes',
    'ojos negros': 'black eyes',
    'ojos de color': 'colored eyes',
    
    // Piel y Tez
    'piel de tez clara': 'fair complexion',
    'tez clara': 'fair complexion',
    'piel clara': 'fair skin',
    'piel blanca': 'pale skin',
    'piel morena': 'olive skin',
    'piel trigueña': 'olive skin',
    'piel triguena': 'olive skin',
    'piel tostada': 'tanned skin',
    'tez morena': 'olive complexion',
    'tez trigueña': 'olive complexion',
    'tez triguena': 'olive complexion',

    // Palabras individuales clave
    'castaña': 'brown',
    'castana': 'brown',
    'castaño': 'brown',
    'castano': 'brown',
    'rubio': 'blonde',
    'rubia': 'blonde',
    'negro': 'black',
    'negra': 'black',
    'rojo': 'red',
    'roja': 'red',
    'oscuro': 'dark',
    'oscura': 'dark',
    'claro': 'light',
    'clara': 'light',
    'trigueño': 'olive',
    'trigueña': 'olive',
    'triguena': 'olive',
    'moreno': 'olive',
    'morena': 'olive',
    
    'delgada': 'slender',
    'delgado': 'slender',
    'atletica': 'athletic',
    'atlética': 'athletic',
    'atletico': 'athletic',
    'atlético': 'athletic',
    'hermosa': 'beautiful',
    'hermoso': 'beautiful',
    'joven': 'young woman',
    'chica': 'girl',
    'mujer': 'woman',
    'modelo': 'model',
  };

  // Reemplazar frases y palabras comunes
  for (const [key, value] of Object.entries(dict)) {
    eng = eng.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
  }
  
  // Reemplazar preposiciones y conectores de forma segura
  eng = eng
    .replace(/\bcabello\b/g, 'hair')
    .replace(/\bpelo\b/g, 'hair')
    .replace(/\bojos\b/g, 'eyes')
    .replace(/\bpiel\b/g, 'skin')
    .replace(/\btez\b/g, 'complexion')
    .replace(/\bcon\b/g, 'with')
    .replace(/\by\b/g, 'and')
    .replace(/\buna\b/g, 'a')
    .replace(/\bun\b/g, 'a')
    .replace(/\bde\b/g, 'with')
    .replace(/\btiene\b/g, 'has');

  return eng;
}

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

  // Traducir descripción física si viene en español
  const physicalEng = params.physicalDescription
    ? translatePhysicalDescriptionToEnglish(params.physicalDescription)
    : '';

  if (!openrouterKey) {
    console.warn('OPENROUTER_API_KEY no configurado, utilizando prompt fallback determinista.');
    return getFallbackPrompt(params);
  }

  const systemInstruction = `
    Eres un asistente experto en fotografía de moda y dirección de arte para la generación de imágenes con FLUX.
    Tu trabajo es recibir una pose, una emoción, la descripción física de un personaje y generar un prompt de imagen enriquecido y ultra-detallado exclusivamente en INGLÉS.
    
    Reglas críticas de formato y prioridad:
    1. Traduce la descripción física provista al inglés de manera perfecta y colócala OBLIGATORIAMENTE al ABSOLUTO INICIO del prompt (por ejemplo: "A young woman with dark brown hair, olive skin, and green eyes..."). Esto es crucial para que el modelo de difusión FLUX dé prioridad máxima a estos rasgos y respete fielmente el color de cabello, ojos y piel del avatar.
    2. El prompt resultante debe ser en INGLÉS y describir con alto detalle de moda:
       - Los rasgos físicos EXACTOS del avatar (color de cabello, color de ojos y tono de piel), sin modificarlos, contradecirlos ni omitirlos en absoluto.
       - La pose e inclinación corporal de forma corporal natural.
       - La emoción y expresión del rostro de forma natural.
       - Una vestimenta moderna, elegante y a la moda (o la ropa específica si se indica).
       - Un fondo fotográfico profesional y coherente con una iluminación de estudio cálida y suave.
    
    Reglas de encuadre para la Pose:
    - Para pose "full" (Cuerpo entero), el prompt DEBE describir obligatoriamente a la persona de pies a cabeza de pie, detallando explícitamente su calzado/zapatos, las piernas completas y el suelo en el que está parada (por ejemplo: "standing on the polished wooden floor showing her stylish heels"). Esto es vital para alejar la cámara de la IA y evitar planos de medio cuerpo o primeros planos. NO describas detalles de primer plano del rostro ni retratos cuando sea cuerpo entero.
    
    Otras reglas:
    - Retorna ÚNICAMENTE una cadena de texto plana con el prompt final en inglés.
    - No agregues introducciones, explicaciones, ni etiquetas como "Prompt:", ni comillas al inicio o final.
    - No menciones ni contradigas el color de pelo ni de ojos en ninguna otra parte del prompt.
  `.trim();

  const promptInput = `
    Avatar: ${params.avatarName}
    Descripción física del avatar (Traducir a inglés y colocar al inicio): ${params.physicalDescription || 'Una mujer joven y hermosa'}
    Estilo base: ${params.styleDescription || 'Moderna y sofisticada'}
    ${params.outfitHint ? `Ropa específica solicitada: ${params.outfitHint}` : ''}
    Pose solicitada: ${params.pose === 'portrait' ? 'Primer plano / Retrato (portrait)' : params.pose === 'full' ? 'Cuerpo entero de pies a cabeza (full body shot standing showing shoes and footwear on the ground)' : 'Medio cuerpo (medium shot waist up)'}
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
    let enriched = data.choices?.[0]?.message?.content?.trim();

    if (enriched && enriched.length > 10) {
      // Limpiar comillas iniciales/finales si Gemini las agregó
      enriched = enriched.replace(/^["']|["']$/g, '');

      // Estructurar de manera determinista el encuadre para forzar la consistencia fotográfica
      let finalPrompt = enriched;

      if (params.pose === 'full') {
        const fullBodyPrefix = "Full-body photograph, head-to-toe shot showing the complete person standing from head to feet, shoes fully visible on the floor";
        if (physicalEng) {
          finalPrompt = `${fullBodyPrefix}, ${physicalEng.trim()}, ${finalPrompt.replace(/full-body/gi, '').replace(/head-to-toe/gi, '').trim()}`;
        } else {
          finalPrompt = `${fullBodyPrefix}, ${finalPrompt}`;
        }
      } else if (params.pose === 'portrait') {
        const portraitPrefix = "Portrait photography, close-up shot of the face and shoulders";
        if (physicalEng) {
          finalPrompt = `${portraitPrefix}, ${physicalEng.trim()}, ${finalPrompt.trim()}`;
        } else {
          finalPrompt = `${portraitPrefix}, ${finalPrompt}`;
        }
      } else { // medium or others
        const mediumPrefix = "Medium shot photography, waist-up view";
        if (physicalEng) {
          finalPrompt = `${mediumPrefix}, ${physicalEng.trim()}, ${finalPrompt.trim()}`;
        } else {
          finalPrompt = `${mediumPrefix}, ${finalPrompt}`;
        }
      }

      return finalPrompt;
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
  const emotionPrompt = FALLBACK_EMOTIONS[params.emotion] || FALLBACK_EMOTIONS.smiling;
  const clothing = params.outfitHint?.trim()
    ? params.outfitHint.trim()
    : (params.styleDescription || 'stylish matching fashion outfit');
  
  const physicalEng = params.physicalDescription
    ? translatePhysicalDescriptionToEnglish(params.physicalDescription)
    : '';
  const physical = physicalEng ? `${physicalEng.trim()}, ` : '';

  let framingPrefix = "Medium shot photography, waist-up view";
  if (params.pose === 'full') {
    framingPrefix = "Full-body photograph, head-to-toe shot showing the complete person standing from head to feet, shoes fully visible on the floor";
  } else if (params.pose === 'portrait') {
    framingPrefix = "Portrait photography, close-up shot of the face and shoulders";
  }
  
  return `${framingPrefix}, ${physical}${emotionPrompt}, wearing ${clothing}`;
}
