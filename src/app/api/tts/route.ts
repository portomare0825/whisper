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

// Función para formatear el texto antes de enviarlo a ElevenLabs.
// Traduce onomatopeyas y acciones comunes del español a palabras clave que ElevenLabs interpreta como sonidos reales (*giggles*, *sigh*, etc.)
// y elimina las descripciones de acciones físicas para que no las lea literalmente en voz alta.
function formatTextForElevenLabs(text: string): string {
  const regex = /\*([^*]+)\*/g;
  
  return text.replace(regex, (match, action) => {
    const cleanAction = action.trim().toLowerCase();
    
    // 1. Mapeo de risas y sonrisas
    if (cleanAction.includes('rie') || cleanAction.includes('ría') || cleanAction.includes('risa') || cleanAction.includes('risita') || cleanAction.includes('jaja') || cleanAction.includes('jeje')) {
      return ' *giggles* ';
    }
    // 2. Mapeo de suspiros y respiraciones
    if (cleanAction.includes('suspir') || cleanAction.includes('respir') || cleanAction.includes('sopla')) {
      return ' *sigh* ';
    }
    // 3. Mapeo de bostezos
    if (cleanAction.includes('bostez')) {
      return ' *yawn* ';
    }
    // 4. Mapeo de sollozos y llanto
    if (cleanAction.includes('llor') || cleanAction.includes('sollozo') || cleanAction.includes('lagrima') || cleanAction.includes('lágrima')) {
      return ' *crying* ';
    }
    // 5. Mapeo de sustos o jadeos (gasp)
    if (cleanAction.includes('gime') || cleanAction.includes('gemid') || cleanAction.includes('jade') || cleanAction.includes('asusta')) {
      return ' *gasp* ';
    }
    // 6. Mapeo de gritos o enojo
    if (cleanAction.includes('grit') || cleanAction.includes('enfad') || cleanAction.includes('enoj')) {
      return ' *screaming* ';
    }
    
    // Si es una descripción de una acción física (ej: *camina*, *mira al suelo*, *cruza los brazos*),
    // no queremos que ElevenLabs la lea literalmente. La reemplazamos por puntos suspensivos para generar una pequeña pausa natural y realista.
    return ' ... ';
  });
}

// Estructura para los segmentos de texto en modo audiolibro
interface TextSegment {
  text: string;
  isNarration: boolean;
}

// Divide el texto en segmentos alternados de narración (dentro de asteriscos) y diálogos (fuera de ellos)
function segmentText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /(\*[^*]+\*)/g;
  const parts = text.split(regex);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('*') && part.endsWith('*')) {
      // Remover los asteriscos externos para que la IA no intente leerlos
      const cleanNarration = part.slice(1, -1).trim();
      if (cleanNarration) {
        segments.push({ text: cleanNarration, isNarration: true });
      }
    } else {
      const cleanDialogue = part.trim();
      if (cleanDialogue) {
        segments.push({ text: cleanDialogue, isNarration: false });
      }
    }
  }
  return segments;
}

// Genera el audio para un segmento de narración utilizando Google Cloud TTS
async function getGoogleCloudSegmentTTS(text: string, gender: string, apiKey: string): Promise<Buffer> {
  const voiceName = gender === 'male' ? 'es-US-Neural2-B' : 'es-US-Neural2-A';
  const ssmlGender = gender === 'male' ? 'MALE' : 'FEMALE';
  const languageCode = 'es-US';

  // Usamos prosodia con volumen un poco más suave y ritmo pausado para dar tono de narrador
  const ssmlText = `<speak><prosody volume="-2.0dB" rate="0.95">${escapeXml(text)}</prosody></speak>`;

  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { ssml: ssmlText },
      voice: {
        languageCode: languageCode,
        name: voiceName,
        ssmlGender: ssmlGender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
        sampleRateHertz: 44100 // Forzar 44.1kHz para que coincida perfectamente con ElevenLabs al unirlos
      },
    }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }

  return Buffer.from(result.audioContent, 'base64');
}

// Función para obtener TTS de ElevenLabs para emociones y onomatopeyas
async function getElevenLabsTTS(text: string, gender?: string, customVoiceId?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY no está configurada en las variables de entorno.');
  }

  // Formatear el texto para traducir emociones a sonidos reales y limpiar acciones físicas
  const formattedText = formatTextForElevenLabs(text);

  // Voces preestablecidas de ElevenLabs: Bella (Mujer) y Adam (Hombre)
  const voiceId = customVoiceId || (gender === 'male' ? 'pNInz6obpgq9NpudJojf' : 'EXAVITQu4vr4xnSDxMaL');
  // Especificar output_format a mp3_44100_128 para garantizar coincidencia de sample rates al unir buffers
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: formattedText,
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

    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'your_elevenlabs_key_here';
    const hasGoogleKey = !!process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your_google_api_key_here';
    const hasOnomatopoeia = /\*[^*]+\*/.test(text);
    let elevenLabsErrorDetails: string | null = null;

    // 1. MODO AUDIOLIBRO HÍBRIDO (Google Cloud para Narrar + ElevenLabs para Diálogo)
    if (hasElevenLabsKey && hasGoogleKey && hasOnomatopoeia) {
      try {
        console.log('[TTS API] 🎙️ Iniciando Modo Audiolibro Híbrido...');
        const segments = segmentText(text);
        const audioBuffers: Buffer[] = [];

        for (const segment of segments) {
          if (segment.isNarration) {
            console.log(`[TTS API] 📖 Narración (Google Cloud): "${segment.text.substring(0, 30)}..."`);
            const buffer = await getGoogleCloudSegmentTTS(segment.text, gender || 'female', process.env.GOOGLE_API_KEY!);
            audioBuffers.push(buffer);
          } else {
            console.log(`[TTS API] 🗣️ Diálogo (ElevenLabs): "${segment.text.substring(0, 30)}..."`);
            const buffer = await getElevenLabsTTS(segment.text, gender, elevenLabsVoiceId);
            audioBuffers.push(buffer);
          }
        }

        const combinedAudio = Buffer.concat(audioBuffers);
        const base64Audio = combinedAudio.toString('base64');
        return NextResponse.json({ 
          audioContent: base64Audio, 
          source: 'hybrid-audiobook' 
        });
      } catch (hybridErr: any) {
        console.warn('Fallo en el Modo Audiolibro Híbrido. Usando Google Cloud normal como fallback:', hybridErr);
        elevenLabsErrorDetails = `Fallo Híbrido: ${hybridErr instanceof Error ? hybridErr.message : String(hybridErr)}`;
      }
    }

    // 2. MODO ELEVENLABS COMPLETO (Si no tiene narraciones pero sí hay API Key de ElevenLabs)
    if (hasElevenLabsKey && !hasOnomatopoeia) {
      try {
        const audioBuffer = await getElevenLabsTTS(text, gender, elevenLabsVoiceId);
        const base64Audio = audioBuffer.toString('base64');
        return NextResponse.json({ 
          audioContent: base64Audio, 
          source: 'elevenlabs-premium' 
        });
      } catch (elevenErr: any) {
        console.warn('Fallo en ElevenLabs Completo. Usando Google Cloud:', elevenErr);
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
