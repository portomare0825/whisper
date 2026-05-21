import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-04-22.dahlia' as any,
});

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      console.error('Falta el signature o webhook secret');
      return NextResponse.json({ error: 'Missing webhook secret or signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed. ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.userId;
      const planName = session.metadata?.planName || '';
      const isCoinPackage = session.metadata?.isCoinPackage === 'true';

      if (userId) {
        // Inicializar cliente admin de supabase para saltar RLS
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        if (isCoinPackage) {
          // Lógica de compra de Monedas
          let coinsToAward = 10;
          if (planName.includes('Básico')) coinsToAward = 10;
          else if (planName.includes('Popular')) coinsToAward = 50;
          else if (planName.includes('Premium')) coinsToAward = 200;

          const { error: rpcError } = await adminClient.rpc('add_coins', {
            user_id_param: userId,
            amount: coinsToAward
          });

          if (rpcError) {
            console.error(`Error al acreditar ${coinsToAward} monedas al usuario ${userId}:`, rpcError);
          } else {
            console.log(`Compra de monedas exitosa. +${coinsToAward} monedas para ${userId}`);
          }
        } else {
          // Lógica de Suscripciones (Diario, Semanal, Mensual)
          await adminClient.from('subscriptions').delete().eq('user_id', userId);
          
          const planNameLower = planName.toLowerCase();
          const planType = planNameLower.includes('diario') || planNameLower.includes('semanal') 
                            ? 'pay_per_use' 
                            : 'pro';
          
          const expiresAt = new Date();
          if (planNameLower.includes('diario')) {
            expiresAt.setDate(expiresAt.getDate() + 1);
          } else if (planNameLower.includes('semanal')) {
            expiresAt.setDate(expiresAt.getDate() + 7);
          } else {
            expiresAt.setDate(expiresAt.getDate() + 30);
          }

          await adminClient.from('subscriptions').insert({
            user_id: userId,
            status: 'active',
            plan_type: planType,
            expires_at: expiresAt.toISOString()
          });

          // Otorgar monedas iniciales por suscribirse
          let coinsToAward = 10;
          if (planNameLower.includes('semanal')) coinsToAward = 40;
          else if (planNameLower.includes('mensual') || planNameLower.includes('pro')) coinsToAward = 150;

          await adminClient.rpc('add_coins', {
            user_id_param: userId,
            amount: coinsToAward
          });

          console.log(`Suscripción actualizada a ${planType} para el usuario ${userId}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
