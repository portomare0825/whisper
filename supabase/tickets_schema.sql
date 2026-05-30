-- Crear la tabla de tickets para canjes promocionales (Pases Diarios o Monedas)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('daily_pass', 'coins')),
  value INTEGER DEFAULT 1, -- Para 'daily_pass', representa los días; para 'coins', representa la cantidad de monedas
  price_label VARCHAR(30) DEFAULT '$3 USD', -- Costo visible en la tarjeta del ticket
  is_used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Habilitar RLS (Row Level Security) para proteger el acceso directo
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Nota: No se definen políticas SELECT o UPDATE públicas para los usuarios comunes.
-- De esta forma se previene que usuarios maliciosos puedan hacer barridos o scans
-- de códigos de tickets desde el cliente a través de Supabase REST API.
-- Todo canje se realizará a través de endpoints seguros del backend con privilegios Service Role.

NOTIFY pgrst, 'reload schema';
