import fs from 'fs';
import path from 'path';

const src = "C:\\Users\\adm-09\\.gemini\\antigravity-ide\\brain\\2c40802f-913d-446c-8f18-ccb8f5647d4e\\media__1780153380659.jpg";
const dest = "c:\\Users\\adm-09\\Desktop\\Geminis\\Antigravity\\ChatBot\\public\\pago_movil_qr.jpg";

try {
  fs.copyFileSync(src, dest);
  console.log("¡Copiado con éxito mediante Node.js!");
} catch (err) {
  console.error("Error al copiar:", err);
}
