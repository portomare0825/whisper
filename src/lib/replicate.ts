import { Buffer } from 'buffer';

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
    if (params.physicalDescription && !isForcingDifferentBody) {
      finalPrompt = `Detailed human physical appearance: ${params.physicalDescription}. ${finalPrompt}`;
    }

    const framingPrefix = "A realistic three-quarter length shot of a person standing, visible from the knees up, full body crop from knees up, standing gracefully, cinematic lighting, professional fashion editorial photography, ";
    let cleanBasePrompt = params.prompt.replace(/portrait/gi, 'three-quarter shot').trim();
    const skinDetails = "EXTREMELY RAW photography, sharp focus on highly detailed real human skin texture, visible pores, unretouched, imperfect natural skin, shot on high-resolution DSLR camera with 50mm lens, ";
    
    finalPrompt = `${framingPrefix}${skinDetails}absolutely no 3D rendering, no digital art, strictly real life human photography, ${cleanBasePrompt}`;

    console.log('[Replicate] Encolando Flux PuLID. Prompt final:', finalPrompt);

    const response = await fetch("https://api.replicate.com/v1/models/bytedance/flux-pulid/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          main_face_image: params.faceImageUrl,
          prompt: finalPrompt,
          width: params.width || 896,
          height: params.height || 1152,
          id_weight: 1.0,
          start_step: 4,
          true_cfg: 1.0,
          num_steps: 20
        }
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
 * Primero genera la prenda de forma aislada y luego realiza el try-on con IDM-VTON.
 */
export async function submitReplicateVTON(params: {
  humanImageUrl: string;
  description: string;
  category?: string;
}): Promise<{ success: boolean; generationId?: string; error?: string }> {
  if (!REPLICATE_API_TOKEN) {
    return { success: false, error: 'REPLICATE_API_TOKEN no configurada en el servidor' };
  }

  try {
    // 1. Generar la prenda de vestir por texto usando Flux Schnell en Replicate
    console.log('[Replicate] Generando prenda de vestir con Flux Schnell para VTON:', params.description);
    const garmentPrompt = `a professional high-quality studio product photo of ${params.description.trim()}, clothing item, flat lay or hanger, solid white background, clean catalog shot`;

    const fluxResponse = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          prompt: garmentPrompt,
          aspect_ratio: "3:4",
          disable_safety_checker: true
        }
      })
    });

    if (!fluxResponse.ok) {
      const errBody = await fluxResponse.text();
      console.error('[Replicate] Error en Flux Schnell al generar prenda:', errBody);
      return { success: false, error: `Error generando prenda: ${errBody}` };
    }

    let fluxData = await fluxResponse.json();
    let garmentImageUrl: string | undefined;

    // Esperar de forma síncrona a que termine Schnell (tarda 2-4 segs)
    let attempts = 0;
    while (attempts < 15 && fluxData.status !== 'succeeded' && fluxData.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${fluxData.id}`, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` }
      });
      if (pollResponse.ok) {
        fluxData = await pollResponse.json();
      }
      attempts++;
    }

    if (fluxData.status === 'succeeded' && fluxData.output) {
      garmentImageUrl = Array.isArray(fluxData.output) ? fluxData.output[0] : fluxData.output;
    }

    if (!garmentImageUrl) {
      return { success: false, error: 'No se pudo generar la imagen aislada de la prenda de vestir' };
    }

    console.log('[Replicate] Prenda generada con éxito:', garmentImageUrl);

    // 2. Realizar el Try-On con IDM-VTON en Replicate
    console.log('[Replicate] Iniciando IDM-VTON...');
    
    // Mapear categoría
    let category = params.category || "upper_body";
    const descLower = params.description.toLowerCase();
    if (descLower.includes("dress") || descLower.includes("robe") || descLower.includes("vestido")) {
      category = "dresses";
    } else if (descLower.includes("pant") || descLower.includes("skirt") || descLower.includes("jean") || descLower.includes("shorts")) {
      category = "lower_body";
    }

    const response = await fetch("https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          garm_img: garmentImageUrl,
          human_img: params.humanImageUrl,
          garment_des: params.description.trim(),
          category: category,
          crop: true
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Replicate] Error en IDM-VTON al realizar try-on:', errBody);
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
