import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { MessageCircle, ArrowRight } from 'lucide-react';

export default async function ChatsIndexPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Crear cliente Supabase con privilegios Service Role (Admin) para evitar problemas de RLS si el creador privatiza el avatar
  const { createClient } = await import('@supabase/supabase-js');
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Obtener todas las conversaciones del usuario junto con la info del avatar
  const { data: conversations } = await adminSupabase
    .from('conversations')
    .select(`
      id,
      updated_at,
      avatars (
        id,
        name,
        base_image_url
      )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mis Conversaciones</h1>
        <p className="text-muted-foreground mt-2">
          Continúa chateando con tus avatares favoritos.
        </p>
      </div>

      {!conversations || conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center glass-morphism rounded-3xl border border-white/5">
          <MessageCircle className="w-16 h-16 text-primary/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Aún no tienes chats activos</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Ve a la sección de Descubrir para elegir un avatar y comenzar tu primera conversación.
          </p>
          <Link 
            href="/dashboard/discover" 
            className="premium-button text-primary-foreground px-6 py-3 rounded-full font-medium inline-flex items-center gap-2"
          >
            Descubrir Avatares <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (() => {
        // Filtrar duplicados: Mostrar solo la conversación más reciente por avatar
        const uniqueChatsMap = new Map();
        conversations.forEach((chat: any) => {
          if (chat.avatars && !uniqueChatsMap.has(chat.avatars.id)) {
            uniqueChatsMap.set(chat.avatars.id, chat);
          }
        });
        const uniqueChats = Array.from(uniqueChatsMap.values());

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueChats.map((chat: any) => (
              <Link 
                key={chat.id} 
                href={`/dashboard/chats/${chat.avatars.id}`}
                className="glass-morphism p-4 rounded-2xl border border-white/5 hover:border-primary/30 transition-all hover:-translate-y-1 group flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 group-hover:border-primary transition-colors">
                  <img 
                    src={chat.avatars.base_image_url} 
                    alt={chat.avatars.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{chat.avatars.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Última vez: {new Date(chat.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
