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
}

export default function ChatContainer({ avatar, conversation, initialMessages = [] }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentImage, setCurrentImage] = useState(conversation.current_avatar_image_url || avatar.current_image_url || avatar.base_image_url);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessageText = input.trim();
    setInput('');
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
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/50 relative">
            <img src={currentImage} alt={avatar.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base leading-none">{avatar.name}</h3>
            <p className="text-[10px] text-primary mt-1.5 uppercase tracking-widest font-semibold">En línea</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            title="Limpiar chat y empezar de nuevo"
            className="p-2.5 bg-white/5 hover:bg-white/10 hover:text-primary text-white/70 rounded-xl transition-all border border-white/5"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            title="Eliminar avatar permanentemente"
            className="p-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl transition-all border border-destructive/20"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 flex gap-6 p-6 min-h-0">
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
          <div className="absolute top-4 right-4 bg-primary/20 backdrop-blur-md p-2 rounded-full border border-primary/30 animate-pulse">
            <Shirt className="w-5 h-5 text-primary" />
          </div>
        </div>

        {/* Columna del Chat */}
        <div className="flex-1 flex flex-col glass-morphism rounded-3xl overflow-hidden">
          {/* Lista de Mensajes */}
          <div 
            ref={scrollRef}
            className="flex-1 p-6 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
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
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-5 py-3">
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
          <div className="mx-6 mb-4 rounded-2xl overflow-hidden relative group cursor-pointer" onClick={() => setShowPremiumModal(true)}>
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 animate-pulse" />
            <div className="relative flex items-center justify-between gap-3 px-5 py-3 border border-amber-400/30 rounded-2xl bg-black/30 backdrop-blur-sm hover:border-amber-400/60 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0 border border-amber-400/40">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-300 leading-none mb-0.5">
                    ¿Sin límites en el chat?
                  </p>
                  <p className="text-[10px] text-white/50 leading-none">
                    Actualiza a <span className="text-amber-400 font-semibold">Pro</span> y chatea sin restricciones
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/30 px-3 py-1.5 rounded-xl whitespace-nowrap group-hover:bg-amber-400/30 transition-colors">
                  ✨ Ver planes
                </span>
              </div>
            </div>
          </div>

          {/* Sugerencias de IA */}
          {suggestions.length > 0 && (
            <div className="mx-6 mb-4 flex flex-col gap-2 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Sugerencias del asistente</span>
                <button 
                  onClick={() => setSuggestions([])}
                  className="ml-auto text-muted-foreground hover:text-white"
                >
                  <X className="w-4 h-4" />
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
                    className="text-left text-sm text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-colors"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input de Mensaje */}
          <form onSubmit={handleSend} className="p-6 pt-0">
            <div className="relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Habla con ${avatar.name}... o *describe una acción*`}
                disabled={sending}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-24 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
              />
              <div className="absolute right-1.5 top-1.5 bottom-1.5 flex gap-0 items-center">
                <button
                  type="button"
                  className="p-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleGetSuggestions}
                  disabled={loadingSuggestions || sending}
                  title="Obtener sugerencias de respuesta"
                  className="p-2 text-muted-foreground hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  <Lightbulb className={`w-5 h-5 ${loadingSuggestions ? 'animate-pulse text-amber-400' : ''}`} />
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="premium-button p-2.5 ml-1 rounded-xl disabled:opacity-50 disabled:grayscale"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

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
