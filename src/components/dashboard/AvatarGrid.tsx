'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ArrowRight, Pencil, Plus, X, ImageIcon, Download, ChevronLeft, ChevronRight, Sparkles, Shirt } from 'lucide-react';
import EditAvatarModal from './EditAvatarModal';

interface AvatarGridProps {
  initialAvatars: any[];
  currentUserId?: string;
}

export default function AvatarGrid({ initialAvatars, currentUserId }: AvatarGridProps) {
  const [avatars, setAvatars] = useState(initialAvatars);
  const [editingAvatar, setEditingAvatar] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'private' | 'public'>('all');

  // Estados del Armario / Vestuario
  const [loadingWardrobeId, setLoadingWardrobeId] = useState<string | null>(null);
  const [wardrobeAvatar, setWardrobeAvatar] = useState<any | null>(null);
  const [wardrobeImages, setWardrobeImages] = useState<any[]>([]);
  const [showWardrobeModal, setShowWardrobeModal] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Estados para el efecto de rasgado de papel ("Paper Tear") y Ultra Pantalla Completa
  const [prevImage, setPrevImage] = useState<string | null>(null);
  const [tearDirection, setTearDirection] = useState<'left' | 'right'>('right');
  const [isUltraFullScreen, setIsUltraFullScreen] = useState(false);

  // Estados para el gesto táctil (Swipe)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const handleAvatarUpdate = (updatedAvatar: any) => {
    setAvatars(prev => prev.map(av => (av.id === updatedAvatar.id ? updatedAvatar : av)));
  };

  // Al hacer clic en la tarjeta del avatar
  const handleCardClick = (avatar: any) => {
    window.location.href = `/dashboard/chats/${avatar.id}`;
  };

  // Manejadores de gestos táctiles para el Carrusel
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (carouselUrls: string[], currentIndex: number) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Siguiente imagen
      const nextIndex = (currentIndex + 1) % carouselUrls.length;
      setPrevImage(fullScreenImage);
      setTearDirection('right');
      setFullScreenImage(carouselUrls[nextIndex]);
    } else if (isRightSwipe) {
      // Imagen anterior
      const prevIndex = (currentIndex - 1 + carouselUrls.length) % carouselUrls.length;
      setPrevImage(fullScreenImage);
      setTearDirection('left');
      setFullScreenImage(carouselUrls[prevIndex]);
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Limpiar imagen anterior después de la animación de cortina de cristal
  useEffect(() => {
    if (!prevImage) return;
    const timer = setTimeout(() => {
      setPrevImage(null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [prevImage]);

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fullScreenImage) return;

      const carouselUrls = wardrobeImages.map((img: any) => img.image_url);
      if (wardrobeAvatar && !carouselUrls.includes(wardrobeAvatar.base_image_url)) {
        carouselUrls.unshift(wardrobeAvatar.base_image_url);
      }

      if (carouselUrls.length <= 1) return;

      const currentIndex = carouselUrls.indexOf(fullScreenImage);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowLeft') {
        const prevIndex = (currentIndex - 1 + carouselUrls.length) % carouselUrls.length;
        setPrevImage(fullScreenImage);
        setTearDirection('left');
        setFullScreenImage(carouselUrls[prevIndex]);
      } else if (e.key === 'ArrowRight') {
        const nextIndex = (currentIndex + 1) % carouselUrls.length;
        setPrevImage(fullScreenImage);
        setTearDirection('right');
        setFullScreenImage(carouselUrls[nextIndex]);
      } else if (e.key === 'Escape') {
        setFullScreenImage(null);
        setIsUltraFullScreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullScreenImage, wardrobeImages, wardrobeAvatar]);

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

  // Filtrado de avatares para sub-secciones en 'private'
  const misPrivados = avatars.filter(av => av.user_id === currentUserId && av.visibility === 'private');
  const misPublicos = avatars.filter(av => av.user_id === currentUserId && av.visibility === 'public');

  const filteredAvatars = avatars.filter(avatar => {
    if (activeTab === 'private') {
      return avatar.user_id === currentUserId; // Todos los propios (se presentarán separados en el render)
    }
    if (activeTab === 'public') {
      return avatar.visibility === 'public' && avatar.moderation_status === 'approved';
    }
    return true; // 'all'
  });

  const renderAvatarCard = (avatar: any) => {
    const isOwner = avatar.user_id === currentUserId;
    const isSystemAvatar = avatar.is_admin_avatar === true;

    return (
      <div key={avatar.id} className="glass-morphism rounded-xl md:rounded-2xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-300 group w-full shadow-md">
        <div 
          onClick={() => handleCardClick(avatar)}
          className="aspect-[4/5] relative bg-black/50 cursor-pointer overflow-hidden group"
          title="Haz clic para ver el vestuario o chatear"
        >
          {avatar.base_image_url ? (
            <img 
              src={avatar.base_image_url} 
              alt={avatar.name}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Users className="w-6 h-6 md:w-12 md:h-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Spinner de Carga de Armario */}
          {loadingWardrobeId === avatar.id && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <div className="w-6 h-6 md:w-8 md:h-8 border-3 md:border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-1 md:mb-2" />
              <span className="text-[7px] md:text-[10px] text-white/80 font-bold uppercase tracking-wider animate-pulse">Abriendo...</span>
            </div>
          )}

          {isSystemAvatar && (
            <span className="absolute top-2 left-2 md:top-4 md:left-4 z-10 text-[7px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md bg-primary/20 text-primary border border-primary/35 backdrop-blur-md flex items-center gap-0.5 md:gap-1 uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-primary animate-pulse" /> Sistema
            </span>
          )}

          {/* Insignias de Privacidad y Moderación para el Propietario (Esquina superior izquierda) */}
          {isOwner && (
            <>
              {avatar.visibility === 'private' && (
                <span className="absolute top-2 left-2 md:top-4 md:left-4 z-10 text-[7px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md bg-white/10 text-white/70 border border-white/20 backdrop-blur-md flex items-center gap-0.5 md:gap-1 uppercase tracking-wider">
                  Privado 🔒
                </span>
              )}
              {avatar.visibility === 'public' && avatar.moderation_status === 'pending' && (
                <span className="absolute top-2 left-2 md:top-4 md:left-4 z-10 text-[7px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/35 backdrop-blur-md flex items-center gap-0.5 md:gap-1 uppercase tracking-wider animate-pulse">
                  En revisión ⏳
                </span>
              )}
              {avatar.visibility === 'public' && avatar.moderation_status === 'rejected' && (
                <span className="absolute top-2 left-2 md:top-4 md:left-4 z-10 text-[7px] md:text-[9px] font-bold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md bg-destructive/20 text-destructive border border-destructive/35 backdrop-blur-md flex items-center gap-0.5 md:gap-1 uppercase tracking-wider">
                  Rechazado ❌
                </span>
              )}
            </>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          
          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingAvatar(avatar);
              }}
              className="absolute top-2 right-2 md:top-4 md:right-4 z-10 w-6 h-6 md:w-10 md:h-10 bg-black/40 hover:bg-primary/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 cursor-pointer"
              title="Editar Avatar"
            >
              <Pencil className="w-3 h-3 md:w-4 md:h-4" />
            </button>
          )}
          
          <div className="absolute bottom-0 left-0 p-2 md:p-6 w-full animate-in fade-in duration-300">
            <h3 className="text-xs md:text-2xl font-bold text-white mb-0.5 md:mb-1 truncate">{avatar.name}</h3>
            <p className="text-[8px] md:text-sm text-white/60 line-clamp-1 md:line-clamp-2 leading-none md:leading-normal mb-1">{avatar.system_prompt}</p>
            
            {/* Calificación en estrellas compacta */}
            {avatar.rating_count !== undefined && avatar.rating_count > 0 ? (
              <div className="flex items-center gap-1 mt-1 bg-black/40 backdrop-blur-md w-fit px-1.5 py-0.5 rounded-md border border-white/5">
                <span className="text-yellow-400 text-[8px] md:text-xs">⭐</span>
                <span className="text-[8px] md:text-[10px] font-bold text-white">{avatar.rating_avg}</span>
                <span className="text-[7px] md:text-[9px] text-white/50">({avatar.rating_count})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1 bg-black/40 backdrop-blur-md w-fit px-1.5 py-0.5 rounded-md border border-white/5">
                <span className="text-white/40 text-[8px] md:text-xs">⭐</span>
                <span className="text-[7px] md:text-[9px] text-white/40">Sin valorar</span>
              </div>
            )}
          </div>
        </div>
      
        <div className="p-2 md:p-4 bg-white/5 border-t border-white/10 flex justify-between items-center gap-1">
          <span className="text-[8px] md:text-xs font-bold px-1.5 py-0.5 md:px-3 md:py-1 rounded-full bg-primary/20 text-primary">
            Activo
          </span>
          <Link 
            href={`/dashboard/chats/${avatar.id}`}
            className="flex items-center gap-0.5 md:gap-2 text-[9px] md:text-sm font-bold hover:text-primary transition-colors whitespace-nowrap"
          >
            <span>Chatear</span>
            <ArrowRight className="w-2.5 h-2.5 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Tabs Selector de Visibilidad Premium */}
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit mb-8 backdrop-blur-md">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${activeTab === 'all' ? 'premium-button text-primary-foreground shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
        >
          Todos 👥
        </button>
        <button
          onClick={() => setActiveTab('private')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${activeTab === 'private' ? 'premium-button text-primary-foreground shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
        >
          Mis Privados 🔒
        </button>
        <button
          onClick={() => setActiveTab('public')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${activeTab === 'public' ? 'premium-button text-primary-foreground shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
        >
          Comunidad Pública 🌐
        </button>
      </div>

      {filteredAvatars.length === 0 && (
        <div className="text-center py-20 glass-morphism rounded-3xl border border-dashed border-white/10 animate-in fade-in duration-300 mb-8">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
            <Users className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <p className="text-muted-foreground text-sm font-semibold">No se encontraron avatares en esta categoría.</p>
        </div>
      )}

      {/* Renderizado condicional para la pestaña 'private' (Mis Privados) */}
      {activeTab === 'private' ? (
        <div className="space-y-12">
          {/* Sub-sección: Mis Avatares Privados */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-bold text-white tracking-wide">🔒 Mis Avatares Privados</span>
              <span className="text-[10px] md:text-xs px-2 py-0.5 bg-white/10 rounded-full text-white/60 border border-white/5">{misPrivados.length}</span>
            </div>
            {misPrivados.length === 0 ? (
              <div className="text-center py-8 glass-morphism rounded-2xl border border-dashed border-white/10">
                <p className="text-muted-foreground text-xs">No tienes avatares privados aún.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-6 pb-4 md:pb-0">
                {misPrivados.map(renderAvatarCard)}
              </div>
            )}
          </div>

          {/* Sub-sección: Mis Avatares Públicos */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-bold text-white tracking-wide">🌐 Mis Avatares Públicos (Creaciones)</span>
              <span className="text-[10px] md:text-xs px-2 py-0.5 bg-primary/20 rounded-full text-primary border border-primary/10">{misPublicos.length}</span>
            </div>
            {misPublicos.length === 0 ? (
              <div className="text-center py-8 glass-morphism rounded-2xl border border-dashed border-white/10">
                <p className="text-muted-foreground text-xs">No has publicado ningún avatar en la comunidad aún.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-6 pb-4 md:pb-0">
                {misPublicos.map(renderAvatarCard)}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grilla estándar para las pestañas 'all' y 'public' */
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-6 pb-4 md:pb-0">
          {filteredAvatars.map(renderAvatarCard)}
        </div>
      )}



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
