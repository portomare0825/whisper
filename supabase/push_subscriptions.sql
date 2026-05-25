-- 1. Crear la tabla para almacenar las suscripciones push de los usuarios
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subscription) -- Evita duplicados idénticos por dispositivo
);

-- 2. Habilitar seguridad de nivel de fila (RLS) en la tabla push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS para push_subscriptions
DROP POLICY IF EXISTS "Permitir guardar propias suscripciones" ON public.push_subscriptions;
CREATE POLICY "Permitir guardar propias suscripciones" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Permitir leer propias suscripciones" ON public.push_subscriptions;
CREATE POLICY "Permitir leer propias suscripciones" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Permitir borrar propias suscripciones" ON public.push_subscriptions;
CREATE POLICY "Permitir borrar propias suscripciones" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Asegurar índices para mejorar el rendimiento de las consultas por administrador
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
