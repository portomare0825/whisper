'use client';

import { Play, Volume2, Square, RefreshCw, Edit3 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Message, Avatar } from '@/types';

interface MessageBubbleProps {
  message: Message;
  avatar: Avatar;
  isLast?: boolean;
  isLastUser?: boolean;
  onEdit?: (content: string) => void;
  onRegenerate?: () => void;
  onRetry?: (content: string) => void;
  sending?: boolean;
}

export default function MessageBubble({ 
  message, 
  avatar,
  isLast = false,
  isLastUser = false,
  onEdit,
  onRegenerate,
  onRetry,
  sending = false
}: MessageBubbleProps) {
  const isAvatar = message.role === 'avatar';
  const [isPlaying, setIsPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Precargar las voces del navegador al montar el componente
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    
    // Detener audio al desmontar el componente
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const cleanTextForTTS = (text: string) => {
    const cleaned = text
      .replace(/\*[^*]+\*/g, '') // Eliminar acciones entre asteriscos
      .replace(/\*/g, '')        // Eliminar asteriscos sueltos
      .replace(/\s+/g, ' ')      // Normalizar espacios
      .trim();
    return cleaned || text; // Si queda vacío, reproducir el original como fallback
  };

  const runLocalSynthesis = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel(); // Cancelar audios previos
      
      const cleanedText = cleanTextForTTS(message.content);
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = 'es-ES'; // Español
      utterance.rate = 1.0;     // Velocidad normal
      
      const gender = avatar.voice_settings?.gender || 'female';
      if (gender === 'male') {
        utterance.pitch = 0.9;  // Tono más bajo para voz masculina
      } else {
        utterance.pitch = 1.1;  // Tono más agudo para voz femenina
      }
      
      // Obtener voces disponibles y filtrar por español
      const voices = window.speechSynthesis.getVoices();
      const spanishVoices = voices.filter(v => v.lang.includes('es'));
      
      let selectedVoice = null;
      
      if (gender === 'male') {
        selectedVoice = spanishVoices.find(v => 
          v.name.toLowerCase().includes('male') || 
          v.name.toLowerCase().includes('hombre') ||
          v.name.includes('Sabin') ||
          v.name.includes('Pablo') ||
          v.name.includes('David')
        );
      } else {
        selectedVoice = spanishVoices.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('mujer') ||
          v.name.includes('Monica') ||
          v.name.includes('Helena') ||
          v.name.includes('Paulina')
        );
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else if (spanishVoices.length > 0) {
        utterance.voice = spanishVoices[0];
      }

      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(false);
    }
  };

  const playAudio = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    if (message.audio_url) {
      const audio = new Audio(message.audio_url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      setIsPlaying(true);
      audio.play();
    } else {
      setIsPlaying(true);
      
      try {
        // Enviamos el texto original (con asteriscos) para que el servidor diferencie la narración del diálogo mediante SSML
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: message.content,
            gender: avatar.voice_settings?.gender || 'female',
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || 'Fallo en la API de TTS');
        }

        // Log interactivo para saber el origen exacto del audio en tiempo real
        if (data.source === 'google-cloud-premium') {
          console.log(
            '%c[TTS Engine] 🟢 Reproduciendo voz PREMIUM de Google Cloud oficial (%s)', 
            'color: #059669; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #ecfdf5; border-radius: 4px;',
            avatar.voice_settings?.gender === 'male' ? 'es-ES-Standard-B (Hombre)' : 'es-ES-Standard-A (Mujer)'
          );
        } else if (data.source === 'google-translate-fallback-billing-error') {
          console.warn(
            '%c[TTS Engine] ⚠️ Tu API Key falló (problema de facturación/cuenta). Usando Fallback de Google Translate gratis (%s)',
            'color: #d97706; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #fffbeb; border-radius: 4px;',
            avatar.voice_settings?.gender === 'male' ? 'es-US (Latino)' : 'es-ES (España)'
          );
        } else {
          console.log(
            '%c[TTS Engine] 🔵 Reproduciendo voz de Google Translate Gratis (%s)',
            'color: #2563eb; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #eff6ff; border-radius: 4px;',
            avatar.voice_settings?.gender === 'male' ? 'es-US (Latino)' : 'es-ES (España)'
          );
        }

        // Reproducir audio premium en base64
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          runLocalSynthesis();
        };
        audio.play();
      } catch (err) {
        console.warn('No se pudo cargar Google TTS Premium, usando WebSpeech API local:', err);
        runLocalSynthesis();
      }
    }
  };

  return (
    <div className={cn(
      "flex w-full mb-4 md:mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300",
      isAvatar ? "justify-start" : "justify-end"
    )}>
      <div className={cn(
        "max-w-[92%] md:max-w-[80%] rounded-2xl px-4 md:px-5 py-2.5 md:py-3 shadow-lg transition-all",
        isAvatar 
          ? "bg-white/5 border border-white/10 rounded-tl-none" 
          : "premium-button text-primary-foreground rounded-tr-none"
      )}>
        {isAvatar && (
          <div className="flex items-center justify-between mb-2 gap-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{avatar.name}</span>
            <div className="flex items-center gap-1.5">
              {isLast && onRegenerate && !sending && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Regenerar respuesta"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button 
                onClick={playAudio}
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  isPlaying ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-white/70 hover:text-white"
                )}
                title={isPlaying ? "Detener audio" : "Escuchar mensaje"}
              >
                {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
        
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        
        <div className={cn(
          "flex items-center gap-3 mt-2 text-[10px]",
          !isAvatar ? "justify-end text-right" : "justify-between"
        )}>
          {!isAvatar && (
            <div className="flex items-center gap-2 mr-auto">
              {isLastUser && onEdit && !sending && (
                <button
                  type="button"
                  onClick={() => onEdit(message.content)}
                  className="px-1.5 py-0.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1 text-[9px] uppercase tracking-wider border border-white/10"
                  title="Editar esta pregunta"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Editar</span>
                </button>
              )}
              {isLast && onRetry && !sending && (
                <button
                  type="button"
                  onClick={() => onRetry(message.content)}
                  className="px-1.5 py-0.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1 text-[9px] uppercase tracking-wider border border-white/10"
                  title="Reintentar respuesta de la IA"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Reintentar</span>
                </button>
              )}
            </div>
          )}
          <span className="opacity-50">
            {mounted ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
