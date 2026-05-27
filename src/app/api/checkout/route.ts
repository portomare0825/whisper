import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia' as any,
    });

    const { priceId, planName, isCoinPackage, userId: frontendUserId } = await req.json();

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

    const finalUserId = user?.id || frontendUserId || '';

    if (!finalUserId) {
      throw new Error("No se pudo determinar el ID de usuario para esta transacción");
    }

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
        userId: finalUserId,
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
