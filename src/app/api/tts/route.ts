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
  // Femenino: es-MX (Español de México / Latino)
  const languageCode = gender === 'male' ? 'es-US' : 'es-MX';

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
    
    // Verificar que la respuesta sea realmente un archivo de audio y no una página HTML de bloqueo/CAPTCHA
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('audio') && !contentType.includes('mpeg')) {
      throw new Error(`Google Translate bloqueó la petición o requiere CAPTCHA (content-type no es audio: ${contentType})`);
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

// Función para obtener TTS de ElevenLabs para emociones y onomatopeyas
async function getElevenLabsTTS(text: string, gender?: string, customVoiceId?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY no está configurada en las variables de entorno.');
  }

  // Voces preestablecidas de ElevenLabs: Bella (Mujer) y Adam (Hombre)
  const voiceId = customVoiceId || (gender === 'male' ? 'pNInz6obpgq9NpudJojf' : 'EXAVITQu4vr4xnSDxMaL');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      }
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs API Error: ${res.statusText} - ${errorText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(req: Request) {
  try {
    const { text, gender, elevenLabsVoiceId } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Falta el texto para la síntesis de voz' }, { status: 400 });
    }

    // RUTA INTELIGENTE: Si hay ElevenLabs configurado Y el texto contiene onomatopeyas/acciones entre asteriscos
    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'your_elevenlabs_key_here';
    const hasOnomatopoeia = /\*[^*]+\*/.test(text);
    let elevenLabsErrorDetails: string | null = null;

    if (hasElevenLabsKey && hasOnomatopoeia) {
      try {
        const audioBuffer = await getElevenLabsTTS(text, gender, elevenLabsVoiceId);
        const base64Audio = audioBuffer.toString('base64');
        return NextResponse.json({ 
          audioContent: base64Audio, 
          source: 'elevenlabs-premium' 
        });
      } catch (elevenErr: any) {
        console.warn('Fallo en la síntesis de ElevenLabs. Usando Google Cloud como fallback:', elevenErr);
        elevenLabsErrorDetails = elevenErr instanceof Error ? elevenErr.message : String(elevenErr);
      }
    }

    const apiKey = process.env.GOOGLE_API_KEY;

    // Si la API Key no está configurada, usar el fallback gratuito e ilimitado de Google Translate (Opción 3)
    if (!apiKey || apiKey === 'your_google_api_key_here') {
      try {
        // En el fallback gratuito de Translate, convertimos los asteriscos en puntos suspensivos para generar pausas naturales
        const narrationPausedText = text.replace(/\*([^*]+)\*/g, '... $1... ');
        const audioBuffer = await getGoogleTranslateTTS(narrationPausedText, gender);
        const base64Audio = audioBuffer.toString('base64');
        return NextResponse.json({ 
          audioContent: base64Audio, 
          source: 'google-translate-fallback-billing-error',
          elevenLabsError: elevenLabsErrorDetails
        });
      } catch (fallbackErr: any) {
        console.error('Fallback TTS Error:', fallbackErr);
        return NextResponse.json({ error: 'Fallo al procesar audio en el fallback gratuito' }, { status: 500 });
      }
    }

    // Si la API Key está configurada, intentar usar Google Cloud TTS Premium
    try {
      const voiceName = gender === 'male' ? 'es-US-Neural2-B' : 'es-US-Neural2-A';
      const ssmlGender = gender === 'male' ? 'MALE' : 'FEMALE';
      const languageCode = 'es-US';

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
            languageCode: languageCode,
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

      return NextResponse.json({ 
        audioContent: result.audioContent, 
        source: 'google-cloud-premium',
        elevenLabsError: elevenLabsErrorDetails
      });
    } catch (premiumErr: any) {
      console.warn('Fallo en Google Cloud TTS Premium. Usando fallback de Google Translate:', premiumErr);
      // Fallback a Google Translate si la API Key da error (por ejemplo, por problemas de facturación)
      const narrationPausedText = text.replace(/\*([^*]+)\*/g, '... $1... ');
      const audioBuffer = await getGoogleTranslateTTS(narrationPausedText, gender);
      const base64Audio = audioBuffer.toString('base64');
      return NextResponse.json({ 
        audioContent: base64Audio, 
        source: 'google-translate-fallback-billing-error',
        errorDetails: premiumErr instanceof Error ? premiumErr.message : String(premiumErr)
      });
    }
  } catch (err: any) {
    console.error('TTS API Error:', err);
    return NextResponse.json({ error: err.message || 'Error interno al procesar el audio' }, { status: 500 });
  }
}
