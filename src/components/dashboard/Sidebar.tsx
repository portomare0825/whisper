'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, CreditCard, Settings, LogOut, PlusCircle, Menu, X, ShieldCheck, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';

function playSynthBell() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6
    osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.8);
    osc2.stop(ctx.currentTime + 0.8);
  } catch (e) {
    // Falla silenciosa si está bloqueado por políticas de autoplay
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const isChatDetailRoute = pathname.startsWith('/dashboard/chats/') && pathname !== '/dashboard/chats';
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeToast, setActiveToast] = useState<{ id: string, name: string, image: string } | null>(null);
  const knownPendingIdsRef = useRef<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    let intervalId: any;

    async function checkAdminAndNotifications() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 1. Verificar privilegios del administrador para el panel y polling de moderación
          let userIsAdmin = false;
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('is_admin')
              .eq('id', user.id)
              .maybeSingle();
            
            userIsAdmin = !!profile?.is_admin;
            setIsAdmin(userIsAdmin);
          } catch (profileErr) {
            console.error('Error al consultar perfil de administrador:', profileErr);
          }

          // 2. Solicitar permisos e inscribir suscripción push para alertas en segundo plano para TODOS los usuarios (requerido para creadores regulares)
          try {
            if ('Notification' in window) {
              if (Notification.permission === 'default') {
                await Notification.requestPermission();
              }
              
              if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(async (registration) => {
                  try {
                    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                    if (!vapidPublicKey) {
                      console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY no encontrada en variables de entorno.');
                      return;
                    }

                    // Función auxiliar para convertir VAPID Key a Uint8Array
                    const urlBase64ToUint8Array = (base64String: string) => {
                      const padding = '='.repeat((4 - base64String.length % 4) % 4);
                      const base64 = (base64String + padding)
                        .replace(/\-/g, '+')
                        .replace(/_/g, '/');
                      const rawData = window.atob(base64);
                      const outputArray = new Uint8Array(rawData.length);
                      for (let i = 0; i < rawData.length; ++i) {
                        outputArray[i] = rawData.charCodeAt(i);
                      }
                      return outputArray;
                    };

                    const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

                    // Registrar suscripción en el navegador
                    const subscription = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: convertedKey
                    });

                    // Guardar suscripción push en la base de datos de Supabase
                    await fetch('/api/notifications/subscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ subscription })
                    });
                  } catch (err) {
                    console.warn('Suscripción Web Push omitida o no soportada en este entorno:', err);
                  }
                });
              }
            }
          } catch (notifErr) {
            console.warn('Error al solicitar permisos de notificación:', notifErr);
          }

          if (userIsAdmin) {
            const checkPending = async (isInitial = false) => {
              try {
                const res = await fetch('/api/avatars/pending');
                if (res.status === 401 || res.status === 403) {
                  if (intervalId) {
                    clearInterval(intervalId);
                  }
                  return;
                }
                if (!res.ok) return;
                const data = await res.json();
                
                if (data && data.avatars) {
                  const currentPending = data.avatars;
                  setPendingCount(currentPending.length);
                  
                  const currentIds = currentPending.map((a: any) => a.id);

                  if (!isInitial) {
                    // Detectar nuevos avatares que no estaban en la referencia previa
                    const newAvatars = currentPending.filter(
                      (a: any) => !knownPendingIdsRef.current.includes(a.id)
                    );

                     if (newAvatars.length > 0) {
                      newAvatars.forEach(async (avatar: any) => {
                        // 1. Activar Toast visual in-app de primer nivel en primer plano
                        setActiveToast({
                          id: avatar.id,
                          name: avatar.name,
                          image: avatar.current_image_url || avatar.base_image_url || '/icon-192.png'
                        });

                        // 2. Reproducir tono sintetizado y vibración táctil
                        playSynthBell();
                        if ('vibrate' in navigator) {
                          navigator.vibrate([80, 50, 80]);
                        }

                        // 3. Programar ocultamiento automático del Toast tras 6 segundos
                        setTimeout(() => {
                          setActiveToast(null);
                        }, 6000);

                        // 4. Intentar enviar la notificación Push del sistema (Navegador/OS)
                        if ('Notification' in window && Notification.permission === 'granted') {
                          if ('serviceWorker' in navigator) {
                            try {
                              const registration = await navigator.serviceWorker.ready;
                              registration.showNotification('Avatar Pendiente de Aprobación ⚖️', {
                                body: `El avatar "${avatar.name}" requiere revisión administrativa.`,
                                icon: avatar.current_image_url || avatar.base_image_url || '/icon-192.png',
                                badge: '/icon-192.png',
                                tag: avatar.id,
                                data: { url: '/dashboard/moderation' }
                              });
                              return;
                            } catch (swErr) {
                              console.error('Error enviando notificación mediante Service Worker:', swErr);
                            }
                          }

                          // Fallback tradicional para navegadores de escritorio
                          const notification = new Notification('Avatar Pendiente de Aprobación ⚖️', {
                            body: `El avatar "${avatar.name}" requiere revisión administrativa.`,
                            icon: avatar.current_image_url || avatar.base_image_url || '/icon-192.png',
                            tag: avatar.id
                          });
                          notification.onclick = () => {
                            window.focus();
                            window.location.href = '/dashboard/moderation';
                          };
                        }
                      });
                    }
                  }
                  
                  knownPendingIdsRef.current = currentIds;
                }
              } catch (e) {
                console.error('Error al consultar avatares pendientes en Sidebar:', e);
              }
            };

            // Ejecución inicial silenciosa para registrar los IDs actuales
            await checkPending(true);

            // Sondeo periódico cada 15 segundos para detectar nuevos ingresos
            intervalId = setInterval(() => {
              checkPending(false);
            }, 15000);
          }
        }
      } catch (err) {
        console.error('Error checking admin status in Sidebar:', err);
      }
    }

    checkAdminAndNotifications();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const items = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: MessageSquare, label: 'Chats', href: '/dashboard/chats' },
    ...(isAdmin ? [
      { icon: ShieldCheck, label: 'Moderación', href: '/dashboard/moderation' },
      { icon: BarChart3, label: 'Panel Admin', href: '/admin' }
    ] : []),
    { icon: CreditCard, label: 'Suscripción', href: '/dashboard/billing' },
    { icon: Settings, label: 'Ajustes', href: '/dashboard/settings' },
  ];

  // Cerrar el sidebar al cambiar de ruta
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpen(false);
  }, [pathname]);

  // Bloquear scroll de fondo en móviles cuando el menú está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Botón Hamburger / Top Navbar en Móvil */}
      <header className="fixed top-0 left-0 right-0 h-16 glass-morphism border-b border-white/5 flex items-center justify-between px-6 z-40 md:hidden">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
          <h2 className="text-xl font-bold gold-gradient tracking-tight">Whisper</h2>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Abrir menú"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Backdrop en Móvil */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 h-screen glass-morphism border-r border-white/5 flex flex-col p-4 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-8 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="Logo" className="w-10 h-10 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.5)]" />
            <h2 className="text-2xl font-bold gold-gradient tracking-tight">Whisper</h2>
          </div>
          {/* Botón para cerrar en móvil */}
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors md:hidden cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group border border-transparent",
                pathname === item.href
                  ? "bg-primary/10 text-primary border border-primary/25"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-primary" : "group-hover:text-primary transition-colors")} />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.label === 'Moderación' && pendingCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-primary text-black shadow-[0_0_12px_rgba(212,175,55,0.6)] border border-primary/50 animate-pulse">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="pt-4 mt-4 border-t border-white/5">
          <Link
            href="/dashboard/avatars/new"
            className="premium-button w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold mb-4"
          >
            <PlusCircle className="w-5 h-5" />
            Nuevo Avatar
          </Link>

          <LogoutButton />
        </div>
      </aside>

      {/* Toast Flotante In-App Premium para Moderación */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-[calc(100%-2rem)] sm:w-96 glass-morphism border border-primary/45 rounded-2xl p-4 shadow-[0_10px_45px_rgba(212,175,55,0.3)] animate-in fade-in slide-in-from-bottom-5 duration-300 flex gap-4 items-center backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
            <img src={activeToast.image} alt={activeToast.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-primary font-bold uppercase tracking-widest leading-none">Moderación Requerida ⚖️</p>
            <h4 className="text-sm font-bold text-white truncate mt-1 leading-none">{activeToast.name}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-tight">Requiere aprobación para ser público.</p>
          </div>
          <button 
            onClick={() => {
              window.location.href = '/dashboard/moderation';
              setActiveToast(null);
            }}
            className="px-3 py-2 bg-primary text-black font-bold text-xs rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_12px_rgba(212,175,55,0.45)] cursor-pointer"
          >
            Revisar
          </button>
        </div>
      )}
      {/* Barra de Navegación Inferior para Móvil (Opción 2) */}
      {!isChatDetailRoute && (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#020617]/95 backdrop-blur-md border-t border-white/5 flex justify-around items-center px-4 z-40 md:hidden pb-safe">
          {/* Item 1: Dashboard */}
          <Link
            href="/dashboard"
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 transition-all",
              pathname === '/dashboard' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-1">Inicio</span>
          </Link>

          {/* Item 2: Chats */}
          <Link
            href="/dashboard/chats"
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 transition-all",
              pathname === '/dashboard/chats' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-1">Chats</span>
          </Link>

          {/* Item 3: Botón de Acción Central (Nuevo Avatar) */}
          <Link
            href="/dashboard/avatars/new"
            className="flex flex-col items-center justify-center w-14 h-14 bg-gradient-to-tr from-amber-500 to-yellow-400 text-black rounded-full -translate-y-4 shadow-lg shadow-amber-500/30 border-4 border-[#020617] active:scale-95 transition-all"
            aria-label="Nuevo Avatar"
          >
            <PlusCircle className="w-6 h-6" />
          </Link>

          {/* Item 4: Suscripción */}
          <Link
            href="/dashboard/billing"
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 transition-all",
              pathname === '/dashboard/billing' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-1">VIP</span>
          </Link>

          {/* Item 5: Ajustes */}
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 transition-all",
              pathname === '/dashboard/settings' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-1">Ajustes</span>
          </Link>
        </nav>
      )}
    </>
  );
}

function LogoutButton() {
  const handleLogout = async () => {
    try {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <button
      onClick={handleLogout}
      id="logout-button"
      className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-destructive hover:bg-destructive/10 transition-all font-medium group cursor-pointer"
    >
      <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200" />
      Cerrar Sesión
    </button>
  );
}
