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
    // 요청 본문에서 옵션 파라미터 받기 (limit, offset)
    let limit = 50 // 기본값: 한 번에 50개만 처리
    let offset = 0
    let onlyMissing = false // title_en이 null인 것만 처리할지 여부

    try {
      const body = await req.json().catch(() => ({}))
      limit = body.limit || 50
      offset = body.offset || 0
      onlyMissing = body.onlyMissing || false
    } catch (_error) {
      // body가 없으면 기본값 사용
    }

    console.log(`[Backfill] 데이터 업데이트 시작... (limit: ${limit}, offset: ${offset}, onlyMissing: ${onlyMissing})`)

    // 1. 업데이트할 대상 가져오기 (제한된 개수만)
    let query = supabase
      .from('contents')
      .select('imdb_id, genre, title, title_en, description_en, tags_en')
      .not('imdb_id', 'is', null)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: true })

    // 영어 데이터가 없는 것만 처리하도록 필터 추가
    // title_en, description_en, tags_en 중 하나라도 null이거나 비어있으면 처리
    if (onlyMissing) {
      query = query.or('title_en.is.null,description_en.is.null,tags_en.is.null')
    }

    const { data: contents, error } = await query

    if (error) throw error

    if (!contents || contents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No contents to update', processed: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[Backfill] 총 ${contents.length}개 콘텐츠 업데이트 예정 (offset: ${offset})`)

    let successCount = 0
    let failCount = 0

    // 2. 순차적으로 업데이트 실행 (제한 시간 내에 처리 가능한 만큼만)
    for (const [index, item] of contents.entries()) {
      if (!item.imdb_id) continue

      // 진행 상황 로그
      if (index % 5 === 0 || index === 0) {
        console.log(
          `Processing ${index + 1}/${contents.length}: ${item.title} (${item.imdb_id})`
        )
      }

      // TMDB API 부하 방지를 위한 딜레이 (0.2초)
      if (index > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }

      try {
        const success = await updateContentByImdbId(
          item.imdb_id,
          item.genre || '영화'
        )

        if (success) {
          successCount++
        } else {
          failCount++
        }
      } catch (error: any) {
        console.error(`[업데이트 실패] ${item.imdb_id}:`, error?.message || error)
        failCount++
      }
    }

    const hasMore = contents.length === limit // limit만큼 가져왔다면 더 있을 가능성

    return new Response(
      JSON.stringify({
        message: 'Backfill batch complete',
        processed: contents.length,
        total: contents.length,
        success: successCount,
        failed: failCount,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
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

