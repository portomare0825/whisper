import Link from 'next/link';
import { XCircle, RefreshCcw } from 'lucide-react';

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border border-destructive/20 p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-bold text-foreground">Pago Cancelado</h1>
        <p className="text-muted-foreground text-lg">
          Has cancelado el proceso de pago o ha ocurrido un error. No se ha realizado ningún cargo a tu tarjeta.
        </p>
        
        <div className="pt-6 flex flex-col gap-3">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center w-full bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCcw className="mr-2 w-5 h-5" />
            Volver a intentarlo
          </Link>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center w-full bg-secondary text-secondary-foreground font-semibold py-3 px-6 rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
