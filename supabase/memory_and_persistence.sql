-- 1. Habilitar la extensión vector en el esquema público
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Modificar la tabla conversations para añadir la columna de hechos clave (JSONB)
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS key_facts JSONB DEFAULT '{}'::jsonb;

-- 3. Crear la tabla de hitos (milestones)
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID REFERENCES public.avatars(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en milestones
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Crear políticas de RLS para milestones
DROP POLICY IF EXISTS "Permitir select de hitos propios" ON public.milestones;
CREATE POLICY "Permitir select de hitos propios" ON public.milestones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Crear la tabla de recuerdos semánticos (semantic_memories) para RAG vectorial
-- Usamos 768 dimensiones para el modelo text-embedding-004 de Google Gemini
CREATE TABLE IF NOT EXISTS public.semantic_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID REFERENCES public.avatars(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en semantic_memories
ALTER TABLE public.semantic_memories ENABLE ROW LEVEL SECURITY;

-- Crear políticas de RLS para semantic_memories
DROP POLICY IF EXISTS "Permitir select de memorias propias" ON public.semantic_memories;
CREATE POLICY "Permitir select de memorias propias" ON public.semantic_memories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Crear un índice compuesto para agilizar las búsquedas vectoriales por conversación
CREATE INDEX IF NOT EXISTS semantic_memories_embedding_idx 
  ON public.semantic_memories 
  USING hnsw (embedding vector_cosine_ops);

-- 5. Crear la función RPC para búsqueda de similitud vectorial
CREATE OR REPLACE FUNCTION public.match_semantic_memories(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  conversation_id_param UUID
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER -- bypass RLS para uso seguro en backend
AS $$
BEGIN
  RETURN QUERY
  SELECT
    semantic_memories.id,
    semantic_memories.content,
    1 - (semantic_memories.embedding <=> query_embedding) AS similarity
  FROM public.semantic_memories
  WHERE semantic_memories.conversation_id = conversation_id_param
    AND 1 - (semantic_memories.embedding <=> query_embedding) > match_threshold
  ORDER BY semantic_memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Notificar recarga de caché de PostgREST
NOTIFY pgrst, 'reload schema';
