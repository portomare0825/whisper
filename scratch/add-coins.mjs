import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const userId = '803cb697-7f86-46c8-a00e-5a8206af02a1';

async function main() {
  console.log(`Añadiendo 50 monedas al usuario ${userId}...`);
  const { data, error } = await supabase.rpc('add_coins', {
    user_id_param: userId,
    amount: 50
  });

  if (error) {
    console.error('Error al añadir monedas:', error);
  } else {
    console.log('Transacción completada. Nuevo saldo de monedas:', data);
  }
}

main().catch(console.error);
