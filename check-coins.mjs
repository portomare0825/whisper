import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'ksezyjdxvjgiryaiulew';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function checkCoins() {
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
          SELECT u.email, p.coins 
          FROM auth.users u
          LEFT JOIN public.profiles p ON u.id = p.id;
        `
      }),
    }
  );

  const data = await response.json();
  console.log('\n🪙 Saldo de monedas de los usuarios:');
  console.table(data);
}

checkCoins().catch(console.error);
