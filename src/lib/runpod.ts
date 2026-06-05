export interface RunPodJobResponse {
  id: string;
  status: string;
}

/**
 * Encola un trabajo en RunPod Serverless.
 * @param input Datos de entrada específicos para el pipeline (ComfyUI / Python script) en la GPU.
 * @param webhookUrl Opcional. URL de webhook a la que RunPod enviará la notificación cuando el job termine.
 */
export async function queueRunPodJob(input: any, webhookUrl?: string): Promise<RunPodJobResponse> {
  const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
  const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    throw new Error('RUNPOD_API_KEY o RUNPOD_ENDPOINT_ID no configuradas en las variables de entorno');
  }

  const payload: any = {
    input,
  };

  if (webhookUrl) {
    payload.webhook = webhookUrl;
  }

  const response = await fetch(`https://api.runpod.ai/v1/${RUNPOD_ENDPOINT_ID}/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod API respondió con error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data as RunPodJobResponse;
}
