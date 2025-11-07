import { createClient } from '@supabase/supabase-js'

// Deno 환경인지 확인 (Supabase Edge Function)
// @ts-ignore: 'Deno' is not defined in Vite/Node.js environment
const isDeno = typeof Deno !== 'undefined'

// Deno(백엔드)일 경우 Deno.env.get()을, Vite(프론트엔드)일 경우 import.meta.env를 사용
const supabaseUrl = isDeno
  // @ts-ignore
  ? Deno.env.get('VITE_SUPABASE_URL')!
  : import.meta.env.VITE_SUPABASE_URL!

const supabaseAnonKey = isDeno
  // @ts-ignore
  ? Deno.env.get('VITE_SUPABASE_ANON_KEY')!
  : import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)