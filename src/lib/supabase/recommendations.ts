import { supabase } from '../supabase.ts'
import { moodsToImdbTags } from '../moodMapping.ts'
import type { Content, Profile } from '../../types/index.ts'

/**
 * 사용자 프로필 기반 추천 콘텐츠 가져오기
 * @param profile 사용자 프로필
 */
export async function getRecommendations(
  profile: Profile,
  _forceRefresh: boolean = false // 이 파라미터는 더 이상 사용되지 않습니다.
): Promise<Content[]> {
  try {
    // 1. Supabase에 저장된 콘텐츠만 조회
    let query = supabase.from('contents').select('*')

    // 2. OTT 제공자가 있는 콘텐츠만 필터링 (시청 가능한 콘텐츠만)
    query = query.not('ott_providers', 'is', null)

    // 3. 장르 필터링
    if (profile.genre) {
      query = query.eq('genre', profile.genre)
    }

    // 4. 무드 태그 필터링
    if (profile.moods && profile.moods.length > 0) {
      const imdbTags = moodsToImdbTags(profile.moods)
      // tags 배열과 겹치는 항목이 있는지 확인 (OR 조건)
      query = query.overlaps('tags', imdbTags)
    }

    const { data: existingContents, error: queryError } = await query
      .order('imdb_rating', { ascending: false, nullsFirst: false }) // 평점 높은 순
      .limit(20) // OTT 필터링을 고려해 여유있게 20개 가져옴

    if (queryError) {
      console.error('추천 콘텐츠 조회 실패:', queryError)
      return []
    }

    // [제거] DB에 3개 미만일 때 TMDB API를 호출하는 로직 (fetchAndSaveRecommendations) 삭제
    // [제거] OTT 정보를 실시간으로 추가하는 로직 (enrichContentWithOTT) 삭제

    // 5. OTT 제공자가 실제로 있는 콘텐츠만 필터링 (빈 배열 제외)
    const contentsWithOTT = (existingContents || []).filter(
      (content) => content.ott_providers && content.ott_providers.length > 0
    )

    console.log(`[추천] 전체: ${existingContents?.length || 0}개, OTT 있음: ${contentsWithOTT.length}개`)

    // 6. 상위 3개 반환 (이미 DB에 OTT 정보가 저장되어 있음)
    return contentsWithOTT.slice(0, 3)
    
  } catch (error) {
    console.error('추천 콘텐츠 조회 중 오류:', error)
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

