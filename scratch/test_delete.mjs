import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  // 1. Obtener los últimos 2 mensajes
  const { data: messages, error: fetchError } = await supabase
    .from('messages')
    .select('id, role, content')
    .order('created_at', { ascending: false })
    .limit(2);

  if (fetchError) {
    console.error("Error al buscar mensajes:", fetchError);
    return;
  }

  console.log("Últimos 2 mensajes encontrados:", messages);
  if (!messages || messages.length === 0) {
    console.log("No hay mensajes en la base de datos.");
    return;
  }

  const ids = messages.map(m => m.id);
  console.log("Intentando eliminar IDs:", ids);

  // 2. Intentar eliminarlos usando .delete().in('id', ids).select()
  const { data: deletedRows, error: deleteError } = await supabase
    .from('messages')
    .delete()
    .in('id', ids)
    .select();

  console.log("Resultado de la eliminación:");
  console.log("Filas eliminadas:", deletedRows);
  console.log("Error:", deleteError);
}

run();
