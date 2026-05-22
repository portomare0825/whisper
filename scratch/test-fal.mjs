import fs from 'fs';
import path from 'path';

// Buscar .env.local
const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró el archivo .env.local');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const falKeyMatch = envContent.match(/^FAL_KEY\s*=\s*(.+)$/m);

if (!falKeyMatch) {
  console.error('No se encontró la variable FAL_KEY en .env.local');
  process.exit(1);
}

const FAL_KEY = falKeyMatch[1].trim().replace(/['"]/g, '');

console.log('Clave de Fal.ai encontrada.');
console.log('Iniciando llamada de diagnóstico a Fal.ai...');

try {
  const response = await fetch('https://fal.run/fal-ai/idm-vton', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}) // Enviamos payload vacío de prueba
  });

  console.log(`Status de respuesta de Fal.ai: ${response.status} (${response.statusText})`);
  
  const text = await response.text();
  console.log('Cuerpo de respuesta:', text);

  if (response.status === 401 || response.status === 403) {
    console.error('\n❌ ERROR DE AUTENTICACIÓN: La clave de Fal.ai no es válida o la cuenta no está activa.');
  } else if (response.status === 402) {
    console.error('\n❌ ERROR DE SALDO: No tienes créditos suficientes en tu cuenta de Fal.ai.');
  } else if (response.status === 422) {
    console.log('\n✅ ¡ÉXITO! La autenticación y la clave son totalmente válidas (el error 422 es el comportamiento esperado porque enviamos un payload vacío). Tu cuenta de Fal.ai está lista y activa.');
  } else {
    console.log('\nInformación adicional:', text);
  }

} catch (err) {
  console.error('Error al conectarse a Fal.ai:', err);
}
