'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Shirt, Zap, Sparkles, Star, X, ArrowLeft, RotateCcw, Trash2, AlertTriangle, Lightbulb, Smile, Eye, EyeOff, ImageOff, Download, ChevronLeft, ChevronRight, BookOpen, MessageSquare } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { Avatar, Message, Conversation } from '@/types';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChatContainerProps {
  avatar: Avatar;
  conversation: Conversation;
  initialMessages?: Message[];
  isPremium?: boolean;
}

export default function ChatContainer({ avatar, conversation, initialMessages = [], isPremium = false }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentImage, setCurrentImage] = useState(conversation.current_avatar_image_url || avatar.current_image_url || avatar.base_image_url);
  // true solo cuando la imagen actual proviene de Fal.ai (relación 3:4) y necesita corrección de aspecto
  const [isFalImage, setIsFalImage] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Estados para el sistema de monedas y cambio de outfit
  const [coins, setCoins] = useState<number>(0);
  const [loadingCoins, setLoadingCoins] = useState<boolean>(true);
  const [showOutfitModal, setShowOutfitModal] = useState(false);
  const [outfitPrompt, setOutfitPrompt] = useState('');
  const [changingOutfit, setChangingOutfit] = useState(false);
  const [outfitError, setOutfitError] = useState('');
  
  // Estado para la generación asíncrona de outfits
  const [pendingOutfitJob, setPendingOutfitJob] = useState<{ generation_id: string; prompt: string; is_free: boolean } | null>(null);
  
  // Estados para el cambio de Pose y Expresión
  const [showPoseModal, setShowPoseModal] = useState(false);
  const [poseEmotion, setPoseEmotion] = useState<'smiling' | 'angry' | 'sad' | 'winking' | 'neutral'>('smiling');
  const [poseLayout, setPoseLayout] = useState<'portrait' | 'medium' | 'full'>('medium');
  const [changingPose, setChangingPose] = useState(false);
  const [poseError, setPoseError] = useState('');
  const [poseOutfitHint, setPoseOutfitHint] = useState('');
  const [pendingPoseJob, setPendingPoseJob] = useState<{ generation_id: string; emotion: string; pose: string; is_free: boolean } | null>(null);
  
  // Estados para el Vestuario (Galería)
  const [showWardrobeModal, setShowWardrobeModal] = useState(false);
  const [wardrobeImages, setWardrobeImages] = useState<any[]>([]);
  const [loadingWardrobe, setLoadingWardrobe] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  // Estados para el efecto de rasgado de papel ("Paper Tear") y Ultra Pantalla Completa
  const [prevImage, setPrevImage] = useState<string | null>(null);
  const [tearDirection, setTearDirection] = useState<'left' | 'right'>('right');
  const [isUltraFullScreen, setIsUltraFullScreen] = useState(false);
  
  // Estados para el gesto táctil (Swipe) en carrusel
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Estado para la compra de monedas
  const [showBuyCoinsModal, setShowBuyCoinsModal] = useState(false);
  const [processingCoinPurchase, setProcessingCoinPurchase] = useState(false);

  // Estados para reconocimiento de apariencia física del usuario
  const [isAnalyzingAppearance, setIsAnalyzingAppearance] = useState(false);
  const [userHasAppearance, setUserHasAppearance] = useState(false);
  const [showAppearanceSuccess, setShowAppearanceSuccess] = useState(false);

  // Estados para el sistema de calificación por estrellas de avatares públicos
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // Cargar calificación previa del usuario al montar el componente
  useEffect(() => {
    async function fetchUserRating() {
      // @ts-ignore
      if (avatar.visibility === 'public' && avatar.moderation_status === 'approved' && avatar.user_id !== conversation.user_id) {
        try {
          const { data } = await supabase
            .from('avatar_ratings')
            .select('rating')
            .eq('avatar_id', avatar.id)
            .eq('user_id', conversation.user_id)
            .maybeSingle();
          if (data) {
            setUserRating(data.rating);
          }
        } catch (err) {
          console.error('Error fetching user rating:', err);
        }
      }
    }
    fetchUserRating();
  }, [avatar.id, conversation.user_id]);

  const handleRate = async (ratingValue: number) => {
    try {
      setUserRating(ratingValue);

      // Upsert de la calificación en la base de datos (con conflicto por avatar_id y user_id)
      const { error } = await supabase
        .from('avatar_ratings')
        .upsert({
          avatar_id: avatar.id,
          user_id: conversation.user_id,
          rating: ratingValue,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'avatar_id,user_id'
        });

      if (error) throw error;
    } catch (err: any) {
      console.error('Error submitting rating:', err);
      alert(`No se pudo enviar la calificación: ${err.message}`);
    }
  };


  // Estado para el Modo Novela (narrativa literaria vs burbujas de chat)
  const [novelMode, setNovelMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`novel-mode-${conversation.id}`);
      return saved === 'true';
    }
    return false;
  });

  const toggleNovelMode = () => {
    setNovelMode(prev => {
      const next = !prev;
      localStorage.setItem(`novel-mode-${conversation.id}`, String(next));
      return next;
    });
  };

  // Estados para ocultar/mostrar avatar y restauración de imagen
  const [showAvatarInChat, setShowAvatarInChat] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`show-avatar-${conversation.id}`);
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [resettingImage, setResettingImage] = useState(false);
  const [outfitToDelete, setOutfitToDelete] = useState<{ id: string; imageUrl: string } | null>(null);

  const toggleShowAvatar = () => {
    setShowAvatarInChat(prev => {
      const next = !prev;
      localStorage.setItem(`show-avatar-${conversation.id}`, String(next));
      return next;
    });
  };

  const handleResetAvatarImage = async () => {
    if (resettingImage || sending) return;
    try {
      setSending(true);
      setResettingImage(true);

      // 1. Restaurar imagen del avatar y conversación en Supabase
      const { error: avatarError } = await supabase
        .from('avatars')
        .update({ current_image_url: avatar.base_image_url })
        .eq('id', avatar.id);
        
      if (avatarError) throw avatarError;
      
      const { error: convoError } = await supabase
        .from('conversations')
        .update({ current_avatar_image_url: avatar.base_image_url })
        .eq('id', conversation.id);
        
      if (convoError) throw convoError;
      
      // 2. Actualizar estados locales
      setCurrentImage(avatar.base_image_url);
      setIsFalImage(false);
    } catch (err: any) {
      console.error('Error al restaurar la imagen del avatar:', err);
      alert(`No se pudo restaurar la imagen: ${err.message}`);
    } finally {
      setSending(false);
      setResettingImage(false);
    }
  };

  const handleSelectWardrobeImage = async (imageUrl: string) => {
    if (sending) return;
    try {
      setSending(true);

      // 1. Actualizar Supabase (avatar y conversación) con la nueva imagen del vestuario
      const { error: avatarError } = await supabase
        .from('avatars')
        .update({ current_image_url: imageUrl })
        .eq('id', avatar.id);
        
      if (avatarError) throw avatarError;
      
      const { error: convoError } = await supabase
        .from('conversations')
        .update({ current_avatar_image_url: imageUrl })
        .eq('id', conversation.id);
        
      if (convoError) throw convoError;
      
      // 2. Actualizar estados locales para reflejar el cambio de inmediato
      setCurrentImage(imageUrl);
      setIsFalImage(true); // Las imágenes del vestuario provienen de Fal.ai y son 3:4
      
      // 3. Cerrar modales de manera limpia
      setFullScreenImage(null);
      setShowWardrobeModal(false);
    } catch (err: any) {
      console.error('Error al aplicar la imagen del vestuario:', err);
      alert(`No se pudo aplicar la imagen: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteWardrobeImage = async (imageId: string, imageUrl: string) => {
    if (sending) return;
    
    try {
      setSending(true);

      // 1. Eliminar de Supabase llamando al API route (para saltar RLS si es necesario)
      const response = await fetch('/api/outfit/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al eliminar');
      
      // 2. Si la imagen borrada era la que estaba de fondo/avatar en el chat, restaurar a la imagen base
      if (currentImage === imageUrl) {
        const { error: avatarError } = await supabase
          .from('avatars')
          .update({ current_image_url: avatar.base_image_url })
          .eq('id', avatar.id);
          
        if (avatarError) throw avatarError;
        
        const { error: convoError } = await supabase
          .from('conversations')
          .update({ current_avatar_image_url: avatar.base_image_url })
          .eq('id', conversation.id);
          
        if (convoError) throw convoError;
        
        setCurrentImage(avatar.base_image_url);
        setIsFalImage(false);
      }
      
      // 3. Actualizar la lista local de la galería de vestuario
      setWardrobeImages(prev => prev.filter(img => img.id !== imageId));
      
      // 4. Cerrar el zoom si la imagen que estaba abierta es la eliminada
      if (fullScreenImage === imageUrl) {
        setFullScreenImage(null);
      }
    } catch (err: any) {
      console.error('Error al eliminar la imagen del vestuario:', err);
      alert(`No se pudo eliminar la imagen: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const appearanceFileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleAppearancePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar formato
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecciona un archivo de imagen válido.');
      setShowErrorModal(true);
      return;
    }

    // Verificar tamaño (máx. 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('La imagen es demasiado grande. Por favor, selecciona una foto de menos de 10MB.');
      setShowErrorModal(true);
      return;
    }

    setIsAnalyzingAppearance(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise<void>((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            
            const response = await fetch('/api/user/appearance', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                conversation_id: conversation.id,
                image: base64Data,
              }),
            });

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || 'Error al analizar la imagen');
            }

            setUserHasAppearance(true);
            setShowAppearanceSuccess(true);
            resolve();
          } catch (err: any) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(new Error('Error al leer el archivo de imagen.'));
      });
    } catch (err: any) {
      console.error('Error al subir foto de apariencia:', err);
      setErrorMessage(err.message || 'No se pudo analizar tu apariencia. Intenta con otra foto.');
      setShowErrorModal(true);
    } finally {
      setIsAnalyzingAppearance(false);
      if (appearanceFileInputRef.current) {
        appearanceFileInputRef.current.value = '';
      }
    }
  };


  const formatCountdown = (ms: number) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || hours > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  };

  const handleGetSuggestions = async () => {
    if (loadingSuggestions) return;
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/chat/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          avatar_id: avatar.id
        })
      });
      const data = await response.json();
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    // Suscribirse a nuevos y eliminados mensajes (Realtime)
    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}` 
      }, (payload) => {
        setMessages((prev) => {
          // Si el mensaje ya existe con el mismo ID, no hacer nada
          if (prev.some(m => m.id === payload.new.id)) return prev;

          // Buscar si hay un mensaje optimista con el mismo contenido y rol
          const optimisticIndex = prev.findIndex(m => 
            m.role === payload.new.role && 
            m.content === payload.new.content && 
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
          );

          if (optimisticIndex !== -1) {
            // Reemplazar el mensaje optimista temporal con el real de la DB (que tiene el UUID real)
            const updated = [...prev];
            updated[optimisticIndex] = payload.new as Message;
            return updated;
          }

          return [...prev, payload.new as Message];
        });
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}` 
      }, (payload) => {
        setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (countdownTime === null || countdownTime <= 0) return;

    const timer = setInterval(() => {
      setCountdownTime(prev => {
        if (prev === null || prev <= 1000) {
          clearInterval(timer);
          return null;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownTime]);

  // Cargar saldo de monedas inicial y descripción física y suscribirse en tiempo real
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('coins, user_physical_description')
          .eq('id', conversation.user_id)
          .maybeSingle();
        
        if (data) {
          setCoins(data.coins);
          setUserHasAppearance(!!data.user_physical_description);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoadingCoins(false);
      }
    };
    
    fetchProfileData();
  }, [conversation.user_id]);


  useEffect(() => {
    const channel = supabase
      .channel(`profile-${conversation.user_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${conversation.user_id}`
      }, (payload) => {
        if (payload.new) {
          if (typeof payload.new.coins === 'number') {
            setCoins(payload.new.coins);
          }
          if ('user_physical_description' in payload.new) {
            setUserHasAppearance(!!payload.new.user_physical_description);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation.user_id]);


  // Cargar jobs pendientes de localStorage al montar el componente
  useEffect(() => {
    // 1. Cargar job de outfit
    const savedOutfitJob = localStorage.getItem(`pending-outfit-${conversation.id}`);
    if (savedOutfitJob) {
      try {
        const parsed = JSON.parse(savedOutfitJob);
        setPendingOutfitJob(parsed);
        if (!parsed.is_free) {
          setChangingOutfit(true);
          setShowOutfitModal(true);
        }
      } catch (e) {
        console.error('Error al cargar job de outfit pendiente de localStorage:', e);
      }
    }

    // 2. Cargar job de pose
    const savedPoseJob = localStorage.getItem(`pending-pose-${conversation.id}`);
    if (savedPoseJob) {
      try {
        const parsed = JSON.parse(savedPoseJob);
        setPendingPoseJob(parsed);
        if (!parsed.is_free) {
          setChangingPose(true);
          setShowPoseModal(true);
        }
      } catch (e) {
        console.error('Error al cargar job de pose pendiente de localStorage:', e);
      }
    }
  }, [conversation.id]);

  // Navegación por teclado en el carrusel de imágenes a pantalla completa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fullScreenImage) return;
      
      const carouselUrls = wardrobeImages.map((img: any) => img.image_url);
      if (!carouselUrls.includes(fullScreenImage)) {
        carouselUrls.unshift(fullScreenImage);
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
  }, [fullScreenImage, wardrobeImages, prevImage]);

  // Limpiar imagen anterior después de la animación de cortina de cristal
  useEffect(() => {
    if (!prevImage) return;
    const timer = setTimeout(() => {
      setPrevImage(null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [prevImage]);

  // Polling para el job de outfit pendiente
  useEffect(() => {
    if (!pendingOutfitJob) return;

    let isActive = true;
    let attempts = 0;
    const maxAttempts = 90; // Hasta 6 minutos (90 * 4s)
    let timeoutId: any;

    const checkStatus = async () => {
      if (!isActive) return;
      try {
        const res = await fetch('/api/outfit/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generation_id: pendingOutfitJob.generation_id,
            conversation_id: conversation.id,
            avatar_id: avatar.id,
            prompt: pendingOutfitJob.prompt,
            is_free: pendingOutfitJob.is_free
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Error al verificar estado del look');
        }

        const data = await res.json();

        if (data.status === 'completed' && data.new_image_url) {
          if (!isActive) return;
          setCurrentImage(data.new_image_url);
          setIsFalImage(true); // La imagen viene de Fal.ai (3:4), activar corrección de aspecto
          if (data.new_coins_balance !== undefined && data.new_coins_balance !== null) {
            setCoins(data.new_coins_balance);
          }
          
          setPendingOutfitJob(null);
          localStorage.removeItem(`pending-outfit-${conversation.id}`);
          
          setChangingOutfit(false);
          setShowOutfitModal(false);
          setOutfitPrompt('');
          setOutfitError('');
          return;
        }

        if (data.status === 'failed') {
          throw new Error(data.error || 'La generación de imagen falló en los servidores de IA.');
        }

        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('La generación de ropa está tomando demasiado tiempo. Por favor, intenta de nuevo en unos momentos (no se han descontado monedas).');
        }

        timeoutId = setTimeout(checkStatus, 4000);
      } catch (err: any) {
        if (!isActive) return;
        console.error('Error en polling de outfit:', err);
        
        const isFatal = err.message.includes('insuficiente') || err.message.includes('falló') || err.message.includes('no encontrado') || err.message.includes('Parámetros');
        
        if (isFatal || attempts >= maxAttempts) {
          setOutfitError(err.message || 'Error al generar la imagen.');
          setPendingOutfitJob(null);
          localStorage.removeItem(`pending-outfit-${conversation.id}`);
          setChangingOutfit(false);
        } else {
          timeoutId = setTimeout(checkStatus, 5000);
        }
      }
    };

    timeoutId = setTimeout(checkStatus, 2000);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [pendingOutfitJob, conversation.id, avatar.id]);

  // Polling para el job de pose pendiente
  useEffect(() => {
    if (!pendingPoseJob) return;

    let isActive = true;
    let attempts = 0;
    const maxAttempts = 90; // Hasta 6 minutos (90 * 4s)
    let timeoutId: any;

    const checkStatus = async () => {
      if (!isActive) return;
      try {
        const res = await fetch('/api/avatar/pose/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generation_id: pendingPoseJob.generation_id,
            conversation_id: conversation.id,
            avatar_id: avatar.id,
            emotion: pendingPoseJob.emotion,
            pose: pendingPoseJob.pose,
            is_free: pendingPoseJob.is_free
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Error al verificar estado de la pose');
        }

        const data = await res.json();

        if (data.status === 'completed' && data.new_image_url) {
          if (!isActive) return;
          setCurrentImage(data.new_image_url);
          setIsFalImage(true); // La imagen viene de Fal.ai
          if (data.new_coins_balance !== undefined && data.new_coins_balance !== null) {
            setCoins(data.new_coins_balance);
          }
          
          setPendingPoseJob(null);
          localStorage.removeItem(`pending-pose-${conversation.id}`);
          
          setChangingPose(false);
          setShowPoseModal(false);
          setPoseError('');
          return;
        }

        if (data.status === 'failed') {
          throw new Error(data.error || 'La generación de pose falló en los servidores de IA.');
        }

        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('La generación de pose está tomando demasiado tiempo. Por favor, intenta de nuevo en unos momentos (no se han descontado monedas).');
        }

        timeoutId = setTimeout(checkStatus, 4000);
      } catch (err: any) {
        if (!isActive) return;
        console.error('Error en polling de pose:', err);
        
        const isFatal = err.message.includes('insuficiente') || err.message.includes('falló') || err.message.includes('no encontrado') || err.message.includes('Parámetros');
        
        if (isFatal || attempts >= maxAttempts) {
          setPoseError(err.message || 'Error al generar la pose.');
          setPendingPoseJob(null);
          localStorage.removeItem(`pending-pose-${conversation.id}`);
          setChangingPose(false);
        } else {
          timeoutId = setTimeout(checkStatus, 5000);
        }
      }
    };

    timeoutId = setTimeout(checkStatus, 2000);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [pendingPoseJob, conversation.id, avatar.id]);

  const handleBuyCoins = async (planName: string, priceId: string) => {
    setProcessingCoinPurchase(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId, 
          planName,
          isCoinPackage: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert(`Error iniciando pago: ${err.message}`);
    } finally {
      setProcessingCoinPurchase(false);
    }
  };

  // Manejadores de gestos táctiles para el Carrusel en móvil
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (carouselUrls: string[], currentIndex: number) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
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

  const handleOpenWardrobe = async () => {
    setShowWardrobeModal(true);
    setLoadingWardrobe(true);
    try {
      const response = await fetch(`/api/outfit/history?avatar_id=${avatar.id}`);
      const data = await response.json();
      if (data.outfits) {
        setWardrobeImages(data.outfits);
      }
    } catch (err) {
      console.error('Error fetching wardrobe:', err);
    } finally {
      setLoadingWardrobe(false);
    }
  };

  const handleOutfitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outfitPrompt.trim() || changingOutfit) return;
    
    if (coins < 10) {
      setOutfitError('No tienes suficientes monedas para cambiar el outfit.');
      return;
    }
    
    setChangingOutfit(true);
    setOutfitError('');
    
    try {
      const response = await fetch('/api/outfit/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          avatar_id: avatar.id,
          prompt: outfitPrompt.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar de ropa.');
      }
      
      // Encolado exitosamente
      const job = {
        generation_id: data.generation_id,
        prompt: outfitPrompt.trim(),
        is_free: false
      };
      
      setPendingOutfitJob(job);
      localStorage.setItem(`pending-outfit-${conversation.id}`, JSON.stringify(job));
    } catch (err: any) {
      setOutfitError(err.message || 'Error al conectar con el servidor.');
      setChangingOutfit(false);
    }
  };

  const handlePoseChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changingPose) return;
    
    if (coins < 10) {
      setPoseError('No tienes suficientes monedas para cambiar la pose.');
      return;
    }
    
    setChangingPose(true);
    setPoseError('');
    
    try {
      // ──────────────────────────────────────────────────────────────────────
      // CORRECCIÓN CRÍTICA: Fal.ai requiere que la máscara tenga exactamente
      // las mismas dimensiones que la imagen de entrada. Para garantizarlo,
      // normalizamos AMBAS (imagen y máscara) a 576×1024 usando el canvas del
      // navegador ANTES de enviar al servidor. Usamos canvases SEPARADOS.
      // ──────────────────────────────────────────────────────────────────────
      const TARGET_W = 576;
      const TARGET_H = 1024;

      // face_box en BD está definido en el espacio de referencia 576×1024
      const faceX = (avatar as any).face_box_x ?? 198;
      const faceY = (avatar as any).face_box_y ?? 120;
      const faceW = (avatar as any).face_box_width ?? 180;
      const faceH = (avatar as any).face_box_height ?? 240;

      let maskBase64 = '';
      let normalizedImageBase64 = '';

      try {
        // ── CANVAS 1: Normalizar la imagen base a 576×1024 (cover-fit) ──────
        const imgElement = new window.Image();
        imgElement.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          imgElement.onload = () => resolve();
          // Si falla CORS, continuar sin imagen normalizada (usará URL original)
          imgElement.onerror = () => resolve();
          imgElement.src = avatar.base_image_url;
        });

        if (imgElement.naturalWidth > 0) {
          const imgCanvas = document.createElement('canvas');
          imgCanvas.width = TARGET_W;
          imgCanvas.height = TARGET_H;
          const imgCtx = imgCanvas.getContext('2d')!;

          // Cover-fit: escala y recorta centrado para no distorsionar la imagen
          const srcW = imgElement.naturalWidth;
          const srcH = imgElement.naturalHeight;
          const srcAspect = srcW / srcH;
          const dstAspect = TARGET_W / TARGET_H;
          let sx = 0, sy = 0, sw = srcW, sh = srcH;
          if (srcAspect > dstAspect) {
            // Imagen más ancha que el destino → recortar los lados
            sw = Math.round(srcH * dstAspect);
            sx = Math.round((srcW - sw) / 2);
          } else {
            // Imagen más alta que el destino → recortar arriba/abajo
            sh = Math.round(srcW / dstAspect);
            sy = Math.round((srcH - sh) / 2);
          }
          imgCtx.drawImage(imgElement, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
          normalizedImageBase64 = imgCanvas.toDataURL('image/jpeg', 0.92);
        }

        // ── CANVAS 2: Generar máscara en 576×1024 (independiente) ───────────
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = TARGET_W;
        maskCanvas.height = TARGET_H;
        const maskCtx = maskCanvas.getContext('2d')!;

        // Fondo BLANCO → área que Fal.ai REDIBUJARÁ (cuerpo, ropa, fondo)
        maskCtx.fillStyle = '#ffffff';
        maskCtx.fillRect(0, 0, TARGET_W, TARGET_H);

        // Óvalo NEGRO difuminado → ROSTRO que Fal.ai PRESERVARÁ pixel a pixel
        maskCtx.filter = 'blur(18px)';
        maskCtx.fillStyle = '#000000';
        maskCtx.beginPath();
        maskCtx.ellipse(
          faceX + faceW / 2,
          faceY + faceH / 2,
          faceW / 2,
          faceH / 2,
          0, 0, 2 * Math.PI
        );
        maskCtx.fill();
        maskBase64 = maskCanvas.toDataURL('image/png');

      } catch (canvasErr: any) {
        console.error('Error al generar mask/imagen en canvas:', canvasErr);
        // Fallback mínimo: máscara básica sin imagen normalizada
        try {
          const fbCanvas = document.createElement('canvas');
          fbCanvas.width = TARGET_W;
          fbCanvas.height = TARGET_H;
          const fbCtx = fbCanvas.getContext('2d')!;
          fbCtx.fillStyle = '#ffffff';
          fbCtx.fillRect(0, 0, TARGET_W, TARGET_H);
          fbCtx.filter = 'blur(18px)';
          fbCtx.fillStyle = '#000000';
          fbCtx.beginPath();
          fbCtx.ellipse(faceX + faceW / 2, faceY + faceH / 2, faceW / 2, faceH / 2, 0, 0, 2 * Math.PI);
          fbCtx.fill();
          maskBase64 = fbCanvas.toDataURL('image/png');
        } catch {}
      }

      const response = await fetch('/api/avatar/pose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          avatar_id: avatar.id,
          emotion: poseEmotion,
          pose: poseLayout,
          mask_image: maskBase64,
          normalized_image: normalizedImageBase64 || undefined,
          outfit_hint: poseOutfitHint.trim() || undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar la pose.');
      }
      
      // Encolado exitosamente — el polling tomará el resultado
      const job = {
        generation_id: data.generation_id,
        emotion: poseEmotion,
        pose: poseLayout,
        is_free: false
      };
      
      setPendingPoseJob(job);
      localStorage.setItem(`pending-pose-${conversation.id}`, JSON.stringify(job));
    } catch (err: any) {
      setPoseError(err.message || 'Error al conectar con el servidor.');
      setChangingPose(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessageText = input.trim();
    setInput('');
    const textarea = document.getElementById('chat-textarea');
    if (textarea) textarea.style.height = 'auto';
    setSuggestions([]);
    setSending(true);

    // Optimistic UI: Add user message immediately
    const tempId = Date.now().toString();
    const optimisticMessage: Message = {
      id: tempId,
      content: userMessageText,
      role: 'user',
      created_at: new Date().toISOString(),
      conversation_id: conversation.id
    } as Message;
    
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Llamar a la API Route interna (Next.js)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          avatar_id: avatar.id,
          message: userMessageText
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403 && result.trigger_premium_modal) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setInput(userMessageText); // Restaurar el mensaje en el input
          setErrorMessage(result.error);
          if (result.reset_duration_ms) {
            setCountdownTime(result.reset_duration_ms);
          }
          setShowPremiumModal(true);
          return;
        }
        throw new Error(result.error || 'Error desconocido al hablar con la IA');
      }

      if (result.trigger_premium_modal) {
        // Eliminar el mensaje optimista del usuario para no contaminar el historial de chat
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setErrorMessage(result.content || ''); // Si hay mensaje de censura
        setShowPremiumModal(true);
        return;
      }

      if (result.pending_outfit_generation_id && result.outfit_prompt) {
        const job = {
          generation_id: result.pending_outfit_generation_id,
          prompt: result.outfit_prompt,
          is_free: true
        };
        setPendingOutfitJob(job);
        localStorage.setItem(`pending-outfit-${conversation.id}`, JSON.stringify(job));
      }
      
      // La base de datos y realtime se encargarán del mensaje del AI, pero 
      // si realtime falla, podemos agregarlo aquí también optimísticamente:
      const optimisticAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: result.content,
        role: 'avatar',
        created_at: new Date().toISOString(),
        conversation_id: conversation.id,
        emotion_tag: result.emotion_tag || undefined,
        hidden_thought: result.hidden_thought || undefined,
      } as Message;
      
      // Solo agregamos si el contenido no está vacío y no existe ya por realtime
      setMessages(prev => {
        const exists = prev.find(m => m.content === optimisticAiMessage.content && m.role === 'avatar');
        return exists ? prev : [...prev, optimisticAiMessage];
      });

    } catch (err: any) {
      console.error('Error enviando mensaje:', err);
      // Remove optimistic user message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(userMessageText); // Restaurar el mensaje para que no se pierda
      setErrorMessage(err.message);
      setShowErrorModal(true);
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (content: string) => {
    setInput(content);
    
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.role === 'user') {
      // Caso A: Solo borrar el último mensaje del usuario
      try {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', lastMessage.id);
        
        if (error) {
          console.warn('No se pudo borrar el mensaje del usuario de la base de datos:', error);
        }
      } catch (err) {
        console.warn('Error limpiando el mensaje editado:', err);
      }
      setMessages(prev => prev.slice(0, -1));
    } else if (lastMessage.role === 'avatar') {
      // Caso B: Borrar la respuesta del avatar y el mensaje del usuario anterior
      const secondLastMessage = messages[messages.length - 2];
      if (secondLastMessage && secondLastMessage.role === 'user') {
        try {
          // Borrar mensaje del avatar
          const { error: errAvatar } = await supabase
            .from('messages')
            .delete()
            .eq('id', lastMessage.id);
          if (errAvatar) console.warn('No se pudo borrar el mensaje del avatar:', errAvatar);
          
          // Borrar mensaje del usuario
          const { error: errUser } = await supabase
            .from('messages')
            .delete()
            .eq('id', secondLastMessage.id);
          if (errUser) console.warn('No se pudo borrar el mensaje del usuario:', errUser);
        } catch (err) {
          console.warn('Error limpiando mensajes al editar:', err);
        }
        setMessages(prev => prev.slice(0, -2));
      }
    }

    // Enfocar el input de texto del chat
    setTimeout(() => {
      const inputEl = document.querySelector('input[placeholder^="Habla con"]') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
      }
    }, 50);
  };

  const handleRetry = async (userMessageText: string, isRegenerate = false) => {
    if (sending) return;
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          avatar_id: avatar.id,
          message: userMessageText,
          is_regenerate: isRegenerate
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403 && result.trigger_premium_modal) {
          setErrorMessage(result.error);
          if (result.reset_duration_ms) {
            setCountdownTime(result.reset_duration_ms);
          }
          setShowPremiumModal(true);
          return;
        }
        throw new Error(result.error || 'Error desconocido al hablar con la IA');
      }

      if (result.trigger_premium_modal) {
        setErrorMessage(result.content || '');
        setShowPremiumModal(true);
        return;
      }

      if (result.pending_outfit_generation_id && result.outfit_prompt) {
        const job = {
          generation_id: result.pending_outfit_generation_id,
          prompt: result.outfit_prompt,
          is_free: true
        };
        setPendingOutfitJob(job);
        localStorage.setItem(`pending-outfit-${conversation.id}`, JSON.stringify(job));
      }
      
      const optimisticAiMessage: Message = {
        id: Date.now().toString(),
        content: result.content,
        role: 'avatar',
        created_at: new Date().toISOString(),
        conversation_id: conversation.id,
        emotion_tag: result.emotion_tag || undefined,
        hidden_thought: result.hidden_thought || undefined,
      } as Message;
      
      setMessages(prev => {
        const exists = prev.find(m => m.content === optimisticAiMessage.content && m.role === 'avatar');
        return exists ? prev : [...prev, optimisticAiMessage];
      });

    } catch (err: any) {
      console.error('Error reintentando mensaje:', err);
      setErrorMessage(err.message);
      setShowErrorModal(true);
    } finally {
      setSending(false);
    }
  };

  const handleRegenerate = async () => {
    if (sending || messages.length === 0) return;
    
    // Encontrar el último mensaje del usuario
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return;
    const lastUserMessage = userMessages[userMessages.length - 1];

    const lastMessage = messages[messages.length - 1];
    
    // Si el último mensaje es del avatar, borrarlo de la base de datos
    if (lastMessage && lastMessage.role === 'avatar') {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastMessage.id);
        
        if (isUuid) {
          const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', lastMessage.id);
            
          if (error) {
            console.warn('No se pudo borrar el mensaje del avatar por ID UUID:', error);
          }
        } else {
          // Si no es un UUID válido (todavía es un ID optimista temporal),
          // intentamos borrarlo de la base de datos haciendo match por contenido y conversación
          const { error } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversation.id)
            .eq('content', lastMessage.content)
            .eq('role', 'avatar');
            
          if (error) {
            console.warn('No se pudo borrar el mensaje temporal por contenido:', error);
          }
        }
      } catch (dbErr) {
        console.warn('Error al conectar con la base de datos para borrar:', dbErr);
      }

      // Eliminar el último mensaje del avatar de la UI local
      setMessages(prev => prev.slice(0, -1));
    }

    // Reintentar con el texto del último mensaje del usuario
    await handleRetry(lastUserMessage.content, true);
  };

  const handleDeleteAvatar = async () => {
    try {
      setSending(true);
      
      // Llamar al endpoint del servidor para realizar el borrado completo con privilegios Service Role (bypasseando RLS)
      const response = await fetch('/api/avatars/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatar_id: avatar.id }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al eliminar el avatar en el servidor');
      }
      
      router.push('/dashboard');
      router.refresh();
      
    } catch (err: any) {
      console.error('Error al eliminar avatar:', err);
      alert(`No se pudo eliminar el avatar: ${err.message}`);
    } finally {
      setSending(false);
      setShowDeleteModal(false);
    }
  };

  const handleClearChat = async () => {
    try {
      setSending(true);

      // 1. Borrar mensajes de la conversación
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversation.id);
        
      if (msgError) throw msgError;
      
      // 2. Restaurar imagen del avatar y conversación
      const { error: avatarError } = await supabase
        .from('avatars')
        .update({ current_image_url: avatar.base_image_url })
        .eq('id', avatar.id);
        
      if (avatarError) {
        console.warn('Error al restaurar imagen de avatar:', avatarError);
      }
      
      const { error: convoError } = await supabase
        .from('conversations')
        .update({ 
          current_avatar_image_url: avatar.base_image_url,
          message_count: 0,
          context_summary: null
        })
        .eq('id', conversation.id);
        
      if (convoError) {
        console.warn('Error al restaurar imagen de conversación y resetear contadores:', convoError);
      }
      
      setMessages([]);
      setCurrentImage(avatar.base_image_url);
      setIsFalImage(false); // Volver a la foto original (9:16 nativa)
      
    } catch (err: any) {
      console.error('Error al limpiar chat:', err);
      alert(`No se pudo limpiar el chat: ${err.message}`);
    } finally {
      setSending(false);
      setShowClearModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Cabecera del Chat (Unificada Premium) */}
      <div className="p-1 md:p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/dashboard" className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg md:rounded-xl transition-colors">
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-white/70" />
          </Link>
          <button 
            type="button"
            onClick={() => setFullScreenImage(currentImage)}
            title="Ver foto a pantalla completa"
            className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-primary/50 relative cursor-zoom-in hover:scale-105 active:scale-95 transition-transform flex-shrink-0"
          >
            <img src={currentImage} alt={avatar.name} className={`w-full h-full object-cover ${(pendingOutfitJob || pendingPoseJob) ? 'animate-pulse opacity-70 blur-[0.5px]' : ''}`} />
            {(pendingOutfitJob || pendingPoseJob) && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          <div>
            <h3 className="font-bold text-white text-sm md:text-base leading-none">{avatar.name}</h3>
            {pendingOutfitJob ? (
              <p className="text-[9px] md:text-[10px] text-amber-400 mt-1 md:mt-1.5 uppercase tracking-widest font-semibold animate-pulse">✨ Diseñando look...</p>
            ) : pendingPoseJob ? (
              <p className="text-[9px] md:text-[10px] text-primary mt-1 md:mt-1.5 uppercase tracking-widest font-semibold animate-pulse">✨ Cambiando pose...</p>
            ) : (
              <p className="text-[9px] md:text-[10px] text-primary mt-1 md:mt-1.5 uppercase tracking-widest font-semibold">En línea</p>
            )}

            {/* Calificación por Estrellas Interactiva */}
            {/* @ts-ignore */}
            {avatar.visibility === 'public' && avatar.moderation_status === 'approved' && avatar.user_id !== conversation.user_id && (
              <div className="flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="text-[9px] text-white/50 font-medium">Valora:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRate(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none transition-transform duration-200 active:scale-125 cursor-pointer"
                      title={`Calificar con ${star} estrella${star > 1 ? 's' : ''}`}
                    >
                      <Star 
                        className={`w-3.5 h-3.5 ${
                          star <= (hoverRating || userRating) 
                            ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]' 
                            : 'text-white/20'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {/* Monedas del usuario */}
          <button 
            type="button"
            onClick={() => setShowBuyCoinsModal(true)}
            title="Comprar más monedas"
            className="flex items-center gap-1 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 px-2.5 md:px-3 py-1.5 rounded-xl text-xs md:text-sm text-white/90 cursor-pointer"
          >
            <span className="gold-gradient font-bold">{loadingCoins ? '...' : coins}</span>
            <span className="text-amber-400 font-bold">🪙</span>
          </button>

          {/* Botón de cambio de outfit para móvil (oculto en lg) */}
          <button
            type="button"
            onClick={() => setShowOutfitModal(true)}
            title="Cambiar outfit (10 monedas)"
            className="lg:hidden p-1.5 md:p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg md:rounded-xl transition-all border border-primary/20 flex items-center justify-center cursor-pointer"
          >
            <Shirt className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>

          {/* Botón de cambio de pose para móvil (oculto en lg) */}
          <button
            type="button"
            onClick={() => setShowPoseModal(true)}
            title="Cambiar pose/expresión (10 monedas)"
            className="lg:hidden p-1.5 md:p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg md:rounded-xl transition-all border border-primary/20 flex items-center justify-center cursor-pointer"
          >
            <Smile className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
          
           {/* Botón de Galería/Vestuario */}
          <button
            type="button"
            onClick={handleOpenWardrobe}
            title="Ver Galería de Outfits"
            className="p-1.5 md:p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg md:rounded-xl transition-all border border-amber-500/20 flex items-center justify-center cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>

          {/* Selector de visualización de avatar */}
          <button
            type="button"
            onClick={toggleShowAvatar}
            title={showAvatarInChat ? "Ocultar avatar en el chat" : "Mostrar avatar en el chat"}
            className={`p-1.5 md:p-2.5 rounded-lg md:rounded-xl transition-all border cursor-pointer flex items-center justify-center ${
              showAvatarInChat 
                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20" 
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
          >
            {showAvatarInChat ? <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <EyeOff className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          </button>

          {/* Botón para borrar/restaurar imagen personalizada */}
          {currentImage !== avatar.base_image_url && (
            <button
              type="button"
              onClick={handleResetAvatarImage}
              disabled={sending || resettingImage}
              title="Restaurar imagen base (borrar outfit/pose personalizado)"
              className="p-1.5 md:p-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg md:rounded-xl transition-all border border-destructive/20 flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <ImageOff className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}

          {/* Toggle Modo Novela */}
          <button
            type="button"
            onClick={toggleNovelMode}
            title={novelMode ? "Cambiar a Modo Chat (burbujas)" : "Cambiar a Modo Novela (narrativa literaria)"}
            className={`p-1.5 md:p-2.5 rounded-lg md:rounded-xl transition-all border cursor-pointer flex items-center justify-center ${
              novelMode
                ? "bg-violet-500/20 border-violet-500/30 text-violet-400 hover:bg-violet-500/30"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
          >
            {novelMode ? <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            title="Limpiar chat y empezar de nuevo"
            className="p-1.5 md:p-2.5 bg-white/5 hover:bg-white/10 hover:text-primary text-white/70 rounded-lg md:rounded-xl transition-all border border-white/5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            title="Eliminar avatar permanentemente"
            className="p-1.5 md:p-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg md:rounded-xl transition-all border border-destructive/20 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 flex gap-4 md:gap-6 p-0 md:p-6 min-h-0">
        {/* Columna del Avatar (Imagen Dinámica) */}
        {showAvatarInChat && (
          <div className="hidden lg:flex flex-col w-1/3 glass-morphism rounded-3xl overflow-hidden relative group">
            <img 
              src={currentImage} 
              alt={avatar.name} 
              onClick={() => setFullScreenImage(currentImage)}
              title="Haz clic para ver a pantalla completa"
              className={`w-full h-full cursor-zoom-in transition-transform duration-700 group-hover:scale-105 ${isFalImage ? 'object-fill' : 'object-cover'} ${(pendingOutfitJob || pendingPoseJob) ? 'opacity-65 blur-[0.5px]' : ''}`}
            />
            {pendingOutfitJob && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
                  <Shirt className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider animate-pulse gold-gradient">
                  ✨ Diseñando look
                </span>
                <p className="text-[10px] text-white/70 mt-1 max-w-[180px] line-clamp-2 italic">
                  "{pendingOutfitJob.prompt}"
                </p>
              </div>
            )}
            {pendingPoseJob && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <Smile className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider animate-pulse gold-gradient">
                  ✨ Cambiando Pose
                </span>
                <p className="text-[10px] text-white/70 mt-1 max-w-[180px] line-clamp-2 italic">
                  {pendingPoseJob.pose === 'full' ? 'Cuerpo entero' : pendingPoseJob.pose === 'medium' ? 'Medio cuerpo' : 'Retrato'}
                </p>
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <h2 className="text-2xl font-bold gold-gradient">{avatar.name}</h2>
              <p className="text-sm text-white/60 line-clamp-2">{avatar.personality}</p>
            </div>
            {/* Botones de acciones para escritorio */}
            <div className="absolute top-4 right-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowOutfitModal(true)}
                title="Cambiar outfit de forma manual (10 monedas)"
                className="bg-primary/30 hover:bg-primary/50 text-primary backdrop-blur-md p-2.5 rounded-full border border-primary/40 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-primary/20 flex items-center justify-center cursor-pointer"
              >
                <Shirt className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowPoseModal(true)}
                title="Cambiar pose/expresión (10 monedas)"
                className="bg-primary/30 hover:bg-primary/50 text-primary backdrop-blur-md p-2.5 rounded-full border border-primary/40 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-primary/20 flex items-center justify-center cursor-pointer"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleOpenWardrobe}
                title="Ver Galería de Outfits"
                className="bg-amber-500/30 hover:bg-amber-500/50 text-amber-500 backdrop-blur-md p-2.5 rounded-full border border-amber-500/40 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-amber-500/20 flex items-center justify-center cursor-pointer"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Columna del Chat */}
        <div className="flex-1 flex flex-col glass-morphism rounded-none md:rounded-3xl overflow-hidden relative">
          
          {/* Imagen de fondo para dispositivos móviles */}
          {showAvatarInChat && (
            <div className="absolute inset-0 z-0 lg:hidden pointer-events-none">
              <img 
                src={currentImage} 
                alt="Background Avatar" 
                className={`w-full h-full opacity-60 object-top ${isFalImage ? 'object-fill' : 'object-cover'}`}
              />
              {/* Gradiente más suave para que el avatar se vea pero los textos sigan siendo legibles */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/90" />
            </div>
          )}

          {/* Lista de Mensajes */}
          <div 
            ref={scrollRef}
            className="flex-1 p-0.5 md:p-6 overflow-y-auto space-y-1 md:space-y-1.5 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent relative z-10"
          >
            {messages.map((msg, index) => {
              const isLast = index === messages.length - 1;
              const userMessages = messages.filter(m => m.role === 'user');
              const isLastUser = msg.role === 'user' && userMessages.length > 0 && msg.id === userMessages[userMessages.length - 1].id;

              return (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  avatar={avatar} 
                  isLast={isLast}
                  isLastUser={isLastUser}
                  onEdit={handleEditMessage}
                  onRegenerate={handleRegenerate}
                  onRetry={handleRetry}
                  sending={sending}
                  isPremium={isPremium}
                  novelMode={novelMode}
                />
              );
            })}
            {sending && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-3 py-1.5 md:px-5 md:py-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Banner Pro */}
          {!isPremium && (
            <div className="mx-0.5 md:mx-6 mb-1 md:mb-4 rounded-xl md:rounded-2xl overflow-hidden relative group cursor-pointer" onClick={() => setShowPremiumModal(true)}>
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 animate-pulse" />
            <div className="relative flex items-center justify-between gap-1.5 md:gap-3 px-2 py-1 md:px-3 md:py-2 border border-amber-400/30 rounded-lg md:rounded-xl bg-black/30 backdrop-blur-sm hover:border-amber-400/60 transition-all duration-300">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0 border border-amber-400/40">
                  <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-amber-300 leading-none mb-0.5">
                    ¿Sin límites en el chat?
                  </p>
                  <p className="text-[8px] md:text-[10px] text-white/50 leading-none">
                    Actualiza a <span className="text-amber-400 font-semibold">Pro</span> y chatea sin restricciones
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                <span className="text-[9px] md:text-[10px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/30 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl whitespace-nowrap group-hover:bg-amber-400/30 transition-colors">
                  ✨ Ver planes
                </span>
              </div>
            </div>
          </div>
          )}

          {/* Sugerencias de IA */}
          {suggestions.length > 0 && (
            <div className="mx-2 md:mx-6 mb-2 md:mb-4 flex flex-col gap-1.5 md:gap-2 animate-in slide-in-from-bottom-4 duration-300 relative z-20">
              <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary animate-pulse" />
                <span className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider">Sugerencias de respuesta</span>
                <button 
                  onClick={() => setSuggestions([])}
                  className="ml-auto text-muted-foreground hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(suggestion);
                      setSuggestions([]);
                    }}
                    className="text-left text-xs md:text-sm text-white/90 font-medium bg-black/85 hover:bg-black/95 border border-primary/30 rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:border-primary transition-all duration-200 cursor-pointer active:scale-[0.98]"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input de Mensaje */}
          <form onSubmit={handleSend} className="p-0.5 md:p-6 pt-0">
            <div className="relative group">
              <textarea
                id="chat-textarea"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                rows={1}
                placeholder={`Habla con ${avatar.name}... o *describe una acción*`}
                disabled={sending}
                className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2 pr-16 md:pr-24 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50 text-xs md:text-base text-white resize-none min-h-[36px] md:min-h-[44px] max-h-[120px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent overflow-y-auto"
                style={{ height: 'auto' }}
              />
              <div className="absolute right-1 top-1 bottom-1 flex gap-0 items-center">
                <input
                  type="file"
                  ref={appearanceFileInputRef}
                  onChange={handleAppearancePhotoUpload}
                  accept="image/*"
                  className="hidden"
                  disabled={isAnalyzingAppearance}
                />
                <button
                  type="button"
                  onClick={() => appearanceFileInputRef.current?.click()}
                  disabled={isAnalyzingAppearance}
                  title={
                    isAnalyzingAppearance
                      ? "Memorizando tu apariencia física..."
                      : userHasAppearance
                      ? "¡Apariencia física recordada! Haz clic para actualizar tu foto de perfil."
                      : "Subir foto para que tu avatar conozca tu apariencia física y la recuerde siempre."
                  }
                  className={`p-1 md:p-2 transition-all duration-300 relative ${
                    isAnalyzingAppearance
                      ? "text-primary cursor-not-allowed"
                      : userHasAppearance
                      ? "text-primary hover:text-primary-hover scale-110 drop-shadow-[0_0_8px_rgba(var(--color-primary),0.5)]"
                      : "text-muted-foreground hover:text-primary hover:scale-105"
                  }`}
                >
                  {isAnalyzingAppearance ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
                      {userHasAppearance && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleGetSuggestions}
                  disabled={loadingSuggestions || sending}
                  title="Obtener sugerencias de respuesta"
                  className="p-1 md:p-2 text-muted-foreground hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  <Lightbulb className={`w-4 h-4 md:w-5 md:h-5 ${loadingSuggestions ? 'animate-pulse text-amber-400' : ''}`} />
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="premium-button p-1.5 md:p-2.5 ml-0.5 rounded-lg md:rounded-xl disabled:opacity-50 disabled:grayscale"
                >
                  <Send className="w-3.5 h-3.5 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Cambio de Outfit Manual */}
      {showOutfitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto glass-morphism rounded-3xl border border-primary/30 p-6 md:p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.15)] animate-in scale-in duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Adornos de fondo */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            
            {/* Botón de cerrar */}
            {!changingOutfit && (
              <button 
                onClick={() => { setShowOutfitModal(false); setOutfitPrompt(''); setOutfitError(''); }}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {changingOutfit ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-6">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <Shirt className="w-8 h-8 text-primary animate-pulse" />
                  <Sparkles className="w-4 h-4 text-amber-400 absolute top-0 right-0 animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-white tracking-wide">
                    Diseñando nueva ropa...
                  </h4>
                  <p className="text-sm text-white/60 max-w-xs mx-auto animate-pulse">
                    Nuestra modista de IA está confeccionando el look. Esto tomará unos segundos.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOutfitChange} className="space-y-6">
                {/* Icono de percha */}
                <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto border border-primary/30">
                  <Shirt className="w-8 h-8 text-primary" />
                </div>

                {/* Título */}
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-white tracking-tight">
                    Cambiar Look de {avatar.name}
                  </h3>
                  <p className="text-white/60 text-xs md:text-sm">
                    Personaliza la ropa de tu avatar. Cada cambio cuesta <span className="text-amber-400 font-semibold">10 monedas</span>.
                  </p>
                </div>

                {/* Saldo de monedas actual en el modal */}
                <div className="flex items-center justify-between bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl text-xs md:text-sm">
                  <span className="text-white/60">Tu saldo actual:</span>
                  <div className="flex items-center gap-1 font-bold">
                    <span className="gold-gradient">{coins}</span>
                    <span className="text-amber-400">🪙</span>
                  </div>
                </div>

                {coins < 10 ? (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 space-y-4 text-center">
                    <p className="text-xs text-destructive-foreground font-semibold leading-relaxed">
                      No tienes suficientes monedas para realizar esta acción (Costo: 10 🪙).
                    </p>
                    <a
                      href="/dashboard/billing"
                      className="premium-button inline-flex w-full py-3 rounded-xl font-bold text-xs justify-center items-center gap-2 shadow-lg"
                    >
                      Obtener monedas / Plan Pro <Zap className="w-4 h-4 text-black fill-current" />
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4 text-left">
                    <label className="text-xs font-bold text-white/80 uppercase tracking-wider block ml-1">
                      ¿Qué ropa quieres que use?
                    </label>
                    <textarea
                      value={outfitPrompt}
                      onChange={(e) => setOutfitPrompt(e.target.value)}
                      placeholder="Ej. Un vestido largo de gala rojo, un bikini deportivo en la playa, ropa casual con jeans y polera blanca..."
                      required
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/40 text-sm text-white resize-none"
                    />

                    {/* Ejemplos de prompts rápidos */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider ml-1">Sugerencias rápidas:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Un vestido elegante de noche negro',
                          'Traje de baño de dos piezas en la piscina',
                          'Ropa deportiva ajustada en el gimnasio',
                          'Outfit casual de primavera con jeans y blusa'
                        ].map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setOutfitPrompt(suggestion)}
                            className="text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {outfitError && (
                  <p className="text-xs text-destructive font-semibold text-center animate-pulse">
                    {outfitError}
                  </p>
                )}

                {/* Botones de acción */}
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => { setShowOutfitModal(false); setOutfitPrompt(''); setOutfitError(''); }}
                    className="flex-1 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-colors text-sm font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  {coins >= 10 && (
                    <button 
                      type="submit"
                      disabled={!outfitPrompt.trim() || changingOutfit}
                      className="flex-1 premium-button py-3.5 rounded-xl text-primary-foreground font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
                    >
                      Cambiar Outfit (-10 🪙)
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal de Cambio de Pose y Expresión */}
      {showPoseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto glass-morphism rounded-3xl border border-primary/30 p-6 md:p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.15)] animate-in scale-in duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Botón de cerrar */}
            {!changingPose && (
              <button 
                onClick={() => { setShowPoseModal(false); setPoseError(''); setPoseOutfitHint(''); }}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {changingPose ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-6">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <Smile className="w-8 h-8 text-primary animate-pulse" />
                  <Sparkles className="w-4 h-4 text-amber-400 absolute top-0 right-0 animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-white tracking-wide">
                    Cambiando pose del avatar...
                  </h4>
                  <p className="text-sm text-white/60 max-w-xs mx-auto animate-pulse">
                    Fotografiando a tu avatar en su nuevo estado de ánimo. Esto tomará unos segundos.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePoseChange} className="space-y-6">
                {/* Icono */}
                <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto border border-primary/30">
                  <Smile className="w-8 h-8 text-primary" />
                </div>

                {/* Título */}
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-white tracking-tight">
                    Expresión y Pose de {avatar.name}
                  </h3>
                  <p className="text-white/60 text-xs md:text-sm">
                    Modifica la pose y emoción del avatar. Cada cambio cuesta <span className="text-amber-400 font-semibold">10 monedas</span>.
                  </p>
                </div>

                {/* Saldo de monedas actual en el modal */}
                <div className="flex items-center justify-between bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl text-xs md:text-sm">
                  <span className="text-white/60">Tu saldo actual:</span>
                  <div className="flex items-center gap-1 font-bold">
                    <span className="gold-gradient">{coins}</span>
                    <span className="text-amber-400">🪙</span>
                  </div>
                </div>

                {coins < 10 ? (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 space-y-4 text-center">
                    <p className="text-xs text-destructive-foreground font-semibold leading-relaxed">
                      No tienes suficientes monedas para realizar esta acción (Costo: 10 🪙).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPoseModal(false);
                        setShowBuyCoinsModal(true);
                      }}
                      className="premium-button inline-flex w-full py-3 rounded-xl font-bold text-xs justify-center items-center gap-2 shadow-lg"
                    >
                      Obtener monedas / Plan Pro <Zap className="w-4 h-4 text-black fill-current" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5 text-left">
                    {/* 1. SELECCIONAR EMOCIÓN */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-white/80 uppercase tracking-wider block ml-1">
                        ¿Qué emoción quieres que muestre?
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'smiling', label: 'Feliz / Riendo', icon: '😃' },
                          { id: 'angry', label: 'Enojada / Molesta', icon: '😡' },
                          { id: 'sad', label: 'Triste', icon: '😢' },
                          { id: 'winking', label: 'Coqueta', icon: '😉' },
                          { id: 'neutral', label: 'Seria / Pensativa', icon: '😐' }
                        ].map((emo) => (
                          <button
                            key={emo.id}
                            type="button"
                            onClick={() => setPoseEmotion(emo.id as any)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                              poseEmotion === emo.id 
                                ? 'border-primary bg-primary/10 shadow-[0_0_10px_rgba(212,175,55,0.15)] text-white' 
                                : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="text-2xl mb-1">{emo.icon}</span>
                            <span className="text-xs font-bold leading-tight">{emo.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. SELECCIONAR POSE / ENCUADRE */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-white/80 uppercase tracking-wider block ml-1">
                        ¿Qué encuadre o pose prefieres?
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'portrait', label: 'Retrato', desc: 'Cara y hombros', icon: '🧑' },
                          { id: 'medium', label: 'Medio Cuerpo', desc: 'Cintura arriba', icon: '🧍' },
                          { id: 'full', label: 'Cuerpo Entero', desc: 'Cuerpo completo', icon: '🚶' }
                        ].map((layout) => (
                          <button
                            key={layout.id}
                            type="button"
                            onClick={() => setPoseLayout(layout.id as any)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                              poseLayout === layout.id 
                                ? 'border-primary bg-primary/10 shadow-[0_0_10px_rgba(212,175,55,0.15)] text-white' 
                                : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="text-2xl mb-1">{layout.icon}</span>
                            <span className="text-xs font-bold leading-tight">{layout.label}</span>
                            <span className="text-[9px] text-white/40 mt-0.5 leading-none">{layout.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. ROPA OPCIONAL */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-white/80 uppercase tracking-wider block ml-1">
                        Ropa personalizada <span className="text-white/40 font-normal normal-case">(opcional)</span>
                      </label>
                      <textarea
                        value={poseOutfitHint}
                        onChange={(e) => setPoseOutfitHint(e.target.value)}
                        placeholder="Ej: vestido largo rojo, ropa deportiva, bikini azul en la playa... (si dejas vacío, la IA lo elige)"
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/40 text-sm text-white resize-none"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {['Vestido elegante negro', 'Bikini en la playa', 'Outfit deportivo', 'Casual con jeans'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setPoseOutfitHint(s)}
                            className="text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {poseError && (
                  <p className="text-xs text-destructive font-semibold text-center animate-pulse">
                    {poseError}
                  </p>
                )}

                {/* Botones de acción */}
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => { setShowPoseModal(false); setPoseError(''); setPoseOutfitHint(''); }}
                    className="flex-1 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-colors text-sm font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  {coins >= 10 && (
                    <button 
                      type="submit"
                      disabled={changingPose}
                      className="flex-1 premium-button py-3.5 rounded-xl text-primary-foreground font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
                    >
                      Generar Pose (-10 🪙)
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal del Vestuario (Galería) */}
      {showWardrobeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-300">
          <div className="relative w-full h-[100dvh] md:h-[85vh] max-w-4xl flex flex-col overflow-hidden glass-morphism rounded-none md:rounded-3xl border-0 md:border border-primary/30 shadow-none md:shadow-[0_0_50px_rgba(212,175,55,0.15)] animate-in scale-in duration-300">
            {/* Header del modal */}
            <div className="flex-shrink-0 p-6 border-b border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-primary" />
                  Vestuario de {avatar.name}
                </h3>
                <p className="text-white/60 text-sm mt-1">
                  Tu colección privada de outfits generados.
                </p>
              </div>
              <button 
                onClick={() => setShowWardrobeModal(false)}
                className="p-2 text-muted-foreground hover:text-white transition-colors cursor-pointer bg-white/5 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido desplazable */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              {loadingWardrobe ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                  <p className="text-white/60 text-sm font-medium animate-pulse">Abriendo el armario...</p>
                </div>
              ) : wardrobeImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <Shirt className="w-8 h-8 text-white/30" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">El vestuario está vacío</h4>
                    <p className="text-white/50 text-sm max-w-sm mt-1">Aún no has generado nuevos looks para este avatar. Usa el botón de la percha para crear uno nuevo.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectWardrobeImage(img.image_url);
                          }}
                          title="Usar como fondo del chat"
                          className="w-10 h-10 bg-primary text-black hover:bg-primary/95 hover:scale-110 active:scale-95 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer"
                        >
                          <Send className="w-5 h-5 pl-0.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOutfitToDelete({ id: img.id, imageUrl: img.image_url });
                          }}
                          title="Eliminar permanentemente"
                          className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white hover:scale-110 active:scale-95 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Imagen a Pantalla Completa */}
      {fullScreenImage && (() => {
        const carouselUrls = wardrobeImages.map((img: any) => img.image_url);
        if (!carouselUrls.includes(fullScreenImage)) {
          carouselUrls.unshift(fullScreenImage);
        }
        const currentIndex = carouselUrls.indexOf(fullScreenImage);
        
        return (
          <>
            <div 
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8 animate-in fade-in duration-300 cursor-zoom-out select-none"
              onClick={() => {
                setFullScreenImage(null);
                setIsUltraFullScreen(false);
              }}
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
                onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); setIsUltraFullScreen(false); }}
              >
                <X className="w-6 h-6" />
              </button>
              
              {/* Contador de Imágenes */}
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
                  title="Imagen Anterior (Flecha Izquierda)"
                >
                  <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}

              {/* Imagen Principal con zoom y transición */}
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
                  title="Siguiente Imagen (Flecha Derecha)"
                >
                  <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}

              {/* Barra de Herramientas de Acción */}
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectWardrobeImage(fullScreenImage);
                  }}
                  title="Usar como Fondo de Chat"
                  className="w-12 h-12 bg-primary text-black hover:bg-primary/95 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  <Send className="w-5 h-5 pl-0.5" />
                </button>
                {(() => {
                  const outfit = wardrobeImages.find(img => img.image_url === fullScreenImage);
                  if (!outfit) return null;
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOutfitToDelete({ id: outfit.id, imageUrl: outfit.image_url });
                      }}
                      title="Eliminar permanentemente"
                      className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  );
                })()}
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

      {/* Modal de Confirmación de Borrado de Outfit */}
      {outfitToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-popover border border-white/10 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl relative glass-morphism border-primary/30">
            <button 
              onClick={() => setOutfitToDelete(null)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/5 p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-center text-white mb-2 tracking-tight">¿Descartar Look?</h3>
            <p className="text-white/60 text-center text-sm mb-6">
              Este look de {avatar.name} se eliminará de forma definitiva de tu vestuario privado. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOutfitToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/10"
              >
                Conservar
              </button>
              <button
                onClick={async () => {
                  if (outfitToDelete) {
                    await handleDeleteWardrobeImage(outfitToDelete.id, outfitToDelete.imageUrl);
                    setOutfitToDelete(null);
                  }
                }}
                disabled={sending}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer hover:shadow-red-600/10 active:scale-95 disabled:opacity-50"
              >
                {sending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Limpieza de Chat */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-popover border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowClearModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
              <RotateCcw className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-center text-white mb-2">¿Limpiar Chat?</h3>
            <p className="text-white/60 text-center mb-6">
              Esta acción eliminará todos los mensajes de esta conversación y restaurará el outfit original de {avatar.name}. No podrás deshacerlo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearChat}
                disabled={sending}
                className="flex-1 px-4 py-3 bg-white text-black hover:bg-white/90 rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                {sending ? 'Limpiando...' : 'Sí, limpiar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Compra de Monedas */}
      {showBuyCoinsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-popover border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowBuyCoinsModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-bold text-white mb-2 text-center">Tienda de Monedas</h3>
            <p className="text-white/60 text-sm text-center mb-6">
              Compra monedas para cambiar el outfit de tus avatares en cualquier momento.
            </p>

            <div className="space-y-3">
              {[
                { coins: 10, price: '$1.99', name: 'Pack Básico', id: 'price_1TZYg4PsyuC6LQ5cEvhUjN8g' },
                { coins: 50, price: '$4.99', name: 'Pack Popular', id: 'price_1TZYghPsyuC6LQ5cwHb8S25N', popular: true },
                { coins: 200, price: '$14.99', name: 'Pack Premium', id: 'price_1TZYhgPsyuC6LQ5c72PW9xhG' },
              ].map((pack) => (
                <button
                  key={pack.coins}
                  onClick={() => handleBuyCoins(pack.name, pack.id)}
                  disabled={processingCoinPurchase}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                    pack.popular 
                      ? 'border-primary bg-primary/10 hover:bg-primary/20 shadow-[0_0_15px_rgba(212,175,55,0.15)]' 
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-xl">
                      🪙
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white flex items-center gap-2">
                        {pack.coins} Monedas
                        {pack.popular && (
                          <span className="text-[10px] uppercase bg-primary text-black px-2 py-0.5 rounded-full font-bold">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-white/50">{pack.name}</div>
                    </div>
                  </div>
                  <div className="font-bold text-lg">{pack.price}</div>
                </button>
              ))}
            </div>
            
            {processingCoinPurchase && (
              <p className="text-center text-primary text-sm mt-4 animate-pulse">
                Procesando pago...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación de Avatar */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden glass-morphism rounded-3xl border border-destructive/30 p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in scale-in duration-300">
            <button 
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-destructive/20">
              <AlertTriangle className="w-8 h-8 text-destructive animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-white tracking-tight mb-3">
              ¿Eliminar a {avatar.name}?
            </h3>
            
            <p className="text-white/70 text-sm leading-relaxed mb-8">
              ¿Estás seguro? Esta acción borrará permanentemente al avatar **{avatar.name}**, todas sus conversaciones, su historial completo de mensajes y sus fotos asociadas en el almacenamiento.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-colors text-sm font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteAvatar}
                disabled={sending}
                className="flex-1 bg-destructive hover:bg-destructive/95 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                {sending ? 'Eliminando...' : 'Eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Invitación a Premium */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden glass-morphism rounded-3xl border border-primary/30 p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.25)] animate-in scale-in duration-300">
            {/* Adornos de fondo */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            
            {/* Botón de cerrar */}
            <button 
              onClick={() => { setShowPremiumModal(false); setErrorMessage(''); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icono */}
            <div className="w-16 h-16 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
              <Zap className="w-8 h-8 text-black fill-current animate-pulse" />
            </div>

            {/* Título */}
            <h3 className="text-3xl font-extrabold gold-gradient tracking-tight mb-3">
              {errorMessage && errorMessage.includes('límite') ? 'Límite Alcanzado' : 'Modo Premium'}
            </h3>
            
            {/* Descripción */}
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              {errorMessage || '¡Este avatar quiere llevar la conversación al siguiente nivel! Las conversaciones íntimas, explícitas y 100% sin censura son una característica exclusiva de nuestros compañeros Premium.'}
            </p>

            {countdownTime !== null && countdownTime > 0 && (
              <div className="mb-6 flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1.5">El límite se restablecerá en:</span>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="text-sm font-extrabold text-amber-300 font-mono tracking-wider">
                    {formatCountdown(countdownTime)}
                  </span>
                </div>
              </div>
            )}

            {/* Beneficios breves */}
            <div className="space-y-3 text-left bg-white/5 rounded-2xl p-4 border border-white/10 mb-8">
              <div className="flex items-center gap-3 text-xs text-white/90">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary">✓</div>
                <span>Roleplay 100% explícito y sin censura</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/90">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary">✓</div>
                <span>Voces premium ultra-realistas</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/90">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary">✓</div>
                <span>Avatares y mensajes ilimitados</span>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col gap-3">
              <a 
                href="/dashboard/billing"
                className="premium-button w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Suscribirse ahora <Sparkles className="w-5 h-5 fill-current" />
              </a>
              <button 
                onClick={() => { setShowPremiumModal(false); setErrorMessage(''); }}
                className="w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-colors text-sm font-medium"
              >
                Quizás más tarde
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Error */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden glass-morphism rounded-3xl border border-destructive/30 p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in scale-in duration-300">
            <button 
              onClick={() => setShowErrorModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-destructive/20">
              <AlertTriangle className="w-8 h-8 text-destructive animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-white tracking-tight mb-3">
              Oops, algo salió mal
            </h3>
            
            <p className="text-white/70 text-sm leading-relaxed mb-8">
              Hubo un problema de conexión. Por favor, intenta de nuevo.
            </p>

            <button 
              onClick={() => setShowErrorModal(false)}
              className="w-full py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-colors text-sm font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de Éxito en Reconocimiento de Apariencia Física */}
      {showAppearanceSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden glass-morphism rounded-3xl border border-primary/30 p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.2)] animate-in scale-in duration-300">
            {/* Adornos de fondo */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            
            {/* Botón de cerrar */}
            <button 
              onClick={() => setShowAppearanceSuccess(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icono */}
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
              <Sparkles className="w-8 h-8 text-black fill-current animate-pulse" />
            </div>

            {/* Título */}
            <h3 className="text-2xl font-extrabold text-white tracking-tight mb-3">
              ¡Apariencia Recordada!
            </h3>
            
            {/* Descripción */}
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              ¡Excelente! Hemos analizado tu foto con éxito. Tu avatar **{avatar.name}** ahora sabe cómo eres físicamente y tendrá presente ese recuerdo en todo momento durante el chat, de forma totalmente privada e invisible.
            </p>

            {/* Botones de acción */}
            <button 
              onClick={() => setShowAppearanceSuccess(false)}
              className="premium-button w-full py-3.5 rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer"
            >
              Comenzar a chatear ✨
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

