'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, CreditCard, Settings, LogOut, PlusCircle, Menu, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const knownPendingIdsRef = useRef<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    let intervalId: any;

    async function checkAdminAndNotifications() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .maybeSingle();
          
          const userIsAdmin = !!profile?.is_admin;
          setIsAdmin(userIsAdmin);

          if (userIsAdmin) {
            // Solicitar permisos de notificación nativa si no se han denegado
            if ('Notification' in window && Notification.permission === 'default') {
              await Notification.permission; // Resuelve de forma fluida
              Notification.requestPermission();
            }

            const checkPending = async (isInitial = false) => {
              try {
                const res = await fetch('/api/avatars/pending');
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
                      newAvatars.forEach((avatar: any) => {
                        if ('Notification' in window && Notification.permission === 'granted') {
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
    ...(isAdmin ? [{ icon: ShieldCheck, label: 'Moderación', href: '/dashboard/moderation' }] : []),
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
