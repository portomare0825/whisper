'use client';

import { Check, Zap, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Gratuito',
    price: '0',
    description: 'Para probar la experiencia básica.',
    features: [
      '1 Avatar activo',
      '50 mensajes diarios',
      'Voz estándar (Gemini)',
      'Cambios de look manuales',
    ],
    buttonText: 'Plan Actual',
    premium: false,
  },
  {
    name: 'Pro',
    price: '9.99',
    description: 'Para entusiastas de la IA y el estilo.',
    features: [
      'Avatares ilimitados',
      'Mensajes ilimitados',
      'Voz premium ultra-realista',
      'Prioridad en generación Leffa',
      'Soporte exclusivo',
    ],
    buttonText: 'Suscribirse Ahora',
    premium: true,
  },
  {
    name: 'Pack Estilo',
    price: '5.00',
    description: 'Créditos para cambios de look.',
    features: [
      '100 cambios de vestuario',
      'Sin vencimiento',
      'Uso en cualquier avatar',
      'Sin suscripción mensual',
    ],
    buttonText: 'Comprar Pack',
    premium: false,
  },
];

export default function BillingPage() {
  const handleCheckout = (planName: string) => {
    // Aquí se integraría la llamada al backend para crear la preferencia de Mercado Pago
    alert(`Redirigiendo a Mercado Pago para el plan: ${planName}`);
  };

  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">Planes y <span className="gold-gradient">Suscripciones</span></h1>
        <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
          Desbloquea el máximo potencial de tus avatares con nuestras opciones premium adaptadas a Latinoamérica.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={cn(
              "relative glass-morphism rounded-3xl p-8 flex flex-col h-full transition-all duration-300 hover:scale-[1.02]",
              plan.premium ? "border-primary/50 shadow-[0_0_40px_rgba(212,175,55,0.15)]" : "border-white/10"
            )}
          >
            {plan.premium && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                RECOMENDADO
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground text-sm">/mes</span>
              </div>
              <p className="text-muted-foreground text-sm mt-4">{plan.description}</p>
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
              onClick={() => handleCheckout(plan.name)}
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
