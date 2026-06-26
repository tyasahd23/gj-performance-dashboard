import { createClient } from "@supabase/supabase-js"

export const supabaseUtil = createClient(
  import.meta.env.VITE_SUPABASE_URL_UTIL,
  import.meta.env.VITE_SUPABASE_ANON_KEY_UTIL
)