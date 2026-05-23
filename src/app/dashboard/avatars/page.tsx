'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, MessageSquare, Edit3, Trash2, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { Avatar } from '@/types';

export default function AvatarsListPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchAvatars = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data } = await supabase
          .from('avatars')
          .select('*')
          .or(`user_id.eq.${user.id},is_admin_avatar.eq.true`)
          .order('created_at', { ascending: false });
        if (data) setAvatars(data);
      }
      setLoading(false);
    };
    fetchAvatars();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Mis <span className="gold-gradient">Avatares</span></h1>
          <p className="text-muted-foreground mt-2">Gestiona tus compañeros digitales y sus personalidades.</p>
        </div>
        <Link 
          href="/dashboard/avatars/new" 
          className="premium-button px-6 py-3 rounded-xl font-bold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Crear Nuevo
        </Link>
      </div>

      {avatars.length === 0 ? (
        <div className="glass-morphism rounded-3xl p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Aún no tienes avatares</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">Crea tu primer avatar para empezar a chatear y experimentar el estilo dinámico.</p>
          </div>
          <Link href="/dashboard/avatars/new" className="premium-button inline-flex px-8 py-3 rounded-xl font-bold">
            Comenzar Creación
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {avatars.map((avatar) => {
            const isOwner = avatar.user_id === currentUserId;
            // Si el avatar tiene is_admin_avatar = true o si su creador no coincide con el logueado, es del sistema
            // @ts-ignore
            const isSystemAvatar = avatar.is_admin_avatar === true;

            return (
              <div key={avatar.id} className="glass-morphism rounded-3xl overflow-hidden group hover:border-primary/30 transition-all duration-300">
                <div className="aspect-[4/5] relative overflow-hidden">
                  <img 
                    src={avatar.current_image_url || avatar.base_image_url} 
                    alt={avatar.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  
                  {isSystemAvatar && (
                    <span className="absolute top-4 left-4 z-10 text-[9px] font-bold px-2 py-1 rounded-md bg-primary/20 text-primary border border-primary/35 backdrop-blur-md flex items-center gap-1 uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 text-primary animate-pulse" /> Sistema
                    </span>
                  )}

                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{avatar.name}</h3>
                    <p className="text-xs text-white/60 line-clamp-1 italic">{avatar.personality}</p>
                  </div>
                </div>
                
                <div className="p-4 flex gap-2">
                  <Link 
                    href={`/dashboard/chats/${avatar.id}`}
                    className="flex-1 premium-button py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chatear
                  </Link>
                  {isOwner && (
                    <>
                      <button className="p-3 glass-morphism rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button className="p-3 glass-morphism rounded-xl hover:bg-destructive/20 text-white/60 hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
