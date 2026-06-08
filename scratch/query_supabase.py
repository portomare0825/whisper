import urllib.request
import json

SUPABASE_URL = "https://ksezyjdxvjgiryaiulew.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZXp5amR4dmpnaXJ5YWl1bGV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1MTI2OCwiZXhwIjoyMDk0NTI3MjY4fQ.Je4KOW0UzWUT5wos1UkRH_T6ukRAzIwiTvKbkFdo1IM"

def query_avatars():
    url = f"{SUPABASE_URL}/rest/v1/avatars?select=id,name,base_image_url,emotion_happy,emotion_sad,emotion_angry,emotion_flirty,profile_image_url,back_image_url,created_at,updated_at&order=updated_at.desc"
    
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        }
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"FOUND {len(data)} AVATARS:")
            for av in data:
                print(f"\n--- Avatar: {av.get('name')} (ID: {av.get('id')}) ---")
                print(f"Created: {av.get('created_at')} | Updated: {av.get('updated_at')}")
                print(f"Base Image: {av.get('base_image_url')}")
                print(f"Happy:   {'YES' if av.get('emotion_happy') else 'NO'} ({av.get('emotion_happy')})")
                print(f"Sad:     {'YES' if av.get('emotion_sad') else 'NO'} ({av.get('emotion_sad')})")
                print(f"Angry:   {'YES' if av.get('emotion_angry') else 'NO'} ({av.get('emotion_angry')})")
                print(f"Flirty:  {'YES' if av.get('emotion_flirty') else 'NO'} ({av.get('emotion_flirty')})")
                print(f"Profile: {'YES' if av.get('profile_image_url') else 'NO'} ({av.get('profile_image_url')})")
                print(f"Back:    {'YES' if av.get('back_image_url') else 'NO'} ({av.get('back_image_url')})")
    except Exception as e:
        print("Error calling Supabase API:", e)

if __name__ == "__main__":
    query_avatars()
