'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ArrowRight, Pencil, Plus, X, ImageIcon, Download, ChevronLeft, ChevronRight, Sparkles, Shirt } from 'lucide-react';
import EditAvatarModal from './EditAvatarModal';

interface AvatarGridProps {
  initialAvatars: any[];
}

export default function AvatarGrid({ initialAvatars }: AvatarGridProps) {
  const [avatars, setAvatars] = useState(initialAvatars);
  const [editingAvatar, setEditingAvatar] = useState<any | null>(null);

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
  const handleCardClick = async (avatar: any) => {
    if (loadingWardrobeId) return;
    setLoadingWardrobeId(avatar.id);
    try {
      const response = await fetch(`/api/outfit/history?avatar_id=${avatar.id}`);
      const data = await response.json();
      if (data.outfits && data.outfits.length > 0) {
        setWardrobeAvatar(avatar);
        setWardrobeImages(data.outfits);
        setShowWardrobeModal(true);
      } else {
        // Redirigir al chat directo si no tiene imágenes en el armario
        window.location.href = `/dashboard/chats/${avatar.id}`;
      }
    } catch (err) {
      console.error('Error fetching wardrobe on click:', err);
      window.location.href = `/dashboard/chats/${avatar.id}`;
    } finally {
      setLoadingWardrobeId(null);
    }
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

  return (
    <>
      {/* Grilla: 3 columnas fijas en móvil (se apilan hacia abajo), 2 en md, 3 en lg */}
      <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6 pb-4 md:pb-0">
        {avatars.map((avatar) => (
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

              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              
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
              
              <div className="absolute bottom-0 left-0 p-2 md:p-6 w-full">
                <h3 className="text-xs md:text-2xl font-bold text-white mb-0.5 md:mb-1 truncate">{avatar.name}</h3>
                <p className="text-[8px] md:text-sm text-white/60 line-clamp-1 md:line-clamp-2 leading-none md:leading-normal">{avatar.system_prompt}</p>
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
        ))}
      </div>

      {/* Modal de Vestuario del Dashboard */}
      {showWardrobeModal && wardrobeAvatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-300">
          <div className="relative w-full h-[100dvh] md:h-[85vh] max-w-4xl flex flex-col overflow-hidden glass-morphism rounded-none md:rounded-3xl border-0 md:border border-primary/30 shadow-none md:shadow-[0_0_50px_rgba(212,175,55,0.15)] animate-in scale-in duration-300">
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-primary" />
                  Vestuario de {wardrobeAvatar.name}
                </h3>
                <p className="text-white/60 text-sm mt-1">
                  Explora la colección privada de looks de tu avatar.
                </p>
              </div>
              <button 
                onClick={() => setShowWardrobeModal(false)}
                className="p-2 text-muted-foreground hover:text-white transition-colors cursor-pointer bg-white/5 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Galería de imágenes */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Imagen base */}
                <div 
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-primary/50 transition-all duration-300 shadow-md"
                  onClick={() => setFullScreenImage(wardrobeAvatar.base_image_url)}
                >
                  <img 
                    src={wardrobeAvatar.base_image_url} 
                    alt="Original Look" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded-md text-[9px] font-bold text-primary border border-primary/35">
                    Original
                  </div>
                </div>

                {/* Imágenes del Armario */}
                {wardrobeImages.map((img) => (
                  <div 
                    key={img.id} 
                    className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-primary/50 transition-all duration-300 shadow-md"
                    onClick={() => setFullScreenImage(img.image_url)}
                  >
                    <img 
                      src={img.image_url} 
                      alt="Outfit" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer de acción rápida para entrar al chat */}
            <div className="flex-shrink-0 p-4 border-t border-white/10 bg-white/5 backdrop-blur-sm flex justify-end">
              <Link
                href={`/dashboard/chats/${wardrobeAvatar.id}`}
                className="premium-button px-6 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5"
              >
                <span>Entrar a Chatear</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Imagen a Pantalla Completa del Dashboard (con Carrusel, Swipe, Ultra Fullscreen y Efecto de Rasgado de Papel) */}
      {fullScreenImage && (() => {
        const carouselUrls = wardrobeImages.map((img: any) => img.image_url);
        if (wardrobeAvatar && !carouselUrls.includes(wardrobeAvatar.base_image_url)) {
          carouselUrls.unshift(wardrobeAvatar.base_image_url);
        }
        const currentIndex = carouselUrls.indexOf(fullScreenImage);
        
        return (
          <>
            <div 
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8 animate-in fade-in duration-300 cursor-zoom-out select-none"
              onClick={() => setFullScreenImage(null)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(carouselUrls, currentIndex)}
            >
              {/* Inyectar estilos CSS para el efecto de rasgado de papel realista */}
              {/* Inyectar estilos CSS para el efecto de cortina de cristal glaseado en 3D */}
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes curtainLeft {
                  0% {
                    transform: translateX(0) scale(1) rotateY(0);
                    filter: blur(0) brightness(1) contrast(1);
                    opacity: 1;
                  }
                  100% {
                    transform: translateX(-100%) scale(0.92) rotateY(-25deg);
                    filter: blur(15px) brightness(0.6) contrast(1.1);
                    opacity: 0;
                  }
                }

                @keyframes curtainRight {
                  0% {
                    transform: translateX(0) scale(1) rotateY(0);
                    filter: blur(0) brightness(1) contrast(1);
                    opacity: 1;
                  }
                  100% {
                    transform: translateX(100%) scale(0.92) rotateY(25deg);
                    filter: blur(15px) brightness(0.6) contrast(1.1);
                    opacity: 0;
                  }
                }

                @keyframes contentReveal {
                  0% {
                    transform: scale(0.95);
                    filter: brightness(0.8) blur(5px);
                    opacity: 0.7;
                  }
                  100% {
                    transform: scale(1);
                    filter: brightness(1) blur(0);
                    opacity: 1;
                  }
                }

                @keyframes dividerLeft {
                  0% {
                    transform: translateX(0);
                    opacity: 1;
                  }
                  100% {
                    transform: translateX(-300px);
                    opacity: 0;
                  }
                }

                @keyframes dividerRight {
                  0% {
                    transform: translateX(0);
                    opacity: 1;
                  }
                  100% {
                    transform: translateX(300px);
                    opacity: 0;
                  }
                }
              `}} />

              {/* Botón Cerrar */}
              <button 
                className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all cursor-pointer z-[70] border border-white/5 shadow-lg"
                onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}
              >
                <X className="w-6 h-6" />
              </button>
              
              {/* Contador */}
              {carouselUrls.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 text-white text-xs font-bold rounded-full backdrop-blur-md border border-white/5 tracking-wider z-[70] shadow-md">
                  {currentIndex + 1} / {carouselUrls.length}
                </div>
              )}

              {/* Flecha Izquierda */}
              {carouselUrls.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const prevIndex = (currentIndex - 1 + carouselUrls.length) % carouselUrls.length;
                    setPrevImage(fullScreenImage);
                    setTearDirection('left');
                    setFullScreenImage(carouselUrls[prevIndex]);
                  }}
                  className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 md:p-4 bg-white/10 hover:bg-primary hover:text-black text-white rounded-full backdrop-blur-md transition-all cursor-pointer hover:scale-110 active:scale-95 z-[70] border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                  title="Imagen Anterior"
                >
                  <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}

              {/* Imagen Principal con animación de cortina de cristal y puntero de zoom */}
              <div 
                className="relative max-w-full max-h-full flex items-center justify-center pointer-events-none overflow-hidden cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUltraFullScreen(true);
                }}
              >
                {/* Imagen nueva (Fondo que se revela) */}
                <img 
                  key={fullScreenImage} // Fuerza re-render para disparar animación
                  src={fullScreenImage} 
                  alt="Outfit Full Screen" 
                  className={`max-w-full max-h-[75vh] md:max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10 pointer-events-auto transition-all`}
                  style={{
                    animation: prevImage ? 'contentReveal 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards' : 'none'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUltraFullScreen(true);
                  }}
                />

                {/* Imagen anterior izquierda (Cortina izquierda) */}
                {prevImage && (
                  <img 
                    src={prevImage} 
                    alt="Left curtain" 
                    className="absolute max-w-full max-h-[75vh] md:max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10 pointer-events-none z-20"
                    style={{
                      clipPath: 'polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)',
                      animation: 'curtainLeft 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                      transformOrigin: 'left center'
                    }}
                  />
                )}

                {/* Imagen anterior derecha (Cortina derecha) */}
                {prevImage && (
                  <img 
                    src={prevImage} 
                    alt="Right curtain" 
                    className="absolute max-w-full max-h-[75vh] md:max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10 pointer-events-none z-20"
                    style={{
                      clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)',
                      animation: 'curtainRight 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                      transformOrigin: 'right center'
                    }}
                  />
                )}

                {/* Separadores dorados resplandecientes que se dividen */}
                {prevImage && (
                  <>
                    <div 
                      className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.8)] z-30 pointer-events-none"
                      style={{
                        animation: 'dividerLeft 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards'
                      }}
                    />
                    <div 
                      className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.8)] z-30 pointer-events-none"
                      style={{
                        animation: 'dividerRight 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards'
                      }}
                    />
                  </>
                )}
              </div>

              {/* Flecha Derecha */}
              {carouselUrls.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextIndex = (currentIndex + 1) % carouselUrls.length;
                    setPrevImage(fullScreenImage);
                    setTearDirection('right');
                    setFullScreenImage(carouselUrls[nextIndex]);
                  }}
                  className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 md:p-4 bg-white/10 hover:bg-primary hover:text-black text-white rounded-full backdrop-blur-md transition-all cursor-pointer hover:scale-110 active:scale-95 z-[70] border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                  title="Siguiente Imagen"
                >
                  <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}

              {/* Herramienta Descarga */}
              <div className="absolute bottom-6 inset-x-0 flex justify-center gap-4 z-[70] px-4">
                <a 
                  href={fullScreenImage} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  download
                  onClick={(e) => e.stopPropagation()}
                  title="Descargar Imagen"
                  className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-md"
                >
                  <Download className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Vista a Pantalla Completa Absoluta (Ultra Full Screen) con gestos táctiles y animación */}
            {isUltraFullScreen && (
              <div 
                className="fixed inset-0 z-[100] bg-black flex items-center justify-center cursor-zoom-out select-none animate-in fade-in duration-300"
                onClick={() => setIsUltraFullScreen(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => handleTouchEnd(carouselUrls, currentIndex)}
              >
                {/* Imagen nueva (Fondo que se revela) */}
                <img 
                  src={fullScreenImage} 
                  alt="Ultra Full Screen" 
                  className={`w-full h-full object-contain md:object-cover animate-in fade-in duration-300`}
                  style={{
                    animation: prevImage ? 'contentReveal 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards' : 'none'
                  }}
                />

                {/* Cortina izquierda */}
                {prevImage && (
                  <img 
                    src={prevImage} 
                    alt="Left curtain" 
                    className="absolute w-full h-full object-contain md:object-cover pointer-events-none z-20"
                    style={{
                      clipPath: 'polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)',
                      animation: 'curtainLeft 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                      transformOrigin: 'left center'
                    }}
                  />
                )}

                {/* Cortina derecha */}
                {prevImage && (
                  <img 
                    src={prevImage} 
                    alt="Right curtain" 
                    className="absolute w-full h-full object-contain md:object-cover pointer-events-none z-20"
                    style={{
                      clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)',
                      animation: 'curtainRight 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                      transformOrigin: 'right center'
                    }}
                  />
                )}

                {/* Separadores dorados resplandecientes */}
                {prevImage && (
                  <>
                    <div 
                      className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.9)] z-30 pointer-events-none"
                      style={{
                        animation: 'dividerLeft 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards'
                      }}
                    />
                    <div 
                      className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.9)] z-30 pointer-events-none"
                      style={{
                        animation: 'dividerRight 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards'
                      }}
                    />
                  </>
                )}

                {/* Botón flotante para cerrar la vista completa */}
                <button 
                  className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all cursor-pointer z-[110]"
                  onClick={(e) => { e.stopPropagation(); setIsUltraFullScreen(false); }}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            )}
          </>
        );
      })()}

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
