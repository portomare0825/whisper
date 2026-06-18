'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Upload, Sparkles, AlertCircle, Coins, Save } from 'lucide-react';
import { compressAvatarImage } from '@/lib/image-utils';
import { createClient } from '@/lib/supabase';

export default function EditAvatarPage() {
  const router = useRouter();
  const params = useParams();
  const avatarId = params.id as string;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [userCoins, setUserCoins] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    name: '',
    personality: '',
    system_prompt: '',
    gender: 'female',
    physical_description: '',
    visibility: 'private',
    face_box_x: 198,
    face_box_y: 120,
    face_box_width: 180,
    face_box_height: 240,
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [roleplaySettings, setRoleplaySettings] = useState({
    dificultad_conquista: 0.5,
    apertura_inicial: 0.5,
    velocidad_confianza: 0.5,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push('/login');

        // Cargar monedas y rol
        const { data: profile } = await supabase
          .from('profiles')
          .select('coins, is_admin')
          .eq('id', user.id)
          .maybeSingle();
        
        setUserCoins(profile?.coins || 0);
        const userIsAdmin = !!profile?.is_admin;
        setIsAdmin(userIsAdmin);

        // Cargar datos del avatar
        const { data: avatar, error: avatarErr } = await supabase
          .from('avatars')
          .select('*')
          .eq('id', avatarId)
          .single();

        if (avatarErr || !avatar) {
          throw new Error('No se pudo cargar el avatar');
        }

        if (avatar.user_id !== user.id && !userIsAdmin) {
          throw new Error('No tienes permiso para editar este avatar');
        }

        setIsOwner(avatar.user_id === user.id);
        
        setFormData({
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

        setRoleplaySettings(avatar.roleplay_settings || {
          dificultad_conquista: 0.5,
          apertura_inicial: 0.5,
          velocidad_confianza: 0.5,
        });
        
        setOriginalImageUrl(avatar.base_image_url);
        setPreview(avatar.base_image_url);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [avatarId, router]);

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
      setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.personality) {
      setError('Por favor, rellena todos los campos obligatorios.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      let finalImageUrl = originalImageUrl;
      let isImageChanged = !!file;

      if (isImageChanged && !isAdmin) {
        if (userCoins < 5) {
          throw new Error('Necesitas 5 monedas para cambiar la foto (requiere regenerar expresiones).');
        }
      }

      // Si subió foto nueva
      if (isImageChanged && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalImageUrl = publicUrl;
      }

      const updates: any = {
        name: formData.name,
        personality: formData.personality,
        system_prompt: formData.system_prompt,
        physical_description: formData.physical_description,
        voice_settings: { gender: formData.gender },
        roleplay_settings: roleplaySettings,
        visibility: formData.visibility,
        face_box_x: formData.face_box_x,
        face_box_y: formData.face_box_y,
        face_box_width: formData.face_box_width,
        face_box_height: formData.face_box_height,
        updated_at: new Date().toISOString()
      };

      if (isImageChanged) {
        updates.base_image_url = finalImageUrl;
        updates.current_image_url = finalImageUrl;
      }

      // Si cambia de privado a público y no es admin, se manda a moderación
      if (formData.visibility === 'public' && !isAdmin) {
        updates.moderation_status = 'pending';
      }

      const { error: dbError } = await supabase
        .from('avatars')
        .update(updates)
        .eq('id', avatarId);

      if (dbError) throw dbError;

      if (isImageChanged) {
        if (!isAdmin) {
          await supabase.from('profiles').update({ coins: userCoins - 5 }).eq('id', user.id);
        }
        // Limpiar las expresiones antiguas para que el sondeo funcione correctamente
        await supabase.from('avatars').update({
          profile_image_url: null,
          back_image_url: null,
          emotion_happy: null,
          emotion_sad: null,
          emotion_angry: null,
          emotion_flirty: null,
        }).eq('id', avatarId);

        // Obtener lista de jobs desde generate-angles
        try {
          const genResponse = await fetch('/api/avatars/generate-angles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarId })
          });
          if (!genResponse.ok) {
            const errorData = await genResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error interno en la generación de expresiones');
          }
          const genData = await genResponse.json().catch(() => ({}));
          const jobs: { key: string; expressionType: string }[] = genData.jobs || [];

          // Encolar expresiones secuencialmente con manejo de throttle
          if (jobs.length > 0) {
            (async () => {
              for (const job of jobs) {
                let attempt = 0;
                const maxAttempts = 5;
                let enqueued = false;

                while (attempt < maxAttempts && !enqueued) {
                  attempt++;
                  try {
                    const oneRes = await fetch('/api/avatars/generate-one', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        avatarId,
                        key: job.key,
                        expressionType: job.expressionType
                      })
                    });
                    const oneData = await oneRes.json().catch(() => ({}));
                    if (oneRes.ok) {
                      console.log(`[EditAvatar] Encolado OK: ${job.key} (predId: ${oneData.predictionId})`);
                      enqueued = true;
                    } else if (oneRes.status === 429 && oneData.throttled) {
                      const waitMs = ((oneData.retry_after || 10) + 3) * 1000;
                      console.warn(`[EditAvatar] Throttle para ${job.key}. Esperando ${waitMs / 1000}s... (intento ${attempt}/${maxAttempts})`);
                      await new Promise(resolve => setTimeout(resolve, waitMs));
                    } else {
                      console.error(`[EditAvatar] Error encolando ${job.key}:`, oneData.error);
                      break;
                    }
                  } catch (e) {
                    console.error(`[EditAvatar] Excepción encolando ${job.key}:`, e);
                    break;
                  }
                }
                if (!enqueued) {
                  console.error(`[EditAvatar] No se pudo encolar ${job.key} tras ${maxAttempts} intentos.`);
                }
                // Pausa de 12s entre expresiones para respetar burst=1 de cuentas < $5
                await new Promise(resolve => setTimeout(resolve, 12000));
              }
            })();
          }
        } catch (err: any) {
          console.error('Error disparando generación de ángulos:', err);
          // No lanzamos error: el avatar se guardó, las expresiones se regenerarán en background
        }
      }

      if (updates.moderation_status === 'pending') {
        try {
          await fetch('/api/avatars/notify-pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarId })
          });
        } catch (err) {
          console.error('Error notificando moderación:', err);
        }
      }

      router.push('/dashboard/avatars');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editar <span className="gold-gradient">Avatar</span></h1>
        <p className="text-muted-foreground mt-2">
          {file 
            ? '¡Cambiar la foto base regenerará las expresiones! (Costo: 5 monedas)' 
            : 'Modifica los detalles. Cambiar solo textos es totalmente gratis.'}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-6 py-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-morphism rounded-3xl p-6 border border-white/5 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Apariencia
            </h3>
            
            <div className="aspect-[4/5] relative rounded-2xl overflow-hidden group bg-black/40 border border-white/10">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <Upload className="w-10 h-10 mb-2 opacity-50" />
                  <span className="text-sm">Subir Foto</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <label className="cursor-pointer premium-button px-6 py-2 rounded-xl text-sm font-bold shadow-xl">
                  Cambiar Foto (5 <Coins className="w-4 h-4 inline" />)
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
                </label>
              </div>

              {analyzingImage && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                  <Sparkles className="w-8 h-8 text-primary animate-pulse mb-3" />
                  <p className="text-xs font-medium text-white/90 animate-pulse">Analizando rasgos faciales...</p>
                </div>
              )}
            </div>

            {file && !isAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs p-3 rounded-xl">
                Has seleccionado una nueva foto. Guardar estos cambios <strong>costará 5 monedas</strong> y regenerará las expresiones.
              </div>
            )}
            
            {file && isAdmin && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs p-3 rounded-xl">
                Has seleccionado una nueva foto. Se regenerarán las expresiones. <strong>¡Modo Admin: Generación Gratuita!</strong>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="glass-morphism rounded-3xl p-6 md:p-8 border border-white/5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 ml-1">Nombre</label>
                <input
                  type="text"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-white placeholder:text-white/30"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Kael, El Sabio"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 ml-1">Voz (Género)</label>
                <select
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white appearance-none"
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="female">Femenina</option>
                  <option value="male">Masculina</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 ml-1">Personalidad Pública</label>
              <textarea
                required
                rows={2}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white resize-none"
                value={formData.personality}
                onChange={(e) => setFormData({...formData, personality: e.target.value})}
                placeholder="Ej: Misterioso, siempre responde con acertijos y sarcasmo."
              />
            </div>

            {/* Parámetros de Roleplay y Conquista */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  Configuración de Roleplay y Afinidad 💖
                </h3>
                <p className="text-[11px] text-white/50 mt-1">
                  Define las barreras de conquista y la facilidad con la que el avatar ganará confianza.
                </p>
              </div>

              <div className="space-y-4">
                {/* Slider 1: Dificultad de Conquista */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-white/70">Dificultad de Conquista: {roleplaySettings.dificultad_conquista}</span>
                    <span className="text-white/40">
                      {roleplaySettings.dificultad_conquista <= 0.3 ? 'Muy fácil' : roleplaySettings.dificultad_conquista <= 0.7 ? 'Moderada' : 'Extrema'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    value={roleplaySettings.dificultad_conquista}
                    onChange={(e) => setRoleplaySettings({...roleplaySettings, dificultad_conquista: parseFloat(e.target.value)})}
                  />
                </div>

                {/* Slider 2: Apertura Inicial */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-white/70">Apertura Inicial: {roleplaySettings.apertura_inicial}</span>
                    <span className="text-white/40">
                      {roleplaySettings.apertura_inicial <= 0.3 ? 'Fría/Distante' : roleplaySettings.apertura_inicial <= 0.7 ? 'Normal' : 'Cálida/Sociable'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    value={roleplaySettings.apertura_inicial}
                    onChange={(e) => setRoleplaySettings({...roleplaySettings, apertura_inicial: parseFloat(e.target.value)})}
                  />
                </div>

                {/* Slider 3: Velocidad de Confianza */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-white/70">Velocidad de Confianza: {roleplaySettings.velocidad_confianza}</span>
                    <span className="text-white/40">
                      {roleplaySettings.velocidad_confianza <= 0.3 ? 'Lenta' : roleplaySettings.velocidad_confianza <= 0.7 ? 'Media' : 'Rápida'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    value={roleplaySettings.velocidad_confianza}
                    onChange={(e) => setRoleplaySettings({...roleplaySettings, velocidad_confianza: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 ml-1 flex items-center justify-between">
                <span>Prompt del Sistema (Secreto)</span>
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">Avanzado</span>
              </label>
              <textarea
                rows={4}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white resize-none"
                value={formData.system_prompt}
                onChange={(e) => setFormData({...formData, system_prompt: e.target.value})}
                placeholder="Instrucciones privadas para la IA. (Opcional)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 ml-1 flex items-center gap-2">
                Visibilidad
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`relative flex items-center justify-center p-4 rounded-xl border cursor-pointer transition-all ${formData.visibility === 'private' ? 'bg-primary/10 border-primary text-primary' : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/5'}`}>
                  <input type="radio" name="visibility" className="hidden" checked={formData.visibility === 'private'} onChange={() => setFormData({...formData, visibility: 'private'})} />
                  <span className="font-medium">Privado</span>
                </label>
                <label className={`relative flex items-center justify-center p-4 rounded-xl border cursor-pointer transition-all ${formData.visibility === 'public' ? 'bg-primary/10 border-primary text-primary' : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/5'}`}>
                  <input type="radio" name="visibility" className="hidden" checked={formData.visibility === 'public'} onChange={() => setFormData({...formData, visibility: 'public'})} />
                  <span className="font-medium">Público (Requiere revisión)</span>
                </label>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <button
                type="submit"
                disabled={saving || analyzingImage}
                className="w-full premium-button py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-5 h-5" /> Guardar Cambios</>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
