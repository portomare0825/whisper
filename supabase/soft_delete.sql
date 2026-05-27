-- SQL Migration: Soft Delete para Avatares
-- Añade la columna deleted_at a la tabla avatars si no existe

ALTER TABLE public.avatars 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Notificar recarga de caché de PostgREST
NOTIFY pgrst, 'reload schema';
