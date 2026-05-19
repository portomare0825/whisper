import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- Tabla de avatares
CREATE TABLE IF NOT EXISTS avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  personality TEXT NOT NULL,
  system_prompt TEXT,
  base_image_url TEXT NOT NULL,
  current_image_url TEXT,
  voice_settings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID REFERENCES avatars(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Nueva conversación',
  current_avatar_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'avatar')),
  content TEXT NOT NULL,
  audio_url TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT CHECK (plan_type IN ('free', 'pro', 'pay_per_use')),
  stripe_customer_id TEXT,
  status TEXT CHECK (status IN ('active', 'canceled', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
`;

async function run() {
  console.log('Aplicando esquema SQL a:', supabaseUrl);
  
  // Nota: supabase-js no tiene un método directo para ejecutar SQL crudo de forma masiva 
  // fácilmente sin una función RPC. Lo mejor es que el usuario lo pegue en el SQL Editor.
  console.log('\n--- ATENCIÓN ---');
  console.log('Para una configuración segura y completa (incluyendo políticas RLS),');
  console.log('por favor copia el bloque SQL de mi respuesta anterior y pégalo');
  console.log('en el SQL Editor de tu Dashboard de Supabase.');
  console.log('----------------\n');
}

run();
