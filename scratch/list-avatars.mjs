import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'ksezyjdxvjgiryaiulew';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function listAvatars() {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: `
          SELECT id, name, base_image_url
          FROM public.avatars;
        `
      }),
    }
  );

  const data = await response.json();
  console.log('\n🎭 Avatares registrados en la base de datos:');
  console.log(JSON.stringify(data, null, 2));
}

listAvatars().catch(console.error);
