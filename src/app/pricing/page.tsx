import { CheckoutButton } from '@/components/payment/CheckoutButton';
import { Check } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background py-20 px-4">
      <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
        <h1 className="text-4xl font-extrabold text-foreground">Planes y Precios</h1>
        <p className="text-xl text-muted-foreground">
          Elige el plan perfecto para ti y comienza a disfrutar de todas las ventajas.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Plan Básico */}
        <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Básico</h2>
            <div className="mt-4 flex items-baseline text-5xl font-extrabold text-foreground">
              Gratis
            </div>
            <p className="mt-4 text-muted-foreground">Perfecto para probar la plataforma.</p>
          </div>
          <ul className="flex-1 space-y-4 mb-8">
            {['10 mensajes por día', 'Respuestas estándar', 'Soporte de la comunidad'].map((feature) => (
              <li key={feature} className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3 shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          <button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold py-3 px-6 rounded-lg transition-colors">
            Plan Actual
          </button>
        </div>

        {/* Plan Premium */}
        <div className="bg-primary/5 rounded-3xl p-8 border-2 border-primary shadow-xl flex flex-col relative transform md:-translate-y-4">
          <div className="absolute top-0 right-8 transform -translate-y-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Más Popular
            </span>
          </div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Premium</h2>
            <div className="mt-4 flex items-baseline text-5xl font-extrabold text-foreground">
              $15
              <span className="text-xl font-medium text-muted-foreground ml-1">/mes</span>
            </div>
            <p className="mt-4 text-muted-foreground">Para usuarios que quieren el máximo poder.</p>
          </div>
          <ul className="flex-1 space-y-4 mb-8">
            {[
              'Mensajes ilimitados',
              'Modelos premium sin censura',
              'Soporte prioritario 24/7',
              'Generación de imágenes',
            ].map((feature) => (
              <li key={feature} className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3 shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          {/* Aquí usamos nuestro componente de Checkout de Stripe */}
          <CheckoutButton priceId="price_fake_premium_id" planName="Premium" />
        </div>
      </div>
    </div>
  );
}
