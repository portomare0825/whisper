// Service Worker básico para cumplir los requisitos de PWA y posibilitar instalación fuera de línea
const CACHE_NAME = 'whisper-chatbot-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones HTTP/HTTPS (ignora extensiones del navegador, etc.)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Respondemos directamente de la red para garantizar respuestas en tiempo real de chat y voz,
  // pero retornando un fallback seguro en caso de error de red para evitar crashes en el navegador.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Sin conexión de red', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
      });
    })
  );
});
