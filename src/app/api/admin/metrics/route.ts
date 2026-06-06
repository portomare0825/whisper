import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Cliente admin para saltarse RLS si es necesario y contar métricas completas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch (error) {}
          },
        },
      }
    );

    // 1. Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Verificar rol admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de administrador.' }, { status: 403 });
    }

    // --- CÁLCULO DE MÉTRICAS ---
    const now = new Date();
    
    // Fechas de referencia
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // "Conectados recientemente" (actualizados en los últimos 30 minutos)
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000).toISOString();

    // Fal.ai API call helper with graceful fallback
    const fetchFalBalance = async () => {
      const falKey = process.env.FAL_KEY;
      if (!falKey) return null;
      try {
        const res = await fetch('https://api.fal.ai/v1/account/billing?expand=credits', {
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.credits) {
            return {
              currentBalance: data.credits.current_balance,
              currency: data.credits.currency || 'USD'
            };
          }
        } else {
          console.warn(`fal.ai billing API returned status ${res.status}`);
        }
      } catch (err) {
        console.error("Error al obtener balance de fal.ai:", err);
      }
      return null;
    };

    // Replicate API call helper with graceful fallback
    const fetchReplicateMetrics = async () => {
      const replicateToken = process.env.REPLICATE_API_TOKEN;
      if (!replicateToken) return null;
      try {
        const res = await fetch('https://api.replicate.com/v1/predictions', {
          headers: {
            'Authorization': `Token ${replicateToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.results)) {
            const results = data.results;
            const total = results.length;
            let succeeded = 0;
            let failed = 0;
            let processing = 0;
            let totalPredictTime = 0;

            results.forEach((pred: any) => {
              if (pred.status === 'succeeded') {
                succeeded++;
                if (pred.metrics && typeof pred.metrics.predict_time === 'number') {
                  totalPredictTime += pred.metrics.predict_time;
                }
              } else if (pred.status === 'failed' || pred.status === 'canceled') {
                failed++;
              } else {
                processing++;
              }
            });

            // Gasto estimado: supongamos $0.00115 por segundo de H100 (promedio general)
            const estimatedCost = totalPredictTime * 0.00115;

            return {
              total,
              succeeded,
              failed,
              processing,
              totalPredictTime: Math.round(totalPredictTime),
              estimatedCost: Number(estimatedCost.toFixed(4))
            };
          }
        }
      } catch (err) {
        console.error("Error al obtener predicciones de Replicate:", err);
      }
      return null;
    };

    // OpenRouter API call helper with graceful fallback
    const fetchOpenRouterBalance = async () => {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) return null;
      
      const logData: Record<string, any> = {};

      // 1. Intentar con /api/v1/auth/key
      try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        logData.authKeyStatus = res.status;
        if (res.ok) {
          const data = await res.json();
          logData.authKeyData = data;
        } else {
          logData.authKeyError = await res.text();
        }
      } catch (err: any) {
        logData.authKeyException = err.message;
      }

      // 2. Intentar con /api/v1/credits
      try {
        const res = await fetch('https://openrouter.ai/api/v1/credits', {
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        logData.creditsStatus = res.status;
        if (res.ok) {
          const data = await res.json();
          logData.creditsData = data;
        } else {
          logData.creditsError = await res.text();
        }
      } catch (err: any) {
        logData.creditsException = err.message;
      }

      // Escribir a scratch/openrouter_debug.log
      try {
        const fs = require('fs');
        const path = require('path');
        const logDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(logDir, 'openrouter_debug.log'),
          JSON.stringify(logData, null, 2)
        );
      } catch (e) {}

      // Combinar los datos para retornar el saldo disponible
      let label = 'Whisper Key';
      let usage = 0;
      let limit = null;
      let isFreeTier = false;
      let remainingLimit = null;
      let totalCredits = undefined;
      let totalUsage = undefined;
      let remainingBalance = undefined;

      if (logData.authKeyData && logData.authKeyData.data) {
        const kd = logData.authKeyData.data;
        label = kd.label || label;
        usage = kd.usage || 0;
        limit = kd.limit;
        isFreeTier = kd.is_free_tier || false;
        remainingLimit = kd.limit !== null ? Math.max(0, kd.limit - (kd.usage || 0)) : null;
      }

      if (logData.creditsData && logData.creditsData.data) {
        const cd = logData.creditsData.data;
        totalCredits = cd.total_credits;
        totalUsage = cd.total_usage;
        remainingBalance = Math.max(0, cd.total_credits - cd.total_usage);
      }

      // Si no tenemos créditos globales pero tenemos un límite y uso de clave, podemos estructurar
      return {
        label,
        usage,
        limit,
        isFreeTier,
        remainingLimit,
        totalCredits,
        totalUsage,
        remainingBalance
      };
    };

    // Promesas concurrentes para máxima velocidad
    const [
      { count: totalUsers },
      { count: usersToday },
      { count: usersThisWeek },
      { count: usersThisMonth },
      { count: activeUsers },
      { count: totalAvatars },
      { count: activeConversations },
      { count: totalMessages },
      { data: dbSizeResult },
      { data: financialResult },
      falBalanceData,
      openRouterBalanceData,
      replicateMetricsData,
      { count: totalTickets },
      { count: usedTickets }
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfWeek),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', thirtyMinutesAgo),
      supabaseAdmin.from('avatars').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabaseAdmin.from('conversations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }),
      supabaseAdmin.rpc('get_database_size'),
      supabaseAdmin.rpc('get_admin_financials'),
      fetchFalBalance(),
      fetchOpenRouterBalance(),
      fetchReplicateMetrics(),
      supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('is_used', true)
    ]);

    const dbBytes = dbSizeResult && dbSizeResult[0] ? dbSizeResult[0].total_bytes : 0;
    const dbPretty = dbSizeResult && dbSizeResult[0] ? dbSizeResult[0].total_pretty : '0 B';
    // Límite gratuito de Supabase: 500 MB (524,288,000 bytes)
    const limitBytes = 524288000;
    const percentUsed = Number(((dbBytes / limitBytes) * 100).toFixed(2));

    const finData = financialResult && financialResult[0] ? financialResult[0] : {
      total_coins_remaining: 0,
      total_coins_sold: 0,
      total_coins_used: 0,
      active_subscribers: 0
    };

    // Resguardo inteligente para el histórico si la tabla de transacciones es nueva
    const coinsSold = finData.total_coins_sold > 0 
      ? finData.total_coins_sold 
      : finData.total_coins_remaining;

    return NextResponse.json({
      metrics: {
        users: {
          total: totalUsers || 0,
          today: usersToday || 0,
          week: usersThisWeek || 0,
          month: usersThisMonth || 0,
          activeNow: activeUsers || 0,
        },
        avatars: {
          total: totalAvatars || 0,
        },
        chat: {
          conversations: activeConversations || 0,
          messages: totalMessages || 0,
        },
        db: {
          bytes: dbBytes,
          pretty: dbPretty,
          limitBytes: limitBytes,
          percentUsed: percentUsed > 100 ? 100 : percentUsed
        },
        financials: {
          coinsRemaining: finData.total_coins_remaining,
          coinsSold: coinsSold,
          coinsUsed: finData.total_coins_used,
          activeSubscribers: finData.active_subscribers
        },
        tickets: {
          total: totalTickets || 0,
          used: usedTickets || 0,
          available: (totalTickets || 0) - (usedTickets || 0)
        },
        falBalance: falBalanceData,
        openRouterBalance: openRouterBalanceData,
        replicateStats: replicateMetricsData
      }
    });

  } catch (error: any) {
    console.error("Error en admin metrics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
