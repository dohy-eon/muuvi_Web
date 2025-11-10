// @ts-ignore: Deno 환경에서 제공되는 모듈
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  fetchAndSaveRecommendations,
  importSpecificTVShows,
} from '../../../src/lib/imdb/fetchContent.ts'

const GENRES = ['영화', '드라마', '애니메이션', '예능']
const MOODS = ['01', '02', '03', '04', '05', '06', '07', '08', '09']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log('Populate DB Function Loaded (Single Job Mode)')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let genre: string | undefined
    let mood: string | undefined
    let tmdbIds: number[] | undefined

    try {
      const body = await req.json()
      genre = body?.genre
      mood = body?.mood
      if (Array.isArray(body?.tmdbIds)) {
        tmdbIds = body.tmdbIds
          .map((id: unknown) => {
            const parsed = typeof id === 'string' ? parseInt(id, 10) : id
            return Number.isFinite(parsed) ? Number(parsed) : null
          })
          .filter((value): value is number => value !== null)
      }
    } catch (_error) {
      // body가 없거나 JSON 파싱 실패 시 무시하고 자동 선택 로직으로 진행
    }

    if (tmdbIds && tmdbIds.length > 0) {
      const moodIds =
        mood !== undefined
          ? [mood]
          : Array.isArray(req.headers.get('x-moods'))
          ? req.headers
              .get('x-moods')!
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : []

      if (!genre) {
        genre = '드라마'
      }

      if (moodIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'mood 값을 제공해야 합니다.' }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
            status: 400,
          },
        )
      }

      console.log(
        `[수동 TMDB 수집] genre=${genre}, moods=${moodIds.join(
          ',',
        )}, tmdbIds=${tmdbIds.join(',')}`,
      )

      const savedContents = await importSpecificTVShows(tmdbIds, moodIds)

      return new Response(
        JSON.stringify({
          message: '특정 TMDB TV 수집 완료',
          inserted: savedContents.length,
          tmdbIds,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 200,
        },
      )
    }

    if (!genre || !mood) {
      // [기본 동작] 36개 조합 중 1개만 선택
      const minute = new Date().getMinutes() // 현재 '분' (0-59)
      const totalCombinations = GENRES.length * MOODS.length // 4 * 9 = 36

      // 현재 '분'을 기준으로 36개 조합 중 하나를 선택
      // (0-35분은 0-35 인덱스, 36-59분은 0-23 인덱스 재사용)
      const index = minute % totalCombinations

      const genreIndex = Math.floor(index / MOODS.length)
      const moodIndex = index % MOODS.length

      genre = GENRES[genreIndex]
      mood = MOODS[moodIndex]
      console.log(`[자동 선택] index ${index}: ${genre} + ${mood}`)
    } else {
      if (!GENRES.includes(genre) || !MOODS.includes(mood)) {
        return new Response(
          JSON.stringify({ error: 'Invalid genre or mood value' }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
            status: 400,
          },
        )
      }
      console.log(`[수동 실행] ${genre} + ${mood}`)
    }

    console.log(`Running population for: ${genre} + ${mood}`)

    // [수정] 선택된 1개의 조합만 실행
    await fetchAndSaveRecommendations(genre, [mood])

    return new Response(
      JSON.stringify({
        message: `DB Population complete for: ${genre} + ${mood}`,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    )
  }
})

