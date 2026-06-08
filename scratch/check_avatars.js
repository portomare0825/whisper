const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ksezyjdxvjgiryaiulew.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZXp5amR4dmpnaXJ5YWl1bGV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1MTI2OCwiZXhwIjoyMDk0NTI3MjY4fQ.Je4KOW0UzWUT5wos1UkRH_T6ukRAzIwiTvKbkFdo1IM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: avatars, error } = await supabase
    .from('avatars')
    .select('id, name, base_image_url, emotion_happy, emotion_sad, emotion_angry, emotion_flirty, profile_image_url, back_image_url, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching avatars:', error);
    return;
  }

  console.log(`FOUND ${avatars.length} AVATARS:`);
  for (const av of avatars) {
    console.log(`\n--- Avatar: ${av.name} (ID: ${av.id}) ---`);
    console.log(`Created: ${av.created_at} | Updated: ${av.updated_at}`);
    console.log(`Base Image: ${av.base_image_url}`);
    console.log(`Happy:   ${av.emotion_happy ? 'YES' : 'NO'} (${av.emotion_happy})`);
    console.log(`Sad:     ${av.emotion_sad ? 'YES' : 'NO'} (${av.emotion_sad})`);
    console.log(`Angry:   ${av.emotion_angry ? 'YES' : 'NO'} (${av.emotion_angry})`);
    console.log(`Flirty:  ${av.emotion_flirty ? 'YES' : 'NO'} (${av.emotion_flirty})`);
    console.log(`Profile: ${av.profile_image_url ? 'YES' : 'NO'} (${av.profile_image_url})`);
    console.log(`Back:    ${av.back_image_url ? 'YES' : 'NO'} (${av.back_image_url})`);
  }
}

check();
