import { supabase } from '../supabase'
import { moodsToImdbTags } from '../moodMapping'
import { fetchAndSaveRecommendations } from '../imdb/fetchContent'
import type { Content, Profile } from '../../types'

// OTT 정보를 동적으로 가져오는 헬퍼 함수 (내부 함수로 import)
// TMDB API를 사용하여 OTT 정보 가져오기
async function enrichContentWithOTT(content: Content): Promise<Content> {
  // 이미 OTT 정보가 있으면 그대로 반환
  if (content.ott_providers && content.ott_providers.length > 0) {
    return content
  }

  try {
    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
    
    let tmdbId: number | null = null
    let contentType: 'movie' | 'tv' = 'movie'
    
    // 방법 1: imdb_id가 있으면 IMDB ID로 TMDB ID 찾기
    if (content.imdb_id) {
      const findResponse = await fetch(
        `${TMDB_BASE_URL}/find/${content.imdb_id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`
      )
      
      if (findResponse.ok) {
        const findData = await findResponse.json()
        const tmdbMovie = findData.movie_results?.[0]
        const tmdbTV = findData.tv_results?.[0]
        
        if (tmdbMovie) {
          tmdbId = tmdbMovie.id
          contentType = 'movie'
        } else if (tmdbTV) {
          tmdbId = tmdbTV.id
          contentType = 'tv'
        }
      }
    }
    
    // 방법 2: imdb_id가 없으면 제목으로 검색
    if (!tmdbId && content.title) {
      const searchResponse = await fetch(
        `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=ko-KR&query=${encodeURIComponent(content.title)}&year=${content.year || ''}`
      )
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        const result = searchData.results?.[0]
        
        if (result) {
          tmdbId = result.id
          contentType = result.media_type === 'tv' ? 'tv' : 'movie'
        }
      }
    }
    
    if (!tmdbId) {
      return content
    }

    // TMDB ID로 OTT 정보 가져오기
    const endpoint =
      contentType === 'tv'
        ? `${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers`
        : `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers`
    
    let ottResponse = await fetch(`${endpoint}?api_key=${TMDB_API_KEY}`)
    
    // movie가 실패하면 tv로 시도 (타입이 잘못되었을 수 있음)
    if (!ottResponse.ok && contentType === 'movie') {
      ottResponse = await fetch(
        `${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`
      )
      if (ottResponse.ok) {
        contentType = 'tv'
      }
    }

    if (!ottResponse.ok) {
      return content
    }

    const ottData = await ottResponse.json()
    const krProviders = ottData.results?.KR

    if (!krProviders || !krProviders.flatrate) {
      return content
    }

    // OTT 정보 추가 (블로그 참고: w300 사용)
    const ottProviders = krProviders.flatrate.map((provider: any) => ({
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      logo_path: provider.logo_path
        ? `https://image.tmdb.org/t/p/w300${provider.logo_path}`
        : undefined,
    }))

    return {
      ...content,
      ott_providers: ottProviders.length > 0 ? ottProviders : undefined,
    }
  } catch (error) {
    console.warn('OTT 정보 가져오기 실패:', error)
    return content
  }
}

/**
 * 사용자 프로필 기반 추천 콘텐츠 가져오기
 * @param profile 사용자 프로필
 * @param forceRefresh 기존 추천 내역을 무시하고 무조건 새로 가져올지 여부 (기본값: false)
 */
export async function getRecommendations(
  profile: Profile,
  forceRefresh: boolean = false
): Promise<Content[]> {
  try {
    // forceRefresh가 true이면 기존 콘텐츠를 무시하고 무조건 TMDB에서 새로 가져오기
    if (forceRefresh) {
      console.log('[강제 새로고침] 기존 추천 내역 무시하고 TMDB에서 새로 가져오는 중...', {
        장르: profile.genre,
        무드: profile.moods,
      })
      const newContents = await fetchAndSaveRecommendations(
        profile.genre,
        profile.moods
      )

      // 장르 필터링 적용 (TMDB에서 가져온 결과가 정확하지 않을 수 있으므로)
      const genreFilteredContents = profile.genre
        ? newContents.filter((content) => content.genre === profile.genre)
        : newContents

      console.log('[강제 새로고침] 장르 필터링 결과', {
        원본개수: newContents.length,
        필터링후개수: genreFilteredContents.length,
        선택한장르: profile.genre,
        필터링된장르들: genreFilteredContents.map((c) => c.genre),
      })

      // 중복 제거 및 정렬
      const uniqueContents = Array.from(
        new Map(genreFilteredContents.map((c) => [c.id, c])).values()
      )
        .sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0))
        .slice(0, 3)

      // OTT 정보가 없는 콘텐츠에 대해 동적으로 가져오기
      const enrichedContents = await Promise.all(
        uniqueContents.map((content) => enrichContentWithOTT(content))
      )

      return enrichedContents
    }

    // 1. 먼저 Supabase에 저장된 콘텐츠 확인
    let query = supabase.from('contents').select('*')

    // 장르 필터링
    if (profile.genre) {
      query = query.eq('genre', profile.genre)
    }

    // 무드 태그 필터링
    if (profile.moods && profile.moods.length > 0) {
      const imdbTags = moodsToImdbTags(profile.moods)
      // tags 배열과 겹치는 항목이 있는지 확인 (OR 조건 - 하나라도 매칭되면 포함)
      query = query.overlaps('tags', imdbTags)
      
      // 또는 moods 필드가 있으면 직접 매칭 (더 정확한 필터링)
      // query = query.or(`moods.cs.{${profile.moods.join(',')}}},tags.ov.{${imdbTags.join(',')}}`)
    }

    const { data: existingContents, error: queryError } = await query
      .order('imdb_rating', { ascending: false })
      .limit(10)

    // 2. 저장된 콘텐츠가 3개 미만이면 TMDB에서 가져와서 저장
    if (!existingContents || existingContents.length < 3) {
      console.log('TMDB에서 콘텐츠 가져오는 중...', {
        기존콘텐츠개수: existingContents?.length || 0,
        장르: profile.genre,
        무드: profile.moods,
      })
      const newContents = await fetchAndSaveRecommendations(
        profile.genre,
        profile.moods
      )

      // 장르 필터링 적용 (TMDB에서 가져온 결과가 정확하지 않을 수 있으므로)
      const genreFilteredNewContents = profile.genre
        ? newContents.filter((content) => content.genre === profile.genre)
        : newContents

      console.log('[TMDB 가져온 콘텐츠 장르 필터링]', {
        원본개수: newContents.length,
        필터링후개수: genreFilteredNewContents.length,
        선택한장르: profile.genre,
        필터링된장르들: genreFilteredNewContents.map((c) => c.genre),
      })

      // 새로 가져온 콘텐츠와 기존 콘텐츠 합치기
      const allContents = [...(existingContents || []), ...genreFilteredNewContents]
      
      // 중복 제거 및 정렬
      const uniqueContents = Array.from(
        new Map(allContents.map((c) => [c.id, c])).values()
      )
        .sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0))
        .slice(0, 3)

      // 최종 장르 필터링 (혹시 모를 경우를 대비)
      const finalFilteredContents = profile.genre
        ? uniqueContents.filter((content) => content.genre === profile.genre)
        : uniqueContents

      console.log('[최종 추천 콘텐츠]', {
        개수: finalFilteredContents.length,
        장르들: finalFilteredContents.map((c) => `${c.title} (${c.genre})`),
      })

      // OTT 정보가 없는 콘텐츠에 대해 동적으로 가져오기
      const enrichedContents = await Promise.all(
        finalFilteredContents.map((content) => enrichContentWithOTT(content))
      )

      return enrichedContents
    }

    if (queryError) {
      console.error('추천 콘텐츠 조회 실패:', queryError)
      return []
    }

    // 3. 상위 3개 반환하고 OTT 정보 추가
    // 장르 필터링이 쿼리에서 적용되었지만, 혹시 모를 경우를 대비해 한 번 더 필터링
    let topContents = (existingContents || []).slice(0, 3)
    
    if (profile.genre) {
      // 장르가 일치하는 것만 필터링
      topContents = topContents.filter((content) => content.genre === profile.genre)
      console.log('[기존 콘텐츠 장르 필터링]', {
        원본개수: (existingContents || []).length,
        필터링후개수: topContents.length,
        선택한장르: profile.genre,
        필터링된장르들: topContents.map((c) => c.genre),
      })
    }
    
    // OTT 정보가 없는 콘텐츠에 대해 동적으로 가져오기 (병렬 처리)
    const enrichedContents = await Promise.all(
      topContents.map((content) => enrichContentWithOTT(content))
    )
    
    console.log('[최종 추천 콘텐츠 (기존 DB)]', {
      개수: enrichedContents.length,
      장르들: enrichedContents.map((c) => `${c.title} (${c.genre})`),
    })
    
    return enrichedContents
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

