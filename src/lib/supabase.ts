import { createClient } from '@supabase/supabase-js'

// Deno 환경인지 확인 (Supabase Edge Function)
// @ts-expect-error: 'Deno' is not defined in Vite/Node.js environment
const isDeno = typeof Deno !== 'undefined'

// Deno(백엔드)일 경우 Deno.env.get()을, Vite(프론트엔드)일 경우 import.meta.env를 사용
const supabaseUrl = isDeno
  // @ts-expect-error: Deno globals only in edge runtime
  ? Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || ''
  : import.meta.env.VITE_SUPABASE_URL!

const supabaseKey = isDeno
  // @ts-expect-error: Deno globals only in edge runtime
  ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('VITE_SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_ANON_KEY') ||
    ''
  : import.meta.env.VITE_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL 또는 Key가 정의되어 있지 않습니다.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)