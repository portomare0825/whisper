export interface GeneratePoseParams {
  faceImageUrl: string;
  templatePoseUrl: string;
  basePrompt: string;
  complexion?: string;
  gender?: string;
  physicalDescription?: string;
}

export interface FalInstantIDResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationId?: string;
}

/**
 * Codifica el resultado de Fal.ai en un formato base64 compatible
 * con la arquitectura actual de polling del frontend.
 */
function encodeResult(imageUrl: string, prompt: string): string {
  try {
    const payload = JSON.stringify({ t: 'fal_pose', u: imageUrl, p: prompt });
    return 'fal_' + Buffer.from(payload).toString('base64url');
  } catch {
    return 'fal_error';
  }
}

/**
 * Genera la pose premium utilizando InstantID en Fal.ai,
 * fusionando la foto de la cara del usuario con la plantilla
 * e inyectando la complexión física.
 */
export async function generatePosePremium(params: GeneratePoseParams): Promise<FalInstantIDResult> {
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return { success: false, error: 'FAL_KEY no configurada en el servidor' };
  }

  try {
    // 1. Construir el prompt dinámico inyectando la complexión física si existe
    let finalPrompt = params.basePrompt;
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
      finalPrompt = `${complexionModifiers}${params.basePrompt}`;
    }

    const isForcingDifferentBody = params.complexion && params.complexion !== 'promedio';

    if (params.physicalDescription && !isForcingDifferentBody) {
      finalPrompt = `Detailed human physical appearance: ${params.physicalDescription}. ${finalPrompt}`;
    }

    // Forzar encuadre de tres cuartos (de rodillas para arriba) en la primera posición del prompt
    const framingPrefix = "A realistic three-quarter length shot of a person standing, visible from the knees up, full body crop from knees up, standing gracefully, cinematic lighting, professional fashion editorial photography, ";
    
    // Quitar la palabra "portrait" de cualquier prompt base
    let cleanBasePrompt = params.basePrompt.replace(/portrait/gi, 'three-quarter shot').trim();

    // Detalles de piel de altísima calidad (ultra realistas al hacer zoom/ampliar) pero sin usar "macro shot" ni lentes cerrados que causan primeros planos
    const skinDetails = "EXTREMELY RAW photography, sharp focus on highly detailed real human skin texture, visible pores, subtle skin blemishes, freckles, fine peach fuzz, unretouched, imperfect natural skin, shot on high-resolution DSLR camera with 50mm lens, ";
    
    finalPrompt = `${framingPrefix}${skinDetails}absolutely no 3D rendering, no digital art, strictly real life human photography, ${cleanBasePrompt}`;

    console.log('Generando Pose Premium con InstantID (PuLID 16:9). Prompt final:', finalPrompt);

    // 2. Llamada a Fal.ai usando el endpoint de Flux PuLID
    const response = await fetch('https://fal.run/fal-ai/flux-pulid', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_image_url: params.faceImageUrl,    // Imagen del rostro a inyectar
        prompt: finalPrompt,
        image_size: "portrait_16_9",
        sync_mode: true,
        enable_safety_checker: false                 // Evitamos las imágenes negras por falsos positivos
      })
    });

    if (!response.ok) {
      let errorDetail = `Fal.ai respondió con status ${response.status}`;
      try {
        const errBody = await response.text();
        const parsed = JSON.parse(errBody);
        errorDetail = parsed.detail?.message || parsed.error || parsed.message || errBody;
      } catch {}
      console.error('Fal.ai InstantID Error:', errorDetail);
      return { success: false, error: errorDetail };
    }

    const data = await response.json();
    
    let imageUrl: string | undefined;
    if (data?.images?.[0]?.url) {
      imageUrl = data.images[0].url;
    } else if (data?.image?.url) {
      imageUrl = data.image.url;
    } else if (typeof data?.image === 'string') {
      imageUrl = data.image;
    }

    if (!imageUrl) {
      console.error('Fal.ai no devolvió URL de imagen:', JSON.stringify(data).slice(0, 500));
      return { success: false, error: 'Fal.ai no devolvió una imagen válida' };
    }

    const generationId = encodeResult(imageUrl, finalPrompt);

    return {
      success: true,
      imageUrl,
      generationId,
    };
  } catch (err: any) {
    console.error('Error llamando a Fal.ai InstantID:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}
