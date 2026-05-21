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

    // Si no tienes configurada la llave real (o si usa la falsa del simulador), activamos el modo simulador
    if (!process.env.STRIPE_SECRET_KEY || stripeSecretKey.includes('FakeKey') || stripeSecretKey.includes('simulador')) {
      console.log(`[SIMULADOR] Petición de pago interceptada para: ${planName}`);
      
      // Obtenemos al usuario para actualizar su suscripción
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
      
      if (user) {
        // Usamos el rol de servicio para saltar las reglas de seguridad
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!, 
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        if (isCoinPackage) {
          // Lógica exclusiva para paquetes de monedas (sin tocar suscripción)
          let coinsToAward = 10;
          if (planName.includes('Básico')) coinsToAward = 10;
          else if (planName.includes('Popular')) coinsToAward = 50;
          else if (planName.includes('Premium')) coinsToAward = 200;

          const { data: newCoins, error: rpcError } = await adminClient.rpc('add_coins', {
            user_id_param: user.id,
            amount: coinsToAward
          });

          if (rpcError) {
            console.error(`[SIMULADOR] Error al acreditar ${coinsToAward} monedas al usuario ${user.id}:`, rpcError);
          } else {
            console.log(`[SIMULADOR] Compra de monedas exitosa. Se acreditaron +${coinsToAward} monedas al usuario ${user.email}. Nuevo saldo: ${newCoins}`);
          }
        } else {
          // Lógica para compra/actualización de suscripción de planes
          await adminClient.from('subscriptions').delete().eq('user_id', user.id);
          
          // Asignamos Pro o Pay per use (los pases temporales)
          const planType = planName.toLowerCase().includes('pase') ? 'pay_per_use' : 'pro';
          
          // Expiración: Si es diario, +1 día. Si es semanal, +7 días. Si es Mensual, +30 días
          const expiresAt = new Date();
          if (planName.toLowerCase().includes('diario')) {
            expiresAt.setDate(expiresAt.getDate() + 1);
          } else if (planName.toLowerCase().includes('semanal')) {
            expiresAt.setDate(expiresAt.getDate() + 7);
          } else {
            expiresAt.setDate(expiresAt.getDate() + 30);
          }

          await adminClient.from('subscriptions').insert({
            user_id: user.id,
            status: 'active',
            plan_type: planType,
            expires_at: expiresAt.toISOString()
          });

          // Determinar cantidad de monedas a otorgar por comprar el plan
          const planNameLower = planName.toLowerCase();
          let coinsToAward = 10; // Diario por defecto
          if (planNameLower.includes('semanal')) {
            coinsToAward = 40;
          } else if (planNameLower.includes('mensual') || planNameLower.includes('pro')) {
            coinsToAward = 150;
          }

          // Acreditar las monedas usando la función atómica RPC add_coins
          const { data: newCoins, error: rpcError } = await adminClient.rpc('add_coins', {
            user_id_param: user.id,
            amount: coinsToAward
          });

          if (rpcError) {
            console.error(`[SIMULADOR] Error al acreditar ${coinsToAward} monedas al usuario ${user.id}:`, rpcError);
          } else {
            console.log(`[SIMULADOR] Suscripción actualizada a ${planType} para el usuario ${user.email}. Se acreditaron +${coinsToAward} monedas. Nuevo saldo: ${newCoins}`);
          }
        }
      }

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
