'use client';

import React, { useState } from 'react';
import { ESTILOS_PREMIUM, EstiloPremium } from '@/lib/constants/catalog';
import { Sparkles, Check, Loader2 } from 'lucide-react';

interface PremiumPoseSelectorProps {
  conversationId: string;
  avatarId: string;
  userCoins: number;
  onSuccess: (generationId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function PremiumPoseSelector({
  conversationId,
  avatarId,
  userCoins,
  onSuccess,
  onError,
  onCancel
}: PremiumPoseSelectorProps) {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [complexion, setComplexion] = useState<string>('promedio');
  const [isGenerating, setIsGenerating] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const PREMIUM_COST = 15;

  const handleGenerate = async () => {
    setErrorMsg(null);
    if (!selectedStyle) return;
    if (userCoins < PREMIUM_COST) {
      setErrorMsg(`No tienes suficientes monedas. Esta acción requiere ${PREMIUM_COST} 🪙.`);
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/outfit/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          avatar_id: avatarId,
          action: 'pose_change',
          premium_style_id: selectedStyle,
          complexion: complexion,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar la pose premium.');
      }

      onSuccess(data.generation_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de red.');
      onError(err.message || 'Error de red.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      
      {/* Selector de Complexión */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-white/80 uppercase tracking-wider ml-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Silueta / Complexión
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'atletica', label: 'Atlética / Fit' },
            { id: 'promedio', label: 'Normal' },
            { id: 'curvilinea', label: 'Curvilínea' },
            { id: 'robusta', label: 'Plus Size / Curvy' }
          ].map(comp => (
            <button
              key={comp.id}
              onClick={() => setComplexion(comp.id)}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer text-xs font-semibold ${
                complexion === comp.id 
                  ? 'border-primary bg-primary/20 shadow-[0_0_15px_rgba(212,175,55,0.2)] text-white' 
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {comp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catálogo de Estilos */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-white/80 uppercase tracking-wider ml-1 flex items-center gap-2">
          📸 Catálogo Premium de Escenarios
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ESTILOS_PREMIUM.map((estilo: EstiloPremium) => (
            <div
              key={estilo.id}
              onClick={() => setSelectedStyle(estilo.id)}
              className={`relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-300 group ${
                selectedStyle === estilo.id 
                  ? 'border-primary shadow-[0_0_20px_rgba(212,175,55,0.4)] scale-[1.02]' 
                  : 'border-transparent hover:border-white/30 hover:scale-[1.01]'
              }`}
            >
              <img 
                src={estilo.miniatura} 
                alt={estilo.nombre}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
              
              {selectedStyle === estilo.id && (
                <div className="absolute top-3 right-3 bg-primary text-black rounded-full p-1 shadow-lg animate-in zoom-in">
                  <Check className="w-4 h-4" />
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white font-bold text-sm leading-tight drop-shadow-md">
                  {estilo.nombre}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-destructive/20 border border-destructive/50 rounded-xl p-3 text-center animate-pulse">
          <p className="text-sm font-semibold text-destructive-foreground">
            {errorMsg}
          </p>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button 
          onClick={onCancel}
          disabled={isGenerating}
          className="flex-1 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-colors text-sm font-semibold disabled:opacity-50"
        >
          Cancelar
        </button>
        <button 
          onClick={handleGenerate}
          disabled={!selectedStyle || isGenerating || userCoins < PREMIUM_COST}
          className="flex-1 premium-button bg-gradient-to-r from-amber-400 to-yellow-600 text-black py-3.5 rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 disabled:from-gray-600 disabled:to-gray-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Creando Magia...
            </>
          ) : (
            <>
              Generar Pose (-{PREMIUM_COST} 🪙)
            </>
          )}
        </button>
      </div>

    </div>
  );
}
