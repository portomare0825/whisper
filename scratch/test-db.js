import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan variables de entorno en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Intentando conectar a Supabase...');
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .limit(5);

  if (error) {
    console.error('Error al consultar mensajes:', error);
  } else {
    console.log('Mensajes consultados con éxito:', data);
  }
}

run().catch(console.error);
