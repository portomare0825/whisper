/**
 * Test de integración directo para la lógica de pose/expresión de avatar.
 * Llama directamente a Fal.ai y Supabase sin pasar por el middleware HTTP de Next.js.
 * Usa las mismas funciones del backend para verificar:
 *  1. Que Fal.ai InstantID genera una imagen correctamente
 *  2. Que se descontarían las monedas
 *  3. Que los registros en outfit_history serían correctos
 *  4. Que se actualizaría current_avatar_image_url en conversations
 *  5. Que se insertaría el mensaje narrativo
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAL_KEY = process.env.FAL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ─────────────────────────────────────────────────
// Datos de prueba (obtenidos de test-db.mjs)
// ─────────────────────────────────────────────────
const TEST_USER_ID      = '803cb697-7f86-46c8-a00e-5a8206af02a1';
const TEST_CONVERSATION = 'e8b8b855-97ee-4343-9e02-9e1fc89ad89b';
const TEST_AVATAR_ID    = 'bca87c87-c194-4c31-b484-941a6b4d7c2c';
const EMOTION           = 'smiling';
const POSE              = 'medium';
const POSE_CHANGE_COST  = 10;

// ─────────────────────────────────────────────────
// Prompts (equivalente a lo que construye el backend)
// ─────────────────────────────────────────────────
const EMOTIONS_MAP = {
  smiling: 'smiling and laughing happily, cheerful expression, warm smile, friendly look',
  angry:   'looking angry and upset, irritated expression, annoyed look, furrowed brow',
  sad:     'looking sad and melancholic, emotional expression, looking down slightly',
  winking: 'winking playfully, flirting expression, cute smirk, charming look',
  neutral: 'with a calm neutral expression, thoughtful look, serene face, serious look'
};

const POSES_MAP = {
  portrait: 'portrait close-up photography of the face and shoulders',
  medium:   'medium shot photography showing waist up, relaxed body language',
  full:     'full body shot photography standing, showing whole body and footwear'
};

const EMOTION_DESCRIPTIONS = {
  smiling: 'sonriendo alegremente',
  angry:   'con una mirada de enojo y molestia',
  sad:     'con expresión triste y melancólica',
  winking: 'guiñando un ojo de forma pícara',
  neutral: 'seria y pensativa'
};

const POSE_DESCRIPTIONS = {
  portrait: 'en primer plano (retrato)',
  medium:   'de medio cuerpo',
  full:     'de cuerpo entero'
};

const POSE_LABELS = { portrait: 'Primer Plano', medium: 'Medio Cuerpo', full: 'Cuerpo Entero' };
const EMOTION_LABELS = {
  smiling: 'Feliz / Riendo', angry: 'Enojada / Molesta',
  sad: 'Triste', winking: 'Coqueta / Pícara', neutral: 'Seria / Pensativa'
};

function log(emoji, msg, data) {
  console.log(`\n${emoji} ${msg}`);
  if (data !== undefined) {
    if (typeof data === 'object') console.dir(data, { depth: null });
    else console.log(data);
  }
}

async function runTest() {
  log('🚀', '=== TEST DE INTEGRACIÓN: CAMBIO DE POSE DE AVATAR ===');

  // ── PASO 1: Obtener imagen base del avatar ──────────────────────────────
  log('1️⃣', 'Obteniendo imagen base del avatar...');
  const { data: avatar, error: avErr } = await supabase
    .from('avatars').select('*').eq('id', TEST_AVATAR_ID).single();
  if (avErr || !avatar) throw new Error('Avatar no encontrado: ' + JSON.stringify(avErr));
  log('✅', 'Avatar encontrado:', { name: avatar.name, base_image_url: avatar.base_image_url });

  // ── PASO 2: Verificar saldo de monedas ─────────────────────────────────
  log('2️⃣', 'Verificando saldo de monedas...');
  const { data: profile, error: profErr } = await supabase
    .from('profiles').select('coins').eq('id', TEST_USER_ID).single();
  if (profErr || !profile) throw new Error('Perfil no encontrado: ' + JSON.stringify(profErr));
  log('💰', `Saldo actual: ${profile.coins} monedas`);
  if (profile.coins < POSE_CHANGE_COST) {
    throw new Error(`Saldo insuficiente: ${profile.coins} < ${POSE_CHANGE_COST}`);
  }
  log('✅', 'Saldo suficiente para el cambio de pose');

  // ── PASO 3: Llamar a Fal.ai InstantID ─────────────────────────────────
  log('3️⃣', 'Construyendo prompt y llamando a Fal.ai InstantID...');

  const emotionPrompt = EMOTIONS_MAP[EMOTION];
  const posePrompt    = POSES_MAP[POSE];
  const finalPrompt   = `${posePrompt}, ${emotionPrompt}, wearing stylish matching fashion outfit`;
  const enhancedPrompt = `${finalPrompt.trim()}, high quality, realistic photography, professional studio lighting, detailed background`;
  const negativePrompt = 'nsfw, nude, naked, explicit, bad eyes, bad hands, deformed faces, bad anatomy, blur, low quality, distorted, extra limbs, watermark, text, lowres, ugly';

  log('📝', 'Prompt enviado a Fal.ai:', enhancedPrompt);
  log('⏳', 'Generando imagen (esto puede tomar ~30-60 segundos)...');

  const startTime = Date.now();
  const falResponse = await fetch('https://fal.run/fal-ai/instantid', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      face_image_url: avatar.base_image_url,
      prompt: enhancedPrompt,
      negative_prompt: negativePrompt,
      ip_adapter_scale: 0.8,
      identity_controlnet_conditioning_scale: 0.8,
      image_size: { width: 576, height: 1024 }
    })
  });

  const elapsedMs = Date.now() - startTime;
  log('⏱️', `Respuesta de Fal.ai en ${(elapsedMs / 1000).toFixed(1)}s`);

  if (!falResponse.ok) {
    const errText = await falResponse.text();
    throw new Error(`Fal.ai error (${falResponse.status}): ${errText}`);
  }

  const falData = await falResponse.json();
  let generatedImageUrl;
  if (falData?.images?.[0]?.url) {
    generatedImageUrl = falData.images[0].url;
  } else if (falData?.image?.url) {
    generatedImageUrl = falData.image.url;
  }

  if (!generatedImageUrl) {
    log('❌', 'Respuesta completa de Fal.ai:', falData);
    throw new Error('Fal.ai no devolvió una URL de imagen válida');
  }

  log('✅', '¡Imagen generada exitosamente!', { url: generatedImageUrl });

  // ── PASO 4: Descontar monedas ──────────────────────────────────────────
  log('4️⃣', `Descontando ${POSE_CHANGE_COST} monedas...`);
  const { data: newCoins, error: rpcErr } = await supabase.rpc('add_coins', {
    user_id_param: TEST_USER_ID,
    amount: -POSE_CHANGE_COST
  });

  if (rpcErr) throw new Error('Error RPC add_coins: ' + JSON.stringify(rpcErr));
  log('✅', `Monedas descontadas. Saldo nuevo: ${newCoins} 🪙`);

  // ── PASO 5: Guardar en outfit_history ──────────────────────────────────
  log('5️⃣', 'Registrando en outfit_history...');
  const promptDescr = `Pose: ${POSE_LABELS[POSE]}, Emoción: ${EMOTION_LABELS[EMOTION]}`;
  const { error: outfitErr } = await supabase.from('outfit_history').insert([{
    user_id: TEST_USER_ID,
    avatar_id: TEST_AVATAR_ID,
    conversation_id: TEST_CONVERSATION,
    image_url: generatedImageUrl,
    prompt: promptDescr
  }]);
  if (outfitErr) throw new Error('Error guardando outfit: ' + JSON.stringify(outfitErr));
  log('✅', 'Registro en outfit_history guardado:', promptDescr);

  // ── PASO 6: Actualizar imagen en la conversación ───────────────────────
  log('6️⃣', 'Actualizando current_avatar_image_url en la conversación...');
  const { error: convoErr } = await supabase
    .from('conversations')
    .update({ current_avatar_image_url: generatedImageUrl })
    .eq('id', TEST_CONVERSATION);
  if (convoErr) throw new Error('Error actualizando conversación: ' + JSON.stringify(convoErr));
  log('✅', 'Conversación actualizada con la nueva imagen');

  // ── PASO 7: Insertar mensaje narrativo ────────────────────────────────
  log('7️⃣', 'Insertando mensaje narrativo en el chat...');
  const poseText    = POSE_DESCRIPTIONS[POSE];
  const emotionText = EMOTION_DESCRIPTIONS[EMOTION];
  const narrative   = `*se muestra ahora ${poseText} y ${emotionText}*`;
  const { error: msgErr } = await supabase.from('messages').insert([{
    conversation_id: TEST_CONVERSATION,
    role: 'avatar',
    content: narrative
  }]);
  if (msgErr) throw new Error('Error insertando mensaje: ' + JSON.stringify(msgErr));
  log('✅', 'Mensaje narrativo insertado:', narrative);

  // ── RESUMEN FINAL ──────────────────────────────────────────────────────
  log('🎉', '=== RESULTADOS DEL TEST ===');
  console.log('');
  console.log('  🖼️  Imagen generada:  ', generatedImageUrl);
  console.log('  💰  Saldo anterior:   ', profile.coins);
  console.log('  💰  Saldo nuevo:      ', newCoins);
  console.log('  📝  Outfit guardado:  ', promptDescr);
  console.log('  💬  Mensaje chat:     ', narrative);
  console.log('');
  log('✅', 'TODOS LOS PASOS COMPLETADOS EXITOSAMENTE ✅');
}

runTest().catch(err => {
  console.error('\n❌ TEST FALLIDO:', err.message || err);
  process.exit(1);
});
