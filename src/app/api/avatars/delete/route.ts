import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { avatar_id } = await req.json();
    if (!avatar_id) {
      return NextResponse.json({ error: 'Falta el ID del avatar' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtener detalles del avatar antes de borrarlo
    const { data: avatar, error: fetchError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (fetchError || !avatar) {
      return NextResponse.json({ error: 'Avatar no encontrado o ya eliminado' }, { status: 404 });
    }

    // 2. Extraer las rutas de las imágenes en Supabase Storage
    const pathsToDelete: string[] = [];
    const extractPath = (url: string) => {
      if (!url) return null;
      // El formato típico es: https://[project_id].supabase.co/storage/v1/object/public/avatars/path/to/image.png
      const parts = url.split('/avatars/');
      if (parts.length > 1) {
        return decodeURIComponent(parts[1].split('?')[0]); // Quitar posibles query params
      }
      return null;
    };

    const basePath = extractPath(avatar.base_image_url);
    if (basePath) pathsToDelete.push(basePath);

    const currentPath = extractPath(avatar.current_image_url);
    if (currentPath && currentPath !== basePath) {
      pathsToDelete.push(currentPath);
    }

    // 3. Borrar los archivos de Supabase Storage con el Service Role (omitiendo RLS)
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('avatars')
        .remove(pathsToDelete);
      
      if (storageError) {
        console.error('Error al borrar imágenes de storage:', storageError);
      } else {
        console.log('Imágenes de storage borradas con éxito:', pathsToDelete);
      }
    }

    // 4. Borrar el avatar de la base de datos (y por CASCADE se borran conversaciones y mensajes)
    const { error: deleteError } = await supabase
      .from('avatars')
      .delete()
      .eq('id', avatar_id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error completo en /api/avatars/delete:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
