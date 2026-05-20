/* eslint-disable */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const targetEmail = process.argv[2] || 'portomare0825@gmail.com';
    console.log(`Buscando usuario con email: ${targetEmail}`);

    const { data: { users }, error: authError } = await sb.auth.admin.listUsers();
    if (authError) throw authError;

    const user = users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
    
    if (!user) {
      console.error(`Error: No se encontró ningún usuario con el email ${targetEmail}`);
      console.log('Usuarios disponibles:');
      users.forEach(u => console.log(`- ${u.email} (${u.id})`));
      return;
    }

    const uid = user.id;
    console.log(`Usuario encontrado. ID: ${uid}. Procediendo a actualizar a Pro...`);
    
    // Eliminar si existe para evitar conflictos de llave única
    await sb.from('subscriptions').delete().eq('user_id', uid);

    const { error: insertError } = await sb.from('subscriptions').insert({
      user_id: uid,
      status: 'active',
      plan_type: 'pro'
    });
    
    if (insertError) throw insertError;
    
    console.log(`¡Éxito! El usuario ${targetEmail} (${uid}) ahora tiene suscripción Pro activa.`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();

