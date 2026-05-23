const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: avatars, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    console.log('--- ACTIVE AVATARS IN DATABASE ---');
    avatars.forEach(av => {
      console.log(`ID: ${av.id}`);
      console.log(`Name: ${av.name}`);
      console.log(`Personality: ${av.personality}`);
      console.log(`Physical Description (in DB): "${av.physical_description}"`);
      console.log(`System Prompt: "${av.system_prompt}"`);
      console.log(`Base Image: ${av.base_image_url}`);
      console.log(`Current Image: ${av.current_image_url}`);
      console.log('----------------------------------\n');
    });

  } catch (err) {
    console.error('Error querying avatars:', err.message);
  }
}

run();
