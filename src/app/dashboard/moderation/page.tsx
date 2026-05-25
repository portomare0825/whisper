'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Sparkles, Check, X, MessageSquare, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function ModerationPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingAvatars, setPendingAvatars] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdminAndFetch() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // 1. Verificar si el usuario es administrador
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.is_admin) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        // 2. Traer avatares en estado de moderación 'pending' a través de la API segura
        const response = await fetch('/api/avatars/pending');
        const data = await response.json();

        if (response.ok && data.avatars) {
          setPendingAvatars(data.avatars);
        } else if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error('Error in moderation page:', err);
        setError('Error al cargar la página de moderación.');
      } finally {
        setLoading(false);
      }
    }
    checkAdminAndFetch();
  }, []);

  const handleModerate = async (avatarId: string, action: 'approve' | 'reject') => {
    setProcessingId(avatarId);
    setError(null);
    try {
      const response = await fetch('/api/avatars/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatar_id: avatarId,
          action,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Remover el avatar procesado de la lista con una animación fluida
        setPendingAvatars(prev => prev.filter(av => av.id !== avatarId));
      } else {
        setError(data.error || 'Error al procesar la moderación');
      }
    } catch (err) {
      console.error('Error moderating avatar:', err);
      setError('Error de red al procesar la solicitud.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto border border-destructive/20">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Acceso Denegado</h1>
          <p className="text-muted-foreground text-sm">
            Esta página es de uso exclusivo para moderadores y administradores de Whisper.
          </p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="premium-button px-8 py-3 rounded-xl font-bold text-sm"
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Panel de <span className="gold-gradient">Moderación</span> ⚖️</h1>
        <p className="text-muted-foreground mt-2">Revisa y aprueba los avatares que los usuarios desean hacer públicos en Whisper.</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {pendingAvatars.length === 0 ? (
        <div className="glass-morphism rounded-3xl p-16 text-center space-y-6 border border-white/5">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">¡Todo al día!</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">No hay avatares pendientes de moderación en este momento.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingAvatars.map((avatar) => (
            <div 
              key={avatar.id} 
              className="glass-morphism rounded-3xl overflow-hidden border border-white/10 flex flex-col md:flex-row hover:border-primary/20 transition-all duration-300 animate-in zoom-in-95 duration-200"
            >
              {/* Previsualización Foto */}
              <div className="w-full md:w-48 aspect-square md:aspect-auto md:h-full relative overflow-hidden flex-shrink-0 bg-black/40 border-b md:border-b-0 md:border-r border-white/5">
                <img 
                  src={avatar.current_image_url || avatar.base_image_url} 
                  alt={avatar.name} 
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Información y Controles */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-bold text-white">{avatar.name}</h3>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/35 uppercase tracking-wider">
                      Pendiente
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Personalidad</p>
                    <p className="text-xs text-white/80 line-clamp-2 italic">"{avatar.personality}"</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">System Prompt (Comportamiento)</p>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3 max-h-24 overflow-y-auto scrollbar-none">
                      <p className="text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap">{avatar.system_prompt || 'Sin prompt específico'}</p>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-3 pt-2">
                  <button
                    disabled={processingId !== null}
                    onClick={() => handleModerate(avatar.id, 'approve')}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Aprobar y Hacer Público
                  </button>
                  <button
                    disabled={processingId !== null}
                    onClick={() => handleModerate(avatar.id, 'reject')}
                    className="bg-destructive/15 hover:bg-destructive/30 text-destructive border border-destructive/20 px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
