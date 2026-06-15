export type Role = 'user' | 'avatar';

export interface Avatar {
  id: string;
  user_id: string;
  name: string;
  personality: string;
  system_prompt?: string;
  base_image_url: string;
  current_image_url?: string;
  profile_image_url?: string;
  back_image_url?: string;
  emotion_happy?: string;
  emotion_sad?: string;
  emotion_angry?: string;
  emotion_flirty?: string;
  voice_settings?: {
    gender?: string;
    [key: string]: any;
  };
  roleplay_settings?: {
    dificultad_conquista: number;
    apertura_inicial: number;
    velocidad_confianza: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  avatar_id: string;
  title: string;
  current_avatar_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  audio_url?: string;
  tokens_used?: number;
  emotion_tag?: string;
  hidden_thought?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'pro' | 'pay_per_use';
  stripe_customer_id?: string;
  status: 'active' | 'canceled' | 'expired';
  expires_at?: string;
  created_at: string;
}
