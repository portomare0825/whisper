import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Inicializamos el cliente de Stripe de forma segura para evitar crashes en el build de Vercel
// La llave falsa debe parecer real para que el constructor de Stripe no falle por validación de formato
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_51FakeKeyForSimulationOnly123456789';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-04-22.dahlia' as any, // Ignoramos el error de tipos si cambia o forzamos la que pide
});

export async function POST(req: Request) {
  try {
    const { priceId, planName, isCoinPackage } = await req.json();



    // 2. MODO REAL STRIPE
    // Este código se ejecutará cuando pongas tus llaves reales en el .env
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    
    // Obtenemos al usuario para asociarlo al pago
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Este debe ser el ID del Precio creado en el Dashboard de Stripe
          quantity: 1,
        },
      ],
      mode: isCoinPackage ? 'payment' : 'subscription', 
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: {
        userId: user?.id || '',
        planName,
        isCoinPackage: isCoinPackage ? 'true' : 'false'
      }
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
