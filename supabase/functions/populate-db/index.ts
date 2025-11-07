import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// 중요: Deno 함수에서 라이브러리를 임포트할 때는,
// tsconfig.json의 "paths"가 적용되지 않으므로 상대 경로를 정확히 입력해야 합니다.
// 이 경로는 supabase/functions/populate-db/ 에서 src/lib/ 까지의 상대 경로입니다.
import { fetchAndSaveRecommendations } from '../../../src/lib/imdb/fetchContent.ts'

const GENRES = ['영화', '드라마', '애니메이션', '예능']
const MOODS = ['01', '02', '03', '04', '05', '06', '07', '08', '09']

console.log('Populate DB Function Loaded')

serve(async (req) => {
  try {
    console.log('Starting scheduled population...')
    
    // 모든 장르 x 모든 무드 조합으로 데이터 수집
    // (API 제한을 피하기 위해 순차적으로 실행)
    for (const genre of GENRES) {
      for (const mood of MOODS) {
        console.log(`Fetching: ${genre} + ${mood}`)
        // 각 조합별로 20개의 추천 콘텐츠를 가져와 DB에 저장
        await fetchAndSaveRecommendations(genre, [mood])
        
        // TMDB API Rate Limit (초당 40회)을 피하기 위해 2초간 대기
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return new Response(
      JSON.stringify({ message: 'DB Population complete!' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})

