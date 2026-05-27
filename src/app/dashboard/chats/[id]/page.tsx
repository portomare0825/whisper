import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import ChatContainer from '@/components/chat/ChatContainer';
import { notFound } from 'next/navigation';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
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
  if (!user) return notFound();

  let isPremium = false;
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (subscription && (!subscription.expires_at || new Date(subscription.expires_at) > new Date())) {
    isPremium = true;
  }

  // 1. Obtener la información del Avatar
  const { data: avatar } = await supabase
    .from('avatars')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();

  if (!avatar) return notFound();

  // 2. Buscar TODAS las conversaciones con este avatar para este usuario (para arreglar el bug de los clones)
  let conversation: any = null;
  const { data: allConvos } = await supabase
    .from('conversations')
    .select('*')
    .eq('avatar_id', avatar.id)
    .eq('user_id', user.id);

  let convoIds: string[] = [];
  
  if (allConvos && allConvos.length > 0) {
    // Usaremos la primera (o cualquiera) como ID principal para nuevos mensajes
    conversation = allConvos[0];
    convoIds = allConvos.map(c => c.id);
  } else {
    // Si no existe ninguna, crear una nueva conversación
    const { data: newConvo, error: createError } = await supabase
      .from('conversations')
      .insert({
        avatar_id: avatar.id,
        user_id: user.id,
      })
      .select('*')
      .single();
      
    if (newConvo && !createError) {
      conversation = newConvo;
      convoIds = [newConvo.id];
    }
  }

  if (!conversation) return notFound();

  // 3. Obtener el historial de mensajes de TODAS las conversaciones clonadas usando Service Role
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );

  let messages: any[] = [];
  if (convoIds.length > 0) {
    const { data } = await adminClient
      .from('messages')
      .select('*')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: true });
    
    if (data) {
      messages = data;
    }
  }

  return (
    <div className="fixed inset-0 top-16 md:relative md:top-auto md:h-[calc(100vh-4rem)] md:m-0 bg-background md:bg-background/50 rounded-none md:rounded-3xl border-0 md:border border-white/10 overflow-hidden md:backdrop-blur-md z-30">
      <ChatContainer 
        avatar={avatar}
        conversation={conversation}
        initialMessages={messages || []}
        isPremium={isPremium}
      />
    </div>
  );
}
