'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { UserPlus, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      // Si la confirmación de email está desactivada, ya tenemos sesión
      router.push('/dashboard');
      router.refresh();
    } else {
      // Si la confirmación está activada, pedimos revisar el email
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-morphism p-8 rounded-3xl text-center space-y-6">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">¡Revisa tu email!</h1>
          <p className="text-muted-foreground">Hemos enviado un enlace de confirmación a <span className="text-white">{email}</span>.</p>
          <Link href="/login" className="premium-button block py-3 rounded-xl font-bold">Ir al Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.05),transparent_50%)]" />
      
      <div className="w-full max-w-md space-y-8 glass-morphism p-8 rounded-3xl relative z-10 border-white/10 shadow-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gold-gradient tracking-tight">Crea tu cuenta</h1>
          <p className="text-muted-foreground text-sm">Únete a la élite de AvatarChat Pro</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-primary outline-none transition-all"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground ml-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-primary outline-none transition-all"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-xl flex items-center gap-2 animate-in fade-in zoom-in duration-300">
              <AlertCircle className="w-4 h-4" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="premium-button w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Creando cuenta...' : 'Registrarse'}
            <UserPlus className="w-5 h-5" />
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground pt-4">
          ¿Ya tienes cuenta? <Link href="/login" className="text-primary hover:underline font-bold">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
