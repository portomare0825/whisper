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

// Manejador para el clic en notificaciones (soporta escritorio y móviles PWA)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // URL de redirección
  const targetUrl = event.notification.data?.url || '/dashboard/moderation';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Buscar si ya hay una pestaña del dashboard abierta para enfocarla y navegarla
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Si no hay pestañas abiertas, abrir una nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Manejador para recibir notificaciones Push nativas desde el servidor (incluso con la app cerrada)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Whisper ⚖️';
  const options = {
    body: data.body || 'Tienes una nueva alerta de moderación.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'moderation-alert',
    data: data.data || { url: '/dashboard/moderation' },
    vibrate: [100, 50, 100],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
