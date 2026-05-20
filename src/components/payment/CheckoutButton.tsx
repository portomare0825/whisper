'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Inicializa Stripe en el cliente
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface CheckoutButtonProps {
  priceId: string;
  planName: string;
}

export function CheckoutButton({ priceId, planName }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, planName }),
      });

      const { url, error, isSimulated } = await response.json();

      if (error) {
        console.error('Error in checkout:', error);
        alert('Ocurrió un error al procesar el pago.');
        setIsLoading(false);
        return;
      }

      // Si estamos en modo simulador, el backend nos devuelve una URL local
      // de éxito a la cual debemos redirigir directamente.
      if (isSimulated && url) {
        router.push(url);
        return;
      }

      // Flujo Real de Stripe
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Network error:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading}
      className="w-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <CreditCard className="w-5 h-5 mr-2" />
      )}
      {isLoading ? 'Procesando...' : `Obtener ${planName}`}
    </button>
  );
}
