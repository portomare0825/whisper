import fs from 'fs';
import path from 'path';

// Parse .env.local manually to ensure zero dependency requirements
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const fileContent = fs.readFileSync(envPath, 'utf-8');
  fileContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        let key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  });
}

async function testTTS() {
  const apiKey = process.env.GOOGLE_API_KEY;
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'No encontrada');

  const voiceName = 'es-MX-Neural2-C';
  const ssmlGender = 'FEMALE';
  const languageCode = 'es-MX';
  const text = 'Hola, esto es una prueba de la voz realista de Gemini.';
  const ssmlText = `<speak>${text}</speak>`;

  try {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    const response = await fetch(url, {
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
        },
      }),
    });

    const result = await response.json();
    console.log('Status Code:', response.status);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error making request:', err);
  }
}

testTTS();
