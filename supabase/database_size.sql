-- SQL Migration: Obtener tamaño de la base de datos para panel de administración
-- Crea una función segura (SECURITY DEFINER) para consultar el tamaño de la base de datos en bytes y formato legible

CREATE OR REPLACE FUNCTION get_database_size()
RETURNS TABLE (
  total_bytes bigint,
  total_pretty text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    pg_database_size(current_database()) as total_bytes,
    pg_size_pretty(pg_database_size(current_database())) as total_pretty;
$$;

-- Notificar recarga de caché de PostgREST
NOTIFY pgrst, 'reload schema';
