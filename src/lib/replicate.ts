import { Buffer } from 'buffer';
import { translatePhysicalDescriptionToEnglish, enrichOutfitPrompt } from './prompt-enricher';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

/**
 * Genera una pose premium utilizando Flux PuLID en Replicate.com.
 * Fusiona la identidad facial y mantiene una gran tolerancia frente a falsos positivos de censura.
 */
export async function submitReplicatePose(params: {
  faceImageUrl: string;
  prompt: string;
  physicalDescription?: string;
  complexion?: string;
  width?: number;
  height?: number;
  isAngle?: boolean;
  webhook?: string;
}): Promise<{ success: boolean; generationId?: string; error?: string }> {
  if (!REPLICATE_API_TOKEN) {
    return { success: false, error: 'REPLICATE_API_TOKEN no configurada en el servidor' };
  }

  try {
    let finalPrompt = params.prompt;
    let complexionModifiers = "";

    if (params.complexion) {
      if (params.complexion === 'delgada' || params.complexion === 'atletica') {
        complexionModifiers = "fashion model figure, tall and thin physique, elegant body shape, flat stomach, ";
      } else if (params.complexion === 'curvilinea') {
        complexionModifiers = "voluptuous, hourglass figure, beautiful soft curves, well-proportioned, ";
      } else if (params.complexion === 'robusta' || params.complexion === 'plus-size') {
        complexionModifiers = "plus-size model, curvy woman, full figured, beautiful thick body, ";
      }
    }

    if (complexionModifiers) {
      finalPrompt = `${complexionModifiers}${params.prompt}`;
    }

    const isForcingDifferentBody = params.complexion && params.complexion !== 'promedio';
    
    // Traducir descripción física a inglés para consistencia de color de piel/cabello/ojos
    const physicalEng = params.physicalDescription
      ? translatePhysicalDescriptionToEnglish(params.physicalDescription)
      : '';

    if (physicalEng && !isForcingDifferentBody) {
      finalPrompt = `A beautiful young woman with ${physicalEng.trim()}. ${finalPrompt}`;
    }

    let startStep = 7; // Aumentado a 7 para asegurar que el cuerpo y fondo se dibujen antes de inyectar el rostro
    let idWeight = 0.78; // Reducido ligeramente a 0.78 para evitar que la cara de referencia fuerce un plano cerrado (1/4)
    let negativePrompt = "floating head, disconnected neck, neck seam, separated neck, double neck, cut-and-paste face, face swap artifact, worst quality, low quality, bad anatomy, deformed body";

    if (params.isAngle) {
      // Para ángulos pregenerados de perfil/emociones de la galería, priorizamos fidelidad de identidad y cercanía
      startStep = 3;
      idWeight = 0.85;
    } else {
      // Detección dinámica de pose para evitar contradicciones en el prompt que causen planos cerrados
      const promptLower = finalPrompt.toLowerCase();
      const isSitting = /\b(sitting|seated|sit|desk|chair|stool|edge of)\b/i.test(promptLower);
      const isLying = /\b(lying|reclining|bed|sheets|sofa|couch|floor|ground|deck|relaxing)\b/i.test(promptLower);
      const isLeaning = /\b(leaning|lean)\b/i.test(promptLower);
      
      let poseWord = "standing";
      if (isSitting) {
        poseWord = "sitting";
      } else if (isLying) {
        poseWord = "lying down";
      } else if (isLeaning) {
        poseWord = "leaning";
      }

      // Encuadre nítido desde las rodillas hacia arriba mostrando rostro y cuerpo con conexión natural del cuello y hombros
      const framingPrefix = `A high-quality three-quarter length fashion photograph of a beautiful young woman ${poseWord}, visible from the knees up, showing her face, head, shoulders, torso and legs, looking directly at the camera, posing gracefully, head naturally and seamlessly connected to neck and shoulders, neck transition looks highly natural, cinematic lighting, on-location fashion editorial photography, `;
      
      let cleanBasePrompt = finalPrompt // Corregido para mantener la descripción física y complexión
        .replace(/portrait/gi, 'three-quarter shot showing from the knees up')
        .replace(/close-up/gi, 'three-quarter shot showing from the knees up')
        .replace(/close up/gi, 'three-quarter shot showing from the knees up')
        .replace(/closeup/gi, 'three-quarter shot showing from the knees up')
        .replace(/headshot/gi, 'three-quarter shot showing from the knees up')
        .replace(/upper body/gi, 'three-quarter shot showing from the knees up')
        .trim();
        
      const skinDetails = "EXTREMELY RAW photography, sharp focus on highly detailed real human skin texture, visible pores, unretouched, imperfect natural skin, shot on high-resolution DSLR camera with 35mm lens, wide fashion photography shot, ultra high resolution, 8k, extremely sharp details, ";
      
      // Colocamos el prompt del escenario y vestuario al ABSOLUTO INICIO para que reciba el peso máximo de la IA
      finalPrompt = `${cleanBasePrompt}, ${framingPrefix}${skinDetails}absolutely no 3D rendering, no digital art, strictly real life human photography, visible from the knees up, three-quarter length shot, wide angle shot`;
      
      // Agregamos exclusión de primeros planos al negative prompt
      negativePrompt += ", close-up, close up, portrait, headshot, face crop, extreme close-up, cropped head, cropped shoulders, cropped torso, medium close-up";
    }

    console.log('[Replicate] Encolando Flux PuLID. Prompt final:', finalPrompt);

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
        input: {
          main_face_image: params.faceImageUrl,
          prompt: finalPrompt,
          width: params.width || 768, // Modificado de 896 a 768 (formato 2:3 vertical más alto para forzar visualización de piernas/rodillas)
          height: params.height || 1152,
          id_weight: idWeight,
          start_step: startStep,
          true_cfg: 1.0,
          num_steps: 20, // Limitado a 20 por validación de Replicate
          output_format: "webp",
          output_quality: 100, // Calidad máxima lossless-like
          negative_prompt: negativePrompt
        },
        ...(params.webhook ? {
          webhook: params.webhook,
          webhook_events_filter: ["completed"]
        } : {})
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Replicate] Error al crear predicción en flux-pulid:', errBody);
      return { success: false, error: errBody };
    }

    const data = await response.json();
    return { success: true, generationId: `replicate_pose_p_${data.id}` };
  } catch (error: any) {
    console.error('[Replicate] Excepción en submitReplicatePose:', error);
    return { success: false, error: error.message || 'Error de red en Replicate' };
  }
}

/**
 * Realiza un cambio de vestuario virtual (VTON) en Replicate.com.
 * Utiliza Flux PuLID en un solo paso rápido para evitar límites de tiempo (Timeout) de Vercel.
 */
export async function submitReplicateVTON(params: {
  humanImageUrl: string;
  description: string;
  category?: string;
  physicalDescription?: string;
}): Promise<{ success: boolean; generationId?: string; error?: string }> {
  if (!REPLICATE_API_TOKEN) {
    return { success: false, error: 'REPLICATE_API_TOKEN no configurada en el servidor' };
  }

  try {
    // Traducir y enriquecer la descripción de la ropa a inglés
    const cleanDescription = await enrichOutfitPrompt(params.description);

    // Traducir descripción física a inglés para respetar color de piel/ojos/pelo del avatar
    const physicalEng = params.physicalDescription
      ? translatePhysicalDescriptionToEnglish(params.physicalDescription)
      : '';
    const physicalSection = physicalEng ? `with ${physicalEng.trim()},` : '';

    // Determinar pose y fondo adecuados según la ropa solicitada para evitar contradicciones
    const descLower = cleanDescription.toLowerCase();
    const inputLower = params.description.toLowerCase();
    const isSitting = /\b(sitting|seated|sit|desk|chair|stool|edge of)\b/i.test(descLower) || /\b(sitting|seated|sit|desk|chair|stool|edge of)\b/i.test(inputLower);
    const isLying = /\b(lying|reclining|bed|sheets|sofa|couch|floor|ground|deck|relaxing)\b/i.test(descLower) || /\b(lying|reclining|bed|sheets|sofa|couch|floor|ground|deck|relaxing)\b/i.test(inputLower);
    const isLeaning = /\b(leaning|lean)\b/i.test(descLower) || /\b(leaning|lean)\b/i.test(inputLower);

    let poseWord = "standing";
    if (isSitting) {
      poseWord = "sitting";
    } else if (isLying) {
      poseWord = "lying down";
    } else if (isLeaning) {
      poseWord = "leaning";
    }

    let backgroundSetting = `posing in a beautifully styled luxury environment`;
    const isSwimwear = /\b(bikini|swimsuit|swimwear|monokini|trikini|one-piece|beachwear|swim|baño|bañador|tanga)\b/i.test(descLower) || /\b(bikini|swimsuit|swimwear|monokini|trikini|one-piece|beachwear|swim|baño|bañador|tanga)\b/i.test(inputLower);
    
    if (isSwimwear) {
      backgroundSetting = `posing on a luxury tropical resort beach with soft sand and palm trees, ocean in the background`;
    } else if (/\b(office|skirt|suit|desk|blouse|oficina|ejecutiva|saco|camisa)\b/i.test(descLower)) {
      backgroundSetting = `posing in a modern high-end office penthouse overlooking the city skyline`;
    } else if (/\b(dress|gown|evening|gala|formal|vestido|coctel)\b/i.test(descLower)) {
      backgroundSetting = `posing in a luxurious grand hotel lobby or elegant ballroom balcony at night`;
    } else if (/\b(street|jacket|jeans|hoodie|casual|calle|chaqueta|streetwear)\b/i.test(descLower)) {
      backgroundSetting = `posing on a stylish European city street with beautiful architecture`;
    }

    // Combinamos el prompt de ropa con la pose y estilo seguro, forzando rodillas hacia arriba, cara visible y cuello perfectamente integrado con fondo inteligente
    const prompt = `wearing a detailed ${cleanDescription.trim()}, ${backgroundSetting}, A RAW realistic fashion photograph of a beautiful young woman ${physicalSection} ${poseWord}, visible from the knees up, showing her head, face, upper body, torso, and legs, head naturally and seamlessly connected to neck and shoulders, neck transition looks highly natural, looking directly at the camera and smiling politely, photorealistic, professional clean lighting, three-quarter length shot, shot on high-resolution DSLR camera with 35mm lens, wide fashion photography shot, sharp focus, real skin texture, visible pores, unretouched natural skin, ultra-high resolution, 8k, extremely sharp details, visible from the knees up, three-quarter length shot, wide angle shot`;

    console.log('[Replicate] Generando VTON en un paso rápido con Flux PuLID. Prompt:', prompt);

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
        input: {
          main_face_image: params.humanImageUrl,
          prompt: prompt,
          width: 768, // Modificado de 896 a 768 (formato 2:3 vertical más alto para forzar visualización de piernas/rodillas)
          height: 1152,
          id_weight: 0.78, // Reducido ligeramente a 0.78 para evitar que la cara de referencia fuerce un plano cerrado (1/4)
          start_step: 7,   // Aumentado a 7 para asegurar que el cuerpo y fondo se dibujen antes de inyectar el rostro
          true_cfg: 1.0,
          num_steps: 20, // Limitado a 20 por validación de Replicate
          output_format: "webp",
          output_quality: 100, // Calidad máxima lossless-like
          negative_prompt: "floating head, disconnected neck, neck seam, separated neck, double neck, cut-and-paste face, face swap artifact, close-up, close up, portrait, headshot, face crop, extreme close-up, cropped head, cropped shoulders, cropped torso, medium close-up, worst quality, low quality, bad anatomy, deformed body"
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Replicate] Error en flux-pulid VTON:', errBody);
      return { success: false, error: errBody };
    }

    const data = await response.json();
    return { success: true, generationId: `replicate_vton_p_${data.id}` };
  } catch (error: any) {
    console.error('[Replicate] Excepción en submitReplicateVTON:', error);
    return { success: false, error: error.message || 'Error en el flujo de VTON' };
  }
}

/**
 * Consulta el estado de una predicción de Replicate usando el ID de predicción.
 */
export async function checkReplicateStatus(predictionId: string): Promise<{
  status: 'completed' | 'queued' | 'failed';
  imageUrl?: string;
  error?: string;
}> {
  if (!REPLICATE_API_TOKEN) {
    return { status: 'failed', error: 'REPLICATE_API_TOKEN no configurada' };
  }

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`
      }
    });

    if (!response.ok) {
      const errBody = await response.text();
      return { status: 'failed', error: `Error en Replicate API: ${errBody}` };
    }

    const data = await response.json();
    const status = data.status;

    if (status === 'succeeded') {
      const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      return { status: 'completed', imageUrl };
    }

    if (status === 'failed' || status === 'canceled') {
      return { status: 'failed', error: data.error || 'La predicción de Replicate falló o fue cancelada' };
    }

    return { status: 'queued' };
  } catch (error: any) {
    console.error('[Replicate] Excepción en checkReplicateStatus:', error);
    return { status: 'failed', error: error.message };
  }
}
