-- SQL Migration: Sistema de Contabilidad de Monedas y Suscripciones para el Administrador

-- 1. Crear tabla de transacciones de monedas para llevar un registro histórico exacto
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL, -- positivo para compras/créditos, negativo para usos/descuentos
  reason VARCHAR(255) DEFAULT 'System', -- 'purchase', 'outfit_change', 'pose_generation', 'signup_reward', 'system'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS para la tabla de transacciones
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- Crear política para que los usuarios puedan ver sus propias transacciones
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias transacciones" ON public.coin_transactions;
CREATE POLICY "Usuarios pueden ver sus propias transacciones" ON public.coin_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Modificar la función add_coins para registrar automáticamente cada transacción en el historial
CREATE OR REPLACE FUNCTION public.add_coins(
  user_id_param UUID, 
  amount INT, 
  reason_param VARCHAR DEFAULT 'System'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- bypass RLS
AS $$
DECLARE
  new_coins INTEGER;
BEGIN
  -- Registrar la transacción en el historial
  INSERT INTO public.coin_transactions (user_id, amount, reason)
  VALUES (user_id_param, amount, reason_param);

  -- Actualizar el balance de monedas en el perfil
  INSERT INTO public.profiles (id, coins)
  VALUES (user_id_param, GREATEST(0, amount))
  ON CONFLICT (id) DO UPDATE
  SET coins = GREATEST(0, public.profiles.coins + amount),
      updated_at = now()
  RETURNING coins INTO new_coins;

  RETURN new_coins;
END;
$$;

-- 3. Función RPC para obtener métricas financieras integradas optimizadas
CREATE OR REPLACE FUNCTION public.get_admin_financials()
RETURNS TABLE (
  total_coins_remaining bigint,
  total_coins_sold bigint,
  total_coins_used bigint,
  active_subscribers bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    (SELECT COALESCE(SUM(coins), 0)::bigint FROM public.profiles) as total_coins_remaining,
    (SELECT COALESCE(SUM(amount), 0)::bigint FROM public.coin_transactions WHERE amount > 0) as total_coins_sold,
    (SELECT COALESCE(ABS(SUM(amount)), 0)::bigint FROM public.coin_transactions WHERE amount < 0) as total_coins_used,
    (SELECT COALESCE(COUNT(DISTINCT user_id), 0)::bigint FROM public.subscriptions WHERE status = 'active' AND expires_at > now()) as active_subscribers;
$$;

-- Notificar recarga de caché de PostgREST
NOTIFY pgrst, 'reload schema';
