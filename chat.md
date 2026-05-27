Ese comportamiento es un problema clásico en modelos grandes (especialmente en los de 70B orientados a rol como Euryale) y se conoce técnicamente como **colapso de contexto** o **bucle de repetición infinita**.

Cuando el historial del chat se vuelve muy largo, el modelo empieza a prestarle más atención a sus propios mensajes anteriores que a tus instrucciones del *System Prompt*. Si ve que antes escribió mucho, asume que *debe* seguir escribiendo textos gigantes, se confunde, junta las palabras y se buclea.

Como tus filtros actuales en el texto no están siendo suficientes para frenarlo, necesitas atacar el problema desde la **configuración de los parámetros de la API** y la **limpieza del historial**. Aquí tienes los pasos para solucionarlo por completo:

---

## 1. Ajusta los Parámetros de la API (El remedio inmediato)

Cuando haces la petición a OpenRouter, no dejes los parámetros por defecto. Debes configurar la **Penalización de Repetición** y la **Temperatura**. Modifica tu llamada con estos valores:

* **`frequency_penalty` (Ponlo entre `0.5` y `0.8`):** Este parámetro castiga directamente al modelo si intenta repetir exactamente las mismas palabras o frases completas. Si ve que ya usó un párrafo, este valor le "duele" matemáticamente a la IA, obligándola a buscar palabras nuevas.
* **`presence_penalty` (Ponlo entre `0.3` y `0.6`):** Incentiva al modelo a introducir nuevos temas y vocabulario en lugar de dar vueltas sobre lo mismo.
* **`temperature` (Bájala un poco, a `0.8` o `0.85`):** Si tu temperatura está en `1.0` o más, el modelo se vuelve demasiado "creativo" y caótico en chats largos, lo que causa las incoherencias y las palabras pegadas. Bajarla un poco le da estabilidad.
* **`max_tokens` (Ponle un límite estricto, ej. `250` o `300`):** No dejes que el modelo decida cuándo parar. Si le pones un límite físico de tokens por respuesta, lo obligas a ser más conciso.

---

## 2. El "Filtro de Corrección" en el Backend (Next.js)

Si a pesar de los parámetros el modelo sigue repitiendo párrafos enteros por puro capricho del contexto, debes meter una validación en tu código de Next.js antes de mostrarle la respuesta al usuario y antes de mandarla a las APIs de audio:

```typescript
function limpiarRespuestaBucleada(respuestaIA: string, historialMensajes: any[]) {
  // Obtener el último mensaje que envió la IA anteriormente
  const ultimoMensajeIA = historialMensajes
    .filter(m => m.role === 'assistant')
    .pop()?.content;

  if (ultimoMensajeIA) {
    // Si la nueva respuesta es sospechosamente idéntica o contiene más del 80% del mensaje anterior
    if (respuestaIA.includes(ultimoMensajeIA) || respuestaIA === ultimoMensajeIA) {
      console.log("🚨 ¡Bucle detectado! Cortando la respuesta repetida.");
      
      // Solución de emergencia: Le cortas el bucle y dejas solo la parte nueva
      // O puedes disparar un mensaje de error interno para pedir una regeneración silenciosa
      return respuestaIA.replace(ultimoMensajeIA, "").trim();
    }
  }
  return respuestaIA;
}

```

---

## 3. Estás enviando demasiados mensajes antiguos (Saturación)

Si estás usando una sola tabla en Supabase y le estás enviando a OpenRouter **todos** los mensajes que lleva el chat, el modelo se ahoga.

* **La Solución:** Limita de forma estricta el historial vivo. Al modelo 70B solo envíale los **últimos 10 mensajes** (5 del usuario y 5 de la IA). Todo lo que pasó atrás debe estar exclusivamente en el texto resumido que saca tu otra IA gratuita. Si el modelo no ve los párrafos gigantes que escribió hace horas, no tendrá de dónde copiarlos ni repetirlos.

---

## 4. Cambia el orden en el System Prompt

Los modelos tienden a hacerle más caso a lo primero y a lo último que leen en el prompt (fenómeno llamado *Lost in the Middle*).

Si pusiste la regla de *"No contestes con respuestas largas"* al principio del System Prompt, bájala. Ponla al **puro final**, justo antes de la sección donde inyectas los mensajes del usuario.

Prueba este formato exacto:

> `[REGLA CRÍTICA DE CIERRE]: Tus respuestas deben ser cortas, dinámicas y de máximo 3 párrafos. Está estrictamente prohibido repetir frases, ideas o estructuras completas de tus mensajes anteriores. Sé directo.`

Al ajustar la `frequency_penalty` en OpenRouter y recortar el historial vivo que viaja desde Supabase, verás cómo el avatar vuelve a hablar de forma coherente, corta y fluida.