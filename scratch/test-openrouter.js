import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('Falta la clave OPENROUTER_API_KEY en .env.local');
  process.exit(1);
}

async function checkCredits() {
  console.log('Verificando saldo de OpenRouter...');
  const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!res.ok) {
    console.error('Error de autenticación o de API en OpenRouter:', res.status, await res.text());
  } else {
    const data = await res.json();
    console.log('Información de la clave de OpenRouter:', data);
  }
}

async function testCompletion() {
  console.log('Probando llamada de completado a OpenRouter con un modelo gratuito...');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [{ role: 'user', content: 'Di hola en una palabra.' }]
    })
  });

  if (!res.ok) {
    console.error('Error al realizar completado:', res.status, await res.text());
  } else {
    const data = await res.json();
    console.log('Respuesta del completado:', data.choices?.[0]?.message?.content);
  }
}

async function run() {
  await checkCredits();
  await testCompletion();
}

run().catch(console.error);
