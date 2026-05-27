import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error('❌ Falta la variable GOOGLE_API_KEY en .env.local');
  process.exit(1);
}

async function testEmbeddings() {
  console.log('🔌 Conectando a la API de Google Gemini...');
  console.log('🧪 Probando generación de embeddings con el modelo text-embedding-004...');

  const textToEmbed = 'Hola, esta es una prueba de memoria semántica y persistencia premium.';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{
            text: textToEmbed,
          }],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (embedding && Array.isArray(embedding)) {
      console.log('✅ Generación de embeddings exitosa!');
      console.log(`Dimensiones del vector: ${embedding.length} (esperado: 768)`);
      console.log('Muestra del vector (primeros 5 elementos):', embedding.slice(0, 5));
    } else {
      console.error('❌ La respuesta de la API no contiene un vector de embedding válido:', data);
    }
  } catch (error) {
    console.error('❌ Error generando el embedding:', error.message);
  }
}

testEmbeddings();
