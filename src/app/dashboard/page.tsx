import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Plus, Users, Star } from 'lucide-react';
import AvatarGrid from '@/components/dashboard/AvatarGrid';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  
  // Obtener avatares del usuario
  const { data: avatars } = await supabase
    .from('avatars')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  // Validar si el usuario es premium consultando la tabla subscriptions
  let isPremium = false;
  if (user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    isPremium = !!subscription && (!subscription.expires_at || new Date(subscription.expires_at) > new Date());
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold gold-gradient tracking-tight">Tu Colección</h1>
          <p className="text-muted-foreground mt-2">Gestiona tus compañeros de IA</p>
        </div>
        <Link 
          href="/dashboard/avatars/new"
          className="premium-button px-6 py-3 rounded-xl font-bold flex items-center gap-2 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          Crear Avatar
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <div className="glass-morphism p-3 md:p-6 rounded-xl md:rounded-2xl border-white/10 flex items-center gap-2 md:gap-4">
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-4.5 h-4.5 md:w-6 md:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] md:text-sm text-muted-foreground leading-none truncate">Avatares Activos</p>
            <p className="text-base md:text-2xl font-bold mt-1 md:mt-1.5 leading-none">{avatars?.length || 0}</p>
          </div>
        </div>
        <div className="glass-morphism p-3 md:p-6 rounded-xl md:rounded-2xl border-white/10 flex items-center gap-2 md:gap-4">
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Star className="w-4.5 h-4.5 md:w-6 md:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] md:text-sm text-muted-foreground leading-none truncate">Plan Actual</p>
            <p className="text-base md:text-2xl font-bold mt-1 md:mt-1.5 leading-none">{isPremium ? 'Pro' : 'Gratuito'}</p>
          </div>
        </div>
      </div>

      {/* Avatars Grid */}
      <div className="pt-8">
        <h2 className="text-xl font-bold mb-6">Tus Avatares</h2>
        
        <AvatarGrid initialAvatars={avatars || []} />
      </div>
    </div>
  );
}
