import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY. Bez toho kytka ani nefotí.'
    : null

export function getSupabaseClient() {
  if (supabaseConfigError) return null

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
}
