'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Shirt, Zap, Sparkles, Star, X, ArrowLeft, RotateCcw, Trash2, AlertTriangle, Lightbulb } from 'lucide-react';
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
  
  // Estados para el Vestuario (Galería)
  const [showWardrobeModal, setShowWardrobeModal] = useState(false);
  const [wardrobeImages, setWardrobeImages] = useState<any[]>([]);
  const [loadingWardrobe, setLoadingWardrobe] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

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

  // Cargar saldo de monedas inicial y suscribirse en tiempo real
  useEffect(() => {
    const fetchCoins = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('coins')
          .eq('id', conversation.user_id)
          .maybeSingle();
        
        if (data) {
          setCoins(data.coins);
        }
      } catch (err) {
        console.error('Error fetching user coins:', err);
      } finally {
        setLoadingCoins(false);
      }
    };
    
    fetchCoins();
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
        if (payload.new && typeof payload.new.coins === 'number') {
          setCoins(payload.new.coins);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation.user_id]);

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
      
      // Actualizar imagen y saldo de monedas
      setCurrentImage(data.new_image_url);
      setCoins(data.new_coins_balance);
      setOutfitPrompt('');
      setShowOutfitModal(false);
      
      // La base de datos registrará el mensaje del sistema que actualizará los mensajes en tiempo real
    } catch (err: any) {
      setOutfitError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setChangingOutfit(false);
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

      if (result.new_image_url) {
        setCurrentImage(result.new_image_url);
      }
      
      // La base de datos y realtime se encargarán del mensaje del AI, pero 
      // si realtime falla, podemos agregarlo aquí también optimísticamente:
      const optimisticAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: result.content,
        role: 'avatar',
        created_at: new Date().toISOString(),
        conversation_id: conversation.id
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
    
    // Si el último mensaje es el del usuario y no tiene respuesta del avatar,
    // lo borramos de la base de datos para no duplicarlo al volver a enviarlo
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user' && lastMessage.content === content) {
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
    }

    // Enfocar el input de texto del chat
    setTimeout(() => {
      const inputEl = document.querySelector('input[placeholder^="Habla con"]') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
      }
    }, 50);
  };

  const handleRetry = async (userMessageText: string) => {
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
          message: userMessageText
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

      if (result.new_image_url) {
        setCurrentImage(result.new_image_url);
      }
      
      const optimisticAiMessage: Message = {
        id: Date.now().toString(),
        content: result.content,
        role: 'avatar',
        created_at: new Date().toISOString(),
        conversation_id: conversation.id
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
    await handleRetry(lastUserMessage.content);
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
        .update({ current_avatar_image_url: avatar.base_image_url })
        .eq('id', conversation.id);
        
      if (convoError) {
        console.warn('Error al restaurar imagen de conversación:', convoError);
      }
      
      setMessages([]);
      setCurrentImage(avatar.base_image_url);
      
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
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-primary/50 relative">
            <img src={currentImage} alt={avatar.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm md:text-base leading-none">{avatar.name}</h3>
            <p className="text-[9px] md:text-[10px] text-primary mt-1 md:mt-1.5 uppercase tracking-widest font-semibold">En línea</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Monedas del usuario */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 md:px-3 py-1.5 rounded-xl text-xs md:text-sm text-white/90">
            <span className="gold-gradient font-bold">{loadingCoins ? '...' : coins}</span>
            <span className="text-amber-400 font-bold">🪙</span>
          </div>

          {/* Botón de cambio de outfit para móvil (oculto en lg) */}
          <button
            type="button"
            onClick={() => setShowOutfitModal(true)}
            title="Cambiar outfit (10 monedas)"
            className="lg:hidden p-1.5 md:p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg md:rounded-xl transition-all border border-primary/20 flex items-center justify-center cursor-pointer"
          >
            <Shirt className="w-3.5 h-3.5 md:w-4 md:h-4" />
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
        <div className="hidden lg:flex flex-col w-1/3 glass-morphism rounded-3xl overflow-hidden relative group">
          <img 
            src={currentImage} 
            alt={avatar.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
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
              onClick={handleOpenWardrobe}
              title="Ver Galería de Outfits"
              className="bg-amber-500/30 hover:bg-amber-500/50 text-amber-500 backdrop-blur-md p-2.5 rounded-full border border-amber-500/40 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-amber-500/20 flex items-center justify-center cursor-pointer"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Columna del Chat */}
        <div className="flex-1 flex flex-col glass-morphism rounded-none md:rounded-3xl overflow-hidden relative">
          
          {/* Imagen de fondo para dispositivos móviles */}
          <div className="absolute inset-0 z-0 lg:hidden pointer-events-none">
            <img 
              src={currentImage} 
              alt="Background Avatar" 
              className="w-full h-full object-cover opacity-30 object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
          </div>

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
            <div className="mx-0.5 md:mx-6 mb-1 md:mb-4 flex flex-col gap-1 md:gap-1.5 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                <span className="text-[10px] md:text-xs font-semibold text-primary/80 uppercase tracking-wider">Sugerencias del asistente</span>
                <button 
                  onClick={() => setSuggestions([])}
                  className="ml-auto text-muted-foreground hover:text-white"
                >
                  <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(suggestion);
                      setSuggestions([]);
                    }}
                    className="text-left text-xs md:text-sm text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg md:rounded-xl p-2 md:p-3 transition-colors"
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
                <button
                  type="button"
                  className="p-1 md:p-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
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
          <div className="relative w-full max-w-lg overflow-hidden glass-morphism rounded-3xl border border-primary/30 p-6 md:p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.15)] animate-in scale-in duration-300">
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

      {/* Modal del Vestuario (Galería) */}
      {showWardrobeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden glass-morphism rounded-3xl border border-primary/30 shadow-[0_0_50px_rgba(212,175,55,0.15)] animate-in scale-in duration-300">
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
                      className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-primary/50 transition-all duration-300"
                      onClick={() => setFullScreenImage(img.image_url)}
                    >
                      <img 
                        src={img.image_url} 
                        alt="Outfit" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                        <p className="text-xs text-white/90 line-clamp-3 font-medium">{img.prompt}</p>
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
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8 animate-in fade-in duration-300 cursor-zoom-out"
          onClick={() => setFullScreenImage(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all cursor-pointer z-[70]"
            onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={fullScreenImage} 
            alt="Outfit Full Screen" 
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent click from closing
          />

          <div className="absolute bottom-6 inset-x-0 flex justify-center z-[70]">
            <a 
              href={fullScreenImage} 
              target="_blank" 
              rel="noopener noreferrer"
              download
              onClick={(e) => e.stopPropagation()}
              className="premium-button py-3 px-6 rounded-xl font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
            >
              Descargar Imagen
            </a>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Limpieza de Chat */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden glass-morphism rounded-3xl border border-white/10 p-8 text-center shadow-2xl animate-in scale-in duration-300">
            <button 
              onClick={() => setShowClearModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
              <RotateCcw className="w-8 h-8 text-primary animate-spin-slow" />
            </div>

            <h3 className="text-2xl font-bold text-white tracking-tight mb-3">
              ¿Limpiar chat completo?
            </h3>
            
            <p className="text-white/70 text-sm leading-relaxed mb-8">
              Esto borrará de forma permanente **todos los mensajes** del historial y restablecerá la apariencia base original del avatar. Esta acción no se puede deshacer.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-colors text-sm font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleClearChat}
                disabled={sending}
                className="flex-1 premium-button py-3.5 rounded-xl text-primary-foreground font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                {sending ? 'Limpiando...' : 'Confirmar'}
              </button>
            </div>
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
    </div>
  );
}
