const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("No se encontró FAL_KEY");
  process.exit(1);
}

const faceImageUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80"; // Imagen de prueba
const prompt = "A realistic three-quarter length shot of a person standing, visible from the knees up, full body crop from knees up, standing gracefully, cinematic lighting, professional fashion editorial photography, EXTREMELY RAW photography, sharp focus on highly detailed real human skin texture, visible pores, subtle skin blemishes, freckles, fine peach fuzz, unretouched, imperfect natural skin, shot on high-resolution DSLR camera with 50mm lens, absolutely no 3D rendering, no digital art, strictly real life human photography, posing next to a luxury infinity pool, wearing a chic designer one-piece swimsuit, wet skin, cinematic night lighting, glowing neon pool reflections, soft ambient luxury backlight";

async function run() {
  console.log("Probando llamada a fal-ai/flux-pulid...");
  try {
    const response = await fetch('https://fal.run/fal-ai/flux-pulid', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_image_url: faceImageUrl,
        prompt: prompt,
        image_size: "portrait_16_9",
        sync_mode: true,
        enable_safety_checker: false,
        disable_safety_checker: true // agregamos esto para probar
      })
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Respuesta de la API:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error en la petición:", error);
  }
}

run();
