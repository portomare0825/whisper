-- Agregar la columna roleplay_settings a la tabla avatars
ALTER TABLE avatars 
ADD COLUMN IF NOT EXISTS roleplay_settings JSONB DEFAULT '{"dificultad_conquista": 0.5, "apertura_inicial": 0.5, "velocidad_confianza": 0.5}'::jsonb;

-- Notificar a postgrest para recargar el esquema
NOTIFY pgrst, 'reload schema';
