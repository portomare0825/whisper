import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ksezyjdxvjgiryaiulew.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZXp5amR4dmpnaXJ5YWl1bGV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1MTI2OCwiZXhwIjoyMDk0NTI3MjY4fQ.Je4KOW0UzWUT5wos1UkRH_T6ukRAzIwiTvKbkFdo1IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  // Buscar el avatar más reciente
  const { data: avatar, error } = await supabase
    .from('avatars')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching avatar:', error);
    return;
  }

  console.log('Testing with avatar:', avatar.id);
  console.log('Base image:', avatar.base_image_url);
  console.log('Physical description:', avatar.physical_description);

  try {
    const res = await fetch('http://localhost:3000/api/avatars/generate-angles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ avatarId: avatar.id })
    });
    
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
