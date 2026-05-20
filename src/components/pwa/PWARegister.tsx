'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Registramos el sw.js en la raíz
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          console.log('%c[PWA System] 📱 Service Worker registrado con éxito', 'color: #0ea5e9; font-weight: bold;');
        })
        .catch((err) => {
          console.error('[PWA System] ❌ Error al registrar el Service Worker:', err);
        });
    }
  }, []);

  return null; // Este componente solo tiene efectos colaterales en cliente, no renderiza nada
}
