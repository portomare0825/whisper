-- SQL Migration: Ranuras de Avatares y Compra de Ranuras Extra

-- 1. Añadir columna extra_avatar_slots a la tabla profiles si no existe
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS extra_avatar_slots INTEGER DEFAULT 0;

-- 2. Crear una función RPC para comprar una ranura adicional por 30 monedas
CREATE OR REPLACE FUNCTION public.buy_avatar_slot(user_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- saltar RLS para actualizar perfiles de forma segura
AS $$
DECLARE
  current_coins INTEGER;
  new_slots INTEGER;
BEGIN
  -- 1. Obtener monedas actuales
  SELECT coins INTO current_coins FROM public.profiles WHERE id = user_id_param;
  
  IF current_coins IS NULL OR current_coins < 30 THEN
    RAISE EXCEPTION 'Saldo insuficiente. Comprar una ranura extra cuesta 30 monedas.';
  END IF;

  -- 2. Descontar las 30 monedas y registrar la transacción utilizando la función existente
  PERFORM public.add_coins(user_id_param, -30, 'buy_avatar_slot');

  -- 3. Incrementar el slot de avatar en el perfil
  UPDATE public.profiles
  SET extra_avatar_slots = COALESCE(extra_avatar_slots, 0) + 1,
      updated_at = now()
  WHERE id = user_id_param
  RETURNING extra_avatar_slots INTO new_slots;

  RETURN new_slots;
END;
$$;

-- Notificar recarga de PostgREST para actualizar el esquema de la API inmediatamente
NOTIFY pgrst, 'reload schema';
