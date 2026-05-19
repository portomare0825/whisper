'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { User, Shield, Key, Mail, Sparkles, Check, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SettingsFormProps {
  initialUser: {
    email?: string;
    id: string;
    created_at: string;
    isPremium: boolean;
  };
}

export default function SettingsForm({ initialUser }: SettingsFormProps) {
  const [mounted, setMounted] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    setUpdating(true);
    setStatus({ type: null, message: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setStatus({ type: 'success', message: '¡Contraseña actualizada con éxito!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err);
      setStatus({ type: 'error', message: err.message || 'Error al actualizar la contraseña.' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Columna Izquierda: Información de Perfil */}
      <div className="lg:col-span-1 space-y-6">
        <div className="glass-morphism p-6 rounded-2xl border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Perfil de Usuario
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                Correo Electrónico
              </label>
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/90">
                <Mail className="w-4 h-4 text-white/40" />
                <span className="text-sm font-medium select-all truncate">{initialUser.email}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                ID de Usuario
              </label>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/50 select-all font-mono truncate">
                {initialUser.id}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                Miembro Desde
              </label>
              <p className="text-sm text-white/70 font-medium px-1">
                {mounted ? new Date(initialUser.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Nivel de Suscripción */}
        <div className="glass-morphism p-6 rounded-2xl border-white/10 relative overflow-hidden">
          <div className={cn(
            "absolute -bottom-6 -right-6 w-32 h-32 rounded-full blur-3xl animate-pulse",
            initialUser.isPremium ? "bg-amber-500/10" : "bg-primary/5"
          )} />
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className={cn("w-5 h-5", initialUser.isPremium ? "text-amber-400" : "text-primary")} /> Plan de Cuenta
          </h2>

          {initialUser.isPremium ? (
            <div className="p-4 bg-gradient-to-tr from-amber-500/20 to-yellow-400/15 border border-amber-400/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Plan Actual</span>
                <span className="text-xs font-extrabold text-black bg-amber-400 px-2 py-0.5 rounded-full uppercase">Pro</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed"> Chatea ilimitadamente sin censura, crea tantos avatares como quieras y accede a voces e imágenes premium de última generación.</p>
            </div>
          ) : (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/50">Plan Actual</span>
                <span className="text-xs font-extrabold text-white/70 bg-white/10 px-2 py-0.5 rounded-full uppercase">Gratuito</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed"> Tu plan gratuito tiene un límite de 1 avatar y restricciones de chat. ¡Actualiza para desbloquear la experiencia completa!</p>
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Cambio de Contraseña */}
      <div className="lg:col-span-2">
        <div className="glass-morphism p-6 md:p-8 rounded-2xl border-white/10">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Seguridad de la Cuenta
          </h2>
          <p className="text-sm text-muted-foreground mb-6">Actualiza tu contraseña para mantener tu cuenta segura.</p>

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1.5">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/35 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1.5">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/35 text-white"
                />
              </div>
            </div>

            {status.type && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                status.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}>
                {status.type === 'success' ? (
                  <Check className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{status.message}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={updating || !newPassword || !confirmPassword}
                className="premium-button px-6 py-3 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-2 disabled:opacity-50 disabled:grayscale cursor-pointer"
              >
                {updating ? 'Actualizando...' : 'Cambiar Contraseña'}
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
