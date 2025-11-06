import { supabase } from '../supabase'
import { GENRE_TO_TMDB_ID } from '../tmdb/genreMapping'
import { moodsToTMDBParams } from '../tmdb/moodToTMDB'
import type { Content, OTTProvider } from '../../types'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

interface TMDBMovie {
  id: number
  title?: string // Movie용
  name?: string // TV용
  original_title?: string // Movie 원제
  original_name?: string // TV 원제
  overview: string
  poster_path: string
  backdrop_path?: string // 배경 이미지
  release_date?: string // Movie용
  first_air_date?: string // TV용
  last_air_date?: string // TV 마지막 방영일
  vote_average: number
  vote_count?: number
  popularity?: number
  genre_ids: number[]
  imdb_id?: string
  original_language?: string
  production_countries?: Array<{ iso_3166_1: string; name: string }>
  // TV 전용 필드
  number_of_seasons?: number
  number_of_episodes?: number
  networks?: Array<{ id: number; name: string }>
}

interface TMDBGenre {
  id: number
  name: string
}

interface TMDBWatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

interface TMDBWatchProvidersResponse {
  results: {
    KR?: {
      flatrate?: TMDBWatchProvider[] // 구독 서비스
      buy?: TMDBWatchProvider[] // 구매
      rent?: TMDBWatchProvider[] // 대여
    }
  }
}

/**
 * TMDB Search API로 콘텐츠 검색 (제목 기반)
 * discover API로 결과가 부족할 때 사용
 */
async function searchContentFromTMDB(
  query: string,
  contentType: 'movie' | 'tv' = 'movie',
  limit: number = 10
): Promise<TMDBMovie[]> {
  try {
    const endpoint = contentType === 'tv' ? 'search/tv' : 'search/movie'
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: 'ko-KR',
      query: query,
      page: '1',
    })

    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.results?.slice(0, limit) || []
  } catch (error) {
    console.error('TMDB Search API 오류:', error)
    return []
  }
}

/**
 * TMDB에서 콘텐츠 데이터 가져오기 (영화/TV)
 * Discover API 사용, 결과가 부족하면 Search API로 보완
 */
async function fetchMoviesFromTMDB(
  genre: string,
  moods: string[],
  limit: number = 20
): Promise<TMDBMovie[]> {
  try {
    // 드라마, 예능, 애니메이션은 TV 엔드포인트 사용, 나머지는 Movie 엔드포인트 사용
    const isTV = genre === '드라마' || genre === '예능' || genre === '애니메이션'
    const endpoint = isTV ? 'discover/tv' : 'discover/movie'

    console.log('[TMDB 검색 시작]', {
      genre,
      moods,
      endpoint,
      isTV,
    })

    // TMDB Discover API로 콘텐츠 검색 (고급 필터링 옵션 활용)
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: 'ko-KR',
      'vote_count.gte': '100', // 최소 평가 수 (품질 보장)
      'vote_average.gte': '6.0', // 최소 평점 (6.0 이상)
      page: '1',
      // 'with_original_language': 'ko', // 한국 작품 우선 (선택사항) - 주석 처리하여 검색 범위 확대
    })

    // 장르 필터 추가 (선택한 장르 우선)
    const genreIds: number[] = []
    const selectedGenreId = genre !== '영화' && GENRE_TO_TMDB_ID[genre] ? GENRE_TO_TMDB_ID[genre] : null
    
    // 선택한 장르가 있으면 우선 적용 (필수)
    if (selectedGenreId) {
      genreIds.push(selectedGenreId)
      console.log('[장르 필터]', { genre, genreId: selectedGenreId })
    } else {
      console.log('[장르 필터] 없음 (또는 영화)', { genre })
    }
    
    // 무드를 TMDB 파라미터로 변환
    const moodParams = moodsToTMDBParams(moods)
    console.log('[무드 파라미터]', {
      moods,
      genres: moodParams.genres,
      keywords: moodParams.keywords,
      sortBy: moodParams.sortBy,
    })
    
    // 무드에서 나온 장르 ID 추가
    if (moodParams.genres && moodParams.genres.length > 0) {
      if (genreIds.length > 0) {
        // 장르와 무드를 모두 포함 (AND 조건 - 드라마 + 판타지)
        genreIds.push(...moodParams.genres)
        console.log('[장르+무드 조합]', { combinedGenres: genreIds })
      } else {
        // 장르가 없으면 무드만 사용
        genreIds.push(...moodParams.genres)
        console.log('[무드 장르만 사용]', { moodGenres: genreIds })
      }
    } else {
      console.log('[무드 장르] 없음')
    }
    
    // 중복 제거
    const uniqueGenreIds = Array.from(new Set(genreIds))
    console.log('[최종 장르 필터]', { uniqueGenreIds })
    
    // 장르 ID가 있으면 필터 추가
    if (uniqueGenreIds.length > 0) {
      // TMDB는 여러 장르를 쉼표로 구분 (AND 조건)
      params.append('with_genres', uniqueGenreIds.join(','))
      console.log('[TMDB 장르 필터 적용]', uniqueGenreIds.join(','))
    } else {
      console.warn('[경고] 장르 필터가 없습니다 - 검색 범위가 넓어질 수 있습니다')
    }
    
    // 키워드 필터 추가 (무드 기반)
    // TMDB 문서: with_keywords는 파이프(|)로 OR 조건, 콤마(,)로 AND 조건
    // 무드는 감정/분위기이므로 OR 조건(파이프) 사용이 더 적합
    if (moodParams.keywords && moodParams.keywords.length > 0) {
      // 여러 키워드를 OR 조건(|)으로 연결하여 더 넓은 범위 검색
      const keywordString = moodParams.keywords.join('|')
      params.append('with_keywords', keywordString)
      console.log('[키워드 필터]', { 
        keywordIds: moodParams.keywords,
        keywordString,
        논리: 'OR (|)',
      })
    } else {
      console.log('[키워드 필터] 없음')
    }
    
    // 정렬 기준 설정 (무드 기반 또는 기본값)
    params.append('sort_by', moodParams.sortBy || 'vote_average.desc')
    console.log('[정렬 기준]', moodParams.sortBy || 'vote_average.desc')
    
    // 한국 제작 작품 우선 (선택사항 - 필요시 활성화)
    // params.append('with_origin_country', 'KR') // 주석 처리 - 검색 범위 확대
    
    // 출시/방영 기간 필터 (최근 10년 작품 우선)
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - 10
    if (isTV) {
      params.append('first_air_date.gte', `${startYear}-01-01`)
      
      // TV 타입 필터 추가 (예능의 경우 Reality/Talk Show 타입 필터링)
      // TMDB 문서: with_type (0=Documentary, 1=News, 2=Miniseries, 3=Reality, 4=Scripted, 5=Talk Show, 6=Video)
      if (genre === '예능') {
        // 예능은 Reality(3) 또는 Talk Show(5) 타입
        params.append('with_type', '3|5')
        console.log('[TV 타입 필터] 예능', { with_type: '3|5 (Reality|Talk Show)' })
      } else if (genre === '드라마') {
        // 드라마는 Scripted(4) 타입
        params.append('with_type', '4')
        console.log('[TV 타입 필터] 드라마', { with_type: '4 (Scripted)' })
      }
    } else {
      params.append('primary_release_date.gte', `${startYear}-01-01`)
    }

    const requestUrl = `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`
    console.log('[TMDB 요청 URL]', requestUrl)

    const response = await fetch(requestUrl)

    if (!response.ok) {
      // 429 에러 (Rate Limit) 처리
      if (response.status === 429) {
        console.warn('[TMDB API] Rate Limit 초과, 잠시 후 재시도')
        return []
      }
      console.error('[TMDB API 오류]', {
        status: response.status,
        statusText: response.statusText,
        genre,
        moods,
      })
      throw new Error(`TMDB API 오류: ${response.status}`)
    }

    const data = await response.json()
    console.log('[TMDB 검색 결과]', {
      totalResults: data.total_results || 0,
      resultsCount: data.results?.length || 0,
      page: data.page || 1,
      totalPages: data.total_pages || 0,
    })
    
    // 결과가 없으면 필터를 완화하여 재검색 (엔드포인트는 유지)
    if (!data.results || data.results.length === 0) {
      console.warn('[검색 결과 없음] 필터 완화하여 재검색...', {
        원인분석: {
          장르: selectedGenreId ? `${genre} (ID: ${selectedGenreId})` : '없음',
          무드장르: (moodParams.genres && moodParams.genres.length > 0) ? moodParams.genres : '없음',
          키워드: (moodParams.keywords && moodParams.keywords.length > 0) ? moodParams.keywords[0] : '없음',
          최소평점: '6.0',
          최소평가수: '100',
          기간필터: isTV ? `${startYear}-01-01 이후` : `${startYear}-01-01 이후`,
          엔드포인트: endpoint, // 중요: TV는 TV, Movie는 Movie로 유지
        },
      })
      
      // 최소 평점 필터 제거
      params.delete('vote_average.gte')
      console.log('[재검색] 최소 평점 필터 제거')
      
      // 최소 평가 수 완화 (100 -> 50)
      params.set('vote_count.gte', '50')
      console.log('[재검색] 최소 평가 수 완화 (100 -> 50)')
      
      // 최근 10년 제한 제거
      if (isTV) {
        params.delete('first_air_date.gte')
        console.log('[재검색] TV 방영일 필터 제거')
      } else {
        params.delete('primary_release_date.gte')
        console.log('[재검색] 영화 개봉일 필터 제거')
      }
      
      // 중요: 엔드포인트는 변경하지 않음 (드라마는 TV, 영화는 Movie로 유지)
      const retryUrl = `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`
      console.log('[재검색 요청 URL]', retryUrl, {
        엔드포인트확인: endpoint,
        장르: genre,
        isTV: isTV,
      })
      
      const retryResponse = await fetch(retryUrl)
      
      if (retryResponse.ok) {
        const retryData = await retryResponse.json()
        console.log('[재검색 결과]', {
          totalResults: retryData.total_results || 0,
          resultsCount: retryData.results?.length || 0,
          엔드포인트: endpoint,
        })
        
        if (retryData.results && retryData.results.length > 0) {
          console.log('[재검색 성공] 필터 완화로 결과 찾음')
          return retryData.results.slice(0, limit) || []
        } else {
          // AND 조건으로 결과가 없으면 OR 조건으로 시도 (장르만)
          if (uniqueGenreIds.length > 1) {
            console.warn('[재검색 실패] AND 조건 실패, OR 조건으로 재시도...', {
              AND조건: uniqueGenreIds.join(','),
              OR조건: uniqueGenreIds.join('|'),
            })
            
            // 장르 필터를 OR 조건(|)으로 변경
            params.set('with_genres', uniqueGenreIds.join('|'))
            
            // 키워드 필터 제거 (너무 제한적일 수 있음)
            params.delete('with_keywords')
            
            const orRetryUrl = `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`
            console.log('[OR 조건 재검색]', orRetryUrl)
            
            const orRetryResponse = await fetch(orRetryUrl)
            if (orRetryResponse.ok) {
              const orRetryData = await orRetryResponse.json()
              if (orRetryData.results && orRetryData.results.length > 0) {
                console.log('[OR 조건 재검색 성공]', { 결과수: orRetryData.results.length })
                return orRetryData.results.slice(0, limit) || []
              }
            }
          }
          
          console.error('[재검색 실패] 모든 필터 완화 후에도 결과 없음', {
            최종필터: {
              엔드포인트: endpoint,
              장르: uniqueGenreIds.length > 0 ? uniqueGenreIds.join(',') : '없음',
              키워드: moodParams.keywords ? moodParams.keywords.join('|') : '없음',
              최소평가수: '50 (완화됨)',
            },
          })
        }
      } else {
        console.error('[재검색 요청 실패]', retryResponse.status)
      }
    } else {
      console.log('[검색 성공]', { 
        결과수: data.results.length,
        엔드포인트: endpoint,
        장르: genre,
      })
    }
     
    return data.results.slice(0, limit) || []
  } catch (error) {
    console.error('TMDB 데이터 가져오기 실패:', error)
    return []
  }
}

/**
 * TMDB 영화/TV ID로 상세 정보 가져오기 (append_to_response 활용)
 * external_ids, credits, videos 등을 한 번에 가져옴
 */
async function getContentDetailsFromTMDB(
  tmdbId: number,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<{
  imdbId: string | null
  credits?: any
  videos?: any
} | null> {
  try {
    const endpoint = contentType === 'tv' ? 'tv' : 'movie'
    // append_to_response로 여러 정보를 한 번에 가져오기
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,credits,videos&language=ko-KR`
    )

    if (!response.ok) return null

    const data = await response.json()
    return {
      imdbId: data.external_ids?.imdb_id || null,
      credits: data.credits,
      videos: data.videos,
    }
  } catch (error) {
    console.error('TMDB 상세 정보 가져오기 실패:', error)
    return null
  }
}

/**
 * TMDB 영화/TV ID로 IMDB ID 가져오기 (레거시 함수 - 하위 호환성)
 */
async function getImdbIdFromTMDB(
  tmdbId: number,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<string | null> {
  const details = await getContentDetailsFromTMDB(tmdbId, contentType)
  return details?.imdbId || null
}

/**
 * TMDB 영화/TV ID로 OTT 제공자 정보 가져오기 (한국 지역)
 * @param tmdbId TMDB 영화 또는 TV ID
 * @param contentType 'movie' 또는 'tv'
 */
async function getWatchProvidersFromTMDB(
  tmdbId: number,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<OTTProvider[]> {
  try {
    const endpoint =
      contentType === 'tv'
        ? `${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers`
        : `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers`
    
    const response = await fetch(
      `${endpoint}?api_key=${TMDB_API_KEY}`
    )

    if (!response.ok) {
      console.warn(`OTT 정보 가져오기 실패: ${response.status}`)
      return []
    }

    const data: TMDBWatchProvidersResponse = await response.json()
    const krProviders = data.results?.KR

    if (!krProviders) {
      return []
    }

    // flatrate(구독), buy(구매), rent(대여) 모두 포함
    const allProviders: OTTProvider[] = []

    // 구독 서비스 (flatrate)만 사용 (블로그 참고)
    if (krProviders.flatrate) {
      krProviders.flatrate.forEach((provider) => {
        allProviders.push({
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          logo_path: provider.logo_path
            ? `https://image.tmdb.org/t/p/w300${provider.logo_path}`
            : undefined,
        })
      })
    }

    // 중복 제거 (같은 provider_id가 여러 타입에 있을 수 있음)
    const uniqueProviders = Array.from(
      new Map(allProviders.map((p) => [p.provider_id, p])).values()
    )

    return uniqueProviders
  } catch (error) {
    console.error('OTT 정보 가져오기 실패:', error)
    return []
  }
}

/**
 * 무드 태그를 TMDB 장르로 변환 (레거시 함수 - 하위 호환성)
 * @deprecated moodsToTMDBParams를 사용하세요
 */
function tagsToGenreIds(tags: string[]): number[] {
  // IMDB 태그를 TMDB 장르 ID로 변환하는 레거시 매핑
  const tagToGenre: Record<string, number[]> = {
    Romance: [10749],
    Horror: [27],
    Comedy: [35],
    'Sci-Fi': [878],
    Fantasy: [14],
    Adventure: [12],
    Action: [28],
    Drama: [18],
    Family: [10751],
    Mystery: [9648],
    Thriller: [53],
  }

  const genreIds = new Set<number>()
  tags.forEach((tag) => {
    const ids = tagToGenre[tag] || []
    ids.forEach((id) => genreIds.add(id))
  })

  return Array.from(genreIds)
}

/**
 * 콘텐츠를 Supabase에 저장
 */
async function saveContentToSupabase(
  movie: TMDBMovie,
  selectedGenre?: string
): Promise<Content | null> {
  try {
    // 중요: 선택한 장르가 TV 타입이면 무조건 TV로 처리
    // TMDB에서 Drama(18)는 Movie와 TV 모두에 존재하므로 선택한 장르를 우선 사용
    const isSelectedGenreTV = selectedGenre === '드라마' || selectedGenre === '예능' || selectedGenre === '애니메이션'
    
    let contentType: 'movie' | 'tv' = 'movie'
    
    if (isSelectedGenreTV) {
      // TV 장르를 선택했으면 무조건 TV로 처리
      contentType = 'tv'
      console.log('[콘텐츠 타입] TV 장르 선택됨', { selectedGenre, contentType })
    } else {
      // 장르 판단 (드라마, 예능, 애니메이션은 tv)
      // 드라마: 18, 애니메이션: 16, 예능: 10770
      const isTVContent = movie.genre_ids.includes(18) || 
                          movie.genre_ids.includes(16) || 
                          movie.genre_ids.includes(10770)
      contentType = isTVContent ? 'tv' : 'movie'
    }
    
    // append_to_response로 상세 정보 한 번에 가져오기
    const details = await getContentDetailsFromTMDB(movie.id, contentType)
    const imdbId = details?.imdbId || null

    // OTT 제공자 정보 가져오기 (장르에 따라 movie 또는 tv)
    const ottProviders = await getWatchProvidersFromTMDB(movie.id, contentType)

    // 장르 목록 가져오기 (TV와 Movie 구분)
    // 선택한 장르가 TV 타입이면 무조건 TV, 아니면 장르 ID로 판단
    const genreType = isSelectedGenreTV 
      ? 'tv' 
      : (movie.genre_ids.some(id => id === 18 || id === 16 || id === 10770) ? 'tv' : 'movie')
    const genreResponseKo = await fetch(
      `${TMDB_BASE_URL}/genre/${genreType}/list?api_key=${TMDB_API_KEY}&language=ko-KR`
    )
    const genreDataKo = await genreResponseKo.json()
    const genreMapKo: Record<number, string> = {}
    genreDataKo.genres.forEach((g: TMDBGenre) => {
      genreMapKo[g.id] = g.name
    })

    const genres = movie.genre_ids.map((id) => genreMapKo[id] || '').filter(Boolean)
    
    // TMDB 장르 이름을 IMDB 태그 형식으로도 저장 (무드 필터링을 위해)
    // TMDB 장르 이름을 영어로도 가져오기
    const genreResponseEn = await fetch(
      `${TMDB_BASE_URL}/genre/${genreType}/list?api_key=${TMDB_API_KEY}&language=en-US`
    )
    const genreDataEn = await genreResponseEn.json()
    const genreMapEn: Record<number, string> = {}
    genreDataEn.genres.forEach((g: TMDBGenre) => {
      genreMapEn[g.id] = g.name
    })
    
    // 영문 장르 이름을 태그로 추가 (무드 매칭을 위해)
    const englishTags = movie.genre_ids
      .map((id) => genreMapEn[id] || '')
      .filter(Boolean)
    
    // 태그에 한국어 장르와 영어 태그 모두 포함
    const allTags = [...genres, ...englishTags]

    // 장르 판단 (우선순위: 선택한 장르 > 드라마 > 애니메이션 > 예능 > 영화)
    // 중요: 선택한 장르가 TV 타입(드라마, 예능, 애니메이션)이면 무조건 해당 장르로 저장
    const genreMapForSave: Record<string, number> = GENRE_TO_TMDB_ID
    
    let contentGenre = '영화' // 기본값
    
    // 선택한 장르가 TV 타입인지 확인 (위에서 이미 선언됨)
    // isSelectedGenreTV 변수는 함수 상단에서 이미 선언되어 있음
    
    if (selectedGenre && selectedGenre !== '영화') {
      if (isSelectedGenreTV) {
        // TV 장르를 선택했으면 무조건 해당 장르로 저장 (엔드포인트에서 TV로 검색했으므로)
        contentGenre = selectedGenre
        console.log('[장르 저장] TV 장르 선택됨', { selectedGenre, contentGenre })
      } else if (genreMapForSave[selectedGenre]) {
        // 영화 장르를 선택했고, 해당 장르 ID가 포함되어 있으면 저장
        if (movie.genre_ids.includes(genreMapForSave[selectedGenre])) {
          contentGenre = selectedGenre
        } else {
          // 선택한 장르 ID가 없으면 우선순위로 판단
          if (movie.genre_ids.includes(18)) {
            contentGenre = '드라마'
          } else if (movie.genre_ids.includes(16)) {
            contentGenre = '애니메이션'
          } else if (movie.genre_ids.includes(10770)) {
            contentGenre = '예능'
          }
        }
      }
    } else {
      // 선택한 장르가 없으면 우선순위로 판단
      if (movie.genre_ids.includes(18)) {
        contentGenre = '드라마'
      } else if (movie.genre_ids.includes(16)) {
        contentGenre = '애니메이션'
      } else if (movie.genre_ids.includes(10770)) {
        contentGenre = '예능'
      }
    }

    // 콘텐츠 데이터 구성 (Supabase 저장용 - ott_providers 제외)
    // TV는 name, Movie는 title 사용
    const contentTitle = movie.title || movie.name || ''
    const originalTitle = movie.original_title || movie.original_name || ''
    
    if (!contentTitle) {
      console.warn('제목이 없는 콘텐츠:', movie)
      return null
    }

    // 연도 계산 (TV는 first_air_date, Movie는 release_date)
    const dateString = movie.release_date || movie.first_air_date || ''
    const year = dateString ? parseInt(dateString.split('-')[0]) : null

    // 제작 국가 정보
    const productionCountry = movie.production_countries?.[0]?.iso_3166_1 || movie.original_language || ''

    const contentData = {
      title: contentTitle,
      description: movie.overview || null,
      poster_url: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      imdb_id: imdbId,
      imdb_rating: movie.vote_average ? movie.vote_average / 2 : null, // TMDB는 10점 만점
      year: year,
      genre: contentGenre, // 실제 장르로 저장
      tags: allTags, // 한국어 장르 + 영어 태그 (무드 필터링용)
      url: imdbId ? `https://www.imdb.com/title/${imdbId}` : null,
      // 추가 정보 (필요시 사용)
      // original_title: originalTitle,
      // original_language: movie.original_language,
      // production_country: productionCountry,
      // vote_count: movie.vote_count,
      // popularity: movie.popularity,
      // ott_providers는 Supabase 테이블에 컬럼이 없으면 제외
      // 필요시 Supabase 테이블에 ott_providers JSONB 컬럼을 추가하세요
    }

    // Supabase에 저장
    const { data, error } = await supabase
      .from('contents')
      .upsert(contentData, {
        onConflict: 'imdb_id',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) {
      // RLS 정책 오류인 경우에만 상세 로그 출력 (중복 방지)
      if (error.code === '42501') {
        console.warn(`콘텐츠 저장 실패 (RLS 정책): ${movie.title} - RLS 정책을 확인하세요`)
      } else {
        console.error('콘텐츠 저장 실패:', error)
      }
      return null
    }

    // 저장된 데이터에 OTT 정보 추가 (프론트엔드에서 사용)
    return data ? { ...data, ott_providers: ottProviders.length > 0 ? ottProviders : undefined } : null
  } catch (error) {
    console.error('콘텐츠 저장 중 오류:', error)
    return null
  }
}

/**
 * 사용자 프로필 기반으로 콘텐츠 가져오기 및 저장
 */
export async function fetchAndSaveRecommendations(
  genre: string,
  moods: string[]
): Promise<Content[]> {
  try {
    // TMDB에서 콘텐츠 가져오기 (무드 ID 직접 전달)
    const movies = await fetchMoviesFromTMDB(genre, moods, 20)

    // 각 영화를 Supabase에 저장 시도
    const savedContents: Content[] = []
    const tempContents: Content[] = [] // 저장 실패 시 임시로 사용할 데이터
    
    for (const movie of movies) {
      const content = await saveContentToSupabase(movie, genre)
      if (content) {
        savedContents.push(content)
      } else {
        // 저장 실패해도 TMDB 데이터를 임시 Content 객체로 변환
        // OTT 정보도 함께 가져오기 (장르에 따라)
        // 중요: 선택한 장르가 TV 타입이면 무조건 TV로 처리
        const isSelectedGenreTV = genre === '드라마' || genre === '예능' || genre === '애니메이션'
        const isTVContent = isSelectedGenreTV 
          ? true 
          : (movie.genre_ids.includes(18) || 
             movie.genre_ids.includes(16) || 
             movie.genre_ids.includes(10770))
        const contentType = isTVContent ? 'tv' : 'movie'
        const ottProviders = await getWatchProvidersFromTMDB(movie.id, contentType)
        
        // 장르 목록 가져오기 (임시 콘텐츠용)
        // 선택한 장르가 TV 타입이면 무조건 TV, 아니면 장르 ID로 판단
        const genreType = isSelectedGenreTV 
          ? 'tv' 
          : (movie.genre_ids.some(id => id === 18 || id === 16 || id === 10770) ? 'tv' : 'movie')
        const genreResponseTemp = await fetch(
          `${TMDB_BASE_URL}/genre/${genreType}/list?api_key=${TMDB_API_KEY}&language=ko-KR`
        )
        const genreDataTemp = await genreResponseTemp.json()
        const genreMapTemp: Record<number, string> = {}
        genreDataTemp.genres.forEach((g: TMDBGenre) => {
          genreMapTemp[g.id] = g.name
        })
        const genresTemp = movie.genre_ids.map((id) => genreMapTemp[id] || '').filter(Boolean)
        
        // TV는 name, Movie는 title 사용
        const contentTitle = movie.title || movie.name || ''
        
        if (!contentTitle) {
          console.warn('제목이 없는 콘텐츠:', movie)
          continue
        }

        const tempContent: Content = {
          id: `temp-${movie.id}`, // 임시 ID
          title: contentTitle,
          description: movie.overview || undefined,
          poster_url: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : undefined,
          imdb_id: undefined,
          imdb_rating: movie.vote_average ? movie.vote_average / 2 : undefined,
          year: (movie.release_date || movie.first_air_date) 
            ? parseInt((movie.release_date || movie.first_air_date || '').split('-')[0]) 
            : undefined,
          genres: genresTemp.length > 0 ? genresTemp : undefined,
          tags: movie.genre_ids.map(String), // 임시로 genre_ids를 문자열 배열로 변환
          url: undefined,
          ott_providers: ottProviders.length > 0 ? ottProviders : undefined,
          created_at: new Date().toISOString(),
        }
        tempContents.push(tempContent)
      }
    }

    // 저장된 콘텐츠가 있으면 반환, 없으면 임시 콘텐츠 반환
    return savedContents.length > 0 ? savedContents : tempContents
  } catch (error) {
    console.error('추천 콘텐츠 가져오기 실패:', error)
    return []
  }
}

