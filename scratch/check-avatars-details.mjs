import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: avatars, error } = await supabase
    .from('avatars')
    .select('id, name, base_image_url, face_box_x, face_box_y, face_box_width, face_box_height, personality');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n🎭 Detalles de todos los avatares:');
  for (const avatar of avatars) {
    console.log(`\n──────────────────────────────────────────────────`);
    console.log(`Nombre: ${avatar.name}`);
    console.log(`ID: ${avatar.id}`);
    console.log(`Base Image: ${avatar.base_image_url}`);
    console.log(`Face Box Coords: X=${avatar.face_box_x}, Y=${avatar.face_box_y}, W=${avatar.face_box_width}, H=${avatar.face_box_height}`);
    console.log(`Personality: ${avatar.personality}`);
    
    // Intentar sacar dimensiones de la imagen base por HTTP
    try {
      const res = await fetch(avatar.base_image_url);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const size = getJpegSize(buffer);
        if (size) {
          console.log(`Dimensiones de imagen real: ${size.width}x${size.height} (Aspecto: ${(size.width/size.height).toFixed(3)})`);
        } else {
          console.log('No se pudieron extraer dimensiones de la imagen base (no es JPEG o cabecera rota)');
        }
      } else {
        console.log(`No se pudo descargar la imagen base (Status: ${res.status})`);
      }
    } catch (e) {
      console.log(`Error al medir la imagen: ${e.message}`);
    }
  }
}

function getJpegSize(buffer) {
  try {
    let i = 2;
    while (i < buffer.length) {
      if (buffer[i] !== 0xFF) return null;
      let marker = buffer[i + 1];
      if (marker === 0xC0 || marker === 0xC2) { // SOF0 or SOF2
        let height = buffer.readUInt16BE(i + 5);
        let width = buffer.readUInt16BE(i + 7);
        return { width, height };
      } else {
        let length = buffer.readUInt16BE(i + 2);
        i += 2 + length;
      }
    }
  } catch (e) {}
  return null;
}

main().catch(console.error);
