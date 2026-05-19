'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Sparkles, AlertCircle } from 'lucide-react';
import { compressAvatarImage } from '@/lib/image-utils';
import { createClient } from '@/lib/supabase';

export default function NewAvatarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    personality: '',
    system_prompt: '',
    gender: 'female', // default to female
    physical_description: '',
  });
  const [file, setFile] = useState<File | null>(null);

  // Convertir archivo a Base64 para análisis
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setLoading(true);
      setError(null);
      const compressed = await compressAvatarImage(selectedFile);
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));

      // Auto-analizar la foto con IA (Gemini 1.5 Flash)
      setAnalyzingImage(true);
      try {
        const base64 = await fileToBase64(compressed);
        const response = await fetch('/api/avatars/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: compressed.type,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.description) {
            setFormData(prev => ({
              ...prev,
              physical_description: data.description
            }));
          }
        } else {
          console.warn('Fallo en el endpoint de análisis de imagen');
        }
      } catch (analyzeErr) {
        console.error('Error al analizar la imagen:', analyzeErr);
      } finally {
        setAnalyzingImage(false);
      }
    } catch (err) {
      setError('Error al procesar la imagen. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !formData.name || !formData.personality) {
      setError('Por favor, rellena todos los campos y sube una imagen.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // 1. Subir imagen a Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // 2. Guardar en la base de datos
      const { error: dbError } = await supabase.from('avatars').insert({
        user_id: user.id,
        name: formData.name,
        personality: formData.personality,
        system_prompt: formData.system_prompt,
        physical_description: formData.physical_description,
        base_image_url: publicUrl,
        current_image_url: publicUrl,
        voice_settings: { gender: formData.gender }
      });

      if (dbError) throw dbError;

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error al crear el avatar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Crea tu <span className="gold-gradient">Avatar</span></h1>
        <p className="text-muted-foreground mt-2">Personaliza la inteligencia y el estilo de tu nuevo compañero.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-muted-foreground">Imagen Base</label>
            <div 
              className={`relative aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${!preview ? 'hover:border-primary/50' : ''}`}
            >
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="cursor-pointer bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-sm font-medium">
                      Cambiar Imagen
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                    </label>
                  </div>
                </>
              ) : (
                <label className="w-full h-full cursor-pointer flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Haz clic para subir</p>
                    <p className="text-xs text-muted-foreground mt-1">Sube la foto del rostro y cuerpo del avatar.</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          {/* Text Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nombre del Avatar</label>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="Ej: Elena"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Género del Avatar (Voz)</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, gender: 'female'})}
                  className={`py-3 rounded-xl font-medium border transition-all ${formData.gender === 'female' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                >
                  Femenino 👩‍💼
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, gender: 'male'})}
                  className={`py-3 rounded-xl font-medium border transition-all ${formData.gender === 'male' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                >
                  Masculino 👨‍💼
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Personalidad y Rasgos</label>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-20 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="Ej: Sarcástica, amante de la literatura clásica, un poco misteriosa..."
                value={formData.personality}
                onChange={(e) => setFormData({...formData, personality: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span>Descripción Física</span>
                {analyzingImage && (
                  <span className="text-xs text-primary animate-pulse flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" /> Analizando foto con IA...
                  </span>
                )}
              </label>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-24 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="Ej: Chica de 25 años, esbelta, delgada, estatura alta, cabello largo y oscuro..."
                value={formData.physical_description}
                onChange={(e) => setFormData({...formData, physical_description: e.target.value})}
              />
              <p className="text-[10px] text-muted-foreground/70">
                La IA analiza la imagen automáticamente, pero puedes agregar tus propios términos (ej. delgada, esbelta, flaca, alta, etc.).
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Instrucciones de Comportamiento (System Prompt)</label>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-24 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            placeholder="Instrucciones específicas sobre cómo debe actuar (sin restricciones)..."
            value={formData.system_prompt}
            onChange={(e) => setFormData({...formData, system_prompt: e.target.value})}
          />
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || analyzingImage}
          className="premium-button w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear Avatar Mágico'}
          <Sparkles className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
