import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve('c:/Users/adm-09/Desktop/Geminis/Antigravity/ChatBot/.env.local') });

const apiKey = process.env.GOOGLE_API_KEY;
console.log('API Key detected:', apiKey ? 'YES (starts with ' + apiKey.slice(0, 8) + '...)' : 'NO');

async function test() {
  const avatarName = "Emma";
  const avatarPersonality = "Amorosa, apasionada, un poco tímida pero muy cariñosa.";
  const userMessage = "Hola hermosa, ¿cómo estás hoy? Te extrañé.";
  const avatarResponse = "¡Hola! Yo también te extrañé muchísimo... Estaba contando las horas para volver a hablar contigo.";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const systemInstruction = `Eres el monólogo interno o pensamiento secreto de un personaje de roleplay llamado ${avatarName} que tiene esta personalidad: ${avatarPersonality}.
Genera UN pensamiento secreto, íntimo y honesto que tuvo ${avatarName} en su mente al recibir el mensaje del usuario y antes de decir su respuesta.
REGLAS:
1. EXTREMADAMENTE BREVE. Entre 5 y 20 palabras.
2. Debe estar escrito ESTRICTAMENTE en primera persona del singular ("yo"). ¡TÚ eres ${avatarName}, este es TU pensamiento privado sobre el usuario! (ej: "Me encanta cuando me habla así...", "Qué pesado es este tipo...").
3. NO incluyas etiquetas como <thought> o asteriscos. Solo el pensamiento puro.
4. Sé natural, cálido y coherente con el contexto de la conversación.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Mensaje del usuario: "${userMessage}"\nMi respuesta visible: "${avatarResponse}"\n\nGenera mi pensamiento interno:`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemInstruction
            }
          ]
        },
        generationConfig: {
          maxOutputTokens: 50,
          temperature: 0.85
        }
      }),
    });

    console.log('HTTP Status:', response.status);
    const text = await response.text();
    console.log('Raw Response:', text);
  } catch (error) {
    console.error('Error in fetch:', error);
  }
}

test();
