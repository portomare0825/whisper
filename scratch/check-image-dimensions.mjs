// Fetch is native in Node 22

const imageUrl = 'https://ksezyjdxvjgiryaiulew.supabase.co/storage/v1/object/public/avatars/11105792-5e5c-49ad-9b19-11da0cbbc028/1779245619998.jpg';

function getJpegSize(buffer) {
  try {
    let i = 2;
    while (i < buffer.length) {
      if (buffer[i] !== 0xFF) return null;
      let marker = buffer[i + 1];
      if (marker === 0xC0 || marker === 0xC2) { // SOF0 or SOF2
        let height = buffer.readUInt16BE(i + 5);
        let width = buffer.readUInt16BE(i + 7);
        return { width, height };
      } else {
        let length = buffer.readUInt16BE(i + 2);
        i += 2 + length;
      }
    }
  } catch (e) {
    console.error('Error al analizar la cabecera JPEG:', e);
  }
  return null;
}

async function run() {
  console.log('Descargando imagen de prueba...');
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Fallo HTTP: ${res.status}`);
  
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const size = getJpegSize(buffer);
  if (size) {
    console.log(`\n📏 Dimensiones de la imagen original:`);
    console.log(`Ancho: ${size.width}px`);
    console.log(`Alto: ${size.height}px`);
    console.log(`Relación de aspecto: ${(size.width / size.height).toFixed(3)} (${size.width}:${size.height})`);
    
    const targetRatio = 3 / 4;
    console.log(`\nObjetivo de Fal.ai (3:4 = 0.750):`);
    console.log(`Diferencia de proporción: ${Math.abs((size.width / size.height) - targetRatio).toFixed(3)}`);
  } else {
    console.log('No se pudieron extraer las dimensiones JPEG (¿es otro formato?)');
  }
}

run().catch(console.error);
