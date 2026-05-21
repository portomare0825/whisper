import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'ksezyjdxvjgiryaiulew';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function run() {
  const adminClient = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: `
          SELECT * FROM public.add_coins(
            (SELECT id FROM auth.users WHERE email = 'portomare0825@gmail.com'),
            10
          );
        `
      }),
    }
  );

  const data = await adminClient.json();
  console.log(data);
}

run();
