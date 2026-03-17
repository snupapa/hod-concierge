import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let browserClient;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

export function getFunctionsBaseUrl() {
  const explicitUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (explicitUrl) return explicitUrl;
  if (!supabaseUrl) return "";
  const match = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co$/);
  if (!match) return "";
  return `https://${match[1]}.functions.supabase.co`;
}
