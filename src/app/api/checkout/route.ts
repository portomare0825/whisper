import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inicializamos el cliente de Stripe. Si la clave es vacía o simulada, 
// no fallará aquí pero fallará al intentar hacer peticiones reales.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-04-22.dahlia' as any, // Ignoramos el error de tipos si cambia o forzamos la que pide
});

export async function POST(req: Request) {
  try {
    const { priceId, planName } = await req.json();

    // 1. MODO SIMULADOR
    // Si detectamos las llaves de prueba del simulador, omitimos Stripe
    if (stripeSecretKey === 'sk_test_simulador' || !stripeSecretKey) {
      console.log(`[SIMULADOR] Petición de pago interceptada para plan: ${planName}`);
      
      // Simulamos un retraso de red
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Devolvemos la URL de éxito simulada
      const origin = req.headers.get('origin') || 'http://localhost:3000';
      return NextResponse.json({ 
        url: `${origin}/checkout/success`,
        isSimulated: true 
      });
    }

    // 2. MODO REAL STRIPE
    // Este código se ejecutará cuando pongas tus llaves reales en el .env
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    
    // Aquí deberías crear un Cliente en Stripe o buscarlo en tu Base de Datos
    // const customerId = ...

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Este debe ser el ID del Precio creado en el Dashboard de Stripe
          quantity: 1,
        },
      ],
      mode: 'subscription', // Cambiar a 'payment' si es pago único
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      // customer: customerId, // (Opcional) Asocia el pago a un usuario
    });

    return NextResponse.json({ url: session.url, isSimulated: false });
    
  } catch (error: any) {
    console.error('Error creando la sesión de Stripe:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
