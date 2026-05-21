import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import SettingsForm from '@/components/dashboard/SettingsForm';

export default async function SettingsPage() {
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

  // Validar si el usuario es premium consultando la tabla subscriptions
  let isPremium = false;
  let planType = 'free';
  let expiresAt = null;

  if (user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subscription && (!subscription.expires_at || new Date(subscription.expires_at) > new Date())) {
      isPremium = true;
      planType = subscription.plan_type || 'pro';
      expiresAt = subscription.expires_at;
    }
  }

  const userData = {
    email: user?.email || 'usuario@dominio.com',
    id: user?.id || 'no-id',
    created_at: user?.created_at || new Date().toISOString(),
    isPremium,
    planType,
    expiresAt,
    coins: 0,
  };

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .maybeSingle();
      
    if (profile) {
      userData.coins = profile.coins;
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold gold-gradient tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground mt-2">Administra tu perfil y la configuración de seguridad</p>
      </div>

      <div className="pt-2">
        <SettingsForm initialUser={userData} />
      </div>
    </div>
  );
}
