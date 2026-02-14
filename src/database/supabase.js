import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use local storage for session persistence
    storage: window.localStorage,
    // Auto refresh token before expiry
    autoRefreshToken: true,
    // Persist session across page refreshes
    persistSession: true,
    // Detect session from URL (for OAuth flows)
    detectSessionInUrl: true,
    // Flow type for PKCE (more secure)
    flowType: 'pkce'
  }
});