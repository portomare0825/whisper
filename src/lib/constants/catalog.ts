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
    miniatura: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1080&q=80",
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
  },
  {
    id: "lenceria_seda_cama",
    nombre: "Lencería de Seda Blanca",
    miniatura: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, photorealistic intimate boudoir, posing on a messy white bed, wearing luxurious white silk lingerie, warm morning sunlight, seductive and relaxed pose, high fashion aesthetic"
  },
  {
    id: "vestido_gala_rojo",
    nombre: "Gala Nocturna en Rojo",
    miniatura: "https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, high-end fashion event photography, wearing a stunning, tight backless red evening gown, posing confidently on a luxury balcony at night, elegant makeup, glamorous and alluring"
  },
  {
    id: "ducha_cristal",
    nombre: "Tras el Cristal (Ducha)",
    miniatura: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, artistic and highly sensual photorealistic shot, wet hair and skin, posing behind a slightly steamed glass shower door, subtle neon purple and blue backlighting, mysterious and captivating"
  },
  {
    id: "gimnasio_fitness",
    nombre: "Fitness de Lujo",
    miniatura: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, professional sports photography, sweaty glowing skin, posing confidently in a luxury dark gym, wearing tight sensual black workout clothes, high contrast lighting, fit aesthetic"
  },
  {
    id: "cowgirl_chic",
    nombre: "Cowgirl al Ocaso",
    miniatura: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, editorial fashion photography, sensual cowgirl outfit, wearing tight denim shorts, leather boots, and a tied flannel shirt showing midriff, posing leaning on a wooden fence, golden hour sunset lighting"
  },
  {
    id: "oficina_ejecutiva",
    nombre: "Jefa Ejecutiva",
    miniatura: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, hyperrealistic corporate glamour, posing sensually sitting on the edge of a mahogany desk in a luxury penthouse office, wearing a tight pencil skirt and a slightly unbuttoned silk blouse, city lights background"
  },
  {
    id: "yate_lujo_bikini",
    nombre: "Bikini en Altamar",
    miniatura: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, luxurious lifestyle photography, sunbathing sensually on a multi-million dollar yacht, wearing a highly fashionable and revealing designer bikini, ocean breeze, bright summer lighting, beautiful blue water"
  },
  {
    id: "bata_seda_espejo",
    nombre: "Preparativos en Bata",
    miniatura: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, intimate editorial portrait, standing in front of an antique mirror, wearing a loosely tied silk robe revealing a shoulder, warm candle and vanity lighting, seductive look through the mirror reflection"
  },
  {
    id: "auto_deportivo_noche",
    nombre: "Carrera Nocturna",
    miniatura: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, Fast and Furious aesthetic, posing seductively leaning against a sleek classic sports car at night, wearing tight edgy street racing leather outfit, illuminated by streetlights and car headlights, wet pavement"
  },
  {
    id: "playa_arena_blanca",
    nombre: "Diosa en la Arena",
    miniatura: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, tropical paradise photography, lying sensually on white sand, wet skin with sand particles, wearing a bold one-piece high-cut swimsuit, bright vibrant sunny lighting, crystal clear beach background"
  },
  {
    id: "angel_oscuridad",
    nombre: "Ángel Caído",
    miniatura: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, dark fantasy aesthetic, posing gracefully with large dramatic black angel wings, wearing elegant sheer black lace lingerie, gothic cathedral background, moonlight shining through stained glass"
  },
  {
    id: "casino_las_vegas",
    nombre: "Noche en el Casino",
    miniatura: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, luxury lifestyle photography, posing alluringly next to a roulette table in a high-roller Las Vegas casino, wearing a sequined extremely tight cocktail dress, cinematic golden lighting"
  },
  {
    id: "sauna_madera",
    nombre: "Calor en el Sauna",
    miniatura: "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, highly realistic intimate portrait, extremely sweaty glowing skin, wrapped only in a white towel, posing sensually inside a cozy wooden steam sauna, soft dim warm lighting"
  },
  {
    id: "lenceria_roja_rosas",
    nombre: "Pétalos y Seda",
    miniatura: "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, romantic boudoir photography, lying gracefully on a bed covered entirely with red rose petals, wearing stunning crimson red lace lingerie, soft candlelit atmosphere, extremely seductive"
  },
  {
    id: "bar_jazz_retro",
    nombre: "Diva del Jazz",
    miniatura: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, 1950s retro vintage photography, singing into an antique microphone in a smoky dim jazz bar, wearing a glamorous tight sequin dress and long silk gloves, moody spotlight illumination"
  },
  {
    id: "gata_ladrona",
    nombre: "Atraco Perfecto",
    miniatura: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, cinematic action photography, stealthy cat burglar posing flexibly while dodging red security laser beams, wearing a skin-tight glossy black latex catsuit, high-tech bank vault background"
  },
  {
    id: "reina_egipcia",
    nombre: "Diosa del Nilo",
    miniatura: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1080&q=80",
    prompt_base: "masterpiece, 8k resolution, epic historical fantasy, posing majestically as an ancient Egyptian Queen, wearing a revealing gold and jewel encrusted outfit, heavy exotic makeup, desert night with pyramids in background"
  }
];
