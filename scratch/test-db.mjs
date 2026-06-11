import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan credenciales en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAvatars() {
  const { data, error } = await supabase
    .from('avatars')
    .select('id, name, base_image_url, current_image_url')
    .limit(5);

  if (error) {
    console.error('Error al consultar avatares:', error);
    return;
  }

  console.log('Avatares encontrados:');
  console.log(JSON.stringify(data, null, 2));
}

checkAvatars();
