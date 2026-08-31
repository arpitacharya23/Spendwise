import { createClient } from '@supabase/supabase-js';

// Supabase Connection Credentials provided by the user
const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};

export const SUPABASE_URL: string = 
  metaEnv.VITE_SUPABASE_URL || 
  metaEnv.NEXT_PUBLIC_SUPABASE_URL || 
  'https://kdjptkhfvzvsevzbcmik.supabase.co';

export const SUPABASE_ANON_KEY: string = 
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || 
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  'sb_publishable_U073qwpspSpADzBXfs55dA_h842lmUO';

// Initialize the universal Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
