export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as
  | string
  | undefined;

export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

