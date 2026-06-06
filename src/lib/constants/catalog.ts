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
    miniatura: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1080&q=80",
    prompt_base: "sitting on a luxury velvet bed inside a penthouse suite in New York at night with city lights background, wearing an elegant silk dress, masterpiece, 8k resolution, photorealistic fashion editorial, cinematic lighting"
  },
  {
    id: "playa_atardecer",
    nombre: "Playa VIP al Atardecer",
    miniatura: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&q=80",
    prompt_base: "posing on a tropical beach at sunset with golden hour soft orange sunset glow, wearing an elegant designer summer resort dress, luxury beachwear, masterpiece, 8k resolution, professional fashion photography, three-quarter length shot showing from the knees up, cinematic lighting"
  },
  {
    id: "estudio_glamour",
    nombre: "Estudio Glamour Vogue",
    miniatura: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080&q=80",
    prompt_base: "wearing an elegant black evening gown in a minimalist studio background with dramatic shadows and hard lighting, high-fashion pose, masterpiece, 8k resolution, professional studio photography, dark aesthetic, Vogue style"
  },
  {
    id: "yate_monaco",
    nombre: "Yate Privado en Mónaco",
    miniatura: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1080&q=80",
    prompt_base: "relaxing on a luxury yacht deck in Monaco with deep blue sea and coastal city background on a bright sunny day, wearing chic summer cruise wear, masterpiece, 8k resolution, photorealistic"
  },
  {
    id: "cabana_nieve",
    nombre: "Cabaña en los Alpes",
    miniatura: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1080&q=80",
    prompt_base: "posing cozy by a fireplace inside a rustic wooden cabin in the snowy Alps with warm amber lighting, wearing elegant winter sweater and leggings, masterpiece, 8k resolution, photorealistic"
  },
  {
    id: "calle_tokio",
    nombre: "Callejón Neón en Tokio",
    miniatura: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1080&q=80",
    prompt_base: "posing confidently in a neon-lit alleyway in Tokyo at night with bright colorful reflections, wearing trendy streetwear fashion, masterpiece, 8k resolution, cyberpunk aesthetic, cinematic depth of field"
  },
  {
    id: "boudoir_mananero",
    nombre: "Boudoir Mañanero",
    miniatura: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=1080&q=80",
    prompt_base: "posing elegantly on white bed sheets with morning sunlight filtering through curtains, wearing a delicate white silk robe, glowing skin, masterpiece, 8k resolution, photorealistic morning portrait, soft focus"
  },
  {
    id: "sofa_terciopelo",
    nombre: "Glamour en Terciopelo",
    miniatura: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1080&q=80",
    prompt_base: "posing elegantly on a vintage red velvet sofa under dramatic moody lighting, wearing a luxurious velvet evening dress, masterpiece, 8k resolution, high-end fashion editorial, refined gaze"
  },
  {
    id: "piscina_nocturna",
    nombre: "Seducción en la Piscina",
    miniatura: "https://images.unsplash.com/photo-1520052205864-92d242b3a76b?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1520052205864-92d242b3a76b?w=1080&q=80",
    prompt_base: "posing next to a luxury infinity pool with glowing neon pool reflections and soft ambient luxury backlight, wearing an elegant luxury designer summer resort dress, glowing skin, masterpiece, 8k resolution, professional night photography, three-quarter length shot showing from the knees up, cinematic night lighting"
  },
  {
    id: "cuero_motocicleta",
    nombre: "Rebelde en Cuero",
    miniatura: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=1080&q=80",
    prompt_base: "posing fiercely leaning on a sleek black motorcycle inside a garage with moody cinematic lighting, wearing a stylish black leather jacket and matching pants, masterpiece, 8k resolution, edgy fashion photography, bold aesthetic"
  },
  {
    id: "lenceria_seda_cama",
    nombre: "Lencería de Seda Blanca",
    miniatura: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=1080&q=80",
    prompt_base: "posing relaxed on a white bed with warm morning sunlight, wearing a luxurious white silk robe, masterpiece, 8k resolution, photorealistic cozy portrait, high fashion aesthetic"
  },
  {
    id: "vestido_gala_rojo",
    nombre: "Gala Nocturna en Rojo",
    miniatura: "https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=1080&q=80",
    prompt_base: "posing confidently on a luxury balcony at night wearing a stunning red evening gown, elegant makeup, masterpiece, 8k resolution, high-end fashion event photography, glamorous and sophisticated"
  },
  {
    id: "ducha_cristal",
    nombre: "Tras el Cristal (Ducha)",
    miniatura: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1080&q=80",
    prompt_base: "posing next to a modern frosted glass panel with colorful neon purple and blue backlighting, silhouette portrait, masterpiece, 8k resolution, artistic photorealistic shot, mysterious and captivating"
  },
  {
    id: "gimnasio_fitness",
    nombre: "Fitness de Lujo",
    miniatura: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1080&q=80",
    prompt_base: "posing confidently in a luxury dark gym with high contrast lighting, wearing stylish black athletic wear, sweaty glowing skin, masterpiece, 8k resolution, professional sports photography, fit aesthetic"
  },
  {
    id: "cowgirl_chic",
    nombre: "Cowgirl al Ocaso",
    miniatura: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1080&q=80",
    prompt_base: "posing leaning on a wooden fence under golden hour sunset lighting, wearing denim jeans, leather boots, and a flannel shirt, chic cowgirl fashion, masterpiece, 8k resolution, editorial fashion photography"
  },
  {
    id: "oficina_ejecutiva",
    nombre: "Jefa Ejecutiva",
    miniatura: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1080&q=80",
    prompt_base: "posing confidently sitting on the edge of a mahogany desk in a luxury penthouse office with city lights background, wearing a professional pencil skirt and an elegant silk blouse, masterpiece, 8k resolution, hyperrealistic corporate glamour"
  },
  {
    id: "yate_lujo_bikini",
    nombre: "Bikini en Altamar",
    miniatura: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1080&q=80",
    prompt_base: "relaxing on the deck of a multi-million dollar yacht with ocean breeze and beautiful blue water under bright summer lighting, wearing elegant designer resort wear fashion, masterpiece, 8k resolution, luxurious lifestyle photography"
  },
  {
    id: "bata_seda_espejo",
    nombre: "Preparativos en Bata",
    miniatura: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1080&q=80",
    prompt_base: "standing in front of an antique mirror with warm candle and vanity lighting, wearing an elegant silk robe, classic beauty portrait through the mirror reflection, masterpiece, 8k resolution, intimate editorial portrait"
  },
  {
    id: "auto_deportivo_noche",
    nombre: "Carrera Nocturna",
    miniatura: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1080&q=80",
    prompt_base: "posing confidently leaning against a sleek classic sports car at night illuminated by streetlights and car headlights, wet pavement, wearing stylish street racing leather fashion, masterpiece, 8k resolution, racing aesthetic"
  },
  {
    id: "playa_arena_blanca",
    nombre: "Diosa en la Arena",
    miniatura: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=1080&q=80",
    prompt_base: "posing gracefully standing on white sand beach with crystal clear turquoise ocean background, wearing an elegant designer one-piece swimsuit, bright cinematic sunny lighting, masterpiece, 8k resolution, professional fashion editorial photography, three-quarter length shot showing from the knees up"
  },
  {
    id: "angel_oscuridad",
    nombre: "Ángel Caído",
    miniatura: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1080&q=80",
    prompt_base: "posing gracefully with large dramatic black angel wings in front of a gothic cathedral background with moonlight shining through stained glass, wearing an elegant black lace evening gown, masterpiece, 8k resolution, dark fantasy aesthetic"
  },
  {
    id: "casino_las_vegas",
    nombre: "Noche en el Casino",
    miniatura: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1080&q=80",
    prompt_base: "posing elegantly next to a roulette table in a high-roller Las Vegas casino with cinematic golden lighting, wearing a glamorous cocktail dress, masterpiece, 8k resolution, luxury lifestyle photography"
  },
  {
    id: "sauna_madera",
    nombre: "Calor en el Sauna",
    miniatura: "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=1080&q=80",
    prompt_base: "relaxing in a cozy wooden steam sauna with soft ambient steam and dim warm lighting, masterpiece, 8k resolution, highly realistic portrait, warm glow"
  },
  {
    id: "lenceria_roja_rosas",
    nombre: "Pétalos y Seda",
    miniatura: "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=1080&q=80",
    prompt_base: "lying gracefully on a bed covered with red rose petals under soft candlelit atmosphere, wearing a stunning crimson red evening gown, masterpiece, 8k resolution, romantic portrait photography, elegant look"
  },
  {
    id: "bar_jazz_retro",
    nombre: "Diva del Jazz",
    miniatura: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1080&q=80",
    prompt_base: "singing into an antique microphone in a smoky dim jazz bar illuminated by a moody spotlight, wearing a glamorous tight sequin dress and long silk gloves, masterpiece, 8k resolution, 1950s retro vintage photography"
  },
  {
    id: "gata_ladrona",
    nombre: "Atraco Perfecto",
    miniatura: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1080&q=80",
    prompt_base: "stealthy cat burglar posing flexibly while dodging red security laser beams inside a high-tech bank vault, wearing a skin-tight glossy black latex catsuit, masterpiece, 8k resolution, cinematic action photography"
  },
  {
    id: "reina_egipcia",
    nombre: "Diosa del Nilo",
    miniatura: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1080&q=80",
    prompt_base: "posing majestically as an ancient Egyptian Queen with a desert night and pyramids in the background, wearing a magnificent gold and jewel-adorned royal dress, heavy exotic makeup, masterpiece, 8k resolution, epic historical fantasy"
  },
  {
    id: "jardin_rosas_secreto",
    nombre: "Jardín Secreto de Rosas",
    miniatura: "https://images.unsplash.com/photo-1525253086316-d0c936c814f8?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1525253086316-d0c936c814f8?w=1080&q=80",
    prompt_base: "standing in a lush blooming English rose garden with colorful pink and red roses surrounding her under soft morning sunlight, wearing a flowing floral summer maxi dress, masterpiece, 8k resolution, romantic fashion editorial, cinematic depth of field"
  },
  {
    id: "terraza_santorini",
    nombre: "Terraza en Santorini",
    miniatura: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1080&q=80",
    prompt_base: "posing on a white balcony in Santorini overlooking the deep blue Aegean sea with blue dome church in background on a bright sunny day, wearing a flowing royal blue silk dress, masterpiece, 8k resolution, luxury travel photography"
  },
  {
    id: "cascada_selva_exotica",
    nombre: "Cascada en Selva Exótica",
    miniatura: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080&q=80",
    prompt_base: "posing standing in front of a majestic jungle waterfall and crystal clear pool surrounded by tropical lush green plants with soft mist and sunbeams filtering through the canopy, wearing a stylish designer emerald green monokini swimwear, masterpiece, 8k resolution, adventurous fashion editorial"
  },
  {
    id: "cafe_parisino_vintage",
    nombre: "Café Parisino Vintage",
    miniatura: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1080&q=80",
    prompt_base: "sitting at a cozy outdoor table of a classic Parisian sidewalk cafe with the Eiffel Tower visible in the distant soft-focus background under warm morning light, wearing an elegant beige trench coat and a red beret, holding a cup of espresso, masterpiece, 8k resolution, vintage chic aesthetic"
  },
  {
    id: "galeria_arte_moderno",
    nombre: "Galería de Arte Moderno",
    miniatura: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1080&q=80",
    prompt_base: "posing next to large abstract colorful paintings in a spacious white modern art gallery with dramatic track lighting, wearing an avant-garde black pantsuit with clean lines, masterpiece, 8k resolution, high-end minimalist fashion, sophisticated pose"
  },
  {
    id: "desierto_dubai_anochecer",
    nombre: "Desierto de Dubái",
    miniatura: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1080&q=80",
    prompt_base: "posing majestically standing on top of a golden sand dune in Dubai at twilight with glowing orange horizon, wearing a dramatic flowing crimson red silk gown blowing in the wind, cinematic wind effect, masterpiece, 8k resolution, luxury desert adventure, epic wide landscape"
  },
  {
    id: "piscina_bali",
    nombre: "Piscina Infinita en Bali",
    miniatura: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1080&q=80",
    prompt_base: "posing relaxing in a luxurious infinity pool in Bali surrounded by lush tropical jungle and palm trees, wearing a chic designer emerald bikini, crystal clear water, tropical sunny day, cinematic reflection, masterpiece, 8k resolution, professional resort photography"
  },
  {
    id: "yate_miami",
    nombre: "Yate de Lujo en Miami",
    miniatura: "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1080&q=80",
    prompt_base: "posing leaning on a luxury yacht deck in Miami at sunset, ocean waves and distant city skyline background, wearing a glamorous elegant white summer resort dress, golden hour warm lighting, cinematic depth of field, masterpiece, 8k resolution, luxury lifestyle photography"
  },
  {
    id: "penthouse_tokio",
    nombre: "Penthouse en Tokio",
    miniatura: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1080&q=80",
    prompt_base: "posing standing in a high-end luxury penthouse in Tokyo at night, giant floor-to-ceiling windows showing beautiful neon-lit Tokyo skyline and Tokyo Tower in background, wearing an elegant modern dark silver evening dress, soft luxury indoor lighting, masterpiece, 8k resolution, cyberpunk glamour"
  },
  {
    id: "glamping_burbuja",
    nombre: "Glamping Tienda Burbuja bajo las Estrellas",
    miniatura: "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=1080&q=80",
    prompt_base: "posing relaxing inside a transparent luxury bubble glamping tent, starry night sky and northern lights visible through the ceiling, cozy warm bed with blankets, wearing comfortable luxurious white loungewear, cozy fairy lights ambient, masterpiece, 8k resolution, photorealistic"
  },
  {
    id: "calle_londres",
    nombre: "Otoño Lluvioso en Londres",
    miniatura: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1080&q=80",
    prompt_base: "posing walking on a rainy historic London street with wet pavement reflecting red double-decker buses, Big Ben blurry in background, wearing a stylish long red wool coat and holding a black umbrella, cinematic moody lighting, masterpiece, 8k resolution, street fashion photography"
  },
  {
    id: "biblioteca_clasica",
    nombre: "Biblioteca Clásica Privada",
    miniatura: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400&q=80",
    imagen_plantilla: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1080&q=80",
    prompt_base: "posing sitting on a luxury leather vintage armchair in an old private library, tall wooden bookshelves filled with leather-bound books in background, warm fireplace glow, wearing a sophisticated dark green turtleneck sweater and spectacles, intellectual chic style, masterpiece, 8k resolution, cinematic lighting"
  }
];
