import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'ksezyjdxvjgiryaiulew';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ Falta la variable SUPABASE_ACCESS_TOKEN en .env.local');
  process.exit(1);
}

const sqlPath = 'supabase/coin_accounting.sql';
let sql = '';
try {
  sql = readFileSync(sqlPath, 'utf-8');
} catch (e) {
  console.error(`❌ No se pudo leer el archivo ${sqlPath}:`, e.message);
  process.exit(1);
}

console.log(`🔌 Conectando a Supabase Project Ref: ${PROJECT_REF}...`);
console.log(`🚀 Ejecutando SQL de contabilidad de monedas...`);

async function run() {
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error HTTP ${response.status}: ${errText}`);
    }

    console.log('✅ Migración de contabilidad de monedas aplicada exitosamente en Supabase.');
  } catch (error) {
    console.error('❌ Error ejecutando la migración en Supabase:', error.message);
    process.exit(1);
  }
}

run();
