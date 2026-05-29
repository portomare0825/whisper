import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── AUXILIARES DE MEMORIA ──

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('[ARCHIVE EMBEDDING] Falta GOOGLE_API_KEY.');
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[ARCHIVE EMBEDDING] Falló Gemini: ${response.status}. ${errText}`);
      return null;
    }

    const data = await response.json();
    const values = data.embedding?.values;
    if (values && Array.isArray(values)) {
      return values;
    }
  } catch (error: any) {
    console.error('[ARCHIVE EMBEDDING] Excepción:', error);
  }
  return null;
}

async function callLLMForMemory(
  systemPrompt: string,
  userPrompt: string,
  recentMessagesFormatted: Array<{ role: string; content: string }>,
  temperature: number = 0.3,
  jsonMode: boolean = false
): Promise<string | null> {
  const models = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemma-2-9b-it:free",
    "sao10k/l3-lunaris-8b"
  ];

  const payloadMessages = [
    { role: "system", content: systemPrompt },
    ...recentMessagesFormatted,
    { role: "user", content: userPrompt }
  ];

  for (const model of models) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          temperature: temperature,
          max_tokens: 400,
          response_format: jsonMode ? { type: "json_object" } : undefined,
          messages: payloadMessages
        })
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (e) {
      console.warn(`[ARCHIVE LLM] Falló llamada con ${model}:`, e);
    }
  }
  return null;
}

// ── CONTROLADOR PRINCIPAL ──

export async function POST(req: Request) {
  try {
    const { conversation_id, avatar_id } = await req.json();

    if (!conversation_id || !avatar_id) {
      return NextResponse.json({ error: 'Falta conversation_id o avatar_id' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtener conversación y avatar
    const { data: convo } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (!convo) {
      return NextResponse.json({ error: 'No se encontró la conversación' }, { status: 404 });
    }

    // 2. Obtener historial COMPLETO de mensajes activos de esta conversación
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, message: 'La conversación ya estaba vacía. No requiere archivado.' });
    }

    console.log(`[ARCHIVE] Iniciando consolidación forzada de ${messages.length} mensajes para la conversación ${conversation_id}...`);

    const recentMessagesFormatted = messages.map(m => ({
      role: m.role === 'avatar' ? 'assistant' : 'user',
      content: m.content
    }));

    // === PASO A: GENERAR EL RESUMEN NARRATIVO ===
    console.log('[ARCHIVE] Paso A: Generando resumen narrativo...');
    const summaryResult = await callLLMForMemory(
      "Eres un asistente de roleplay que resume conversaciones. Resume los eventos, emociones y hechos clave de esta conversación en máximo 4 o 5 líneas en español, en tercera persona y de forma neutral. Sé sumamente preciso. No saludes ni agregues explicaciones.",
      "Resume los eventos y hechos más importantes del chat reciente en 4-5 líneas.",
      recentMessagesFormatted,
      0.3
    );

    if (summaryResult) {
      console.log(`[ARCHIVE] Resumen generado con éxito: "${summaryResult}"`);
      await supabase
        .from('conversations')
        .update({ context_summary: summaryResult })
        .eq('id', conversation_id);
    }

    // === PASO B: EXTRAER Y CONSOLIDAR HECHOS CLAVE (JSONB) ===
    console.log('[ARCHIVE] Paso B: Extrayendo hechos clave (JSONB)...');
    const currentKeyFacts = convo.key_facts || {};
    const factsPrompt = `Eres un sistema que consolida hechos y el estado de una relación en formato JSON.
Tienes este JSON actual que representa lo que ya sabíamos de la relación:
${JSON.stringify(currentKeyFacts)}

Analiza el diálogo reciente e incorpora hechos NUEVOS relevantes (como gustos, profesión, nombres, apodos, secretos o el estado civil del usuario o del avatar) o actualiza el estado de la relación. Mantenlo súper conciso.
REGLAS:
1. Responde ÚNICAMENTE con el objeto JSON estructurado exactamente así:
{
  "gustos_usuario": ["ejemplo1"],
  "relacion_actual": "ejemplo",
  "apodos_o_nombres": ["ejemplo"],
  "secretos_revelados": ["ejemplo"],
  "detalles_importantes": ["ejemplo"]
}
2. NO modifiques campos antiguos a menos que hayan cambiado.
3. Si no hay nada nuevo, mantén el JSON igual.
4. Tu respuesta debe ser SOLO un JSON válido, sin explicaciones ni markdown.`;

    const factsResult = await callLLMForMemory(
      factsPrompt,
      "Extrae y actualiza el perfil en JSON de acuerdo a la conversación reciente.",
      recentMessagesFormatted,
      0.2,
      true
    );

    if (factsResult) {
      try {
        const parsedFacts = JSON.parse(factsResult);
        console.log('[ARCHIVE] Hechos clave (JSONB) consolidados:', parsedFacts);
        await supabase
          .from('conversations')
          .update({ key_facts: parsedFacts })
          .eq('id', conversation_id);
      } catch (e) {
        console.error('[ARCHIVE] Error al parsear JSON de hechos clave:', e, 'Raw output:', factsResult);
      }
    }

    // === PASO C: DETECTAR HITOS NARRATIVOS (Milestones) ===
    console.log('[ARCHIVE] Paso C: Buscando hitos narrativos importantes...');
    const milestonePrompt = `Eres un analista literario de roleplay.
Analiza la conversación reciente y determina si ha ocurrido algún evento crucial o hito irreversible en la historia (ej: "Se declararon su amor", "Confesó que se muda mañana", "Tuvieron una pelea muy grave", "Llegaron a un acuerdo sobre X").
REGLAS:
1. Si ocurrió un hito crucial, descríbelo en UNA sola oración corta en español y en tercera persona (ej: "El usuario le confesó que planea irse de viaje por meses").
2. Si no ocurrió ningún evento crucial, responde ÚNICAMENTE con la palabra "NINGUNO".
3. Sé estricto: un hito debe marcar un punto de inflexión. Conversaciones casuales no son hitos.`;

    const milestoneResult = await callLLMForMemory(
      milestonePrompt,
      "¿Ocurrió algún hito decisivo en esta parte del chat?",
      recentMessagesFormatted,
      0.3
    );

    if (milestoneResult && milestoneResult.trim().toUpperCase() !== 'NINGUNO') {
      const cleanMilestone = milestoneResult.trim().replace(/^["']|["']$/g, '');
      console.log(`[ARCHIVE] Hito detectado: "${cleanMilestone}". Guardando...`);
      await supabase
        .from('milestones')
        .insert({
          conversation_id: conversation_id,
          user_id: convo.user_id,
          avatar_id: convo.avatar_id,
          description: cleanMilestone
        });
    }

    // === PASO D: GENERAR MEMORIAS SEMÁNTICAS (RAG Vectorial) ===
    console.log('[ARCHIVE] Paso D: Extrayendo recuerdos semánticos para RAG...');
    const memoriesPrompt = `Eres un extractor de recuerdos a largo plazo para un chatbot.
Revisa el diálogo y extrae 1 o 2 hechos muy específicos y significativos que merezca la pena recordar en el futuro a largo plazo (ej: "El usuario prefiere el sushi de salmón", "Al avatar le encanta pasear por la playa de noche", "El usuario tiene un perro llamado Max").
REGLAS:
1. Escribe cada recuerdo en una oración independiente, muy directa y clara, en tercera persona en español.
2. Si hay más de un recuerdo, sepáralos por salto de línea.
3. Si no hay nada de gran relevancia duradera en este bloque, responde ÚNICAMENTE con la palabra "NINGUNO".`;

    const memoriesResult = await callLLMForMemory(
      memoriesPrompt,
      "Extrae recuerdos significativos para almacenamiento a largo plazo.",
      recentMessagesFormatted,
      0.3
    );

    if (memoriesResult && memoriesResult.trim().toUpperCase() !== 'NINGUNO') {
      const rawMemories = memoriesResult.split('\n')
        .map(m => m.trim().replace(/^[-*+\d\.\s]+/g, ''))
        .filter(m => m.length > 5);

      console.log(`[ARCHIVE] Recuerdos semánticos extraídos:`, rawMemories);

      for (const memoryText of rawMemories) {
        try {
          const embedding = await generateEmbedding(memoryText);
          if (embedding) {
            await supabase
              .from('semantic_memories')
              .insert({
                conversation_id: conversation_id,
                user_id: convo.user_id,
                avatar_id: convo.avatar_id,
                content: memoryText,
                embedding: embedding
              });
            console.log(`[ARCHIVE] Memoria semántica vectorial guardada: "${memoryText}"`);
          }
        } catch (err) {
          console.error('[ARCHIVE] Error al guardar memoria semántica:', err);
        }
      }
    }

    // === PASO E: LIMPIAR CHAT (BORRADO FÍSICO DE MENSAJES Y RESET DE CONTADOR) ===
    console.log('[ARCHIVE] Paso E: Removiendo mensajes activos y reseteando contadores...');
    
    // Borrar físicamente los mensajes
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversation_id);

    if (deleteError) {
      throw deleteError;
    }

    // Resetear el contador de mensajes
    await supabase
      .from('conversations')
      .update({ message_count: 0 })
      .eq('id', conversation_id);

    console.log('[ARCHIVE] ¡Conversación archivada y consolidada exitosamente!');

    return NextResponse.json({
      success: true,
      message: 'La conversación ha sido archivada y todos los recuerdos han sido guardados en la memoria del avatar.'
    });

  } catch (error: any) {
    console.error('API Archive Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno al archivar el chat' }, { status: 500 });
  }
}
