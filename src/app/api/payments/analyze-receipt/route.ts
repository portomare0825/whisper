import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { image } = await req.json(); // base64 encoded image
    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen de comprobante' }, { status: 400 });
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return NextResponse.json({ error: 'Clave de API de OpenRouter no configurada en el servidor' }, { status: 500 });
    }

    // Prompt de extracción de texto y OCR de alta precisión para capturas de Pago Móvil de bancos de Venezuela
    const prompt = `Analiza esta captura de pantalla de comprobante de Pago Móvil de Venezuela (bancos como Banesco, Banco de Venezuela, Mercantil, Provincial, etc.).
Extrae los siguientes datos clave y devuélvelos estrictamente en formato JSON válido, sin bloques de código markdown ni texto adicional, usando exactamente estas claves:
{
  "monto": "Monto de la transferencia (ej. 121,50 Bs o 120 Bs)",
  "referencia": "Número de referencia, recibo, lote o aprobación",
  "banco": "Nombre del banco desde el cual se envió el dinero (ej. Banco de Venezuela, Mercantil, Banesco, etc.)",
  "fecha": "Fecha en que se realizó la operación (DD/MM/AAAA)"
}
Si alguno de estos datos no se puede encontrar o leer, escribe "No detectado" para ese campo. Mantén el JSON limpio y válido.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AvatarChat Payment Receipt Analyzer'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Modelo multimodal rápido y preciso
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: image // Formato base64 completo: data:image/jpeg;base64,...
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error al llamar a OpenRouter:', errText);
      throw new Error('Fallo la respuesta del motor de análisis de IA.');
    }

    const data = await response.json();
    let resultText = data.choices?.[0]?.message?.content;
    if (!resultText) {
      throw new Error('No se recibió respuesta del analizador de comprobantes.');
    }

    // Limpiar posibles bloques de markdown en el JSON
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedResult = JSON.parse(resultText);

    return NextResponse.json({
      success: true,
      data: parsedResult
    });

  } catch (error: any) {
    console.error('Error en analyze-receipt API:', error);
    return NextResponse.json({ error: error.message || 'Error al analizar el comprobante' }, { status: 500 });
  }
}
