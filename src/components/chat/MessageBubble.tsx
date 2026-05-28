'use client';

import { Volume2, Square, RefreshCw, Edit3, Brain, EyeOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Message, Avatar } from '@/types';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES: Paleta de colores por emoción
// ═══════════════════════════════════════════════════════════════════
const EMOTION_STYLES: Record<string, { border: string; glow: string; label: string }> = {
  'Feliz':        { border: 'border-amber-400/50',   glow: 'shadow-amber-400/20',   label: '😊' },
  'Triste':       { border: 'border-blue-400/50',    glow: 'shadow-blue-400/20',    label: '💙' },
  'Enojado':      { border: 'border-red-500/50',     glow: 'shadow-red-500/20',     label: '😠' },
  'Sorprendido':  { border: 'border-yellow-300/50',  glow: 'shadow-yellow-300/20',  label: '😲' },
  'Coqueto':      { border: 'border-pink-400/50',    glow: 'shadow-pink-400/25',    label: '😏' },
  'Seductor':     { border: 'border-rose-500/50',    glow: 'shadow-rose-500/25',    label: '🌹' },
  'Misterioso':   { border: 'border-violet-400/50',  glow: 'shadow-violet-400/20',  label: '🔮' },
  'Neutral':      { border: 'border-white/10',       glow: '',                      label: '' },
  'Asustado':     { border: 'border-slate-400/50',   glow: 'shadow-slate-400/20',   label: '😨' },
  'Avergonzado':  { border: 'border-pink-300/50',    glow: 'shadow-pink-300/20',    label: '😳' },
  'Orgulloso':    { border: 'border-emerald-400/50', glow: 'shadow-emerald-400/20', label: '✨' },
  'Divertido':    { border: 'border-lime-400/50',    glow: 'shadow-lime-400/20',    label: '😄' },
  'Melancólico':  { border: 'border-indigo-400/50',  glow: 'shadow-indigo-400/15',  label: '🌙' },
  'Ansioso':      { border: 'border-orange-400/50',  glow: 'shadow-orange-400/20',  label: '😰' },
};

// ═══════════════════════════════════════════════════════════════════
// Heurística para detectar diálogos metidos erróneamente en asteriscos por la IA
function isDialogueHeuristic(text: string): boolean {
  const clean = text.toLowerCase().trim();
  
  // 1. Si empieza con descripciones de partes del propio cuerpo o acciones reflejas, es NARRACIÓN de rol
  const narrationStarts = [
    'mi cuerpo', 'mi cabeza', 'mi mirada', 'mi mano', 'mi rostro', 'mi voz', 
    'mis ojos', 'un suspiro', 'un recuerdo', 'mi dedo', 'mi boca', 'mi cabello', 'mis labios',
    'se ', 'un ', 'una ', 'el ', 'la ', 'los ', 'las '
  ];

  for (const start of narrationStarts) {
    if (clean.startsWith(start)) {
      return false; // Es narración física descriptiva
    }
  }

  // 2. Si empieza con verbos comunes en tercera persona que describen acciones físicas del rol, es NARRACIÓN
  const narrationVerbs = [
    'apoya', 'cierra', 'mira', 'desvía', 'desvia', 'cruza', 'sale', 'mueve', 
    'acaricia', 'abraza', 'besa', 'tiembla', 'sonríe', 'sonrie', 'asiente', 
    'niega', 'camina', 'acerca', 'evita'
  ];
  
  const words = clean.split(/\s+/);
  if (words.length > 0 && narrationVerbs.includes(words[0])) {
    return false; // Es narración de acción
  }

  // 3. Si pasa los filtros anteriores, buscar fuertes indicadores de diálogo directo (tú, ti, te amo, etc.)
  const dialogueIndicators = [
    'te amo', 'gracias', 'contigo', 'me encanta', 'quiero', 'de ti', 'para mí', 'para mi',
    'haces sentir', 'me miras', 'me tocas', 'te extrañ', 'te extran', 'te quier',
    'eres ', 'mi hogar', 'lo siento', 'por favor', 'tú ', 'tu '
  ];

  for (const indicator of dialogueIndicators) {
    if (clean.includes(indicator)) {
      return true;
    }
  }

  if (words.length <= 4 && words.length > 0) {
    const firstWord = words[0];
    if (['te', 'me', 'amo', 'quiero', 'siento', 'gracias', 'hola', 'adiós', 'adios'].includes(firstWord)) {
      return true;
    }
  }

  return false;
}

// UTILIDAD: Renderizador de Modo Novela
// Separa *acciones* de diálogos, aplica estilos diferentes y filtra contenido meta-narrativo
// ═══════════════════════════════════════════════════════════════════
function NovelRenderer({ text }: { text: string }) {
  // Dividir el texto por segmentos: *acción* vs diálogo normal
  const parts = text.split(/(\*[^*]+\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        
        const isAction = part.startsWith('*') && part.endsWith('*') && part.length > 2;
        
        if (isAction) {
          const cleanText = part.slice(1, -1).trim();
          const cleanLower = cleanText.toLowerCase();

          // 1. FILTRAR descripciones de voz redundantes
          const isVoiceDescription = 
            cleanLower.includes('mi voz') || 
            cleanLower.includes('mi tono') || 
            cleanLower.includes('hablo con') || 
            cleanLower.includes('susurro') || 
            cleanLower.includes('con voz') || 
            cleanLower.includes('diciendo con') || 
            cleanLower.includes('digo con') ||
            cleanLower.includes('hablar con');

          if (isVoiceDescription) {
            return null; // Omitir del renderizado visual
          }

          // 2. Si es diálogo directo metido en asteriscos, renderizarlo como texto normal sin asteriscos
          if (isDialogueHeuristic(cleanText)) {
            return <span key={i}>{cleanText} </span>;
          }

          // 3. Renderizar como acción física itálica normal (con sus asteriscos limpios)
          return (
            <em
              key={i}
              className="not-italic"
              style={{ 
                fontStyle: 'italic', 
                opacity: 0.75, 
                fontSize: '0.92em',
                letterSpacing: '0.01em'
              }}
            >
              *{cleanText}* 
            </em>
          );
        }

        // Segmentos fuera de asteriscos (diálogos por defecto)
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════
interface MessageBubbleProps {
  message: Message;
  avatar: Avatar;
  isLast?: boolean;
  isLastUser?: boolean;
  onEdit?: (content: string) => void;
  onRegenerate?: () => void;
  onRetry?: (content: string, isAlreadyInDb?: boolean) => void;
  sending?: boolean;
  isPremium?: boolean;
  novelMode?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function MessageBubble({ 
  message, 
  avatar,
  isLast = false,
  isLastUser = false,
  onEdit,
  onRegenerate,
  onRetry,
  sending = false,
  isPremium = false,
  novelMode = false,
}: MessageBubbleProps) {
  const isAvatar = message.role === 'avatar';
  const [isPlaying, setIsPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showThought, setShowThought] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Resolver estilo de emoción
  const emotionStyle = message.emotion_tag
    ? (EMOTION_STYLES[message.emotion_tag] || EMOTION_STYLES['Neutral'])
    : null;

  // Precargar las voces del navegador al montar el componente
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    
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
      .replace(/\*[^*]+\*/g, '')
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || text;
  };

  const runLocalSynthesis = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      
      const cleanedText = cleanTextForTTS(message.content);
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      
      const gender = avatar.voice_settings?.gender || 'female';
      if (gender === 'male') {
        utterance.pitch = 0.9;
      } else {
        utterance.pitch = 1.1;
      }
      
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
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: message.content,
            gender: avatar.voice_settings?.gender || 'female',
            elevenLabsVoiceId: avatar.voice_settings?.elevenlabs_voice_id,
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || 'Fallo en la API de TTS');
        }

        if (data.source === 'hybrid-audiobook') {
          console.log(
            '%c[TTS Engine] 📚 Reproduciendo en MODO AUDIOLIBRO HÍBRIDO (Narrador: Google Cloud 🟢 | Personaje: ElevenLabs 👑)', 
            'color: #0284c7; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #f0f9ff; border-radius: 4px;'
          );
        } else if (data.source === 'elevenlabs-premium') {
          console.log(
            '%c[TTS Engine] 👑 Reproduciendo voz ULTRA-REALISTA de ElevenLabs con emociones (%s)', 
            'color: #7c3aed; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #f5f3ff; border-radius: 4px;',
            avatar.voice_settings?.gender === 'male' ? 'Adam (Hombre Premium)' : 'Bella (Mujer Premium)'
          );
        } else if (data.source === 'google-cloud-premium') {
          console.log(
            '%c[TTS Engine] 🟢 Reproduciendo voz PREMIUM de Google Cloud oficial (%s)', 
            'color: #059669; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #ecfdf5; border-radius: 4px;',
            avatar.voice_settings?.gender === 'male' ? 'es-US-Neural2-B (Hombre Latino)' : 'es-US-Neural2-A (Mujer Latina A)'
          );
          if (data.elevenLabsError) {
            console.warn(
              '%c[TTS Engine] ⚠️ ElevenLabs falló y se usó Google Cloud como fallback. Detalle: "' + data.elevenLabsError + '"',
              'color: #d97706; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #fffbeb; border-radius: 4px;'
            );
          }
        } else if (data.source === 'google-translate-fallback-billing-error') {
          console.warn(
            '%c[TTS Engine] ⚠️ Tu API Key falló. Detalle: "' + (data.errorDetails || 'Error desconocido') + '". Usando Fallback de Google Translate gratis (%s)',
            'color: #d97706; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #fffbeb; border-radius: 4px;',
            avatar.voice_settings?.gender === 'male' ? 'es-US (Latino)' : 'es-MX (México)'
          );
        } else {
          console.log(
            '%c[TTS Engine] 🔵 Reproduciendo voz de Google Translate Gratis (%s)',
            'color: #2563eb; font-weight: bold; font-size: 11px; padding: 2px 6px; background-color: #eff6ff; border-radius: 4px;',
            avatar.voice_settings?.gender === 'male' ? 'es-US (Latino)' : 'es-MX (México)'
          );
        }

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

  // ── MODO NOVELA: contenedor de flujo continuo ──
  if (novelMode && isAvatar) {
    return (
      <div className={cn(
        "w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isLast && "mb-6"
      )}>
        {/* Nombre del avatar en modo novela */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-primary opacity-80">
            {avatar.name}
          </span>
          {emotionStyle && emotionStyle.label && (
            <span className="text-[11px] opacity-70" title={message.emotion_tag || ''}>
              {emotionStyle.label}
            </span>
          )}
          {/* Botones de acción en modo novela */}
          <div className="flex items-center gap-1 ml-auto">
            {isLast && onRegenerate && !sending && (
              <button
                onClick={onRegenerate}
                className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                title="Regenerar respuesta"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            <button 
              onClick={playAudio}
              className={cn(
                "p-1 rounded-full transition-colors",
                isPlaying ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-white/70 hover:text-white"
              )}
              title={isPlaying ? "Detener audio" : "Escuchar mensaje"}
            >
              {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3 h-3" />}
            </button>
            {isPremium && message.hidden_thought && (
              <button
                onClick={() => setShowThought(prev => !prev)}
                className={cn(
                  "p-1 rounded-full transition-colors text-violet-400 hover:bg-violet-400/10",
                  showThought && "bg-violet-400/20"
                )}
                title="Ver pensamiento oculto"
              >
                <Brain className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Pensamiento oculto (blur efecto) */}
        {isPremium && message.hidden_thought && (
          <div className={cn(
            "mb-2 px-3 py-1.5 rounded-lg border border-violet-400/20 bg-violet-950/20 text-violet-200/80 text-[11px] italic leading-relaxed transition-all duration-500",
            showThought ? "blur-none opacity-100" : "blur-sm opacity-50 select-none pointer-events-none"
          )}>
            <span className="text-violet-400 not-italic font-semibold text-[9px] uppercase tracking-wider mr-2">Piensa:</span>
            {message.hidden_thought}
          </div>
        )}

        {/* Texto en modo novela: flujo continuo */}
        <p className="text-sm md:text-base leading-relaxed md:leading-loose font-serif text-white/90 whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere]">
          <NovelRenderer text={message.content} />
        </p>

        <span className="block mt-1 text-[9px] opacity-40">
          {mounted ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>
    );
  }

  // ── MODO BURBUJA (por defecto) ──
  return (
    <div className={cn(
      "flex w-full mb-1.5 md:mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300",
      isAvatar ? "justify-start" : "justify-end"
    )}>
      <div className={cn(
        "max-w-[97%] md:max-w-[80%] rounded-xl md:rounded-2xl px-2.5 py-1.5 md:px-6 md:py-4 shadow-lg transition-all",
        isAvatar 
          ? cn(
              "bg-white/5 border rounded-tl-none",
              // Color de borde dinámico según emoción
              emotionStyle ? emotionStyle.border : "border-white/10",
              emotionStyle?.glow ? `shadow-md ${emotionStyle.glow}` : ""
            )
          : "premium-button text-primary-foreground rounded-tr-none"
      )}>
        {isAvatar && (
          <div className="flex items-center justify-between mb-1 md:mb-2 gap-2 md:gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-primary">{avatar.name}</span>
              {/* Indicador de emoción */}
              {emotionStyle && emotionStyle.label && (
                <span className="text-[11px] opacity-80" title={message.emotion_tag || ''}>
                  {emotionStyle.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-1.5">
              {isLast && onRegenerate && !sending && (
                <button
                  onClick={onRegenerate}
                  className="p-1 md:p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Regenerar respuesta"
                >
                  <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5" />
                </button>
              )}
              {/* Botón de pensamiento oculto: siempre visible para Premium en mensajes del avatar */}
              {isPremium && isAvatar && (
                <button
                  onClick={() => message.hidden_thought && setShowThought(prev => !prev)}
                  className={cn(
                    "p-1 md:p-1.5 rounded-full transition-all duration-300",
                    message.hidden_thought
                      ? showThought
                        ? "text-violet-400 bg-violet-400/20 shadow-sm shadow-violet-400/30"
                        : "text-violet-400 hover:bg-violet-400/10"
                      : "text-white/20 cursor-default" // dimmed si no hay thought aún
                  )}
                  title={
                    message.hidden_thought
                      ? showThought ? "Ocultar pensamiento" : "Revelar pensamiento interno"
                      : "Pensamiento interno no disponible en este mensaje"
                  }
                >
                  {showThought && message.hidden_thought
                    ? <EyeOff className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    : <Brain className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  }
                </button>
              )}
              <button 
                onClick={playAudio}
                className={cn(
                  "p-1 md:p-1.5 rounded-full transition-colors",
                  isPlaying ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-white/70 hover:text-white"
                )}
                title={isPlaying ? "Detener audio" : "Escuchar mensaje"}
              >
                {isPlaying ? <Square className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current" /> : <Volume2 className="w-3 h-3 md:w-3.5 md:h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Panel de pensamiento oculto con blur animado */}
        {isAvatar && isPremium && message.hidden_thought && (
          <div className={cn(
            "mb-2 md:mb-3 px-2.5 py-2 rounded-lg border border-violet-400/25 bg-violet-950/20 text-violet-200/80 text-[10px] md:text-[11px] italic leading-relaxed transition-all duration-500 overflow-y-auto max-h-56 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']",
            showThought 
              ? "blur-none opacity-100" 
              : "blur-sm opacity-40 select-none pointer-events-none"
          )}>
            <span className="text-violet-400 not-italic font-semibold text-[8px] md:text-[9px] uppercase tracking-wider mr-1.5 block mb-0.5">
              💭 Piensa internamente:
            </span>
            {message.hidden_thought}
          </div>
        )}
        
        <p className={cn(
          "text-xs md:text-sm leading-normal md:leading-relaxed whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere]",
          isLast && isAvatar && "animate-in fade-in duration-700"
        )}>
          {/* Renderizar *acciones* en cursiva SIEMPRE en mensajes del avatar */}
          {isAvatar ? <NovelRenderer text={message.content} /> : message.content}
        </p>
        
        <div className={cn(
          "flex items-center gap-2 md:gap-3 mt-1 md:mt-2 text-[9px] md:text-[10px]",
          !isAvatar ? "justify-end text-right" : "justify-between"
        )}>
          {!isAvatar && (
            <div className="flex items-center gap-1 md:gap-2 mr-auto">
              {isLastUser && onEdit && !sending && (
                <button
                  type="button"
                  onClick={() => onEdit?.(message.content)}
                  className="px-1 py-0.2 md:px-1.5 md:py-0.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-0.5 md:gap-1 text-[8px] md:text-[9px] uppercase tracking-wider border border-white/10"
                  title="Editar esta pregunta"
                >
                  <Edit3 className="w-2 h-2 md:w-2.5 md:h-2.5" />
                  <span>Editar</span>
                </button>
              )}
               {isLast && onRetry && !sending && (
                <button
                  type="button"
                  onClick={() => {
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message.id);
                    onRetry?.(message.content, isUuid);
                  }}
                  className="px-1 py-0.2 md:px-1.5 md:py-0.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-all flex items-center gap-0.5 md:gap-1 text-[8px] md:text-[9px] uppercase tracking-wider border border-white/10"
                  title="Reintentar respuesta de la IA"
                >
                  <RefreshCw className="w-2 h-2 md:w-2.5 md:h-2.5" />
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
