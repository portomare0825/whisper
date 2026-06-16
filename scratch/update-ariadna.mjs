import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// 1. Leer .env.local de forma manual
try {
  const envContent = readFileSync('.env.local', 'utf-8');
  const env = Object.fromEntries(
    envContent.split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => { 
        const [k, ...v] = l.split('='); 
        return [k.trim(), v.join('=').trim()]; 
      })
  );

  const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
  const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
    process.exit(1);
  }

  // 2. Conectar a Supabase con bypass de RLS
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  async function updateAvatar() {
    console.log('🔍 Buscando avatar Ariadna / Ariana...');

    // Obtener los avatares que coincidan con el nombre
    const { data: avs, error: fetchError } = await supabase
      .from('avatars')
      .select('id, name, roleplay_settings');

    if (fetchError) {
      throw fetchError;
    }

    // Filtrar localmente por expresión regular tolerante a Ariadna/Ariana
    const targetAvatars = avs.filter(a => 
      /ariana/i.test(a.name) || /ariadna/i.test(a.name)
    );

    if (targetAvatars.length === 0) {
      console.log('⚠️  No se encontró ningún avatar con el nombre "Ariadna" o "Ariana" en la base de datos.');
      return;
    }

    console.log(`✨ Se encontraron ${targetAvatars.length} avatar(es):`);
    
    for (const avatar of targetAvatars) {
      const currentSettings = avatar.roleplay_settings || {
        dificultad_conquista: 0.5,
        apertura_inicial: 0.5,
        velocidad_confianza: 0.5
      };

      const updatedSettings = {
        ...currentSettings,
        apertura_inicial: 0.3
      };

      console.log(`   - Actualizando "${avatar.name}" (ID: ${avatar.id})...`);
      console.log(`     Ajustes viejos:`, currentSettings);
      console.log(`     Ajustes nuevos:`, updatedSettings);

      const { error: updateError } = await supabase
        .from('avatars')
        .update({ roleplay_settings: updatedSettings })
        .eq('id', avatar.id);

      if (updateError) {
        console.error(`   ❌ Error al actualizar "${avatar.name}":`, updateError);
      } else {
        console.log(`   ✅ "${avatar.name}" actualizado correctamente.`);
        
        // También resetear las conversaciones activas con este avatar para aplicar el nuevo inicio
        console.log(`   - Reseteando nivel de confianza inicial en las conversaciones con ${avatar.name}...`);
        const { data: convos } = await supabase
          .from('conversations')
          .select('id, key_facts')
          .eq('avatar_id', avatar.id);

        if (convos && convos.length > 0) {
          for (const convo of convos) {
            const updatedFacts = {
              ...(convo.key_facts || {}),
              nivel_confianza: 3.0 // 0.3 * 10
            };
            await supabase
              .from('conversations')
              .update({ key_facts: updatedFacts })
              .eq('id', convo.id);
          }
          console.log(`   ✅ Se actualizaron las conversaciones vinculadas.`);
        }
      }
    }
  }

  updateAvatar().catch(err => {
    console.error('❌ Error general durante la actualización:', err);
  });

} catch (err) {
  console.error('❌ Error al abrir .env.local:', err.message);
}
