/**
 * Adaptador para Fal.ai FLUX Inpainting
 * 
 * Permite realizar inpainting de alta calidad con el modelo FLUX, asegurando consistencia
 * facial absoluta (el rostro original protegido por la máscara no cambia en absoluto).
 * 
 * Utiliza el mismo truco stateless de codificar el resultado en el generation_id.
 */

import { translatePhysicalDescriptionToEnglish } from './prompt-enricher';

interface FalInpaintingResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationId?: string;
}

function encodeResult(imageUrl: string, prompt: string): string {
  try {
    const payload = JSON.stringify({ t: 'falinp', u: imageUrl, p: prompt });
    return 'falinp_' + Buffer.from(payload).toString('base64url');
  } catch {
    return 'falinp_error';
  }
}

export function decodeInpaintingResult(generationId: string): {
  imageUrl: string;
  prompt: string;
} | null {
  try {
    if (!generationId.startsWith('falinp_')) return null;
    const b64 = generationId.slice(7);
    const raw = Buffer.from(b64, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.t !== 'falinp') return null;
    return { imageUrl: parsed.u, prompt: parsed.p };
  } catch {
    return null;
  }
}

export async function submitFalInpainting(params: {
  /** URL pública del avatar O base64 data URL (jpeg/png) normalizada a 576×1024 */
  baseImage: string;
  maskImageBase64: string;
  prompt: string;
}): Promise<FalInpaintingResult> {
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return {
      success: false,
      error: 'FAL_KEY no configurada en el servidor',
    };
  }

  try {
    console.log('Iniciando Fal.ai FLUX Inpainting (576×1024). Prompt:', params.prompt);

    const negativePrompt = 'nsfw, nude, naked, explicit, bad eyes, bad hands, deformed faces, bad anatomy, blur, low quality, distorted, extra limbs, watermark, text, lowres, ugly';

    // Si el frontend normalizó la imagen, ambos inputs (image + mask) son 576×1024.
    // No se especifica image_size para dejar que Fal.ai use las dimensiones reales.
    const body: Record<string, unknown> = {
      image_url: params.baseImage,
      mask_url: params.maskImageBase64,
      prompt: params.prompt,
      negative_prompt: negativePrompt,
      num_inference_steps: 30,
      guidance_scale: 3.5,
      enable_safety_checker: false,
      disable_safety_checker: true
    };

    // Si la imagen viene como base64 (data URL), Fal.ai la procesa igual.
    // Sólo añadimos image_size si la imagen es una URL pública (fallback sin normalización)
    if (!params.baseImage.startsWith('data:')) {
      body.image_size = { width: 576, height: 1024 };
    }

    const response = await fetch(
      'https://fal.run/fal-ai/flux-general/inpainting',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      let errDetail = `Error en la API de Fal.ai Inpainting (Status ${response.status})`;
      try {
        const errBody = await response.text();
        const parsed = JSON.parse(errBody);
        errDetail = parsed.detail?.message || parsed.error || parsed.message || errBody;
      } catch {}
      console.error('Error en Fal.ai FLUX Inpainting:', errDetail);
      return {
        success: false,
        error: `Fallo en el servicio de inpainting de Fal.ai: ${errDetail}`,
      };
    }

    const data = await response.json();
    let generatedImageUrl: string | undefined;

    if (data?.images?.[0]?.url) {
      generatedImageUrl = data.images[0].url;
    } else if (data?.image?.url) {
      generatedImageUrl = data.image.url;
    }

    if (!generatedImageUrl) {
      console.error('Fal.ai FLUX Inpainting no devolvió una URL de imagen válida:', JSON.stringify(data));
      return {
        success: false,
        error: 'El servicio de generación no devolvió un resultado de imagen válido.',
      };
    }

    console.log('Imagen con inpainting y rostro intacto generada con éxito:', generatedImageUrl);

    // Codificar el resultado en el generationId para el polling stateless
    const generationId = encodeResult(generatedImageUrl, params.prompt);

    return {
      success: true,
      imageUrl: generatedImageUrl,
      generationId,
    };

  } catch (err) {
    console.error('Excepción en submitFalInpainting:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado al conectar con Fal.ai',
    };
  }
}

export async function submitFalPoseWithFaceSwap(params: {
  /** URL pública del avatar O base64 data URL (jpeg/png) normalizada a 576×1024 */
  baseImage: string;
  prompt: string;
  /** Descripción física del avatar: color de pelo, ojos, piel — se inyecta como prefijo en el prompt de FLUX */
  physicalDescription?: string;
}): Promise<FalInpaintingResult> {
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return {
      success: false,
      error: 'FAL_KEY no configurada en el servidor',
    };
  }

  try {
    // Construir prompt con rasgos físicos al inicio para máxima fidelidad en FLUX Dev
    // Los modelos de difusión dan mayor peso a los tokens al principio del prompt.
    // Solo anteponemos si la descripción física en inglés no está ya presente al inicio del prompt.
    let finalFluxPrompt = params.prompt;
    if (params.physicalDescription) {
      const physicalEng = translatePhysicalDescriptionToEnglish(params.physicalDescription);
      if (physicalEng) {
        const firstWord = physicalEng.split(' ')[0]?.toLowerCase();
        if (firstWord && !params.prompt.toLowerCase().includes(firstWord)) {
          finalFluxPrompt = `${physicalEng.trim()}, ${params.prompt}`;
        }
      }
    }

    console.log('Iniciando Paso 1: Generación de pose libre con Fal.ai FLUX Dev. Prompt:', finalFluxPrompt);


    // 1. Generar la pose con FLUX Dev en 576x1024
    const fluxResponse = await fetch(
      'https://fal.run/fal-ai/flux/dev',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: finalFluxPrompt,
          image_size: {
            width: 576,
            height: 1024
          },
          sync_mode: true,
          enable_safety_checker: false,
          disable_safety_checker: true
        }),
      }
    );

    if (!fluxResponse.ok) {
      let errDetail = `Error en FLUX Dev (Status ${fluxResponse.status})`;
      try {
        const errBody = await fluxResponse.text();
        const parsed = JSON.parse(errBody);
        errDetail = parsed.detail?.message || parsed.error || parsed.message || errBody;
      } catch {}
      console.error('Error en Fal.ai FLUX Dev:', errDetail);
      return {
        success: false,
        error: `Fallo al generar la pose en FLUX Dev: ${errDetail}`,
      };
    }

    const fluxData = await fluxResponse.json();
    let newPoseImageUrl: string | undefined;

    if (fluxData?.images?.[0]?.url) {
      newPoseImageUrl = fluxData.images[0].url;
    } else if (fluxData?.image?.url) {
      newPoseImageUrl = fluxData.image.url;
    }

    if (!newPoseImageUrl) {
      console.error('FLUX Dev no devolvió una URL de imagen válida:', JSON.stringify(fluxData));
      return {
        success: false,
        error: 'El servicio FLUX Dev no devolvió un resultado de imagen de pose válido.',
      };
    }

    console.log('Paso 1 Completado. Pose libre generada con éxito:', newPoseImageUrl);
    console.log('Iniciando Paso 2: Face Swap con el rostro original del avatar...');

    // 2. Aplicar Face Swap sobre la pose generada utilizando el rostro original
    // Usamos el modelo oficial fal-ai/face-swap que preserva la identidad facial y el parecido de forma muy superior
    const swapResponse = await fetch(
      'https://fal.run/fal-ai/face-swap',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_image_url: newPoseImageUrl, // Imagen destino con la pose libre
          swap_image_url: params.baseImage, // Rostro fuente del avatar
        }),
      }
    );

    if (!swapResponse.ok) {
      let errDetail = `Error en Face Swap (Status ${swapResponse.status})`;
      try {
        const errBody = await swapResponse.text();
        const parsed = JSON.parse(errBody);
        errDetail = parsed.detail?.message || parsed.error || parsed.message || errBody;
      } catch {}
      console.error('Error en Fal.ai Face Swap:', errDetail);
      // Fallback: Si el swap de cara falla, al menos devolvemos la pose generada
      console.warn('Usando fallback de pose sin swap debido a error.');
      const generationId = encodeResult(newPoseImageUrl, params.prompt);
      return {
        success: true,
        imageUrl: newPoseImageUrl,
        generationId,
      };
    }

    const swapData = await swapResponse.json();
    let finalImageUrl: string | undefined;

    if (swapData?.images?.[0]?.url) {
      finalImageUrl = swapData.images[0].url;
    } else if (swapData?.image?.url) {
      finalImageUrl = swapData.image.url;
    } else if (swapData?.output_url) {
      finalImageUrl = swapData.output_url;
    }

    if (!finalImageUrl) {
      console.warn('Face Swap no devolvió URL, usando fallback de pose.');
      const generationId = encodeResult(newPoseImageUrl, params.prompt);
      return {
        success: true,
        imageUrl: newPoseImageUrl,
        generationId,
      };
    }

    console.log('Paso 2 Completado. Face Swap aplicado exitosamente:', finalImageUrl);

    // Codificar el resultado final en el generationId para mantener compatibilidad 100% con polling
    const generationId = encodeResult(finalImageUrl, params.prompt);

    return {
      success: true,
      imageUrl: finalImageUrl,
      generationId,
    };

  } catch (err) {
    console.error('Excepción en submitFalPoseWithFaceSwap:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado en el flujo de pose y face swap',
    };
  }
}

export function checkFalInpaintingStatus(params: {
  generationId: string;
}): { status: 'completed' | 'failed'; imageUrl?: string; error?: string } {
  const decoded = decodeInpaintingResult(params.generationId);
  if (!decoded) {
    return {
      status: 'failed',
      error: 'ID de generación no válido o corrupto',
    };
  }
  return {
    status: 'completed',
    imageUrl: decoded.imageUrl,
  };
}
