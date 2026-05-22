import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'ksezyjdxvjgiryaiulew';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function applyMigration() {
  const query = `
    -- 1. Agregar columnas para la máscara de rostro
    ALTER TABLE public.avatars 
    ADD COLUMN IF NOT EXISTS face_box_x INTEGER DEFAULT 198,
    ADD COLUMN IF NOT EXISTS face_box_y INTEGER DEFAULT 120,
    ADD COLUMN IF NOT EXISTS face_box_width INTEGER DEFAULT 180,
    ADD COLUMN IF NOT EXISTS face_box_height INTEGER DEFAULT 240;

    -- 2. Asegurarse de que los avatares existentes tengan estas coordenadas por defecto
    UPDATE public.avatars
    SET 
      face_box_x = COALESCE(face_box_x, 198),
      face_box_y = COALESCE(face_box_y, 120),
      face_box_width = COALESCE(face_box_width, 180),
      face_box_height = COALESCE(face_box_height, 240);
  `;

  console.log('Aplicando migración SQL en Supabase...');
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al aplicar la migración: ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Migración aplicada exitosamente:', JSON.stringify(data, null, 2));
}

applyMigration().catch(console.error);
