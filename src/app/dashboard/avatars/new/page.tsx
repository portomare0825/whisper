'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Sparkles, AlertCircle, Coins, Plus } from 'lucide-react';
import { compressAvatarImage } from '@/lib/image-utils';
import { createClient } from '@/lib/supabase';

export default function NewAvatarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generatingAngles, setGeneratingAngles] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    personality: '',
    system_prompt: '',
    gender: 'female', // default to female
    physical_description: '',
    visibility: 'private', // 'private' | 'public'
    face_box_x: 198,
    face_box_y: 120,
    face_box_width: 180,
    face_box_height: 240,
  });
  const [roleplaySettings, setRoleplaySettings] = useState({
    dificultad_conquista: 0.5,
    apertura_inicial: 0.5,
    velocidad_confianza: 0.5,
  });
  const [file, setFile] = useState<File | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [userCoins, setUserCoins] = useState<number>(0);
  const [avatarCount, setAvatarCount] = useState<number>(0);
  const [baseLimit, setBaseLimit] = useState<number>(1);
  const [extraSlots, setExtraSlots] = useState<number>(0);
  const [buyingSlot, setBuyingSlot] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string>('Gratuito');

  async function checkLimits() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Obtener ranuras adicionales del perfil, monedas e is_admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('extra_avatar_slots, coins, is_admin')
        .eq('id', user.id)
        .maybeSingle();
      const extraSlotsVal = profile?.extra_avatar_slots || 0;
      const coinsVal = profile?.coins || 0;
      const isAdminVal = !!profile?.is_admin;
      
      setUserCoins(coinsVal);
      setExtraSlots(extraSlotsVal);

      // 2. Obtener la suscripción activa
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const isPremium = !!subscription && (!subscription.expires_at || new Date(subscription.expires_at) > new Date());

      let baseSlotsLimit = 1; // Gratuito por defecto
      let pName = 'Gratuito';
      
      if (isAdminVal) {
        baseSlotsLimit = 999999;
        pName = 'Administrador';
      } else if (isPremium && subscription) {
        if (subscription.plan_type === 'pro') {
          baseSlotsLimit = 15; // Mensual Pro
          pName = 'Mensual Pro';
        } else if (subscription.plan_type === 'pay_per_use') {
          if (subscription.expires_at && subscription.created_at) {
            const diffMs = new Date(subscription.expires_at).getTime() - new Date(subscription.created_at).getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > 2) {
              baseSlotsLimit = 8; // Pase Semanal
              pName = 'Semanal';
            } else {
              baseSlotsLimit = 3; // Pase Diario
              pName = 'Diario';
            }
          } else {
            baseSlotsLimit = 3;
            pName = 'Diario';
          }
        }
      }
      
      setBaseLimit(baseSlotsLimit);
      setPlanName(pName);

      const totalSlotsLimit = baseSlotsLimit + extraSlotsVal;

      const { count } = await supabase
        .from('avatars')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const countVal = count || 0;
      setAvatarCount(countVal);

      if (!isAdminVal && countVal >= totalSlotsLimit) {
        setLimitReached(true);
      } else {
        setLimitReached(false);
      }
    } catch (err) {
      console.error('Error al comprobar límites:', err);
    } finally {
      setCheckingLimit(false);
    }
  }

  useEffect(() => {
    checkLimits();
  }, []);

  const handleBuySlot = async () => {
    try {
      setBuyingSlot(true);
      setBuyError(null);
      
      const res = await fetch('/api/user/slots/buy', {
        method: 'POST',
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al comprar ranura');
      }
      
      // Compra exitosa, volver a comprobar límites
      await checkLimits();
    } catch (err: any) {
      setBuyError(err.message || 'Ocurrió un error inesperado al procesar la compra.');
    } finally {
      setBuyingSlot(false);
    }
  };

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
        const { data: { user } } = await supabase.auth.getUser();
        const base64 = await fileToBase64(compressed);
        const response = await fetch('/api/avatars/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: compressed.type,
            userId: user?.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            name: data.name || prev.name,
            personality: data.personality || prev.personality,
            physical_description: data.physical_description || data.description || prev.physical_description,
            system_prompt: data.system_prompt || prev.system_prompt,
            face_box_x: data.face_box_x !== undefined ? data.face_box_x : prev.face_box_x,
            face_box_y: data.face_box_y !== undefined ? data.face_box_y : prev.face_box_y,
            face_box_width: data.face_box_width !== undefined ? data.face_box_width : prev.face_box_width,
            face_box_height: data.face_box_height !== undefined ? data.face_box_height : prev.face_box_height,
          }));
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

      // Validar que el nombre no esté repetido
      const cleanName = formData.name.trim();
      if (!cleanName) {
        throw new Error('Por favor, introduce un nombre válido para el avatar.');
      }

      // 1. Comprobar si el propio usuario ya tiene un avatar con este nombre
      const { data: existingUserAvatar, error: userCheckError } = await supabase
        .from('avatars')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', cleanName)
        .maybeSingle();

      if (userCheckError) {
        console.error('Error comprobando duplicado de usuario:', userCheckError);
      }

      if (existingUserAvatar) {
        throw new Error(`Ya tienes un avatar creado con el nombre "${cleanName}". Por favor, elige otro nombre.`);
      }

      // 2. Si es público, comprobar si ya existe un avatar público con ese nombre en la comunidad
      if (formData.visibility === 'public') {
        const { data: existingPublicAvatar, error: publicCheckError } = await supabase
          .from('avatars')
          .select('id')
          .eq('visibility', 'public')
          .ilike('name', cleanName)
          .maybeSingle();

        if (publicCheckError) {
          console.error('Error comprobando duplicado público:', publicCheckError);
        }

        if (existingPublicAvatar) {
          throw new Error(`Ya existe un avatar público en la comunidad con el nombre "${cleanName}". Por favor, elige un nombre único.`);
        }
      }

      // Validar límites y comprobar permisos de administrador según el plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('extra_avatar_slots, is_admin')
        .eq('id', user.id)
        .maybeSingle();
      const extraSlots = profile?.extra_avatar_slots || 0;
      const isAdmin = !!profile?.is_admin;

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const isPremium = !!subscription && (!subscription.expires_at || new Date(subscription.expires_at) > new Date());

      let baseSlotsLimit = 1; // Gratuito por defecto
      if (isPremium && subscription) {
        if (subscription.plan_type === 'pro') {
          baseSlotsLimit = 15; // Mensual Pro
        } else if (subscription.plan_type === 'pay_per_use') {
          if (subscription.expires_at && subscription.created_at) {
            const diffMs = new Date(subscription.expires_at).getTime() - new Date(subscription.created_at).getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > 2) {
              baseSlotsLimit = 8; // Pase Semanal
            } else {
              baseSlotsLimit = 3; // Pase Diario
            }
          } else {
            baseSlotsLimit = 3;
          }
        }
      }

      const totalSlotsLimit = baseSlotsLimit + extraSlots;

      const { count } = await supabase
        .from('avatars')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!isAdmin && count && count >= totalSlotsLimit) {
        throw new Error(`Has alcanzado tu límite máximo de ${totalSlotsLimit} avatares activos. Por favor, actualiza tu plan o adquiere ranuras adicionales para expandirlo.`);
      }

      if (!isAdmin && userCoins < 5) {
        throw new Error('Necesitas al menos 5 monedas para crear un avatar.');
      }

      // 1. Subir imagen a Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // 2. Guardar en la base de datos
      const { data: newAvatar, error: dbError } = await supabase
        .from('avatars')
        .insert({
          user_id: user.id,
          name: formData.name,
          personality: formData.personality,
          system_prompt: formData.system_prompt,
          physical_description: formData.physical_description,
          base_image_url: publicUrl,
          current_image_url: publicUrl,
          voice_settings: { gender: formData.gender },
          roleplay_settings: roleplaySettings,
          face_box_x: formData.face_box_x,
          face_box_y: formData.face_box_y,
          face_box_width: formData.face_box_width,
          face_box_height: formData.face_box_height,
          is_admin_avatar: isAdmin,
          visibility: formData.visibility,
          moderation_status: formData.visibility === 'private' ? 'none' : (isAdmin ? 'approved' : 'pending'),
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 3. Disparar notificación push de moderación en segundo plano (si requiere revisión)
      if (formData.visibility === 'public' && !isAdmin && newAvatar) {
        fetch('/api/avatars/notify-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: newAvatar.id })
        }).catch(err => console.error('Error disparando notificación push:', err));
      }

      // 4. Descontar 5 monedas y disparar la generación de ángulos/emociones (Opción A)
      if (!isAdmin) {
        await supabase.from('profiles').update({ coins: userCoins - 5 }).eq('id', user.id);
      }

      if (newAvatar) {
        try {
          const genResponse = await fetch('/api/avatars/generate-angles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarId: newAvatar.id })
          });

          if (genResponse.ok) {
            const genData = await genResponse.json();
            const predictions = genData.predictions;

            if (predictions && Array.isArray(predictions) && predictions.length > 0) {
              setGeneratingAngles(true);
              setCompletedCount(0);
              setGenerationProgress(0);

              const totalPredictions = predictions.length;
              const completedPredictions = new Set<string>();

              // Timeout de seguridad de 60 segundos
              const safetyTimeout = setTimeout(() => {
                console.warn('[NewAvatar] Sondeo de expresiones alcanzó el límite de tiempo seguro.');
                setGeneratingAngles(false);
                router.push('/dashboard');
                router.refresh();
              }, 60000);

              const checkInterval = setInterval(async () => {
                try {
                  const checkPromises = predictions.map(async (pred) => {
                    if (completedPredictions.has(pred.key)) return;

                    const res = await fetch(`/api/avatars/check-status?predictionId=${pred.predictionId}&avatarId=${newAvatar.id}&userId=${newAvatar.user_id}&key=${pred.key}`);
                    if (res.ok) {
                      const statusData = await res.json();
                      if (statusData.status === 'completed') {
                        completedPredictions.add(pred.key);
                      } else if (statusData.status === 'failed') {
                        console.error(`[NewAvatar] Predicción fallida en Replicate para ${pred.key}:`, statusData.error);
                        completedPredictions.add(pred.key);
                      }
                    }
                  });

                  await Promise.all(checkPromises);

                  const count = completedPredictions.size;
                  setCompletedCount(count);
                  setGenerationProgress((count / totalPredictions) * 100);

                  if (count >= totalPredictions) {
                    clearInterval(checkInterval);
                    clearTimeout(safetyTimeout);
                    setGeneratingAngles(false);
                    router.push('/dashboard');
                    router.refresh();
                  }
                } catch (checkErr) {
                  console.error('Error sondeando predicciones desde el cliente:', checkErr);
                }
              }, 3000);

              return; // Salir aquí para esperar el progreso
            }
          }
        } catch (err) {
          console.error('Error disparando generación de ángulos:', err);
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error al crear el avatar');
    } finally {
      setLoading(false);
    }
  };

  if (checkingLimit) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (limitReached) {
    const hasEnoughCoins = userCoins >= 30;

    return (
      <div className="max-w-2xl mx-auto text-center space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-amber-400/10 rounded-3xl flex items-center justify-center mx-auto border border-amber-400/20">
          <AlertCircle className="w-10 h-10 text-amber-400" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Límite de <span className="gold-gradient">Avatares</span></h1>
          <p className="text-white/80 leading-relaxed font-semibold text-lg">
            Has alcanzado tu límite máximo de {baseLimit + extraSlots} {baseLimit + extraSlots === 1 ? 'avatar activo' : 'avatares activos'}.
          </p>
          <div className="inline-flex flex-wrap justify-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl text-sm font-medium backdrop-blur-md">
            <span>Plan: <span className="text-primary font-bold">{planName}</span> ({baseLimit})</span>
            <span className="text-white/20">•</span>
            <span>Ranuras Extras: <span className="text-emerald-400 font-bold">{extraSlots}</span></span>
            <span className="text-white/20">•</span>
            <span>Usados: <span className="text-amber-400 font-bold">{avatarCount}</span></span>
          </div>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Tienes {avatarCount} de {baseLimit + extraSlots} avatares creados. Para seguir creando nuevos compañeros mágicos, puedes expandir tu límite.
          </p>
        </div>

        {/* Módulo de Compra de Slot Extra con Diseño Premium */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg mx-auto shadow-2xl space-y-6 text-left relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Compra Permanente
              </span>
              <h3 className="text-xl font-bold text-white mt-3 flex items-center gap-2">
                Adquirir Ranura Adicional 🪄
              </h3>
              <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">
                Desbloquea de forma permanente una ranura extra para tener un nuevo avatar activo simultáneamente. ¡Sin suscripciones!
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Costo</div>
              <div className="text-2xl font-black text-amber-400 flex items-center justify-end gap-1">
                30 <Coins className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <Coins className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Tus monedas</div>
                <div className="text-sm font-bold text-white">{userCoins} Monedas 🪙</div>
              </div>
            </div>

            {hasEnoughCoins ? (
              <button
                type="button"
                disabled={buyingSlot}
                onClick={handleBuySlot}
                className="premium-button text-primary-foreground font-bold px-6 py-3 rounded-xl flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] transition-all disabled:opacity-50 shadow-lg"
              >
                {buyingSlot ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Comprar Ranura Extra
                    <Plus className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/dashboard/billing')}
                className="bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/20 font-bold px-6 py-3 rounded-xl flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] transition-all"
              >
                Cargar Monedas
                <Coins className="w-4 h-4" />
              </button>
            )}
          </div>

          {buyError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{buyError}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button 
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-all font-semibold"
          >
            Volver al Dashboard
          </button>
          <button 
            type="button"
            onClick={() => router.push('/dashboard/billing')}
            className="premium-button px-8 py-3 rounded-xl text-primary-foreground font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Ver Planes Premium ✨
          </button>
        </div>
      </div>
    );
  }

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
              <label className="text-sm font-medium text-muted-foreground">Privacidad del Avatar</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, visibility: 'private'})}
                  className={`py-3 rounded-xl font-medium border transition-all ${formData.visibility === 'private' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                >
                  Privado 🔒
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, visibility: 'public'})}
                  className={`py-3 rounded-xl font-medium border transition-all ${formData.visibility === 'public' ? 'premium-button text-primary-foreground border-primary/50 shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
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

      {/* Parámetros de Roleplay y Conquista */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Configuración de Roleplay y Afinidad 💖
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Define las barreras de conquista y la facilidad con la que el avatar ganará confianza.
          </p>
        </div>

        <div className="space-y-4">
          {/* Slider 1: Dificultad de Conquista */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-white/80">Dificultad de Conquista: {roleplaySettings.dificultad_conquista}</span>
              <span className="text-xs text-muted-foreground">
                {roleplaySettings.dificultad_conquista <= 0.3 ? 'Muy fácil' : roleplaySettings.dificultad_conquista <= 0.7 ? 'Moderada' : 'Extrema'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              value={roleplaySettings.dificultad_conquista}
              onChange={(e) => setRoleplaySettings({...roleplaySettings, dificultad_conquista: parseFloat(e.target.value)})}
            />
            <p className="text-[10px] text-muted-foreground">
              Una dificultad alta requiere de conversaciones más profundas y paciencia antes de que el avatar se muestre afectuoso.
            </p>
          </div>

          {/* Slider 2: Apertura Inicial */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-white/80">Apertura Inicial: {roleplaySettings.apertura_inicial}</span>
              <span className="text-xs text-muted-foreground">
                {roleplaySettings.apertura_inicial <= 0.3 ? 'Fría/Distante' : roleplaySettings.apertura_inicial <= 0.7 ? 'Normal' : 'Cálida/Sociable'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              value={roleplaySettings.apertura_inicial}
              onChange={(e) => setRoleplaySettings({...roleplaySettings, apertura_inicial: parseFloat(e.target.value)})}
            />
            <p className="text-[10px] text-muted-foreground">
              Determina la amabilidad o distancia emocional del avatar en los primeros mensajes de la conversación.
            </p>
          </div>

          {/* Slider 3: Velocidad de Confianza */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-white/80">Velocidad de Confianza: {roleplaySettings.velocidad_confianza}</span>
              <span className="text-xs text-muted-foreground">
                {roleplaySettings.velocidad_confianza <= 0.3 ? 'Lenta' : roleplaySettings.velocidad_confianza <= 0.7 ? 'Media' : 'Rápida'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              value={roleplaySettings.velocidad_confianza}
              onChange={(e) => setRoleplaySettings({...roleplaySettings, velocidad_confianza: parseFloat(e.target.value)})}
            />
            <p className="text-[10px] text-muted-foreground">
              Controla qué tan rápido responde positivamente el avatar a los gestos agradables del usuario.
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
          {loading ? 'Creando...' : 'Crear Avatar Mágico (5 Monedas)'}
          <Sparkles className="w-5 h-5" />
        </button>
      </form>

      {/* Cargando progreso de generación de expresiones */}
      {generatingAngles && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                Generando Expresiones Mágicas 🪄
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Estamos creando las 6 imágenes faciales del avatar (alegre, triste, perfil, etc.) usando IA de alta fidelidad.
              </p>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full bg-white/5 border border-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-amber-400 rounded-full transition-all duration-500" 
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                <span>{Math.round(generationProgress)}% Completado</span>
                <span>{completedCount} de 6 imágenes</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 italic">
              Esto tomará unos 15 segundos. Por favor, no cierres esta pestaña.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
