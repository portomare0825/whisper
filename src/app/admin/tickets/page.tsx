'use client';

import { useState, useEffect, useRef } from 'react';
import { Ticket, Sparkles, Loader2, ArrowLeft, Check, Copy, Share2, Star, ShieldAlert, Download } from 'lucide-react';
import Link from 'next/link';

export default function AdminTicketsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [tickets, setTickets] = useState<any[]>([]);

  // Formulario de creación
  const [type, setType] = useState<'daily_pass' | 'coins'>('daily_pass');
  const [value, setValue] = useState<number>(1);
  const [priceLabel, setPriceLabel] = useState<string>('$3 USD');
  const [expiresInDays, setExpiresInDays] = useState<number>(0);
  const [creating, setCreating] = useState<boolean>(false);

  // Estados visuales de canje y copia
  const [generatedTicket, setGeneratedTicket] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  
  const ticketRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  const handleDownloadTicketImage = async () => {
    if (!ticketRef.current || !generatedTicket) return;
    setDownloading(true);
    try {
      // Cargar html2canvas dinámicamente desde un CDN de alta velocidad
      if (!(window as any).html2canvas) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }
      
      const html2canvas = (window as any).html2canvas;
      
      // Capturar la tarjeta con alta fidelidad y CORS activado para imágenes externas (QR)
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: '#0f172a',
        scale: 2, // Resolucion premium
        useCORS: true,
        logging: false
      });
      
      // Descargar PNG
      const link = document.createElement('a');
      link.download = `ticket-${generatedTicket.code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error al generar la imagen del ticket:', err);
      alert('Error al generar la imagen. Por favor, realiza una captura de pantalla tradicional.');
    } finally {
      setDownloading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/admin/tickets');
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdmin(true);
        setTickets(data.tickets || []);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Error fetching admin tickets:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;

    setCreating(true);
    setGeneratedTicket(null);

    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          value: Number(value),
          price_label: priceLabel.trim(),
          expires_in_days: expiresInDays > 0 ? Number(expiresInDays) : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear el ticket');
      }

      setGeneratedTicket(data.ticket);
      // Auto-rellenar valores por defecto
      setPriceLabel(type === 'daily_pass' ? '$3 USD' : '$5 USD');
      fetchTickets(); // Recargar listado
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getRedeemLink = (code: string) => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return `${origin}/dashboard/billing?redeem=${code}`;
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = (code: string) => {
    navigator.clipboard.writeText(getRedeemLink(code));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Cargando panel de administración...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 glass-morphism rounded-3xl border border-red-500/20 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Acceso Denegado</h2>
          <p className="text-muted-foreground text-sm">
            Esta sección es exclusiva para administradores autorizados de AvatarChat.
          </p>
        </div>
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold border border-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-1 sm:px-0">
      <div className="space-y-10 max-w-7xl mx-auto p-3 sm:p-6 md:p-8">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Panel de <span className="gold-gradient">Tickets y Canjes</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 leading-normal">
            Genera boletos premium con códigos QR para canjes directos sin pasarela de pago.
          </p>
        </div>
        <Link 
          href="/dashboard"
          className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold border border-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Columna Izquierda: Formulario de Creación */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-morphism rounded-3xl p-4 sm:p-6 border border-white/10 space-y-5 sm:space-y-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Nuevo Boleto Promocional
            </h2>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Tipo de Canje</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as 'daily_pass' | 'coins';
                    setType(newType);
                    setPriceLabel(newType === 'daily_pass' ? '$3 USD' : '$5 USD');
                    setValue(newType === 'daily_pass' ? 1 : 50);
                  }}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-sm"
                >
                  <option value="daily_pass">Pase VIP Pro (Acceso ilimitado por días)</option>
                  <option value="coins">Recarga de Monedas</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {type === 'daily_pass' ? 'Días Pro' : 'Cantidad Monedas'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-white outline-none focus:border-primary/50 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Precio de Venta</label>
                  <input
                    type="text"
                    value={priceLabel}
                    onChange={(e) => setPriceLabel(e.target.value)}
                    placeholder="Ej: $3 USD o 3$ Pago Móvil"
                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-white outline-none focus:border-primary/50 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Expiración en Días (Opcional)</label>
                <input
                  type="number"
                  min="0"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  placeholder="0 para que nunca caduque"
                  className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Coloca 0 si quieres que el boleto no tenga fecha de vencimiento límite.</p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-4 bg-primary text-black font-black text-sm rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(212,175,55,0.15)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generar Ticket VIP'}
              </button>
            </form>
          </div>
        </div>

        {/* Columna Derecha: Previsualización del Ticket Visual */}
        <div className="lg:col-span-7 flex justify-center w-full px-1 sm:px-0 overflow-hidden">
          {generatedTicket ? (
            <div className="w-full max-w-sm sm:max-w-md space-y-6">
              {/* Tarjeta Visual Premium usando #0f172a como fondo principal */}
              <div 
                ref={ticketRef}
                className="relative overflow-hidden rounded-3xl p-5 sm:p-8 bg-[#0f172a] border-2 border-primary/40 shadow-[0_0_50px_rgba(212,175,55,0.12)] text-center text-white space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-300 w-full"
              >
                {/* Patrón de brillo de fondo */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.06),transparent_60%)] pointer-events-none" />

                {/* Sello de Autenticidad VIP */}
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-wider text-primary shadow-sm shadow-primary/10">
                  <Star className="w-2.5 h-2.5 fill-current animate-pulse" />
                  VIP AUTHENTIC
                </div>

                {/* Cabecera Tarjeta */}
                <div className="space-y-1.5 mt-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary leading-none">AVATARCHAT CLUB</span>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight break-words">
                    {generatedTicket.type === 'daily_pass' ? 'GOLDEN PASS VOUCHER' : 'COINS INJECT VOUCHER'}
                  </h3>
                  <p className="text-white/40 text-[10px] italic">Canjear escaneando el código QR</p>
                </div>

                {/* Valor Central */}
                <div className="py-3 sm:py-4 border-y border-white/5 space-y-1 bg-white/2 backdrop-blur-sm rounded-2xl border border-white/5 shadow-inner">
                  <p className="text-[10px] sm:text-xs text-white/50 font-bold uppercase tracking-wider">Beneficio Acreditado</p>
                  <p className="text-lg sm:text-2xl font-black text-white leading-tight break-words px-2">
                    {generatedTicket.type === 'daily_pass' 
                      ? `✨ Pase Pro: ${generatedTicket.value} Día(s)` 
                      : `🪙 Saldo: +${generatedTicket.value} Monedas`
                    }
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-primary mt-1">
                    VALOR: {generatedTicket.price_label}
                  </p>
                </div>

                {/* Código QR Dinámico (Renderizado Elegante) */}
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-xl w-36 h-36 sm:w-44 sm:h-44 mx-auto border-2 border-primary/30 relative">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=0f172a&data=${encodeURIComponent(getRedeemLink(generatedTicket.code))}`}
                    alt="QR Code Ticket"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Código Alfanumérico */}
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Código de Redención</p>
                  <span className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 border border-white/10 rounded-xl text-base sm:text-lg font-mono font-bold tracking-widest text-white shadow-inner uppercase break-all">
                    {generatedTicket.code}
                  </span>
                </div>

                <div className="text-[9px] text-white/30 font-medium">
                  {generatedTicket.expires_at 
                    ? `Válido hasta: ${new Date(generatedTicket.expires_at).toLocaleDateString()}` 
                    : 'Boleto de canje único ilimitado'
                  }
                </div>
              </div>

              {/* Botón de Descarga de Imagen Principal */}
              <button
                onClick={handleDownloadTicketImage}
                disabled={downloading}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {downloading ? 'Generando Imagen...' : 'Descargar Boleto como Imagen (PNG)'}
              </button>

              {/* Botones de acción del administrador */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCopyCode(generatedTicket.code)}
                  className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/70" />}
                  {copiedCode ? '¡Copiado!' : 'Copiar Código'}
                </button>
                <button
                  onClick={() => handleCopyLink(generatedTicket.code)}
                  className="py-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-primary/5"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  {copiedLink ? '¡Enlace Copiado!' : 'Copiar Link QR'}
                </button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground italic">
                💡 Tip: Envía el ticket capturando la tarjeta digital como imagen por WhatsApp, o simplemente copia y envía el **Link QR** directo para que el usuario canjee en 1 clic.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-sm sm:max-w-md min-h-[280px] sm:aspect-[3/4.2] glass-morphism rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-white/20 animate-pulse" />
              </div>
              <div className="px-2">
                <h4 className="text-white font-bold text-sm sm:text-base">Vista Previa del Ticket</h4>
                <p className="text-muted-foreground text-xs max-w-xs mt-1 leading-normal">
                  Completa el formulario de la izquierda y haz clic en "Generar Ticket VIP" para previsualizar y descargar tu boleto digital premium.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historial de Tickets Creados */}
      <div className="glass-morphism rounded-3xl p-4 sm:p-6 border border-white/10 space-y-6 w-full overflow-hidden">
        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          Historial de Tickets Generados
        </h2>

        {tickets.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Aún no se han generado tickets en el sistema.</p>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-white/80 border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Precio Impreso</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Utilizado Por</th>
                  <th className="py-3 px-4">Fecha Uso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors font-medium">
                    <td className="py-3 px-4 font-mono font-bold tracking-wider text-xs uppercase text-primary select-all">
                      {t.code}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {t.type === 'daily_pass' ? '🎟️ Pase VIP Pro' : '🪙 Monedas'}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold">
                      {t.type === 'daily_pass' ? `${t.value} día(s)` : `${t.value} monedas`}
                    </td>
                    <td className="py-3 px-4 text-xs text-primary font-bold">
                      {t.price_label}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        t.is_used 
                          ? "bg-red-500/10 border border-red-500/20 text-red-400" 
                          : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      }`}>
                        {t.is_used ? 'Canjeado' : 'Disponible'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-white/60">
                      {t.is_used && t.profiles ? t.profiles.email : '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-white/40">
                      {t.is_used ? new Date(t.used_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
