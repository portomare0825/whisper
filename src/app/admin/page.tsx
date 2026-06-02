'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, UserPlus, Activity, Database, 
  MessageSquare, UserCircle, RefreshCw, BarChart, ChevronLeft,
  Coins, TrendingUp, UserCheck, Cpu, Wallet, AlertTriangle, Ticket
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

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
  financials?: {
    coinsRemaining: number;
    coinsSold: number;
    coinsUsed: number;
    activeSubscribers: number;
  };
  falBalance?: {
    currentBalance: number;
    currency: string;
  } | null;
  openRouterBalance?: {
    label?: string;
    usage?: number;
    limit?: number | null;
    isFreeTier?: boolean;
    remainingLimit?: number | null;
    totalCredits?: number;
    totalUsage?: number;
    remainingBalance?: number;
  } | null;
  tickets?: {
    total: number;
    used: number;
    available: number;
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
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/dashboard');
                }
              }}
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
          <div className="flex items-center gap-2">
            <Link 
              href="/admin/tickets"
              className="flex items-center gap-2 text-xs md:text-sm bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-1.5 md:px-4 md:py-2 rounded-full border border-amber-500/20 hover:border-amber-500/40 transition-all text-amber-400 font-bold shadow-lg shadow-amber-500/5 hover:shadow-amber-500/10"
            >
              <Ticket className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400" />
              <span>Tickets VIP</span>
            </Link>
            <button 
              onClick={fetchMetrics}
              className="flex items-center gap-2 text-xs md:text-sm bg-white/5 hover:bg-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/10 transition-all text-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>
          </div>
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

        {/* SECCIÓN: ECONOMÍA & SUSCRIPCIONES */}
        {metrics?.financials && (
          <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-6">
              <Coins className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold tracking-wide">Economía & Suscripciones</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              
              <MetricCard 
                title="Suscritos Activos" 
                value={metrics.financials.activeSubscribers} 
                icon={<UserCheck className="w-5 h-5 text-indigo-400" />} 
                gradient="from-indigo-500/20 to-blue-500/5"
                border="border-indigo-500/20"
                valueColor="text-indigo-400"
              />
              <MetricCard 
                title="Monedas Vendidas" 
                value={metrics.financials.coinsSold} 
                icon={<Coins className="w-5 h-5 text-amber-400" />} 
                gradient="from-amber-500/20 to-orange-500/5"
                border="border-amber-500/20"
                valueColor="text-amber-400"
              />
              <MetricCard 
                title="Monedas Usadas" 
                value={metrics.financials.coinsUsed} 
                icon={<TrendingUp className="w-5 h-5 text-rose-400" />} 
                gradient="from-rose-500/20 to-pink-500/5"
                border="border-rose-500/20"
                valueColor="text-rose-400"
              />
              <MetricCard 
                title="Monedas de Usuarios" 
                value={metrics.financials.coinsRemaining} 
                icon={<Database className="w-5 h-5 text-teal-400" />} 
                gradient="from-teal-500/20 to-emerald-500/5"
                border="border-teal-500/20"
                valueColor="text-teal-400"
              />
              
            </div>
          </section>
        )}

        {/* SECCIÓN: SISTEMA DE TICKETS VIP */}
        {metrics?.tickets && (
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2 px-1 mt-6">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold tracking-wide">Tickets VIP & Canjes Locales</h2>
              </div>
              <span className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1 font-medium">
                Ideal para Venezuela (Pago Móvil / WhatsApp)
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Contenedor de Métricas del Ticket */}
              <div className="lg:col-span-2 grid grid-cols-3 gap-3 md:gap-6">
                <MetricCard 
                  title="Tickets Generados" 
                  value={metrics.tickets.total} 
                  icon={<Ticket className="w-5 h-5 text-amber-400" />} 
                  gradient="from-amber-500/20 to-yellow-500/5"
                  border="border-amber-500/20"
                  valueColor="text-amber-400"
                />
                <MetricCard 
                  title="Disponibles" 
                  value={metrics.tickets.available} 
                  icon={<UserCheck className="w-5 h-5 text-emerald-400" />} 
                  gradient="from-emerald-500/20 to-teal-500/5"
                  border="border-emerald-500/20"
                  valueColor="text-emerald-400"
                />
                <MetricCard 
                  title="Canjeados" 
                  value={metrics.tickets.used} 
                  icon={<TrendingUp className="w-5 h-5 text-rose-400" />} 
                  gradient="from-rose-500/20 to-pink-500/5"
                  border="border-rose-500/20"
                  valueColor="text-rose-400"
                />
              </div>

              {/* Acceso Directo Premium al Administrador de Tickets */}
              <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-lg shadow-amber-500/5 hover:border-amber-500/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-transparent opacity-30 pointer-events-none" />
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Herramienta Administrativa</span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight leading-tight">
                    Generador de Boletos VIP
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Crea nuevos códigos alfanuméricos con códigos QR e imágenes premium de fondo (#0f172a) listos para enviar por WhatsApp.
                  </p>
                </div>
                <div className="mt-4 pt-2 relative z-10">
                  <Link 
                    href="/admin/tickets"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Ticket className="w-4 h-4 text-black" />
                    <span>Entrar al Generador de Tickets</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

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

        {/* SECCIÓN: SERVICIOS EXTERNOS & IA */}
        <section>
          <div className="flex items-center justify-between mb-6 mt-6 px-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold tracking-wide">Consola de Inteligencia Artificial (OpenRouter & fal.ai)</h2>
            </div>
            <span className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Conexión Activa con LLMs
            </span>
          </div>

          <div className="space-y-6">
            {/* SUB-SECCIÓN: OPENROUTER ACTIVITY CONSOLE (Inspirado en OpenRouter Dashboard) */}
            <div className="bg-[#0b0f19] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight">Activity / Actividad</h3>
                  <p className="text-xs text-slate-400 mt-1">Your usage across models on OpenRouter ( Whispers completions )</p>
                </div>
                <div className="flex gap-2">
                  <a 
                    href="https://openrouter.ai/activity" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#020617] hover:bg-white/5 transition-all border border-white/5 px-4 py-2 rounded-xl text-xs text-slate-200 cursor-pointer font-semibold"
                  >
                    <Activity className="w-4 h-4 text-violet-400" />
                    <span>OpenRouter Activity</span>
                  </a>
                  <a 
                    href="https://openrouter.ai/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="premium-button text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-primary/10"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Recargar Créditos</span>
                  </a>
                </div>
              </div>

              {/* Grid de Actividad (Gasto, Peticiones, Tokens y Créditos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                
                {/* 1. Gasto (Spend) */}
                <div className="bg-[#020617] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-pink-500/20 transition-all duration-300 relative overflow-hidden group shadow-lg">
                  <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Spend / Gasto</span>
                    <Coins className="w-4 h-4 text-pink-500" />
                  </div>
                  <div className="my-5 relative z-10">
                    <h4 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                      {metrics?.openRouterBalance ? (
                        `$${metrics.openRouterBalance.usage?.toFixed(3).replace('.', ',')}`
                      ) : (
                        `$0,000`
                      )}
                    </h4>
                  </div>
                  <div className="text-[9px] text-slate-400 leading-none relative z-10">
                    Consumido por tu clave de completions
                  </div>
                </div>

                {/* 2. Peticiones (Requests) */}
                <div className="bg-[#020617] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300 relative overflow-hidden group shadow-lg">
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Requests / Peticiones</span>
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="my-5 relative z-10">
                    <h4 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                      {metrics?.chat.messages ? new Intl.NumberFormat('es-US').format(metrics.chat.messages) : '0'}
                    </h4>
                  </div>
                  <div className="text-[9px] text-slate-400 leading-none relative z-10">
                    Total mensajes respondidos exitosamente
                  </div>
                </div>

                {/* 3. Tokens */}
                <div className="bg-[#020617] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-violet-500/20 transition-all duration-300 relative overflow-hidden group shadow-lg">
                  <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Tokens Procesados</span>
                    <Activity className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="my-5 relative z-10">
                    <h4 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                      {metrics?.chat.messages ? (
                        metrics.chat.messages * 280 > 1000000 
                          ? `${(metrics.chat.messages * 280 / 1000000).toFixed(2).replace('.', ',')}M`
                          : `${Math.round(metrics.chat.messages * 280 / 1000).toString().replace('.', ',')}K`
                      ) : (
                        `0`
                      )}
                    </h4>
                  </div>
                  <div className="text-[9px] text-slate-400 leading-none relative z-10">
                    Tokens promedio inyectados en completions
                  </div>
                </div>

                {/* 4. Créditos de la Cuenta (Credits Balance) */}
                <div className="bg-gradient-to-br from-indigo-500/10 via-[#020617] to-[#020617] border border-indigo-500/25 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition-all duration-300 relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none animate-pulse" />
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Credits / Créditos</span>
                    <Wallet className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="my-5 relative z-10">
                    <h4 className="text-3xl md:text-4xl font-black text-emerald-400 tracking-tight">
                      {metrics?.openRouterBalance === undefined ? (
                        <span className="text-sm font-normal text-slate-400 animate-pulse">Cargando...</span>
                      ) : metrics.openRouterBalance === null ? (
                        <span className="text-sm font-semibold text-rose-400">Sin clave ADMIN</span>
                      ) : metrics.openRouterBalance.remainingBalance !== undefined ? (
                        `$${metrics.openRouterBalance.remainingBalance.toFixed(2).replace('.', ',')}`
                      ) : metrics.openRouterBalance.remainingLimit !== null && metrics.openRouterBalance.remainingLimit !== undefined ? (
                        `$${metrics.openRouterBalance.remainingLimit.toFixed(2).replace('.', ',')}`
                      ) : (
                        `Ilimitado`
                      )}
                    </h4>
                  </div>
                  <div className="text-[9px] text-slate-400 leading-none relative z-10 font-medium">
                    {metrics?.openRouterBalance?.remainingBalance !== undefined 
                      ? "Personal Account: desolucionesxi@gmail.com"
                      : "Saldo restante asignado a esta clave API"}
                  </div>
                </div>

              </div>

              {/* Leyenda de modelos similar a la de OpenRouter Activity */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 bg-[#020617]/50 border border-white/5 p-4 rounded-2xl">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                    <span className="text-xs text-slate-300 font-medium">Llama 3.3 Euryale 70B</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-300 font-medium">Llama 3 8B Lunaris</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span className="text-xs text-slate-300 font-medium">Gemini 2.5 Flash</span>
                  </div>
                </div>
                <div className="text-left sm:text-right text-[10px] text-slate-500 font-semibold flex items-center sm:justify-end gap-1">
                  <span>Clave Administrada Activa:</span>
                  <span className="text-slate-400 font-bold">
                    {metrics?.openRouterBalance?.label || 'Whisper Principal Key'}
                  </span>
                </div>
              </div>
            </div>

            {/* SECCIÓN FAL.AI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tarjeta de Fal.ai Balance */}
              <div className="md:col-span-2 bg-[#0f172a]/50 backdrop-blur-sm border border-violet-500/20 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-20 transition-opacity duration-300 group-hover:opacity-40" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Saldo Disponible en fal.ai</span>
                    <div className="flex items-baseline gap-2">
                      {metrics?.falBalance === undefined ? (
                        <span className="text-3xl font-extrabold text-white animate-pulse">Cargando...</span>
                      ) : metrics.falBalance === null ? (
                        <div className="flex items-center gap-2 text-rose-400">
                          <AlertTriangle className="w-5 h-5 animate-bounce" />
                          <span className="text-lg md:text-xl font-bold">No disponible / Sin clave ADMIN</span>
                        </div>
                      ) : (
                        <>
                          <span className={`text-4xl md:text-5xl font-extrabold tracking-tight ${
                            metrics.falBalance.currentBalance < 5 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                          }`}>
                            ${metrics.falBalance.currentBalance.toFixed(2)}
                          </span>
                          <span className="text-sm text-slate-400">{metrics.falBalance.currency}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {metrics?.falBalance === null 
                        ? "Asegúrate de que tu FAL_KEY en .env.local posea el rol de ADMIN para consultar facturación."
                        : "Créditos para generación de imágenes (VTON, InstantID) y síntesis de voz."}
                    </p>
                  </div>

                  <a 
                    href="https://fal.run/dashboard/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="premium-button text-white px-5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 border border-violet-500/30 hover:border-violet-500/60 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all whitespace-nowrap"
                  >
                    <Wallet className="w-4 h-4" />
                    Gestionar Saldo fal.ai
                  </a>
                </div>
              </div>

              {/* Tarjeta de estado de API de Fal.ai */}
              <div className="bg-[#0f172a]/50 backdrop-blur-sm border border-violet-500/20 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-20 transition-opacity duration-300 group-hover:opacity-40" />
                <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Estado de fal.ai</h3>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${metrics?.falBalance ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                      <span className="text-lg font-bold text-white">
                        {metrics?.falBalance ? 'Conectado / Activo' : 'Clave de API cargada'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Llamadas al endpoint IDM-VTON y síntesis de audio configuradas a través del SDK oficial de fal.ai.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

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
