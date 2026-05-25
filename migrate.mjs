// Migración directa vía REST API de Supabase
// Lee automáticamente las credenciales del .env.local
import { readFileSync } from 'fs';

// Leer .env.local manualmente
const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ No se encontraron las credenciales en .env.local');
  process.exit(1);
}

console.log(`\n🔌 Conectando a: ${SUPABASE_URL}`);

// Ejecutar SQL vía PostgREST RPC (función pg_catalog)
// Usamos el endpoint /rest/v1/rpc/... o directo vía query
async function runSQL(label, sql) {
  console.log(`\n▶ ${label}...`);
  
  // Supabase expone un endpoint de query directo con service role
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql })
  });
  
  if (!response.ok) {
    // Intentar con el endpoint de query directo de Supabase Management API
    const errText = await response.text();
    console.log(`  ℹ RPC no disponible (${response.status}), intentando verificación directa...`);
    return false;
  }
  
  const data = await response.json();
  console.log('  ✅ OK', data ? JSON.stringify(data).slice(0, 100) : '');
  return true;
}

async function verifyColumn(table, column) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=0`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    }
  );
  return response.ok;
}

async function main() {
  // Intentar ejecutar las migraciones via RPC
  await runSQL(
    'Agregar emotion_tag y hidden_thought a messages',
    'ALTER TABLE messages ADD COLUMN IF NOT EXISTS emotion_tag TEXT, ADD COLUMN IF NOT EXISTS hidden_thought TEXT;'
  );
  
  await runSQL(
    'Agregar context_summary y message_count a conversations',
    'ALTER TABLE conversations ADD COLUMN IF NOT EXISTS context_summary TEXT, ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;'
  );

  await runSQL('Reload schema cache', "SELECT pg_notify('pgrst', 'reload schema')");

  // Verificar directamente si las columnas son accesibles
  console.log('\n🔍 Verificando columnas...');
  
  const checks = [
    ['messages', 'emotion_tag'],
    ['messages', 'hidden_thought'],
    ['conversations', 'context_summary'],
    ['conversations', 'message_count'],
  ];

  let allOk = true;
  for (const [table, col] of checks) {
    const ok = await verifyColumn(table, col);
    console.log(`  ${ok ? '✅' : '❌'} ${table}.${col}`);
    if (!ok) allOk = false;
  }

  if (allOk) {
    console.log('\n🎉 ¡Todas las columnas están accesibles! El chat debería funcionar ahora.');
  } else {
    console.log('\n⚠️  Algunas columnas no son visibles aún. Esto es lo que necesitas pegar en el SQL Editor de Supabase:');
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS emotion_tag TEXT,
  ADD COLUMN IF NOT EXISTS hidden_thought TEXT;

ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS context_summary TEXT,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

NOTIFY pgrst, 'reload schema';
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
}

main().catch(console.error);
