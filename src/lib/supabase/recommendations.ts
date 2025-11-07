import { supabase } from '../supabase.ts'
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

    // 2. 검색 텍스트를 "검색 벡터"로 변환
    const { data: embedData, error: embedError } = await supabase.functions.invoke(
      'embed',
      { body: { text: queryText } }
    )
    if (embedError) throw embedError
    const query_vector = embedData.vector

    // 3. 1차 필터링에 사용할 태그 준비 (선택 사항이지만 정확도 향상에 도움)
    const p_mood_tags = moodsToImdbTags(profile.moods)
    
    // 4. [수정] DB의 'match_contents' 함수(RPC)를 호출
    const { data, error } = await supabase.rpc('match_contents', {
      query_vector: query_vector, // AI 검색 벡터
      match_count: 5,             // 5개 결과 요청
      p_genre: profile.genre,     // 1차 필터: 장르
      p_mood_tags: p_mood_tags    // 1차 필터: 태그
    })

    if (error) {
      console.error('벡터 검색(RPC) 실패:', error)
      return []
    }
    
    // 5. OTT 제공자가 실제로 있는 콘텐츠만 필터링
    const contentsWithOTT = (data || []).filter(
      (content: Content) => content.ott_providers && content.ott_providers.length > 0
    )

    console.log(`[AI 추천] "${queryText}" => ${contentsWithOTT.length}개 반환`)

    // 6. 상위 3개 반환
    return contentsWithOTT.slice(0, 3)
    
  } catch (error) {
    console.error('AI 추천 조회 중 오류:', error)
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

