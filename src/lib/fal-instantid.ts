/**
 * Adaptador para Fal.ai InstantID
 *
 * Permite cambiar la pose y expresión facial de un avatar manteniendo su identidad.
 * Utiliza el mismo truco stateless de codificar el resultado inmediato de la llamada síncrona
 * en el generation_id para mantener compatibilidad total con el flujo de polling del cliente.
 *
 * Env requerida: FAL_KEY
 */

interface FalInstantIDResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationId?: string;
}

function encodeResult(imageUrl: string, prompt: string): string {
  try {
    const payload = JSON.stringify({ t: 'faliid', u: imageUrl, p: prompt });
    return 'faliid_' + Buffer.from(payload).toString('base64url');
  } catch {
    return 'faliid_error';
  }
}

export function decodeInstantIDResult(generationId: string): {
  imageUrl: string;
  prompt: string;
} | null {
  try {
    if (!generationId.startsWith('faliid_')) return null;
    const b64 = generationId.slice(7);
    const raw = Buffer.from(b64, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.t !== 'faliid') return null;
    return { imageUrl: parsed.u, prompt: parsed.p };
  } catch {
    return null;
  }
}

export async function submitFalInstantID(params: {
  faceImageUrl: string;
  prompt: string;
}): Promise<FalInstantIDResult> {
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return {
      success: false,
      error: 'FAL_KEY no configurada en el servidor',
    };
  }

  try {
    console.log('Iniciando Fal.ai InstantID para pose/expresión. Prompt:', params.prompt);

    // Ajustar el prompt para mejorar los resultados
    const enhancedPrompt = `${params.prompt.trim()}, high quality, realistic photography, professional studio lighting, detailed background`;
    const negativePrompt = 'nsfw, nude, naked, explicit, bad eyes, bad hands, deformed faces, bad anatomy, blur, low quality, distorted, extra limbs, watermark, text, lowres, ugly';

    const response = await fetch(
      'https://fal.run/fal-ai/instantid',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          face_image_url: params.faceImageUrl,
          prompt: enhancedPrompt,
          negative_prompt: negativePrompt,
          ip_adapter_scale: 0.8,
          identity_controlnet_conditioning_scale: 0.8,
          image_size: {
            width: 576,
            height: 1024
          }
        }),
      }
    );

    if (!response.ok) {
      let errDetail = `Error en la API de Fal.ai (Status ${response.status})`;
      try {
        const errBody = await response.text();
        const parsed = JSON.parse(errBody);
        errDetail = parsed.detail?.message || parsed.error || parsed.message || errBody;
      } catch {}
      console.error('Error en Fal.ai InstantID:', errDetail);
      return {
        success: false,
        error: `Fallo en el servicio de generación de pose de Fal.ai: ${errDetail}`,
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
      console.error('Fal.ai InstantID no devolvió una URL de imagen válida:', JSON.stringify(data));
      return {
        success: false,
        error: 'El servicio de generación no devolvió un resultado de imagen válido.',
      };
    }

    console.log('Imagen de pose/expresión generada con éxito:', generatedImageUrl);

    // Codificar el resultado en el generationId para el polling stateless
    const generationId = encodeResult(generatedImageUrl, params.prompt);

    return {
      success: true,
      imageUrl: generatedImageUrl,
      generationId,
    };

  } catch (err) {
    console.error('Excepción en submitFalInstantID:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado al conectar con Fal.ai',
    };
  }
}

export function checkFalInstantIDStatus(params: {
  generationId: string;
  prompt: string;
}): { status: 'completed' | 'failed'; imageUrl?: string; error?: string } {
  const decoded = decodeInstantIDResult(params.generationId);
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
