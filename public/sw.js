// Service Worker básico para cumplir los requisitos de PWA y posibilitar instalación fuera de línea
const CACHE_NAME = 'whisper-chatbot-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Respondemos directamente de la red para garantizar respuestas en tiempo real de chat y voz,
  // pero manteniendo la estructura de Service Worker necesaria para que sea instalable como App
  event.respondWith(fetch(event.request).catch(() => {
    // Aquí se puede manejar lógica de fallback sin conexión si se requiere en el futuro
  }));
});
