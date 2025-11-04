import { supabase } from '../supabase'
import { moodsToImdbTags } from '../moodMapping'
import { fetchAndSaveRecommendations } from '../imdb/fetchContent'
import type { Content, Profile } from '../../types'

/**
 * 사용자 프로필 기반 추천 콘텐츠 가져오기
 */
export async function getRecommendations(
  profile: Profile
): Promise<Content[]> {
  try {
    // 1. 먼저 Supabase에 저장된 콘텐츠 확인
    let query = supabase.from('contents').select('*')

    // 장르 필터링
    if (profile.genre) {
      query = query.eq('genre', profile.genre)
    }

    // 무드 태그 필터링
    if (profile.moods && profile.moods.length > 0) {
      const imdbTags = moodsToImdbTags(profile.moods)
      // tags 배열과 겹치는 항목이 있는지 확인
      query = query.overlaps('tags', imdbTags)
    }

    const { data: existingContents, error: queryError } = await query
      .order('imdb_rating', { ascending: false })
      .limit(10)

    // 2. 저장된 콘텐츠가 3개 미만이면 TMDB에서 가져와서 저장
    if (!existingContents || existingContents.length < 3) {
      console.log('TMDB에서 콘텐츠 가져오는 중...')
      const newContents = await fetchAndSaveRecommendations(
        profile.genre,
        profile.moods
      )

      // 새로 가져온 콘텐츠와 기존 콘텐츠 합치기
      const allContents = [...(existingContents || []), ...newContents]
      
      // 중복 제거 및 정렬
      const uniqueContents = Array.from(
        new Map(allContents.map((c) => [c.id, c])).values()
      )
        .sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0))
        .slice(0, 3)

      return uniqueContents
    }

    if (queryError) {
      console.error('추천 콘텐츠 조회 실패:', queryError)
      return []
    }

    // 3. 상위 3개 반환
    return (existingContents || []).slice(0, 3)
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

