import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Consultando base de datos...');
  
  // 1. Obtener avatares
  const { data: avatars, error: avError } = await supabase
    .from('avatars')
    .select('id, name, base_image_url')
    .limit(5);

  if (avError) {
    console.error('Error al obtener avatares:', avError);
    return;
  }
  console.log('\nAvatares disponibles:');
  console.table(avatars);

  // 2. Obtener conversaciones
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, user_id, avatar_id, current_avatar_image_url')
    .limit(5);

  if (convError) {
    console.error('Error al obtener conversaciones:', convError);
    return;
  }
  console.log('\nConversaciones disponibles:');
  console.table(conversations);

  if (conversations.length > 0) {
    const convo = conversations[0];
    // Obtener perfil del usuario
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('id, coins')
      .eq('id', convo.user_id)
      .single();

    if (profError) {
      console.error('Error al obtener perfil:', profError);
    } else {
      console.log('\nPerfil del usuario de la conversación:');
      console.log(profile);
    }
  }
}

main().catch(console.error);
