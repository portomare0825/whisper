import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

async function listPredictions() {
  if (!REPLICATE_API_TOKEN) {
    console.error('Falta REPLICATE_API_TOKEN');
    return;
  }

  console.log('Consultando predicciones recientes en Replicate...');
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Error de Replicate (${response.status}): ${text}`);
    return;
  }

  const data = await response.json();
  console.log(`Se encontraron ${data.results?.length || 0} predicciones recientes:`);

  for (const pred of data.results || []) {
    console.log(`\n- ID: ${pred.id} | Status: ${pred.status} | Model: ${pred.model} | Created: ${pred.created_at}`);
    if (pred.error) {
      console.error(`  Error: ${pred.error}`);
    }
    if (pred.status === 'succeeded') {
      console.log(`  Output: ${JSON.stringify(pred.output)}`);
    }
  }
}

listPredictions().catch(console.error);
