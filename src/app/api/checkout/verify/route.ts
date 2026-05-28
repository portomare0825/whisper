import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Falta el parámetro session_id' }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia' as any,
    });

    // 1. Obtener la sesión de Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ verified: false, error: 'El pago no ha sido completado' }, { status: 400 });
    }

    const userId = session.metadata?.userId;
    const planName = session.metadata?.planName || '';
    const isCoinPackage = session.metadata?.isCoinPackage === 'true';

    if (!userId) {
      return NextResponse.json({ verified: false, error: 'ID de usuario no encontrado en los metadatos de la sesión' }, { status: 400 });
    }

    // Inicializar cliente admin de supabase para saltar RLS y poder añadir monedas de forma segura
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let coinsAwarded = 0;
    let type = '';

    if (isCoinPackage) {
      // Normalizar el planName para evitar errores por tildes o mayúsculas en el pack
      const planNameNormalized = planName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      let coinsToAward = 10;
      if (planNameNormalized.includes('basico')) coinsToAward = 10;
      else if (planNameNormalized.includes('popular')) coinsToAward = 50;
      else if (planNameNormalized.includes('premium')) coinsToAward = 200;

      const transactionReason = `purchase_${sessionId}`;
      
      // Evitar doble acreditación si el webhook ya lo hizo
      const { data: existingTx } = await adminClient
        .from('coin_transactions')
        .select('id')
        .eq('reason', transactionReason)
        .maybeSingle();

      if (existingTx) {
        return NextResponse.json({ verified: true, alreadyProcessed: true, coins: coinsToAward, type: 'coins' });
      }

      // Acreditar monedas llamando a la función RPC
      const { error: rpcError } = await adminClient.rpc('add_coins', {
        user_id_param: userId,
        amount: coinsToAward,
        reason_param: transactionReason
      });

      if (rpcError) {
        throw rpcError;
      }
      
      coinsAwarded = coinsToAward;
      type = 'coins';
    } else {
      // Flujo de Suscripción (Diario, Semanal, Mensual)
      const transactionReason = `subscription_${sessionId}`;

      const { data: existingTx } = await adminClient
        .from('coin_transactions')
        .select('id')
        .eq('reason', transactionReason)
        .maybeSingle();

      if (existingTx) {
        return NextResponse.json({ verified: true, alreadyProcessed: true, type: 'subscription' });
      }

      // Eliminar suscripciones anteriores activas
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

      // Otorgar monedas iniciales de suscripción
      let coinsToAward = 10;
      if (planNameLower.includes('semanal')) coinsToAward = 40;
      else if (planNameLower.includes('mensual') || planNameLower.includes('pro')) coinsToAward = 150;

      await adminClient.rpc('add_coins', {
        user_id_param: userId,
        amount: coinsToAward,
        reason_param: transactionReason
      });

      coinsAwarded = coinsToAward;
      type = 'subscription';
    }

    return NextResponse.json({ verified: true, type, coins: coinsAwarded });
  } catch (error: any) {
    console.error('Error al verificar sesión de Stripe:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
