export interface EstiloPremium {
  id: string;
  nombre: string;
  miniatura: string;
  imagen_plantilla: string;
  prompt_base: string;
}

export const ESTILOS_PREMIUM: EstiloPremium[] = [
  {
    id: "suite_lujo_ny",
    nombre: "Suite de Lujo en Nueva York",
    // NOTA: Estas URLs son placeholders. Cuando tengas las imágenes subidas a Supabase Storage, 
    // debes reemplazar estas URLs por los enlaces públicos generados por Supabase.
    miniatura: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, photorealistic fashion editorial, wearing elegant silk lingerie, sitting on a luxury velvet bed inside a penthouse suite in New York at night, city lights background, cinematic lighting"
  },
  {
    id: "playa_atardecer",
    nombre: "Playa VIP al Atardecer",
    miniatura: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, hyperrealistic shot, posing sensually on a tropical beach at sunset, wearing luxury swimwear, soft waves reflecting orange sunlight, golden hour lighting"
  },
  {
    id: "estudio_glamour",
    nombre: "Estudio Glamour Vogue",
    miniatura: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, professional studio photography, high-fashion sensual pose, wearing an elegant black bodysuit, minimalist studio background with dramatic shadows and hard lighting, dark aesthetic, Vogue style"
  },
  {
    id: "yate_monaco",
    nombre: "Yate Privado en Mónaco",
    miniatura: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, photorealistic, relaxing on a luxury yacht deck in Monaco, wearing chic summer cruise wear, deep blue sea and coastal city background, bright sunny day"
  },
  {
    id: "cabana_nieve",
    nombre: "Cabaña en los Alpes",
    miniatura: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, photorealistic, cozy pose by a fireplace inside a rustic wooden cabin in the snowy Alps, wearing elegant winter sweater and leggings, warm amber lighting"
  },
  {
    id: "calle_tokio",
    nombre: "Callejón Neón en Tokio",
    miniatura: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, cyberpunk aesthetic, posing confidently in a neon-lit alleyway in Tokyo at night, wearing trendy streetwear fashion, bright colorful reflections, cinematic depth of field"
  },
  {
    id: "boudoir_mananero",
    nombre: "Boudoir Mañanero",
    miniatura: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, photorealistic intimate boudoir photography, seductive and soft sensual pose on white bed sheets, morning sunlight filtering through curtains, wearing delicate white lace lingerie, glowing skin, soft focus"
  },
  {
    id: "sofa_terciopelo",
    nombre: "Glamour en Terciopelo",
    miniatura: "https://images.unsplash.com/photo-1515516089376-88db1e26e980?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1515516089376-88db1e26e980?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, high-end fashion editorial, posing provocatively on a vintage red velvet sofa, wearing luxurious black sheer lingerie, dramatic moody lighting, sensual gaze, very alluring"
  },
  {
    id: "piscina_nocturna",
    nombre: "Seducción en la Piscina",
    miniatura: "https://images.unsplash.com/photo-1520052205864-92d242b3a76b?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1520052205864-92d242b3a76b?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, hyperrealistic night photography, wet skin, posing sensually emerging from a luxury infinity pool, wearing a revealing designer bikini, glowing neon pool lights, extremely attractive and seductive"
  },
  {
    id: "cuero_motocicleta",
    nombre: "Rebelde en Cuero",
    miniatura: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, edgy and provocative photography, posing fiercely leaning on a sleek black motorcycle, wearing a sensual tight leather outfit with a deep neckline, garage with moody cinematic lighting, bad girl aesthetic"
  }
];
