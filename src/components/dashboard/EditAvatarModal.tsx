'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Sparkles, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { compressAvatarImage } from '@/lib/image-utils';

interface EditAvatarModalProps {
  avatar: any;
  onClose: () => void;
  onUpdate: (updatedAvatar: any) => void;
}

export default function EditAvatarModal({ avatar, onClose, onUpdate }: EditAvatarModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(avatar.base_image_url || null);
  const [file, setFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: avatar.name || '',
    personality: avatar.personality || '',
    system_prompt: avatar.system_prompt || '',
    gender: avatar.gender || 'female',
    physical_description: avatar.physical_description || '',
    visibility: avatar.visibility || 'private',
    face_box_x: avatar.face_box_x ?? 198,
    face_box_y: avatar.face_box_y ?? 120,
    face_box_width: avatar.face_box_width ?? 180,
    face_box_height: avatar.face_box_height ?? 240,
  });

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
      setError(null);
      const compressed = await compressAvatarImage(selectedFile);
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));

      setAnalyzingImage(true);
      try {
        const base64 = await fileToBase64(compressed);
        const response = await fetch('/api/avatars/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: compressed.type }),
        });

        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            physical_description: data.physical_description || data.description || prev.physical_description,
            face_box_x: data.face_box_x !== undefined ? data.face_box_x : prev.face_box_x,
            face_box_y: data.face_box_y !== undefined ? data.face_box_y : prev.face_box_y,
            face_box_width: data.face_box_width !== undefined ? data.face_box_width : prev.face_box_width,
            face_box_height: data.face_box_height !== undefined ? data.face_box_height : prev.face_box_height,
          }));
        }
      } catch (analyzeErr) {
        console.error('Error al analizar la imagen:', analyzeErr);
      } finally {
        setAnalyzingImage(false);
      }
    } catch (err) {
      setError('Error al procesar la imagen.');
    }
  };

  const [userCoins, setUserCoins] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('coins, is_admin').eq('id', user.id).maybeSingle();
        if (profile) {
          setUserCoins(profile.coins || 0);
          setIsAdmin(!!profile.is_admin);
        }
      }
    };
    loadProfile();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.personality) {
      setError('El nombre y personalidad son obligatorios.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      let imageUrl = avatar.base_image_url;
      const isImageChanged = !!file;

      if (file) {
        // Upload new image
        const fileExt = file.name.split('.').pop();
        const fileName = `${avatar.id}-${Math.random()}.${fileExt}`;
        const filePath = `${avatar.user_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        imageUrl = publicUrl;
      }

      const updatedData: any = {
        name: formData.name,
        personality: formData.personality,
        system_prompt: formData.system_prompt,
        gender: formData.gender,
        physical_description: formData.physical_description,
        face_box_x: formData.face_box_x,
        face_box_y: formData.face_box_y,
        face_box_width: formData.face_box_width,
        face_box_height: formData.face_box_height,
        visibility: formData.visibility,
        moderation_status: formData.visibility === 'private' ? 'none' : (isAdmin ? 'approved' : 'pending'),
      };

      if (isImageChanged) {
        updatedData.base_image_url = imageUrl;
        updatedData.current_image_url = imageUrl;
      }

      const { data, error: updateError } = await supabase
        .from('avatars')
        .update(updatedData)
        .eq('id', avatar.id)
        .select()
        .single();

      if (updateError) throw updateError;

      if (isImageChanged) {        
        // Disparar generación de ángulos y esperar
        try {
          await fetch('/api/avatars/generate-angles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarId: avatar.id })
          });
        } catch (err) {
          console.error('Error generando ángulos:', err);
        }
      }

      // Disparar notificación push de moderación en segundo plano (si requiere revisión)
      if (formData.visibility === 'public' && !isAdmin && data) {
        fetch('/api/avatars/notify-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: data.id })
        }).catch(err => console.error('Error disparando notificación push:', err));
      }
      
      onUpdate(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.');
    } finally {
      setLoading(false);
    }
  };

  // Prevenir scroll en el body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col relative animate-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="sticky top-0 z-10 flex justify-between items-center p-6 bg-background/80 backdrop-blur-md border-b border-white/5">
          <div>
            <h2 className="text-2xl font-bold gold-gradient">Editar Avatar</h2>
            <p className="text-sm text-muted-foreground">Actualiza la apariencia y personalidad de {avatar.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Modal */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
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
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                )}
              </div>
              
              {file && !isAdmin && (
                <div className="bg-primary/10 border border-primary/20 text-primary text-xs p-3 rounded-xl mt-3">
                  Has seleccionado una nueva foto. El sistema sincronizará todas las expresiones automáticamente. <strong>¡Esta actualización es gratuita!</strong>
                </div>
              )}
              {file && isAdmin && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs p-3 rounded-xl mt-3">
                  Has seleccionado una nueva foto. <strong>¡Modo Admin: Generación Gratuita!</strong>
                </div>
              )}
            </div>

            {/* Text Fields */}
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Nombre del Avatar</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="Ej: Elena"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Género del Avatar (Voz)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, gender: 'female'})}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${formData.gender === 'female' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    Femenino 👩‍💼
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, gender: 'male'})}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${formData.gender === 'male' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    Masculino 👨‍💼
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Privacidad del Avatar</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, visibility: 'private'})}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${formData.visibility === 'private' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    Privado 🔒
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, visibility: 'public'})}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${formData.visibility === 'public' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    Público 🌐
                  </button>
                </div>
                {formData.visibility === 'public' && (
                  <p className="text-[10px] text-primary animate-pulse font-semibold mt-1">
                    ✨ Nota: Al hacerlo público, pasará a revisión de un moderador antes de ser visible para toda la comunidad.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Personalidad y Rasgos</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-20 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="Ej: Sarcástica, amante de la literatura clásica..."
                  value={formData.personality}
                  onChange={(e) => setFormData({...formData, personality: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                  <span>Descripción Física</span>
                  {analyzingImage && (
                    <span className="text-xs text-primary animate-pulse flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" /> Analizando...
                    </span>
                  )}
                </label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-24 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="Ej: Chica de 25 años, esbelta, delgada..."
                  value={formData.physical_description}
                  onChange={(e) => setFormData({...formData, physical_description: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Instrucciones de Comportamiento (System Prompt)</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-24 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              placeholder="Instrucciones específicas sobre cómo debe actuar..."
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
        </form>

        {/* Footer Modal */}
        <div className="sticky bottom-0 p-6 bg-background/80 backdrop-blur-md border-t border-white/5 flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || analyzingImage}
            className="premium-button px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-spin" /> Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-5 h-5" /> Guardar Cambios
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
