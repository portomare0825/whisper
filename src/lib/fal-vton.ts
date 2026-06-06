/**
 * Adaptador para Fal.ai IDM-VTON (Virtual Try-On)
 *
 * Reemplaza las llamadas a PixelAPI para cambios de ropa.
 * Mantiene la misma interfaz async (submit → poll) para no
 * modificar el comportamiento del cliente.
 *
 * Fal.ai IDM-VTON es síncrono: devuelve resultado inmediato.
 * Para compatibilidad con el flujo existente de polling del cliente,
 * el resultado se codifica en el generation_id y se decodifica
 * en el endpoint de status.
 *
 * Env requerida: FAL_KEY
 */

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface FalVTONResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationId?: string;
}

// ---------------------------------------------------------------------------
// Utilidad: codificar/decodificar resultado en el generation_id
//
// Como Vercel serverless no comparte memoria entre invocaciones,
// y Fal.ai es síncrono (no hay "queued" real), codificamos el
// resultado directamente en el generation_id para que el endpoint
// de status pueda recuperarlo sin necesidad de storage adicional.
// ---------------------------------------------------------------------------

function encodeResult(imageUrl: string, prompt: string): string {
  try {
    const payload = JSON.stringify({ t: 'fal', u: imageUrl, p: prompt });
    return 'fal_' + Buffer.from(payload).toString('base64url');
  } catch {
    return 'fal_error';
  }
}

function decodeResult(generationId: string): {
  imageUrl: string;
  prompt: string;
  isPose: boolean;
} | null {
  try {
    if (!generationId.startsWith('fal_')) return null;
    const b64 = generationId.slice(4);
    const raw = Buffer.from(b64, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.t !== 'fal' && parsed.t !== 'fal_pose') return null;
    return { imageUrl: parsed.u, prompt: parsed.p, isPose: parsed.t === 'fal_pose' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Submit: llama a Fal.ai IDM-VTON de forma síncrona
// ---------------------------------------------------------------------------

export async function submitFalVTON(params: {
  humanImageUrl: string;
  description: string;
}): Promise<FalVTONResult> {
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    return {
      success: false,
      error: 'FAL_KEY no configurada en el servidor',
    };
  }

  try {
    // -------------------------------------------------------------------------
    // PASO 1: Generar la prenda de vestir por texto usando Flux Schnell
    // -------------------------------------------------------------------------
    console.log('Generando prenda de vestir con Flux Schnell para:', params.description);
    
    // Traducir o reformatear el prompt del usuario para obtener una prenda aislada sobre fondo blanco
    const garmentPrompt = `a professional high-quality studio product photo of ${params.description.trim()}, clothing item, flat lay or hanger, solid white background, clean catalog shot`;

    const fluxResponse = await fetch(
      'https://fal.run/fal-ai/flux/schnell',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: garmentPrompt,
          sync_mode: true,
          enable_safety_checker: false,
          disable_safety_checker: true,
          safety_tolerance: 6
        }),
      }
    );

    if (!fluxResponse.ok) {
      let fluxErrDetail = `Fallo al generar la prenda en Flux Schnell (Status ${fluxResponse.status})`;
      try {
        const errBody = await fluxResponse.text();
        const parsed = JSON.parse(errBody);
        fluxErrDetail = parsed.detail?.message || parsed.error || parsed.message || errBody;
      } catch {}
      console.error('Error Flux Schnell:', fluxErrDetail);
      return {
        success: false,
        error: `Fallo al generar la prenda de vestir en Fal.ai: ${fluxErrDetail}`,
      };
    }

    const fluxData = await fluxResponse.json();
    let garmentImageUrl: string | undefined;

    if (fluxData?.images?.[0]?.url) {
      garmentImageUrl = fluxData.images[0].url;
    } else if (fluxData?.image?.url) {
      garmentImageUrl = fluxData.image.url;
    }

    if (!garmentImageUrl) {
      console.error('Flux Schnell no devolvió URL de imagen para la prenda:', JSON.stringify(fluxData));
      return {
        success: false,
        error: 'No se pudo generar la imagen de la prenda de vestir de forma válida',
      };
    }

    console.log('Prenda de vestir generada con éxito:', garmentImageUrl);

    // -------------------------------------------------------------------------
    // PASO 2: Realizar el Virtual Try-On con IDM-VTON
    // -------------------------------------------------------------------------
    console.log('Iniciando IDM-VTON con la prenda generada...');

    const response = await fetch(
      'https://fal.run/fal-ai/idm-vton',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          human_image_url: params.humanImageUrl,
          garment_image_url: garmentImageUrl,
          description: params.description.trim(),
          enable_safety_checker: false,
          disable_safety_checker: true,
          safety_tolerance: 6
        }),
      }
    );

    if (!response.ok) {
      let errorDetail = `Fal.ai respondió con status ${response.status}`;
      try {
        const errBody = await response.text();
        const parsed = JSON.parse(errBody);
        errorDetail = parsed.detail?.message || parsed.error || parsed.message || errBody;
      } catch {
        // no se pudo parsear el error, usar default
      }
      console.error('Fal.ai VTON Error:', errorDetail);
      return { success: false, error: errorDetail };
    }

    const data = await response.json();

    // El output de IDM-VTON en Fal.ai es { image: { url: '...' } }
    // o puede ser directamente { image: { url: '...' }, mask: { url: '...' } }
    let imageUrl: string | undefined;

    if (data?.image?.url) {
      imageUrl = data.image.url;
    } else if (data?.output?.image?.url) {
      imageUrl = data.output.image.url;
    } else if (typeof data?.image === 'string') {
      imageUrl = data.image;
    } else if (typeof data?.output_url === 'string') {
      imageUrl = data.output_url;
    }

    if (!imageUrl) {
      console.error('Fal.ai no devolvió URL de imagen:', JSON.stringify(data).slice(0, 500));
      return {
        success: false,
        error: 'Fal.ai no devolvió una imagen válida',
      };
    }

    // Codificar el resultado en un generation_id para el polling del cliente
    const generationId = encodeResult(imageUrl, params.description);

    return {
      success: true,
      imageUrl,
      generationId,
    };
  } catch (err: any) {
    console.error('Error llamando a Fal.ai VTON:', err);
    return {
      success: false,
      error: err.message || 'Error desconocido al llamar a Fal.ai',
    };
  }
}

// ---------------------------------------------------------------------------
// Check status: decodifica el generation_id y devuelve el resultado
//
// Como Fal.ai es síncrono, el resultado ya está listo.
// Esta función decodifica el generation_id y retorna la info
// para que el endpoint de status pueda procesar monedas/DB.
// ---------------------------------------------------------------------------

export function checkFalVTONStatus(params: {
  generationId: string;
  prompt: string;
}): {
  status: 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
  isPose?: boolean;
} {
  const decoded = decodeResult(params.generationId);

  if (!decoded) {
    return {
      status: 'failed',
      error: 'No se pudo recuperar el resultado de la generación',
    };
  }

  return {
    status: 'completed',
    imageUrl: decoded.imageUrl,
    isPose: decoded.isPose
  };
}

// ---------------------------------------------------------------------------
// Parse error messages para el usuario (equivalente a parsePixelAPIError)
// ---------------------------------------------------------------------------

export function parseFalAPIError(errText: string): string {
  try {
    const parsed = JSON.parse(errText);
    if (parsed.detail) {
      if (typeof parsed.detail === 'object' && parsed.detail.message) {
        return parsed.detail.message;
      }
      return typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
    }
    if (parsed.error_message) return parsed.error_message;
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // no es JSON
  }
  return errText || 'Error desconocido de Fal.ai';
}
