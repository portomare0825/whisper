'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Loader2, AlertCircle, Coins, Sparkles } from 'lucide-react';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [coinsAwarded, setCoinsAwarded] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      // Si no hay id de sesión en la URL (por ejemplo, recarga directa), mostramos éxito estándar
      setStatus('success');
      return;
    }

    async function verifyPayment() {
      try {
        const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`);
        const data = await res.json();
        
        if (res.ok && data.verified) {
          setStatus('success');
          if (data.coins) {
            setCoinsAwarded(data.coins);
          }
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'No se pudo verificar el estado del pago.');
        }
      } catch (err: any) {
        console.error('Error verificando pago:', err);
        setStatus('error');
        setErrorMessage('Error de red al intentar verificar tu pago.');
      }
    }

    verifyPayment();
  }, [sessionId]);

  return (
    <div className="max-w-md w-full bg-[#0f172a]/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 text-center space-y-6 relative overflow-hidden group">
      {/* Luces y gradientes decorativos de fondo */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500" />

      {status === 'verifying' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-[0_0_20px_rgba(212,175,55,0.1)] relative">
            <Loader2 className="w-10 h-10 animate-spin" />
          </div>
          
          <h1 className="text-2xl font-black text-white tracking-tight">Verificando tu Pago...</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Estamos contactando de forma segura con Stripe para registrar tu transacción e inyectar tus monedas en tu cuenta de Supabase. Esto tomará solo unos segundos.
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative">
            <CheckCircle className="w-10 h-10 animate-in zoom-in-50 duration-500" />
          </div>
          
          <h1 className="text-3xl font-extrabold text-white tracking-tight">¡Pago Exitoso!</h1>
          
          {coinsAwarded ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl shadow-[0_0_15px_rgba(16,185,129,0.1)] animate-bounce mt-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-extrabold text-emerald-300">
                +{coinsAwarded} Monedas Acreditadas
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl shadow-[0_0_15px_rgba(99,102,241,0.1)] mt-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-extrabold text-indigo-300">
                Acceso Premium Activado
              </span>
            </div>
          )}

          <p className="text-slate-300 text-sm leading-relaxed">
            Tu pago ha sido procesado e inyectado correctamente en tu balance. Ya puedes volver a conversar y vestir a tus avatares favoritos.
          </p>
          
          <div className="pt-4">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center justify-center w-full premium-button text-white font-bold py-3.5 px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
            >
              Ir a mi Dashboard
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <AlertCircle className="w-10 h-10" />
          </div>
          
          <h1 className="text-2xl font-bold text-white tracking-tight">Verificación Pendiente</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            {errorMessage || 'No pudimos verificar de inmediato tu pago, pero no te preocupes.'} Nuestro sistema de Webhooks está re-intentando procesar e inyectar tus monedas en background de forma automática.
          </p>

          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-left text-slate-400 leading-relaxed">
            <strong className="text-white block mb-1">¿Qué hacer ahora?</strong>
            Puedes regresar a tu Dashboard. Si ves que el saldo no se actualiza en unos minutos, ponte en contacto con soporte técnico adjuntando tu comprobante de pago.
          </div>
          
          <div className="pt-4">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center justify-center w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 px-6 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200"
            >
              Regresar al Dashboard
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 selection:bg-primary/30">
      <Suspense fallback={
        <div className="max-w-md w-full bg-[#0f172a]/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Preparando verificación...</h2>
        </div>
      }>
        <SuccessPageContent />
      </Suspense>
    </div>
  );
}
