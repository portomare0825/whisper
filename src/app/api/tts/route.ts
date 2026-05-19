import { NextResponse } from 'next/server';

// Función para obtener TTS de Google Translate (Opción 3) como fallback gratuito e ilimitado
async function getGoogleTranslateTTS(text: string, gender?: string): Promise<Buffer> {
  const chunks: string[] = [];
  const words = text.split(' ');
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length > 180) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + word : word;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  // Alternar acentos de Google para distinguir masculino de femenino en el plan gratuito
  // Masculino: es-US (Español Latinoamericano)
  // Femenino: es-ES (Español de España)
  const languageCode = gender === 'male' ? 'es-US' : 'es-ES';

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${languageCode}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch TTS chunk: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  return Buffer.concat(buffers);
}

// Función auxiliar para escapar caracteres XML inválidos
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Función para convertir texto con asteriscos en SSML enriquecido para separar narración de diálogo
function convertToSSML(text: string): string {
  const regex = /\*([^*]+)\*/g;
  let ssml = '<speak>';
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Texto antes de la narración (diálogo)
    if (match.index > lastIndex) {
      ssml += escapeXml(text.substring(lastIndex, match.index));
    }
    
    // Texto de narración (dentro de los asteriscos)
    // Usamos prosodia con volumen suave, tono más grave (-3 semitonos) y velocidad un poco más pausada (0.88)
    const narrationText = match[1].trim();
    if (narrationText) {
      ssml += `<break time="300ms"/><prosody volume="soft" pitch="-3.0st" rate="0.88">${escapeXml(narrationText)}</prosody><break time="300ms"/>`;
    }
    
    lastIndex = regex.lastIndex;
  }

  // Texto restante (diálogo final)
  if (lastIndex < text.length) {
    ssml += escapeXml(text.substring(lastIndex));
  }

  ssml += '</speak>';
  return ssml;
}

export async function POST(req: Request) {
  try {
    const { text, gender } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Falta el texto para la síntesis de voz' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;

    // Si la API Key no está configurada, usar el fallback gratuito e ilimitado de Google Translate (Opción 3)
    if (!apiKey || apiKey === 'your_google_api_key_here') {
      try {
        // En el fallback gratuito de Translate, convertimos los asteriscos en puntos suspensivos para generar pausas naturales
        const narrationPausedText = text.replace(/\*([^*]+)\*/g, '... $1... ');
        const audioBuffer = await getGoogleTranslateTTS(narrationPausedText, gender);
        const base64Audio = audioBuffer.toString('base64');
        return NextResponse.json({ audioContent: base64Audio, source: 'google-translate-fallback' });
      } catch (fallbackErr: any) {
        console.error('Fallback TTS Error:', fallbackErr);
        return NextResponse.json({ error: 'Fallo al procesar audio en el fallback gratuito' }, { status: 500 });
      }
    }

    // Si la API Key está configurada, intentar usar Google Cloud TTS Premium
    try {
      const voiceName = gender === 'male' ? 'es-ES-Standard-B' : 'es-ES-Standard-A';
      const ssmlGender = gender === 'male' ? 'MALE' : 'FEMALE';

      // Convertimos el texto original en SSML enriquecido para diferenciar la narración del diálogo
      const ssmlText = convertToSSML(text);

      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { ssml: ssmlText }, // Usamos 'ssml' en lugar de 'text'
          voice: {
            languageCode: 'es-ES',
            name: voiceName,
            ssmlGender: ssmlGender,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
          },
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return NextResponse.json({ audioContent: result.audioContent, source: 'google-cloud-premium' });
    } catch (premiumErr) {
      console.warn('Fallo en Google Cloud TTS Premium. Usando fallback de Google Translate:', premiumErr);
      // Fallback a Google Translate si la API Key da error (por ejemplo, por problemas de facturación)
      const narrationPausedText = text.replace(/\*([^*]+)\*/g, '... $1... ');
      const audioBuffer = await getGoogleTranslateTTS(narrationPausedText, gender);
      const base64Audio = audioBuffer.toString('base64');
      return NextResponse.json({ audioContent: base64Audio, source: 'google-translate-fallback-billing-error' });
    }
  } catch (err: any) {
    console.error('TTS API Error:', err);
    return NextResponse.json({ error: err.message || 'Error interno al procesar el audio' }, { status: 500 });
  }
}
