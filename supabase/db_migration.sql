-- SQL Migration: Coins System and Profiles Table
-- Puedes copiar este script y pegarlo en el editor SQL de Supabase (https://supabase.com)

-- 1. Crear la tabla de perfiles de usuario para manejar monedas
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INTEGER DEFAULT 0 CHECK (coins >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar Seguridad de Nivel de Fila (RLS) en la tabla profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS
-- El usuario solo puede consultar (leer) su propio saldo de monedas
DROP POLICY IF EXISTS "Permitir lectura de perfiles propios" ON public.profiles;
CREATE POLICY "Permitir lectura de perfiles propios" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Nota: No se le otorga permiso de UPDATE ni INSERT directos a los usuarios
-- para evitar hackeos de saldo desde la consola web/frontend.
-- Las actualizaciones de monedas se hacen mediante la función RPC 'add_coins'
-- con privilegios SECURITY DEFINER, o mediante el rol de servicio en el backend.

-- 4. Crear función atómica (RPC) para agregar o descontar monedas de manera segura
CREATE OR REPLACE FUNCTION public.add_coins(user_id_param UUID, amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios del creador (bypass RLS)
AS $$
DECLARE
  new_coins INTEGER;
BEGIN
  -- Intentar insertar el perfil si no existe, o actualizar el saldo si ya existe
  INSERT INTO public.profiles (id, coins)
  VALUES (user_id_param, GREATEST(0, amount))
  ON CONFLICT (id) DO UPDATE
  SET coins = GREATEST(0, public.profiles.coins + amount),
      updated_at = now()
  RETURNING coins INTO new_coins;

  RETURN new_coins;
END;
$$;

-- 5. Crear trigger para inicializar perfiles con 0 monedas automáticamente al registrarse nuevos usuarios en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, coins)
  VALUES (new.id, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si ya existe para evitar errores
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear el trigger en auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Insertar perfiles para los usuarios existentes que no los tengan (migración preventiva)
INSERT INTO public.profiles (id, coins)
SELECT id, 0 FROM auth.users
ON CONFLICT (id) DO NOTHING;
