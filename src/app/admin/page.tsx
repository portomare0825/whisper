'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, UserPlus, Activity, Database, 
  MessageSquare, UserCircle, RefreshCw, BarChart, ChevronLeft 
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

interface Metrics {
  users: { total: number; today: number; week: number; month: number; activeNow: number; };
  avatars: { total: number; };
  chat: { conversations: number; messages: number; };
  db?: {
    bytes: number;
    pretty: string;
    limitBytes: number;
    percentUsed: number;
  };
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Verificar auth primero
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/admin/metrics');
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          router.push('/dashboard');
          return;
        }
        throw new Error('Error al cargar métricas');
      }
      
      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Auto refresh every minute
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, [router]);

  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <RefreshCw className="w-10 h-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold tracking-wide">Cargando Panel Premium...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-2xl max-w-md backdrop-blur-md">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h2 className="text-xl font-bold mb-2">Acceso Denegado / Error</h2>
          <p className="text-sm opacity-80 mb-6">{error}</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="premium-button text-white px-6 py-2 rounded-full font-medium"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-primary/30 pb-20 md:pb-10">
      
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-full hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <BarChart className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Admin Panel
              </h1>
            </div>
          </div>
          <button 
            onClick={fetchMetrics}
            className="flex items-center gap-2 text-xs md:text-sm bg-white/5 hover:bg-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/10 transition-all text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* SECCIÓN 1: USUARIOS */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold tracking-wide">Comunidad</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            
            <MetricCard 
              title="Usuarios Activos (30m)" 
              value={metrics?.users.activeNow} 
              icon={<Activity className="w-5 h-5 text-emerald-400" />} 
              gradient="from-emerald-500/20 to-teal-500/5"
              border="border-emerald-500/20"
              valueColor="text-emerald-400"
            />
            <MetricCard 
              title="Registros Hoy" 
              value={metrics?.users.today} 
              icon={<UserPlus className="w-5 h-5 text-sky-400" />} 
              gradient="from-sky-500/20 to-blue-500/5"
              border="border-sky-500/20"
            />
            <MetricCard 
              title="Esta Semana" 
              value={metrics?.users.week} 
              icon={<Users className="w-5 h-5 text-indigo-400" />} 
              gradient="from-indigo-500/20 to-violet-500/5"
              border="border-indigo-500/20"
            />
            <MetricCard 
              title="Total Histórico" 
              value={metrics?.users.total} 
              icon={<Database className="w-5 h-5 text-slate-400" />} 
              gradient="from-slate-500/20 to-slate-400/5"
              border="border-slate-500/20"
            />
            
          </div>
        </section>

        {/* SECCIÓN 2: CONTENIDO */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1 mt-6">
            <MessageSquare className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold tracking-wide">Interacciones & Avatares</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            
            <MetricCard 
              title="Avatares Públicos" 
              value={metrics?.avatars.total} 
              icon={<UserCircle className="w-6 h-6 text-pink-400" />} 
              gradient="from-pink-500/20 to-rose-500/5"
              border="border-pink-500/20"
              large
            />
            <MetricCard 
              title="Conversaciones Activas" 
              value={metrics?.chat.conversations} 
              icon={<MessageSquare className="w-6 h-6 text-amber-400" />} 
              gradient="from-amber-500/20 to-orange-500/5"
              border="border-amber-500/20"
              large
            />
            <MetricCard 
              title="Mensajes Totales" 
              value={metrics?.chat.messages} 
              icon={<Database className="w-6 h-6 text-violet-400" />} 
              gradient="from-violet-500/20 to-purple-500/5"
              border="border-violet-500/20"
              large
            />
            
          </div>
        </section>

        {/* SECCIÓN 3: ALMACENAMIENTO DE DATOS */}
        {metrics?.db && (
          <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-6">
              <Database className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold tracking-wide">Infraestructura & Almacenamiento</h2>
            </div>
            <div className="bg-[#0f172a]/50 backdrop-blur-sm border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-20 transition-opacity duration-300 group-hover:opacity-40" />
              
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Tamaño de Base de Datos</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                      {metrics.db.pretty}
                    </span>
                    <span className="text-sm text-slate-400">/ 500 MB</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Espacio ocupado en tu clúster de Supabase PostgreSQL.
                  </p>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-medium">Uso del plan gratuito (Límite: 500MB)</span>
                    <span className="font-bold text-indigo-400">{metrics.db.percentUsed}%</span>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="w-full h-3 bg-slate-950 rounded-full border border-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-indigo-400 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-500"
                      style={{ width: `${metrics.db.percentUsed}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0 MB</span>
                    <span>250 MB</span>
                    <span>500 MB</span>
                  </div>
                </div>

              </div>
            </div>
          </section>
        )}

        {/* NOTA SOBRE VERCEL */}
        <div className="mt-12 bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
              <span>🚀</span> Vercel Web Analytics
            </h3>
            <p className="text-sm text-slate-400 max-w-xl">
              Este panel muestra métricas puras de tu base de datos Supabase. Para visualizar gráficas detalladas de tráfico web, países de origen y dispositivos de tus visitantes, hemos integrado Vercel Analytics.
            </p>
          </div>
          <a 
            href="https://vercel.com/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="premium-button text-white px-6 py-3 rounded-xl font-medium text-sm whitespace-nowrap"
          >
            Abrir Vercel Dashboard
          </a>
        </div>

      </main>
    </div>
  );
}

// ── COMPONENTE CARD DE MÉTRICA ──
function MetricCard({ 
  title, 
  value, 
  icon, 
  gradient, 
  border, 
  valueColor = "text-white",
  large = false 
}: { 
  title: string; 
  value?: number; 
  icon: React.ReactNode; 
  gradient: string; 
  border: string; 
  valueColor?: string;
  large?: boolean;
}) {
  return (
    <div className={`relative group overflow-hidden rounded-2xl md:rounded-3xl border bg-[#0f172a]/50 backdrop-blur-sm p-4 md:p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${border}`}>
      <div className={`absolute inset-0 bg-gradient-to-br opacity-20 transition-opacity duration-300 group-hover:opacity-40 ${gradient}`} />
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-2 md:mb-4">
          <h3 className={`font-medium text-slate-300 tracking-wide ${large ? 'text-sm md:text-base' : 'text-xs md:text-sm'}`}>
            {title}
          </h3>
          <div className="p-2 bg-white/5 rounded-xl border border-white/5 shadow-inner">
            {icon}
          </div>
        </div>
        
        <div className="mt-auto">
          <p className={`font-bold tracking-tight ${valueColor} ${large ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`}>
            {value !== undefined ? new Intl.NumberFormat('es-US').format(value) : '0'}
          </p>
        </div>
      </div>
    </div>
  );
}
