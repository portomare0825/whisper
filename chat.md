```markdown
# Guía Completa: Optimización de IA para Apps de Roleplay en Español

Esta guía contiene la recopilación exhaustiva de estrategias, configuraciones y arquitecturas para optimizar una aplicación de chat con inteligencia artificial (IA), enfocada en roleplay premium y lenguaje español nativo. 

## 1. Selección de Modelos (OpenRouter)
Los modelos genéricos de 70B tienden a "pensar" en inglés y traducir internamente, generando un español robótico y artificial. Para una experiencia nativa y premium, se recomiendan:
*   **Claude 3.5 Sonnet:** El rey indiscutible en redacción orgánica y comprensión de contexto.
*   **Command R+ (Cohere):** Diseñado para escenarios empresariales y multilingües, ofrece un español muy nativo y resultados narrativos humanos excepcionales.
*   **Modelos Específicos para Roleplay:** Las versiones puras de Llama o Mistral son rígidas, por lo que es preferible usar modelos *fine-tuned* para rol literario y sin censura, como **Magnum 72B** o variantes de Llama 3 Instruct como **Euryale de Sao10K** y **Mythomax**.

## 2. Configuración de la API y Parámetros
El roleplay requiere creatividad y variedad para no aburrir.
*   **Temperatura:** Para chat general, ajusta entre 0.7 y 0.9. Para roleplay, súbela a 1.0 o 1.1 para obtener un vocabulario más rico.
*   **Penalizaciones:** Ajusta el *Frequency Penalty* entre 0.2 y 0.4 (evita repetición de palabras/muletillas) y el *Presence Penalty* entre 0.1 y 0.3 (incentiva la introducción de nuevos elementos a la trama).
*   **Límites de Longitud:** Configura `max_tokens` entre 150 y 250 (1 o 2 párrafos) para evitar que el bot genere "muros de texto" y juegue solo.
*   **Secuencias de Parada (Stop Sequences):** Añade el prefijo del jugador (ej. "Usuario:" o "Tú:") en el array de parada para que la IA detenga la generación si intenta escribir por el jugador.

## 3. Ingeniería de Prompts (System Prompt)
El *System Prompt* es fundamental para guiar el tono del modelo, que por defecto tiende a ser formal, inglés traducido y excesivamente amable.
*   **Regla de Oro de Idioma:** Exige explícitamente español nativo, literario y natural, prohibiendo estructuras calcadas del inglés, como el exceso de voz pasiva y gerundios.
*   **Estructura de Personaje (Formato W++):** Los modelos 70B procesan mejor los atributos si se estructuran como pseudo-código o JSON en lugar de párrafos largos. Este formato reduce el consumo de tokens y asegura que el modelo respete las características.
*   **Voz Propia y Modismos:** Implementa una variable de `speech_style` para definir exactamente cómo habla el personaje (ej. jerga informal, o un tono noble usando "vos").
*   **Filtro de Clichés (Lista Negra):** Prohíbe en el prompt frases de IA comunes, como "como modelo de lenguaje", verbos sobreutilizados (ej. *esbozar una sonrisa*, *un escalofrío recorrió*), y transiciones repetitivas (*sin embargo*, *de repente*).
*   **Anticomplacencia y Drama:** Instruye a la IA a que está prohibido ser amable por defecto si el personaje es rudo o villano, reaccionando al conflicto con drama en lugar de diplomacia.
*   **Anti-Puppeteering:** Prohíbe estrictamente a la IA decidir las acciones, pensamientos o diálogos del usuario, forzándola a reaccionar solo al turno inmediato.
*   **Prevención de Saltos Temporales (Time Skips):** Ordena que se juegue momento a momento en tiempo real, prohibiendo avanzar la escena automáticamente.
*   **Modificador de Iniciativa:** Establece reglas para que la IA tome un rol proactivo (introducir secretos, preguntas, eventos ambientales) en lugar de ser un simple espejo reactivo del usuario.
*   **Jailbreak Dinámico:** Para evitar bloqueos morales o de censura (especialmente con Claude o Llama), incluye una instrucción indicando que es ficción literaria sin personas reales, obligando al modelo a retratar comportamientos oscuros o adultos si la trama lo requiere.

## 4. Arquitectura Avanzada de Backend y Contexto
Para evitar la "pérdida de atención" de los modelos en chats largos y mantener los costos controlados, no se debe enviar todo el historial bruto.
*   **Memoria en Tres Capas:** 
    1.  *Memoria Core:* Prompt del sistema (quién es el personaje).
    2.  *Memoria Reciente:* Últimos 15 a 20 mensajes para mantener la fluidez a corto plazo.
    3.  *Memoria Semántica / Summary Inyectado:* Un *worker* en segundo plano que, cada 20 mensajes, usa un modelo barato (como Llama 3 8B) para resumir los eventos clave en 3 líneas, inyectándolo al inicio del payload con etiquetas `<summary>`.
*   **Diccionario del Mundo (Lorebook):** Un sistema que escanea los mensajes del usuario en busca de palabras clave inventadas y, si las encuentra, inyecta su significado dinámicamente como notas de contexto antes del prompt.
*   **Inyección de la Situación Actual (System Note):** Un campo oculto añadido antes del último mensaje para recordarle al modelo la ubicación física y hora (ej. lluvia, noche, en una cabaña), anclando su cognición espacial.
*   **Temperatura Dinámica:** Un algoritmo que sube la temperatura a 1.05 si el usuario escribe muy poco (para forzar iniciativa) y la baja a 0.75 si el usuario escribe un texto largo (para forzar coherencia).
*   **Prevención de Bucles (El Bug del Eco):** Analizar en el backend las primeras 3 palabras de los últimos 3 mensajes de la IA; si repite estructura (ej. empezar con gerundios), se inyecta una advertencia dinámica en la petición.
*   **Validador de Formato (Regex Guard):** Una función backend para balancear asteriscos desparejos antes de enviar la respuesta al frontend, protegiendo el diseño visual.

## 5. Frontend UI/UX y Funciones Premium exclusivas
*   **Modo Novela (Literatura):** Abandona el estilo de burbujas de WhatsApp. Haz que el texto fluya continuamente, usando CSS para diferenciar con cursiva y opacidad las narraciones (entre asteriscos) de los diálogos.
*   **Streaming Suavizado (Fade-in CSS):** Acumula tokens en pequeños buffers y muéstralos con transiciones de opacidad para enmascarar la latencia de la red, simulando un pensamiento orgánico en lugar de escritura matemática y fría.
*   **Swipe (Regeneración):** Permite al usuario generar alternativas deslizando, lo cual reenvía la petición subiendo sutilmente la temperatura (+0.05 a +0.1) para ramificar la historia.
*   **Leer la Mente (Pensamientos Ocultos):** Instruye a la IA mediante XML a incluir su monólogo interno antes del rol normal. En el frontend de React, oculta este texto con un desenfoque (*blur*) CSS que solo los usuarios premium puedan revelar gastando recursos o presionando un botón.
*   **Sistema de Emociones (Metadatos):** Fuerza al modelo a incluir etiquetas ocultas de emociones al final de la respuesta (ej. `[EMOCIÓN: Feliz]`) para alterar dinámicamente colores de interfaz, avatares o parámetros de voz TTS.
*   **Ejemplos de Contexto Fantasma (Few-Shot):** En bots nuevos, inyecta falsos mensajes previos ocultos para que el modelo clone el estilo literario correcto desde el primer saludo. El primer saludo siempre debe tener una ortografía y estilo impecables.
*   **Filtros de Salida:** Usa Regex en React para limpiar frases introductorias típicas de IA y arreglar espacios huérfanos alrededor de los asteriscos y guiones largos.
```