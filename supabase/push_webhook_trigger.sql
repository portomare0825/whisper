-- 1. Habilitar la extensión pg_net (permite peticiones HTTP asíncronas desde PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Crear la función del Trigger que disparará el Webhook HTTP hacia Next.js
CREATE OR REPLACE FUNCTION public.notify_admin_on_pending_avatar()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  webhook_url TEXT;
  auth_header TEXT;
BEGIN
  -- >>> CONFIGURACIÓN DEL WEBHOOK <<<
  -- En entorno de desarrollo (localhost), reemplaza la URL por tu dominio público de ngrok o similar.
  -- En producción, coloca la URL real de tu sitio (ej. https://mi-sitio.com/api/avatars/notify-pending).
  webhook_url := 'https://[REEMPLAZAR_POR_TU_TUNE_DE_NGROK_O_DOMINIO]/api/avatars/notify-pending';
  
  -- Coloca exactamente la clave secreta que configuraste en tu archivo .env.local para WEBHOOK_SECRET_KEY
  auth_header := 'Bearer d7c92b51-7f91-49b0-8e12-4019bfb823e4';
  
  -- Verificar si el avatar pasa a ser público y requiere moderación
  -- (Trigger activado al INSERTAR un público pendiente, o al ACTUALIZAR a visibilidad pública y estado pendiente)
  IF (TG_OP = 'INSERT' AND NEW.visibility = 'public' AND NEW.moderation_status = 'pending') OR
     (TG_OP = 'UPDATE' AND NEW.visibility = 'public' AND NEW.moderation_status = 'pending' AND 
      (OLD.visibility != 'public' OR OLD.moderation_status != 'pending')) THEN
      
    -- Construir el cuerpo de la petición HTTP POST
    payload := jsonb_build_object('avatarId', NEW.id);
    
    -- Realizar la llamada HTTP POST asíncrona de forma posicional con 5 argumentos (firma nativa de pg_net en Supabase)
    PERFORM net.http_post(
      webhook_url,
      payload::text,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', auth_header
      ),
      2000 -- timeout_milliseconds (Requerido posicionalmente en esta firma)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger sobre la tabla avatars
DROP TRIGGER IF EXISTS trigger_notify_admin_on_pending ON public.avatars;
CREATE TRIGGER trigger_notify_admin_on_pending
  AFTER INSERT OR UPDATE ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_pending_avatar();
