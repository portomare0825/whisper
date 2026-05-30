'use client';

import { useState, useEffect } from 'react';
import { Check, Zap, Sparkles, Star, Loader2, Ticket, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';

const plans = [
  {
    name: 'Gratuito',
    price: '0',
    priceId: '',
    period: 'siempre',
    description: 'Para probar la experiencia básica.',
    features: [
      '1 Ranura de avatar activo',
      '20 mensajes cada 3 horas',
      'Espera de 3h tras límite',
      'Voz estándar',
      'Cambios de look manuales',
    ],
    buttonText: 'Plan Actual',
    premium: false,
  },
  {
    name: 'Pase Diario',
    price: '3',
    priceId: 'price_1TZYTdPsyuC6LQ5c8N6CEEUa',
    period: 'día',
    description: 'Acceso total de prueba intensiva.',
    features: [
      '15 Monedas de regalo',
      '3 Ranuras de avatar',
      'Mensajes ilimitados',
      'Roleplay explícito sin censura',
      'Ver pensamientos del avatar',
      'Voces premium ultra-realistas',
      'Cambios de look con IA',
    ],
    buttonText: 'Adquirir Pase',
    premium: true,
  },
  {
    name: 'Pase Semanal',
    price: '8',
    priceId: 'price_1TZYYBPsyuC6LQ5ceuvzhvCp',
    period: 'semana',
    description: 'La opción flexible favorita.',
    features: [
      '45 Monedas de regalo',
      '8 Ranuras de avatar',
      'Mensajes ilimitados',
      'Roleplay explícito sin censura',
      'Ver pensamientos del avatar',
      'Voces premium ultra-realistas',
      'Cambios de look con IA',
      'Ahorras más del 60%',
    ],
    buttonText: 'Adquirir Pase',
    premium: true,
    badge: 'Popular',
  },
  {
    name: 'Mensual Pro',
    price: '25',
    priceId: 'price_1TZYanPsyuC6LQ5cLuX82gqT',
    period: 'mes',
    description: 'El compañero perfecto a largo plazo.',
    features: [
      '90 Monedas de regalo',
      '15 Ranuras de avatar',
      'Mensajes ilimitados',
      'Roleplay explícito sin censura',
      'Ver pensamientos del avatar',
      'Voces premium ultra-realistas',
      'Cambios de look con IA',
      'Soporte VIP prioritario',
    ],
    buttonText: 'Suscribirse Ahora',
    premium: true,
    badge: 'Mejor Valor',
  },
];

export default function BillingPage() {
  const [activePlan, setActivePlan] = useState<string>('Gratuito');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  // Estados para el canje de tickets
  const [ticketCode, setTicketCode] = useState<string>('');
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string>('');
  const [redeemError, setRedeemError] = useState<string>('');

  // Estado para la solicitud de tickets
  const [requesting, setRequesting] = useState<boolean>(false);

  const checkSubscription = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setActivePlan('Gratuito');
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email || '');

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subscription && (!subscription.expires_at || new Date(subscription.expires_at) > new Date())) {
        if (subscription.plan_type === 'pro') {
          setActivePlan('Mensual Pro');
        } else if (subscription.plan_type === 'pay_per_use') {
          if (!subscription.expires_at || !subscription.created_at) {
            setActivePlan('Pase Diario'); // fallback seguro
          } else {
            const diffMs = new Date(subscription.expires_at).getTime() - new Date(subscription.created_at).getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > 2) {
              setActivePlan('Pase Semanal');
            } else {
              setActivePlan('Pase Diario');
            }
          }
        } else {
          setActivePlan('Gratuito');
        }
      } else {
        setActivePlan('Gratuito');
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setActivePlan('Gratuito');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, []);

  // Buscar parámetro de URL 'redeem' para canje de QR automático
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('redeem');
      if (code && userId) {
        handleRedeemTicket(code);
      }
    }
  }, [userId]);

  const handleRedeemTicket = async (codeToUse?: string) => {
    const targetCode = codeToUse || ticketCode;
    if (!targetCode.trim() || redeeming) return;

    setRedeeming(true);
    setRedeemError('');
    setRedeemSuccess('');

    try {
      const response = await fetch('/api/tickets/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error inesperado al validar el ticket.');
      }

      setRedeemSuccess(data.message);
      setTicketCode('');

      // Limpiar query params de la URL para que no re-intente al recargar
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('redeem');
        window.history.replaceState({}, '', url.toString());
      }

      // Recargar suscripción
      await checkSubscription();
    } catch (err: any) {
      setRedeemError(err.message);
    } finally {
      setRedeeming(false);
    }
  };

  const handleRequestViaWhatsApp = (planName: string, price: string) => {
    const adminPhone = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '584120000000'; // Número del admin
    const emailInfo = userEmail ? ` (Registrado con: ${userEmail})` : '';
    const text = `¡Hola! Me gustaría solicitar un ticket para el "${planName}" ($${price} USD)${emailInfo}. Por favor, indícame los datos de Pago Móvil o Zelle para procesar el pago.`;
    const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCheckout = async (planName: string, priceId: string) => {
    if (!priceId) return; // Plan gratuito

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planName, userId }),
      });

      const { url, error, isSimulated } = await response.json();

      if (error) {
        console.error('Error in checkout:', error);
        alert('Ocurrió un error al procesar el pago.');
        return;
      }

      if (isSimulated && url) {
        window.location.href = url;
        return;
      }

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">Planes y <span className="gold-gradient">Suscripciones</span></h1>
        <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
          Desbloquea el máximo potencial de tus avatares con nuestras opciones premium adaptadas a Latinoamérica.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = activePlan === plan.name;
          const buttonText = isCurrentPlan ? 'Plan Actual' : plan.buttonText;
          return (
            <div 
              key={plan.name}
              className={cn(
                "relative glass-morphism rounded-3xl p-6 flex flex-col h-full transition-all duration-300 hover:scale-[1.02]",
                plan.premium ? "border-amber-400/30 shadow-[0_0_30px_rgba(251,191,36,0.08)] bg-gradient-to-b from-amber-400/5 via-transparent to-transparent" : "border-white/10",
                isCurrentPlan && "border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.15)] bg-gradient-to-b from-amber-400/10 via-transparent to-transparent"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black px-4 py-1 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-lg shadow-amber-400/20 shrink-0 whitespace-nowrap">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {plan.badge}
                </div>
              )}

              <div className="mb-6 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  {isCurrentPlan && (
                    <span className="text-[10px] font-bold bg-amber-400 text-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_10px_rgba(251,191,36,0.4)]">
                      Activo
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-muted-foreground text-xs font-semibold">/{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-3 min-h-[32px]">{plan.description}</p>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm text-white/80">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  disabled={isCurrentPlan || loading}
                  onClick={() => handleCheckout(plan.name, plan.priceId)}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm",
                    isCurrentPlan
                      ? "bg-amber-400 text-black cursor-default shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                      : plan.premium 
                        ? "premium-button cursor-pointer" 
                        : "bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    buttonText
                  )}
                </button>

                {plan.premium && !isCurrentPlan && (
                  <button
                    onClick={() => handleRequestViaWhatsApp(plan.name, plan.price)}
                    className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Pago Local (WhatsApp)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SECCIÓN VIP: Canje de Tickets con diseño adaptado al color de fondo #0f172a */}
      <div className="glass-morphism rounded-3xl p-6 md:p-8 border border-amber-400/20 bg-gradient-to-r from-amber-400/5 via-transparent to-transparent space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 mt-1">
              <Ticket className="w-6 h-6 text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                ¿Tienes un <span className="gold-gradient">Ticket VIP</span> o Código?
              </h3>
              <p className="text-white/60 text-xs md:text-sm max-w-xl leading-relaxed">
                Si compraste un boleto promocional o recibiste un código QR de canje por WhatsApp, ingrésalo al lado para activar tu Pase VIP o recargar tus monedas al instante.
              </p>
            </div>
          </div>

          <div className="w-full lg:max-w-md">
            <div className="flex gap-2 w-full">
              <input
                type="text"
                value={ticketCode}
                onChange={(e) => {
                  setTicketCode(e.target.value);
                  setRedeemError('');
                  setRedeemSuccess('');
                }}
                placeholder="EJ: VIP-GOLD-PASS-XXXX"
                disabled={redeeming}
                className="min-w-0 flex-1 bg-background/40 border border-white/10 rounded-xl px-3 py-2.5 md:px-4 md:py-3 outline-none focus:border-amber-400/50 text-white placeholder:text-white/20 font-mono tracking-wider text-xs md:text-sm uppercase"
              />
              <button
                onClick={() => handleRedeemTicket()}
                disabled={!ticketCode.trim() || redeeming}
                className="px-4 py-2.5 md:px-6 md:py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-black font-black rounded-xl text-xs md:text-sm transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {redeeming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Canjear'}
              </button>
            </div>
            
            {/* Mensajes de Estado */}
            {redeemError && (
              <p className="text-red-400 text-xs font-semibold mt-2.5 animate-in fade-in slide-in-from-top-1">
                ⚠️ {redeemError}
              </p>
            )}
            
            {redeemSuccess && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium space-y-1 animate-in fade-in slide-in-from-top-1">
                <p className="font-bold">✨ ¡Ticket Procesado con Éxito!</p>
                <p className="opacity-90">{redeemSuccess}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-morphism rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 justify-between border-primary/20">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h4 className="text-xl font-bold">¿Necesitas algo a medida?</h4>
            <p className="text-muted-foreground">Ofrecemos planes corporativos y para creadores de contenido con grandes audiencias.</p>
          </div>
        </div>
        <button className="px-8 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition-colors font-bold shrink-0 cursor-pointer">
          Contactar Ventas
        </button>
      </div>

      <div className="flex justify-center gap-8 grayscale opacity-50">
        <span className="text-xs font-bold tracking-widest uppercase">Pagos seguros con Mercado Pago</span>
      </div>
    </div>
  );
}
