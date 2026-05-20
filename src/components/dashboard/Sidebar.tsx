'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, CreditCard, Settings, LogOut, PlusCircle, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: MessageSquare, label: 'Chats', href: '/dashboard/chats' },
  { icon: CreditCard, label: 'Suscripción', href: '/dashboard/billing' },
  { icon: Settings, label: 'Ajustes', href: '/dashboard/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Cerrar el sidebar al cambiar de ruta
  useEffect(() => {
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
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                pathname === item.href
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-primary" : "group-hover:text-primary transition-colors")} />
              <span className="font-medium">{item.label}</span>
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
