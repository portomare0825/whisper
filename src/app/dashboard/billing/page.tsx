'use client';

import { Check, Zap, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Gratuito',
    price: '0',
    priceId: '',
    period: 'siempre',
    description: 'Para probar la experiencia básica.',
    features: [
      '1 Avatar activo',
      '20 mensajes cada 3 horas',
      'Espera de 3h tras límite',
      'Voz estándar (Gemini)',
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
      'Avatares ilimitados',
      'Mensajes ilimitados',
      'Roleplay explícito sin censura',
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
      'Avatares ilimitados',
      'Mensajes ilimitados',
      'Roleplay explícito sin censura',
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
      'Avatares ilimitados',
      'Mensajes ilimitados',
      'Roleplay explícito sin censura',
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
  const handleCheckout = async (planName: string, priceId: string) => {
    if (!priceId) return; // Plan gratuito

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planName }),
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
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={cn(
              "relative glass-morphism rounded-3xl p-6 flex flex-col h-full transition-all duration-300 hover:scale-[1.02]",
              plan.premium ? "border-amber-400/30 shadow-[0_0_30px_rgba(251,191,36,0.08)] bg-gradient-to-b from-amber-400/5 via-transparent to-transparent" : "border-white/10"
            )}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black px-4 py-1 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-lg shadow-amber-400/20 shrink-0 whitespace-nowrap">
                <Star className="w-2.5 h-2.5 fill-current" />
                {plan.badge}
              </div>
            )}

            <div className="mb-6 mt-2">
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
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

            <button
              onClick={() => handleCheckout(plan.name, plan.priceId)}
              className={cn(
                "w-full py-4 rounded-xl font-bold transition-all",
                plan.premium 
                  ? "premium-button text-lg" 
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              )}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
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
        <button className="px-8 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition-colors font-bold shrink-0">
          Contactar Ventas
        </button>
      </div>

      <div className="flex justify-center gap-8 grayscale opacity-50">
        {/* Aquí irían logos de Mercado Pago, Visa, Mastercard, etc */}
        <span className="text-xs font-bold tracking-widest uppercase">Pagos seguros con Mercado Pago</span>
      </div>
    </div>
  );
}
