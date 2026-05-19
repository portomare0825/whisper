'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, ArrowRight, Pencil, Plus } from 'lucide-react';
import EditAvatarModal from './EditAvatarModal';

interface AvatarGridProps {
  initialAvatars: any[];
}

export default function AvatarGrid({ initialAvatars }: AvatarGridProps) {
  const [avatars, setAvatars] = useState(initialAvatars);
  const [editingAvatar, setEditingAvatar] = useState<any | null>(null);

  const handleAvatarUpdate = (updatedAvatar: any) => {
    setAvatars(prev => prev.map(av => (av.id === updatedAvatar.id ? updatedAvatar : av)));
  };

  if (!avatars || avatars.length === 0) {
    return (
      <div className="text-center py-24 glass-morphism rounded-3xl border border-dashed border-white/20">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <Users className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Aún no tienes avatares</h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Crea tu primer compañero digital inteligente y dale vida con personalidad y estilo visual dinámico.
        </p>
        <Link 
          href="/dashboard/avatars/new"
          className="premium-button px-8 py-4 rounded-xl font-bold inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Crear mi primer Avatar
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {avatars.map((avatar) => (
          <div key={avatar.id} className="glass-morphism rounded-2xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-300 group">
            <div className="aspect-[4/5] relative bg-black/50">
              {avatar.base_image_url ? (
                <img 
                  src={avatar.base_image_url} 
                  alt={avatar.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              
              <button
                onClick={() => setEditingAvatar(avatar)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/40 hover:bg-primary/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
                title="Editar Avatar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              
              <div className="absolute bottom-0 left-0 p-6 w-full">
                <h3 className="text-2xl font-bold text-white mb-1">{avatar.name}</h3>
                <p className="text-sm text-white/70 line-clamp-2">{avatar.system_prompt}</p>
              </div>
            </div>
            
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-between items-center">
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/20 text-primary">
                Activo
              </span>
              <Link 
                href={`/dashboard/chats/${avatar.id}`}
                className="flex items-center gap-2 text-sm font-bold hover:text-primary transition-colors"
              >
                Chatear <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {editingAvatar && (
        <EditAvatarModal 
          avatar={editingAvatar}
          onClose={() => setEditingAvatar(null)}
          onUpdate={handleAvatarUpdate}
        />
      )}
    </>
  );
}
