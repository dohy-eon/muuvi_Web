import { supabase } from '../supabase.ts'
const isDeno = typeof Deno !== 'undefined'

async function getFunctionAuthHeaders() {
  let anonKey = ''
  let serviceKey = ''

  if (isDeno) {
    // @ts-ignore: Deno globals only in edge runtime
    anonKey =
      Deno.env.get('SUPABASE_ANON_KEY') ||
      Deno.env.get('VITE_SUPABASE_ANON_KEY') ||
      ''
    // @ts-ignore
    serviceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') ||
      ''
  } else if (typeof import.meta !== 'undefined') {
    anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
    serviceKey = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  }

  const session = await supabase.auth.getSession().catch(() => null)
  const accessToken = session?.data?.session?.access_token

  const headers: Record<string, string> = {}
  const token = accessToken || serviceKey || anonKey

  if (anonKey) {
    headers.apikey = anonKey
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}
import { moodsToImdbTags } from '../moodMapping.ts' // 1차 필터링을 위해 유지
import type { Content, Profile } from '../../types/index.ts'

// [추가] 무드 ID를 한글로 변환 (검색어 생성용)
const moodIdToKorean: Record<string, string> = {
  '01': '로맨스',
  '02': '호러',
  '03': '코미디',
  '04': '공상 과학',
  '05': '판타지',
  '06': '어드벤처',
  '07': '액션',
  '08': '힐링',
  '09': '미스테리',
}

/**
 * 사용자 프로필 기반 AI 벡터 검색 추천
 * @param profile 사용자 프로필
 */
export async function getRecommendations(
  profile: Profile,
  _forceRefresh: boolean = false
): Promise<Content[]> {
  try {
    // 1. 사용자의 선택을 AI가 이해할 수 있는 "검색 텍스트"로 변환
    const moodNames = profile.moods.map(id => moodIdToKorean[id] || '').join(' ')
    const queryText = `${moodNames} ${profile.genre}` // 예: "힐링 로맨스 드라마"
    const p_mood_tags = moodsToImdbTags(profile.moods)

    // 2. AI 벡터 검색 시도
    try {
      console.log(`[AI 추천 시도] "${queryText}"`)
      
      // 검색 텍스트를 "검색 벡터"로 변환
      const { data: embedData, error: embedError } = await supabase.functions.invoke(
        'embed',
        { body: { text: queryText } }
      )
      
      if (embedError) {
        console.warn('[임베딩 실패] 태그 검색으로 폴백:', embedError.message)
        throw embedError
      }
      
      const query_vector = embedData.vector
      
      // DB의 'match_contents' 함수(RPC)를 호출
      const { data, error } = await supabase.rpc('match_contents', {
        query_vector: query_vector,
        match_count: 5,
        p_genre: profile.genre,
        p_mood_tags: p_mood_tags
      })

      if (error) {
        console.warn('[벡터 검색 실패] 태그 검색으로 폴백:', error.message)
        throw error
      }
      
      // OTT 제공자가 있는 콘텐츠만 필터링
      const contentsWithOTT = (data || []).filter(
        (content: Content) => content.ott_providers && content.ott_providers.length > 0
      )

      if (contentsWithOTT.length > 0) {
        console.log(`[AI 추천 성공] "${queryText}" => ${contentsWithOTT.length}개 반환`)
        return contentsWithOTT.slice(0, 3)
      }
      
      console.log('[AI 추천 결과 없음] 태그 검색으로 폴백')
      throw new Error('No AI results')
      
    } catch (aiError) {
      // 3. AI 검색 실패 시 태그 기반 검색으로 폴백
      console.log(`[태그 기반 검색] "${queryText}"`)
      
      let query = supabase.from('contents').select('*')
      
      // OTT 필터
      query = query.not('ott_providers', 'is', null)
      
      // 장르 필터
      if (profile.genre) {
        query = query.eq('genre', profile.genre)
      }
      
      // 무드 태그 필터
      if (p_mood_tags.length > 0) {
        query = query.overlaps('tags', p_mood_tags)
      }
      
      const { data: tagData, error: tagError } = await query
        .order('imdb_rating', { ascending: false, nullsFirst: false })
        .limit(20)
      
      if (tagError) {
        console.error('[태그 검색 실패]:', tagError)
        return []
      }
      
      // OTT 필터링
      const contentsWithOTT = (tagData || []).filter(
        (content: Content) => content.ott_providers && content.ott_providers.length > 0
      )
      
      console.log(`[태그 추천 성공] "${queryText}" => ${contentsWithOTT.length}개 반환`)

      if (contentsWithOTT.length === 0) {
        const primaryMood = profile.moods[0]
        if (profile.genre && primaryMood) {
          try {
            console.log(`[데이터 보충 요청] ${profile.genre} + ${primaryMood}`)
            const headers = await getFunctionAuthHeaders()

            await supabase.functions.invoke('populate-db', {
              body: {
                genre: profile.genre,
                mood: primaryMood,
              },
              headers,
            })
          } catch (populateError: any) {
            console.warn('[데이터 보충 실패]', populateError?.message || populateError)
          }
        }
      }

      return contentsWithOTT.slice(0, 3)
    }
    
  } catch (error) {
    console.error('추천 조회 실패:', error)
    return []
  }
}

/**
 * IMDB 데이터를 Supabase에 동기화하는 함수
 * (백엔드에서 주기적으로 실행하거나 Edge Function으로 구현)
 */
export async function syncImdbContent(imdbId: string): Promise<Content | null> {
  try {
    // IMDB API 호출 (Supabase Edge Function 또는 외부 API 사용)
    // 예시: Supabase Edge Function을 통해 IMDB 데이터 가져오기
    const { data, error } = await supabase.functions.invoke('fetch-imdb', {
      body: { imdb_id: imdbId },
    })

    if (error) {
      console.error('IMDB 동기화 실패:', error)
      return null
    }

    // 콘텐츠 저장
    const { data: content, error: insertError } = await supabase
      .from('contents')
      .upsert({
        imdb_id: imdbId,
        title: data.title,
        description: data.plot,
        poster_url: data.poster,
        imdb_rating: data.rating,
        year: data.year,
        genres: data.genres,
        tags: data.tags,
      })
      .select()
      .single()

    if (insertError) {
      console.error('콘텐츠 저장 실패:', insertError)
      return null
    }

    return content
  } catch (error) {
    console.error('IMDB 동기화 중 오류:', error)
    return null
  }
}

