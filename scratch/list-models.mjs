import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error('❌ Falta la variable GOOGLE_API_KEY en .env.local');
  process.exit(1);
}

async function listModels() {
  console.log('🔌 Conectando a la API de Google Gemini...');
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log('✅ Lista de modelos obtenida exitosamente!');
    const embeddingModels = data.models.filter(m => m.supportedGenerationMethods.includes('embedContent'));
    
    console.log('\n🤖 Modelos de EMBEDDING disponibles:');
    embeddingModels.forEach(m => {
      console.log(`- Nombre: ${m.name}`);
      console.log(`  Descripción: ${m.description}`);
      console.log(`  Métodos soportados: ${m.supportedGenerationMethods.join(', ')}`);
    });
  } catch (error) {
    console.error('❌ Error listando los modelos:', error.message);
  }
}

listModels();
