'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, CreditCard, Settings, LogOut, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: MessageSquare, label: 'Chats', href: '/dashboard/chats' },
  { icon: CreditCard, label: 'Suscripción', href: '/dashboard/billing' },
  { icon: Settings, label: 'Ajustes', href: '/dashboard/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen glass-morphism border-r border-white/5 flex flex-col p-4 z-50">
      <div className="mb-8 px-4">
        <h2 className="text-2xl font-bold gold-gradient tracking-tight">AvatarChat Pro</h2>
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
      // Redirigir siempre al login, incluso si falla el signOut
      window.location.href = '/login';
    }
  };

  return (
    <button
      onClick={handleLogout}
      id="logout-button"
      className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-destructive hover:bg-destructive/10 transition-all font-medium group"
    >
      <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200" />
      Cerrar Sesión
    </button>
  );
}
