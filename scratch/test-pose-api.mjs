import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function testPose() {
  const conversation_id = 'e8b8b855-97ee-4343-9e02-9e1fc89ad89b';
  const avatar_id = 'bca87c87-c194-4c31-b484-941a6b4d7c2c';
  const emotion = 'smiling';
  const pose = 'medium';

  console.log('\n--- 1. CONSULTANDO SALDO INICIAL ---');
  const { data: profileInit } = await supabase
    .from('profiles')
    .select('coins')
    .eq('id', '803cb697-7f86-46c8-a00e-5a8206af02a1')
    .single();
  console.log('Saldo inicial de monedas:', profileInit?.coins);

  console.log('\n--- 2. ENVIANDO PETICIÓN DE POSE (/api/avatar/pose) ---');
  const initRes = await fetch(`${BASE_URL}/api/avatar/pose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id, avatar_id, emotion, pose })
  });

  const initData = await initRes.json();
  console.log('Respuesta de /api/avatar/pose (status code ' + initRes.status + '):', initData);

  if (!initRes.ok || !initData.generation_id) {
    throw new Error('Fallo al iniciar el trabajo de pose');
  }

  const generation_id = initData.generation_id;

  console.log('\n--- 3. ESPERANDO E INVOCANDO STATUS (/api/avatar/pose/status) ---');
  // Esperar 2 segundos para simular el polling del frontend
  await new Promise(resolve => setTimeout(resolve, 2000));

  const statusRes = await fetch(`${BASE_URL}/api/avatar/pose/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generation_id,
      conversation_id,
      avatar_id,
      emotion,
      pose,
      is_free: false
    })
  });

  const statusData = await statusRes.json();
  console.log('Respuesta de /api/avatar/pose/status (status code ' + statusRes.status + '):', statusData);

  if (!statusRes.ok) {
    throw new Error('Fallo al comprobar el estado del trabajo de pose');
  }

  console.log('\n--- 4. VERIFICANDO ACTUALIZACIONES EN LA BASE DE DATOS ---');
  
  // A. Monedas del perfil
  const { data: profileFinal } = await supabase
    .from('profiles')
    .select('coins')
    .eq('id', '803cb697-7f86-46c8-a00e-5a8206af02a1')
    .single();
  console.log('Saldo final de monedas:', profileFinal?.coins);
  console.log('¿Se descontaron 10 monedas?:', profileInit.coins - profileFinal.coins === 10 ? 'SÍ ✅' : 'NO ❌');

  // B. Outfit history
  const { data: outfits } = await supabase
    .from('outfit_history')
    .select('*')
    .eq('image_url', statusData.new_image_url);
  console.log('¿Outfit registrado en outfit_history?:', outfits && outfits.length > 0 ? 'SÍ ✅' : 'NO ❌');
  if (outfits && outfits.length > 0) {
    console.log('Detalle outfit:', outfits[0]);
  }

  // C. Conversation image
  const { data: convo } = await supabase
    .from('conversations')
    .select('current_avatar_image_url')
    .eq('id', conversation_id)
    .single();
  console.log('¿Conversación actualizada con nueva imagen?:', convo?.current_avatar_image_url === statusData.new_image_url ? 'SÍ ✅' : 'NO ❌');

  // D. Mensaje narrativo
  const { data: messages } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: false })
    .limit(1);
  console.log('Último mensaje en el chat:', messages?.[0]?.content);
  console.log('¿Es narrativo?:', messages?.[0]?.content.startsWith('*') && messages?.[0]?.content.endsWith('*') ? 'SÍ ✅' : 'NO ❌');
}

testPose().catch(err => {
  console.error('Error en el test:', err);
});
