require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const { data: { users }, error: authError } = await sb.auth.admin.listUsers();
    if (authError) throw authError;
    
    if (users.length === 0) {
      console.log('No hay usuarios en la base de datos.');
      return;
    }
    
    const uid = users[0].id;
    
    // Eliminar si existe
    await sb.from('subscriptions').delete().eq('user_id', uid);

    const { error: insertError } = await sb.from('subscriptions').insert({
      user_id: uid,
      status: 'active',
      plan_type: 'pro'
    });
    
    if (insertError) throw insertError;
    
    console.log('¡Éxito! El usuario con ID', uid, 'ahora tiene suscripción Pro activa.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
