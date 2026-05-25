const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log("=== COMPROBANDO BASE DE DATOS ===");
  
  // 1. Suscripciones push
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('*');
  
  if (subsError) {
    console.error("Error al consultar push_subscriptions:", subsError.message);
  } else {
    console.log(`Dispositivos suscritos a notificaciones Push: ${subs.length}`);
    subs.forEach(s => {
      console.log(`- Usuario ID: ${s.user_id}, Creado: ${s.created_at}`);
    });
  }

  // 2. Conversaciones y último mensaje
  const { data: convos, error: convoError } = await supabase
    .from('conversations')
    .select('id, user_id, avatar_id');

  if (convoError) {
    console.error("Error al consultar conversaciones:", convoError.message);
    return;
  }

  console.log(`\nConversaciones encontradas: ${convos.length}`);
  for (const convo of convos) {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: avatar } = await supabase
      .from('avatars')
      .select('name')
      .eq('id', convo.avatar_id)
      .single();

    if (messages && messages.length > 0) {
      const lastMsg = messages[0];
      const timeDiffMin = ((Date.now() - new Date(lastMsg.created_at).getTime()) / 60000).toFixed(2);
      console.log(`- Chat con ${avatar?.name || convo.avatar_id} (ID Convo: ${convo.id}):`);
      console.log(`  Último mensaje enviado por: ${lastMsg.role}`);
      console.log(`  Contenido: "${lastMsg.content}"`);
      console.log(`  Hace: ${timeDiffMin} minutos`);
    } else {
      console.log(`- Chat con ${avatar?.name || convo.avatar_id} (ID Convo: ${convo.id}): Sin mensajes.`);
    }
  }
}

run();
