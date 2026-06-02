import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'ksezyjdxvjgiryaiulew';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function run() {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: `
          SELECT id, conversation_id, role, substring(content, 1, 30) as excerpt, created_at
          FROM public.messages
          ORDER BY created_at DESC
          LIMIT 15;
        `
      }),
    }
  );

  const data = await res.json();
  console.log("Últimos 15 mensajes en la DB:");
  console.log(data);
}

run();
