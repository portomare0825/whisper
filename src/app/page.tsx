import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Sparkles, MessageCircle, Shield, Zap } from 'lucide-react';

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }> | { code?: string };
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const code = resolvedParams?.code;

  if (code) {
    const cookieStore = await cookies();
    const isResetting = cookieStore.get('is_resetting_password')?.value === 'true';
    const next = isResetting ? '/auth/reset-password' : '/dashboard';
    
    redirect(`/auth/callback?code=${code}&next=${next}`);
  }
  return (
    <div className="min-h-screen bg-transparent text-foreground selection:bg-primary/30">
      {/* Hero Section */}
      <header className="relative h-screen flex flex-col items-center justify-center overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1),transparent_50%)]" />
        
        <div className="z-10 text-center px-4 space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex justify-center mb-6">
            <img src="/icon-192.png" alt="Whisper Logo" className="w-24 h-24 md:w-32 md:h-32 rounded-3xl shadow-[0_0_40px_rgba(212,175,55,0.4)]" />
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter gold-gradient">
            Whisper
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
            Conversaciones sin censura con tu confidente digital. Habla sin miedo, responde sin filtros. Donde cada palabra encuentra un refugio y todo está permitido. Tu compañero, tu regla, tu libertad.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link 
              href="/auth/signup" 
              className="premium-button px-8 py-4 rounded-full text-lg font-semibold flex items-center gap-2 group"
            >
              Comenzar ahora
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </Link>
            <Link 
              href="/login" 
              className="glass-morphism px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/5 transition-colors border-white/20"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 px-4 bg-black/20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4 p-8 rounded-2xl glass-morphism hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Personalidad Única</h3>
            <p className="text-muted-foreground leading-relaxed">
              Define cada rasgo de tu avatar. Desde filósofos estoicos hasta compañeros sarcásticos, el límite es tu imaginación.
            </p>
          </div>

          <div className="space-y-4 p-8 rounded-2xl glass-morphism hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Estilo Dinámico</h3>
            <p className="text-muted-foreground leading-relaxed">
              Tu avatar cambia su vestimenta y pose en tiempo real basándose en el contexto de vuestra conversación.
            </p>
          </div>

          <div className="space-y-4 p-8 rounded-2xl glass-morphism hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Sin Restricciones</h3>
            <p className="text-muted-foreground leading-relaxed">
              Libertad total de conversación impulsada por modelos de lenguaje de vanguardia sin censura creativa.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center text-muted-foreground">
        <p>© 2026 Whisper. Diseñado para la excelencia.</p>
      </footer>
    </div>
  );
}
