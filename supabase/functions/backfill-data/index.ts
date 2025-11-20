// supabase/functions/backfill-data/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import {
  updateContentByImdbId,
} from '../../../src/lib/imdb/fetchContent.ts'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[Backfill] 데이터 업데이트 시작...')

    // 1. 업데이트할 대상 가져오기
    // 전체를 다 하려면 .is('title_en', null) 조건을 빼세요.
    const { data: contents, error } = await supabase
      .from('contents')
      .select('imdb_id, genre, title')
      .not('imdb_id', 'is', null)
    // .is('title_en', null) // 필요하면 주석 해제하여 '안 된 것만' 처리

    if (error) throw error

    if (!contents || contents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No contents to update' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[Backfill] 총 ${contents.length}개 콘텐츠 업데이트 예정`)

    let successCount = 0
    let failCount = 0

    // 2. 순차적으로 업데이트 실행
    for (const [index, item] of contents.entries()) {
      if (!item.imdb_id) continue

      // 진행 상황 로그
      if (index % 5 === 0) {
        console.log(
          `Processing ${index + 1}/${contents.length}: ${item.title}`
        )
      }

      // TMDB API 부하 방지를 위한 딜레이 (0.2초)
      if (index > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }

      const success = await updateContentByImdbId(
        item.imdb_id,
        item.genre || '영화'
      )

      if (success) {
        successCount++
      } else {
        failCount++
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Backfill complete',
        total: contents.length,
        success: successCount,
        failed: failCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('[Backfill Error]', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

