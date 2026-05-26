export interface AvatarPhysicalProfile {
  genero: 'hombre' | 'mujer' | 'otro';
  complexion: 'delgada' | 'atletica' | 'curvilinea' | 'robusta' | 'promedio';
  edad_estimada: number;
}

/**
 * Analiza la imagen del avatar para extraer su fisionomía y complexión
 * utilizando Gemini 2.5 Flash a través de OpenRouter (Vision).
 */
export async function analyzeUserFace(imageUrl: string): Promise<AvatarPhysicalProfile | null> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterKey) {
    console.warn('OPENROUTER_API_KEY no configurado, omitiendo análisis de visión.');
    return null;
  }

  const systemInstruction = `
    Eres un analista de fisionomía experta. Tu tarea es analizar la imagen proporcionada de una persona y devolver EXACTAMENTE un objeto JSON válido con los siguientes campos y valores permitidos:
    {
      "genero": "hombre" | "mujer" | "otro",
      "complexion": "delgada" | "atletica" | "curvilinea" | "robusta" | "promedio",
      "edad_estimada": numero_entero
    }
    No devuelvas NADA MÁS que el JSON en bruto. Ni markdown, ni texto introductorio. Solo el objeto JSON.
    Si la imagen no parece una persona, devuelve valores estimados por defecto.
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
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: systemInstruction },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analiza esta imagen y devuelve el JSON solicitado.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      console.error(`Error en OpenRouter Vision (Status: ${response.status})`);
      return null;
    }

    const data = await response.json();
    let jsonContent = data.choices?.[0]?.message?.content?.trim();

    if (jsonContent) {
      // Limpiar posibles etiquetas markdown de JSON que a veces la IA devuelve aunque se le diga que no
      jsonContent = jsonContent.replace(/```json/gi, '').replace(/```/g, '').trim();
      const profile = JSON.parse(jsonContent) as AvatarPhysicalProfile;
      
      // Validación básica
      if (profile.genero && profile.complexion) {
        return profile;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error al analizar el rostro con Gemini Vision:', error);
    return null;
  }
}
