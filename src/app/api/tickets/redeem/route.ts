import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Falta el código de ticket' }, { status: 400 });
    }

    // 1. Obtener al usuario autenticado de forma segura
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

    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión para canjear un ticket' }, { status: 401 });
    }

    // 2. Conectar con Supabase como Administrador (Service Role) para evitar RLS
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Buscar el ticket en la base de datos
    const { data: ticket, error: ticketError } = await adminSupabase
      .from('tickets')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle();

    if (ticketError) {
      console.error('Error al consultar ticket:', ticketError);
      return NextResponse.json({ error: 'Error al verificar el ticket en el servidor' }, { status: 500 });
    }

    if (!ticket) {
      return NextResponse.json({ error: 'El código de ticket ingresado no existe o no es válido' }, { status: 404 });
    }

    // 4. Validar el estado del ticket
    if (ticket.is_used) {
      return NextResponse.json({ error: 'Este ticket ya ha sido utilizado por otro usuario' }, { status: 400 });
    }

    if (ticket.expires_at && new Date(ticket.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este ticket ha caducado y ya no es válido' }, { status: 400 });
    }

    // 5. Aplicar los beneficios del ticket de forma segura
    const transactionReason = `ticket_redeem_${ticket.code}`;

    if (ticket.type === 'daily_pass') {
      // Suscripción: Pase Diario (o pase de N días)
      // Primero, limpiar cualquier suscripción previa
      await adminSupabase.from('subscriptions').delete().eq('user_id', user.id);

      const daysToAdd = ticket.value || 1;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysToAdd);

      // Insertar nueva suscripción de pase de uso
      const { error: subError } = await adminSupabase.from('subscriptions').insert({
        user_id: user.id,
        status: 'active',
        plan_type: 'pay_per_use',
        expires_at: expiresAt.toISOString()
      });

      if (subError) {
        console.error('Error al crear suscripción del ticket:', subError);
        return NextResponse.json({ error: 'No se pudo activar el pase del ticket' }, { status: 500 });
      }

      // Otorgar monedas iniciales de regalo según la duración del pase (15 monedas por día)
      const coinsToAward = 15 * daysToAdd;
      const { error: rpcError } = await adminSupabase.rpc('add_coins', {
        user_id_param: user.id,
        amount: coinsToAward,
        reason_param: transactionReason
      });

      if (rpcError) {
        console.error('Error al otorgar monedas de cortesía del pase:', rpcError);
      }

    } else if (ticket.type === 'coins') {
      // Recarga de Monedas pura
      const coinsToAward = ticket.value || 15;
      const { error: rpcError } = await adminSupabase.rpc('add_coins', {
        user_id_param: user.id,
        amount: coinsToAward,
        reason_param: transactionReason
      });

      if (rpcError) {
        console.error('Error al otorgar monedas del ticket:', rpcError);
        return NextResponse.json({ error: 'No se pudo acreditar el saldo del ticket' }, { status: 500 });
      }
    }

    // 6. Marcar el ticket como utilizado de manera atómica
    const { error: updateError } = await adminSupabase
      .from('tickets')
      .update({
        is_used: true,
        used_by: user.id,
        used_at: new Date().toISOString()
      })
      .eq('id', ticket.id);

    if (updateError) {
      console.error('Error al actualizar estado del ticket:', updateError);
      // Nota: Aunque los beneficios ya se entregaron, registramos el error
      return NextResponse.json({ error: 'El ticket se redimió pero ocurrió un problema al registrar su estado.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: ticket.type === 'daily_pass' 
        ? `¡Enhorabuena! Has activado con éxito tu Pase VIP de ${ticket.value} día(s) Pro y recibido ${15 * ticket.value} monedas de cortesía.` 
        : `¡Canje exitoso! Se han acreditado +${ticket.value} monedas a tu cuenta de forma instantánea.`,
      ticket_type: ticket.type,
      ticket_value: ticket.value
    });

  } catch (error: any) {
    console.error('Error en /api/tickets/redeem:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
