import fs from 'fs';
import path from 'path';

// Utilidad simple para cargar .env.local sin librerías externas
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local no encontrado en el directorio actual.');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  });
}

loadEnv();

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error('FAL_KEY no está configurada en .env.local');
  process.exit(1);
}

async function testPoseAndSwap() {
  console.log('--- Iniciando Test de Generación de Pose + Face Swap ---');

  // Usamos una imagen de rostro de prueba (el avatar original de Nira o similar en Supabase)
  // Como fallback usaremos una cara de prueba de alta calidad de unsplash
  const sourceFaceUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=576&h=1024&q=80';
  const posePrompt = 'A beautiful young woman smiling, winking, wearing a light brown jacket, standing outdoors, medium shot, high quality';

  console.log('\n1. Llamando a fal-ai/flux/dev para la nueva pose...');
  try {
    const fluxRes = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: posePrompt,
        image_size: {
          width: 576,
          height: 1024
        },
        sync_mode: true
      })
    });

    if (!fluxRes.ok) {
      const errText = await fluxRes.text();
      throw new Error(`Error en FLUX: ${fluxRes.status} - ${errText}`);
    }

    const fluxData = await fluxRes.json();
    const generatedPoseUrl = fluxData.images?.[0]?.url || fluxData.image?.url;
    if (!generatedPoseUrl) {
      throw new Error(`FLUX no devolvió imagen: ${JSON.stringify(fluxData)}`);
    }

    console.log('✔ Pose generada exitosamente:', generatedPoseUrl);

    console.log('\n2. Llamando a fal-ai/face-swap...');
    const swapRes = await fetch('https://fal.run/fal-ai/face-swap', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base_image_url: generatedPoseUrl,
        swap_image_url: sourceFaceUrl
      })
    });

    if (!swapRes.ok) {
      const errText = await swapRes.text();
      throw new Error(`Error en Face Swap: ${swapRes.status} - ${errText}`);
    }

    const swapData = await swapRes.json();
    const finalImageUrl = swapData.images?.[0]?.url || swapData.image?.url;
    if (!finalImageUrl) {
      throw new Error(`Face Swap no devolvió imagen: ${JSON.stringify(swapData)}`);
    }

    console.log('✔ Face Swap completado con éxito!');
    console.log('URL de la imagen final:', finalImageUrl);

  } catch (error) {
    console.error('✘ Test fallido:', error.message || error);
  }
}

testPoseAndSwap();
