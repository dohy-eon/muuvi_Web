import { supabase } from '../supabase.ts'
import { GENRE_TO_TMDB_ID, MOOD_TO_TMDB_GENRE } from '../tmdb/genreMapping.ts'
import { moodsToTMDBParams } from '../tmdb/moodToTMDB.ts'
import { moodsToImdbTags } from '../moodMapping.ts'
import type { Content, OTTProvider } from '../../types/index.ts'

// Deno 환경인지 확인 (Supabase Edge Function)
// @ts-ignore: 'Deno' is not defined in Vite/Node.js environment
const isDeno = typeof Deno !== 'undefined'

// Deno(백엔드)일 경우 Deno.env.get()을, Vite(프론트엔드)일 경우 import.meta.env를 사용
const TMDB_API_KEY = isDeno
  // @ts-ignore
  ? Deno.env.get('VITE_TMDB_API_KEY') || ''
  : import.meta.env.VITE_TMDB_API_KEY || ''

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
export async function searchContentFromTMDB(
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
      'vote_count.gte': '1', // 최소 평가 수 완화
      'vote_average.gte': '4.0', // 최소 평점 완화
      page: '1',
      // 'with_original_language': 'ko', // 한국 작품 우선 (선택사항)
    })

    // 무드를 TMDB 파라미터로 변환 (키워드와 정렬 기준을 가져옴)
    const moodParams = moodsToTMDBParams(moods)
    console.log('[무드 파라미터]', {
      moods,
      genres: moodParams.genres, // 참고용 (사용 안 함)
      keywords: moodParams.keywords, // 사용할 키워드
      sortBy: moodParams.sortBy,
    })

    // 1. [장르 필터] 적용
    const genreIdsToFilter = new Set<number>()

    // '드라마', '애니메이션'은 GENRE_TO_TMDB_ID에서 ID를 가져와 추가
    const selectedGenreId = genre !== '영화' && genre !== '예능' && GENRE_TO_TMDB_ID[genre] ? GENRE_TO_TMDB_ID[genre] : null
    
    if (selectedGenreId && (genre === '드라마' || genre === '애니메이션')) {
      genreIdsToFilter.add(selectedGenreId)
    }

    // '영화' (isTV=false)의 경우, 무드에서 파생된 장르 ID(MOOD_TO_TMDB_GENRE)를 사용
    // (예: 로맨스 무드 '01' -> 장르 ID 10749)
    if (!isTV && moodParams.genres && moodParams.genres.length > 0) {
      moodParams.genres.forEach(id => genreIdsToFilter.add(id))
      console.log('[무드 기반 장르 필터 적용]', { genre, moodGenreIds: moodParams.genres })
    }

    // '예능'은 with_type으로 필터링되므로 여기서는 추가 ID 없음

    // 수집된 장르 ID가 있으면 params에 추가 (여러 개일 경우 OR 조건 '|')
    if (genreIdsToFilter.size > 0) {
      const genreIdString = Array.from(genreIdsToFilter).join('|')
      params.append('with_genres', genreIdString)
      console.log('[장르 필터 적용]', { genre, genreIds: genreIdString })
    } else {
      console.log('[장르 필터] 없음 (영화+무드조합없음 또는 예능)', { genre })
    }

    // 2. [무드 필터] 적용 (키워드 기반)
    // 무드에서 파생된 장르(moodParams.genres)는 의도치 않은 AND 조건으로
    // 검색 결과를 0으로 만드므로, 키워드(moodParams.keywords)만 사용합니다.
    // 예능은 키워드 필터를 사용하지 않음 (검색 결과가 너무 제한적)
    if (genre !== '예능' && moodParams.keywords && moodParams.keywords.length > 0) {
      // 여러 키워드를 OR 조건(|)으로 연결하여 더 넓은 범위 검색
      const keywordString = moodParams.keywords.join('|')
      params.append('with_keywords', keywordString)
      console.log('[무드 필터 적용]', {
        keywordIds: moodParams.keywords,
        keywordString,
        논리: 'OR (|)',
      })
    } else {
      console.log('[무드 필터] 없음 또는 예능 (키워드 필터 제외)')
    }

    // 3. [정렬 기준] 적용
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
        console.log('[TV 타입 필터] 없음 (드라마는 장르 ID로만 필터링)')
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
            최소평점: '5.0',
            최소평가수: '10',
          기간필터: isTV ? `${startYear}-01-01 이후` : `${startYear}-01-01 이후`,
          엔드포인트: endpoint, // 중요: TV는 TV, Movie는 Movie로 유지
        },
      })
      
      // 최소 평점 필터 제거
      params.delete('vote_average.gte')
      console.log('[재검색] 최소 평점 필터 제거')
      
      // 최소 평가 수 완화 (10 -> 5)
      params.set('vote_count.gte', '5')
      console.log('[재검색] 최소 평가 수 완화 (10 -> 5)')
      
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
          // 키워드 필터만 제거하고 재시도 (장르 필터는 유지)
          if (moodParams.keywords && moodParams.keywords.length > 0) {
            console.warn('[재검색 실패] 키워드 필터 제거하고 재시도...')
            
            // 키워드 필터 제거 (너무 제한적일 수 있음)
            params.delete('with_keywords')
            
            const keywordRetryUrl = `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`
            console.log('[키워드 제거 후 재검색]', keywordRetryUrl)
            
            const keywordRetryResponse = await fetch(keywordRetryUrl)
            if (keywordRetryResponse.ok) {
              const keywordRetryData = await keywordRetryResponse.json()
              if (keywordRetryData.results && keywordRetryData.results.length > 0) {
                console.log('[키워드 제거 후 재검색 성공]', { 결과수: keywordRetryData.results.length })
                return keywordRetryData.results.slice(0, limit) || []
              }
            }
          }
          
          console.error('[재검색 실패] 모든 필터 완화 후에도 결과 없음', {
            최종필터: {
              엔드포인트: endpoint,
              장르: selectedGenreId ? selectedGenreId.toString() : '없음',
              키워드: moodParams.keywords ? moodParams.keywords.join('|') : '없음',
              최소평가수: '5 (완화됨)',
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
    
    // [최적화] 결과가 부족하면 여러 페이지 검색
    let allResults = data.results || []
    let currentPage = 1
    const maxPages = 10 // 최대 10페이지까지 검색 (더 많은 영화를 검색하기 위해 3 -> 10으로 증가)
    
    while (allResults.length < limit && currentPage < maxPages && data.total_pages > currentPage) {
      currentPage++
      params.set('page', currentPage.toString())
      
      console.log(`[추가 페이지 검색] page ${currentPage} (현재: ${allResults.length}/${limit}개)`)
      
      const nextResponse = await fetch(`${TMDB_BASE_URL}/${endpoint}?${params.toString()}`)
      if (nextResponse.ok) {
        const nextData = await nextResponse.json()
        if (nextData.results && nextData.results.length > 0) {
          allResults = [...allResults, ...nextData.results]
          console.log(`[페이지 ${currentPage} 추가] 총 ${allResults.length}개`)
        } else {
          break
        }
      } else {
        break
      }
    }
     
    return allResults.slice(0, limit) || []
  } catch (error) {
    console.error('TMDB 데이터 가져오기 실패:', error)
    return []
  }
}

async function fetchTVShowById(tmdbId: number): Promise<TMDBMovie | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=ko-KR`
    )

    if (!response.ok) {
      console.warn('[TMDB TV 상세 호출 실패]', {
        tmdbId,
        status: response.status,
        statusText: response.statusText,
      })
      return null
    }

    const data = await response.json()
    const genreIds = Array.isArray(data.genres)
      ? data.genres.map((genre: TMDBGenre) => genre.id)
      : []

    const networks = Array.isArray(data.networks)
      ? data.networks.map((network: { id: number; name: string }) => ({
          id: network.id,
          name: network.name,
        }))
      : undefined

    const tvShow: TMDBMovie = {
      id: data.id,
      name: data.name,
      original_name: data.original_name,
      overview: data.overview,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path,
      first_air_date: data.first_air_date,
      last_air_date: data.last_air_date,
      vote_average: data.vote_average,
      vote_count: data.vote_count,
      popularity: data.popularity,
      genre_ids: genreIds,
      original_language: data.original_language,
      production_countries: data.production_countries,
      number_of_seasons: data.number_of_seasons,
      number_of_episodes: data.number_of_episodes,
      networks,
    }

    return tvShow
  } catch (error) {
    console.error(`[TMDB] TV 상세 정보 가져오기 실패 (ID: ${tmdbId})`, error)
    return null
  }
}

/**
 * TMDB 영화/TV ID로 상세 정보 가져오기 (append_to_response 활용)
 * external_ids, credits, videos 등을 한 번에 가져옴
 */
interface TMDBKeyword {
  id: number
  name: string
}

async function getContentDetailsFromTMDB(
  tmdbId: number,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<{
  imdbId: string | null
  credits?: any
  videos?: any
  genres?: TMDBGenre[]
  keywords?: TMDBKeyword[]
  title?: string
  titleEn?: string | null
  description?: string
  descriptionEn?: string | null
} | null> {
  try {
    const endpoint = contentType === 'tv' ? 'tv' : 'movie'
    // 한국어와 영어 정보를 병렬로 가져오기
    const [responseKo, responseEn] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,credits,videos,keywords&language=ko-KR`
      ),
      fetch(
        `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
      )
    ])

    if (!responseKo.ok) return null

    const dataKo = await responseKo.json()
    const keywordsRaw = dataKo.keywords
    let keywords: TMDBKeyword[] = []

    if (keywordsRaw) {
      if (Array.isArray(keywordsRaw.results)) {
        keywords = keywordsRaw.results
      } else if (Array.isArray(keywordsRaw.keywords)) {
        keywords = keywordsRaw.keywords
      }
    }

    // 한국어 정보
    const title = contentType === 'tv' ? dataKo.name : dataKo.title
    const description = dataKo.overview

    // 영어 정보 (선택적 - 실패해도 한국어만 반환)
    let titleEn: string | null = null
    let descriptionEn: string | null = null
    if (responseEn.ok) {
      try {
        const dataEn = await responseEn.json()
        titleEn = contentType === 'tv' ? dataEn.name : dataEn.title
        descriptionEn = dataEn.overview
      } catch (error) {
        console.warn('영어 정보 파싱 실패:', error)
      }
    }

    return {
      imdbId: dataKo.external_ids?.imdb_id || null,
      credits: dataKo.credits,
      videos: dataKo.videos,
      genres: Array.isArray(dataKo.genres) ? dataKo.genres : [],
      keywords,
      title,
      titleEn,
      description,
      descriptionEn,
    }
  } catch (error) {
    console.error('TMDB 상세 정보 가져오기 실패:', error)
    return null
  }
}

/**
 * TMDB 영화/TV ID로 IMDB ID 가져오기 (레거시 함수 - 하위 호환성)
 */
export async function getImdbIdFromTMDB(
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
export function tagsToGenreIds(tags: string[]): number[] {
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
 * [추가] 장르 맵(ko, en)을 한 번만 가져오는 헬퍼 함수
 */
async function getGenreMaps(genreType: 'movie' | 'tv') {
  try {
    const [genreResponseKo, genreResponseEn] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/genre/${genreType}/list?api_key=${TMDB_API_KEY}&language=ko-KR`),
      fetch(`${TMDB_BASE_URL}/genre/${genreType}/list?api_key=${TMDB_API_KEY}&language=en-US`)
    ]);

    const genreDataKo = await genreResponseKo.json();
    const genreMapKo: Record<number, string> = {};
    if (genreDataKo.genres) {
      genreDataKo.genres.forEach((g: TMDBGenre) => (genreMapKo[g.id] = g.name));
    }
  
    const genreDataEn = await genreResponseEn.json();
    const genreMapEn: Record<number, string> = {};
    if (genreDataEn.genres) {
      genreDataEn.genres.forEach((g: TMDBGenre) => (genreMapEn[g.id] = g.name));
    }
  
    return { genreMapKo, genreMapEn };
  } catch (e) {
    console.error("장르 맵 가져오기 실패", e);
    return { genreMapKo: {}, genreMapEn: {} };
  }
}


/**
 * 콘텐츠를 Supabase에 저장 (최적화 버전)
 * [수정] 장르 맵을 인자로 받아 중복 API 호출 제거
 */
interface SaveContentOptions {
  forceSaveOTT?: boolean
  forceMoodTags?: boolean
}

async function saveContentToSupabase(
  movie: TMDBMovie,
  selectedGenre: string,
  genreMapKo: Record<number, string>,
  genreMapEn: Record<number, string>,
  moodIds: string[] = [],
  options: SaveContentOptions = {}
): Promise<Content | null> {
  try {
    // [기존 로직] 콘텐츠 타입 결정 (selectedGenre 우선)
    let contentType: 'movie' | 'tv' = 'movie';
    if (selectedGenre === '영화') {
      contentType = 'movie';
    } else if (selectedGenre === '애니메이션' || selectedGenre === '드라마' || selectedGenre === '예능') {
      contentType = 'tv';
    } else {
      const isTVContent = movie.genre_ids.includes(18) || movie.genre_ids.includes(16) || movie.genre_ids.includes(10770);
      contentType = isTVContent ? 'tv' : 'movie';
    }

    // [최적화] 한국어/영어 상세 정보 및 OTT 정보를 병렬로 가져오기
    const endpoint = contentType === 'tv' ? 'tv' : 'movie'
    const [responseKo, responseEn, rawOttProviders] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/${endpoint}/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,credits,videos,keywords&language=ko-KR`
      ),
      fetch(
        `${TMDB_BASE_URL}/${endpoint}/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=keywords&language=en-US`
      ).catch(() => null), // 영어 정보 실패해도 계속 진행
      getWatchProvidersFromTMDB(movie.id, contentType)
    ]);
    
    // 한국어 데이터 처리
    if (!responseKo || !responseKo.ok) {
      console.warn(`[상세 정보 누락] ID: ${movie.id}`)
      return null
    }
    
    const dataKo = await responseKo.json()
    
    // 한국어 키워드 파싱
    const keywordsRawKo = dataKo.keywords
    let keywordsKo: TMDBKeyword[] = []
    if (keywordsRawKo) {
      if (Array.isArray(keywordsRawKo.results)) {
        keywordsKo = keywordsRawKo.results
      } else if (Array.isArray(keywordsRawKo.keywords)) {
        keywordsKo = keywordsRawKo.keywords
      }
    }
    
    const detailsKo = {
      imdbId: dataKo.external_ids?.imdb_id || null,
      credits: dataKo.credits,
      videos: dataKo.videos,
      genres: Array.isArray(dataKo.genres) ? dataKo.genres : [],
      keywords: keywordsKo,
      title: contentType === 'tv' ? dataKo.name : dataKo.title,
      description: dataKo.overview,
    }
    
    // 영어 데이터 처리 (선택적)
    let detailsEn: {
      title?: string
      description?: string
      keywords?: TMDBKeyword[]
    } | null = null
    
    if (responseEn) {
      if (responseEn.ok) {
        try {
          const dataEn = await responseEn.json()
          
          // 영어 키워드 파싱
          const keywordsRawEn = dataEn.keywords
          let keywordsEn: TMDBKeyword[] = []
          if (keywordsRawEn) {
            if (Array.isArray(keywordsRawEn.results)) {
              keywordsEn = keywordsRawEn.results
            } else if (Array.isArray(keywordsRawEn.keywords)) {
              keywordsEn = keywordsRawEn.keywords
            }
          }
          
          detailsEn = {
            title: contentType === 'tv' ? dataEn.name : dataEn.title,
            description: dataEn.overview,
            keywords: keywordsEn,
          }
        } catch (error) {
          console.warn(`[영어 정보 파싱 실패] ID: ${movie.id}:`, error)
        }
      } else {
        // [추가] 실패 로그 - Rate Limit 등 원인 파악을 위해
        console.warn(`[영어 데이터 실패] ID: ${movie.id}, Status: ${responseEn.status} ${responseEn.statusText}`)
        if (responseEn.status === 429) {
          console.warn(`[Rate Limit 감지] ID: ${movie.id} - 잠시 대기 후 재시도 가능`)
        }
      }
    } else {
      console.warn(`[영어 데이터 요청 실패] ID: ${movie.id} - 네트워크 오류 또는 요청 미완료`)
    }
    
    const details = detailsKo // 메인 로직은 한국어 데이터 기준
    let ottProviders = rawOttProviders
    
    const imdbId = details?.imdbId || null;

    // [필터링] OTT 제공자가 없으면 저장하지 않음 (시청 불가능한 콘텐츠 제외)
    if ((!ottProviders || ottProviders.length === 0) && !options.forceSaveOTT) {
      console.log(`[OTT 없음] 저장 건너뜀: ${movie.title || movie.name} (ID: ${movie.id})`);
      return null;
    }

    if ((!ottProviders || ottProviders.length === 0) && options.forceSaveOTT) {
      ottProviders = [
        {
          provider_id: -1,
          provider_name: '수동 추가',
        },
      ];
    }

    // [추가] 임베딩 생성 (줄거리를 벡터로 변환)
    const textToEmbed = movie.overview || movie.title || movie.name || '';
    let embedding: number[] | null = null;

    if (textToEmbed) {
      try {
        // 텍스트 길이 제한 (512자) - embed 함수와 동일
        const truncatedText = textToEmbed.slice(0, 512);
        
        const { data: embedData, error: embedError } = await supabase.functions.invoke(
          'embed',
          { body: { text: truncatedText } }
        );
        
        if (embedError) {
          console.error(`[임베딩 에러] (ID: ${movie.id}):`, embedError);
          throw embedError;
        }
        
        if (!embedData || !embedData.vector) {
          console.warn(`[임베딩 응답 없음] (ID: ${movie.id})`);
        } else {
          embedding = embedData.vector;
          const vectorSize = Array.isArray(embedding) ? embedding.length : 0;
          console.log(`[임베딩 성공] ${movie.title || movie.name} (벡터 크기: ${vectorSize})`);
        }
      } catch (e: any) {
        console.error(`[임베딩 실패] (ID: ${movie.id}, 제목: ${movie.title || movie.name}):`, e.message || e);
        // 임베딩 실패해도 콘텐츠는 저장 (vector는 null)
        embedding = null;
      }
    }

    // [수정] 태그 생성 로직 분리 (Ko / En)
    const genreIdSet = new Set<number>(movie.genre_ids || [])
    if (details?.genres) {
      details.genres.forEach((genre: TMDBGenre) => {
        if (typeof genre?.id === 'number') {
          genreIdSet.add(genre.id)
        }
      })
    }

    const genreIds = Array.from(genreIdSet)

    // 1. 장르 태그 (기본) - 한국어와 영어 분리
    let tagsKo: string[] = genreIds.map((id) => genreMapKo[id] || '').filter(Boolean)
    let tagsEn: string[] = genreIds.map((id) => genreMapEn[id] || '').filter(Boolean)

    // 복합 태그 분리 (예: "Action & Adventure" → ["Action", "Adventure"])
    tagsKo = tagsKo.flatMap(tag => 
      tag.includes('&') 
        ? tag.split('&').map(t => t.trim()).filter(Boolean)
        : tag
    )
    tagsEn = tagsEn.flatMap(tag => 
      tag.includes('&') 
        ? tag.split('&').map(t => t.trim()).filter(Boolean)
        : tag
    )
    
    // 영문 태그를 한글로 번역 (한국어 태그에 추가)
    const tagTranslation: Record<string, string> = {
      // 장르
      'Action': '액션',
      'Adventure': '모험',
      'Animation': '애니메이션',
      'Comedy': '코미디',
      'Crime': '범죄',
      'Documentary': '다큐멘터리',
      'Drama': '드라마',
      'Family': '가족',
      'Fantasy': '판타지',
      'History': '역사',
      'Horror': '공포',
      'Music': '음악',
      'Mystery': '미스터리',
      'Romance': '로맨스',
      'Science Fiction': 'SF',
      'Sci-Fi': 'SF',
      'Thriller': '스릴러',
      'War': '전쟁',
      'Western': '서부',
      'Reality': '리얼리티',
      'Talk Show': '토크쇼',
      'News': '뉴스',
      'War & Politics': '전쟁·정치',
      'Action & Adventure': '액션',
      'Sci-Fi & Fantasy': 'SF',
      'Soap': '연속극',
      'Kids': '키즈',
      // TV 타입
      'TV Movie': 'TV영화',
    }
    
    // 영어 태그를 한국어로 번역하여 한국어 태그에 추가
    tagsEn.forEach(tag => {
      const translated = tagTranslation[tag]
      if (translated && !tagsKo.includes(translated)) {
        tagsKo.push(translated)
      }
    })
    
    // [키워드 태그] TMDB 키워드 기반 태그 보강
    
    // (1) 한국어 키워드 처리 - 한국어 태그에 추가
    if (details?.keywords && details.keywords.length > 0) {
      const keywordTranslation: Record<string, string> = {
        'historical drama': '사극',
        'historical fiction': '사극',
        'history': '역사',
        'alternate history': '퓨전 사극',
        'alternate past': '퓨전 사극',
        'sageuk': '사극',
        'fusion sageuk': '퓨전 사극',
        'period drama': '사극',
        'ancient korea': '사극',
        'martial arts': '무협',
        'warrior': '무협',
        'sword fight': '검술',
        'sword': '검술',
        'politics': '정치',
        'political intrigue': '정치',
        'power struggle': '정치',
        'romance': '로맨스',
        'love': '로맨스',
        'assassin': '암살',
        'rebellion': '혁명',
        'royalty': '왕실',
        'kingdom': '왕권',
        'court': '궁중',
        'conspiracy': '음모',
      }

      const keywordTags = new Set<string>()

      details.keywords.forEach((keyword) => {
        if (!keyword?.name) return

        // 한국어 태그는 번역해서 추가
        const normalized = keyword.name.trim().toLowerCase()
        if (!normalized) return

        const translated =
          keywordTranslation[normalized] ||
          (normalized.includes('romance') ? '로맨스' : null) ||
          (normalized.includes('histor') ? '사극' : null) ||
          (normalized.includes('martial') ? '무협' : null) ||
          (normalized.includes('sword') ? '검술' : null) ||
          (normalized.includes('politic') ? '정치' : null) ||
          (normalized.includes('love') ? '로맨스' : null)

        if (translated) {
          keywordTags.add(translated)
        }
      })

      if (keywordTags.size > 0) {
        tagsKo = [...tagsKo, ...keywordTags]
      }
    }

    // (2) 영어 키워드 처리 - 영어 태그에 추가 (detailsEn 사용)
    if (detailsEn?.keywords && detailsEn.keywords.length > 0) {
      detailsEn.keywords.forEach((keyword) => {
        if (keyword?.name) {
          tagsEn.push(keyword.name) // 영어 원문 그대로 추가
        }
      })
    }

    // [무드 태그] 선택된 무드를 기반으로 태그 추가
    const moodTagOrder: string[] = []

    if (Array.isArray(moodIds) && moodIds.length > 0) {
      const moodTagsToAddKo = new Set<string>()
      const moodTagsToAddEn = new Set<string>()
      
      moodIds.forEach((moodId) => {
        const relatedGenres = MOOD_TO_TMDB_GENRE[moodId] || []
        const hasMatchingGenre =
          relatedGenres.length === 0 ||
          relatedGenres.some((genreId) => movie.genre_ids?.includes(genreId))

        if (options.forceMoodTags || hasMatchingGenre) {
          const moodDerivedTags = moodsToImdbTags([moodId]) // ['Romance', 'Drama'] 등 반환 가정
          
          // 영어 태그 추가
          moodDerivedTags.forEach((tag) => {
            moodTagsToAddEn.add(tag)
            if (!moodTagOrder.includes(tag)) {
              moodTagOrder.push(tag)
            }
          })

          // 한국어 태그 번역 추가
          const translatedMoodTags = moodDerivedTags.map(tag => tagTranslation[tag] || tag)
          translatedMoodTags.forEach((tag) => {
            moodTagsToAddKo.add(tag)
          })
        }
      })

      if (moodTagsToAddEn.size > 0) {
        tagsEn = [...tagsEn, ...moodTagsToAddEn]
      }
      if (moodTagsToAddKo.size > 0) {
        tagsKo = [...tagsKo, ...moodTagsToAddKo]
      }
    }

    // 4. 중복 제거 및 정제
    tagsKo = [...new Set(tagsKo)]
    tagsEn = [...new Set(tagsEn)]

    // 무드 태그 순서 적용 (한국어 태그에만)
    if (moodTagOrder.length > 0) {
      const moodTagsKo = moodTagOrder.map(tag => tagTranslation[tag] || tag).filter(tag => tagsKo.includes(tag))
      const otherTagsKo = tagsKo.filter((tag) => !moodTagsKo.includes(tag))
      tagsKo = [...moodTagsKo, ...otherTagsKo]
    }

    // [개선] 태그에서 장르 추론 및 정리
    const genreMapForSave: Record<string, number> = GENRE_TO_TMDB_ID;
    let contentGenre = '영화'; // 기본값
    
    // 장르 키워드 매핑 (태그에서 장르 추론용 - 이미 번역된 한글 태그)
    const genreKeywords: Record<string, string[]> = {
      '애니메이션': ['애니메이션'],
      '드라마': ['드라마'],
      '예능': ['리얼리티', '토크쇼'],
    };
    
    // 태그에서 장르 감지 (한국어 태그 기준)
    let detectedGenre: string | null = null;
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(keyword => tagsKo.includes(keyword))) {
        detectedGenre = genre;
        // 태그에서 장르 키워드 제거 (한국어만)
        tagsKo = tagsKo.filter(tag => !keywords.includes(tag));
        break;
      }
    }
    
    // [추가] 태그가 비었을 경우 기본 태그 추가 (장르 기반)
    if (tagsKo.length === 0 && tagsEn.length === 0) {
      // selectedGenre 또는 감지된 장르를 기본 태그로 사용
      const baseGenre = selectedGenre || detectedGenre || '영화';
      
      // 장르별 기본 태그 추가 (한국어와 영어 모두)
      if (baseGenre === '예능') {
        tagsKo = ['코미디', '리얼리티'];
        tagsEn = ['Comedy', 'Reality'];
      } else if (baseGenre === '애니메이션') {
        tagsKo = ['애니메이션'];
        tagsEn = ['Animation'];
      } else if (baseGenre === '드라마') {
        tagsKo = ['드라마'];
        tagsEn = ['Drama'];
      } else {
        // 영화는 평점 기반 태그 추가
        if (movie.vote_average >= 7) {
          tagsKo = ['명작'];
          tagsEn = ['Classic'];
        } else {
          tagsKo = ['영화'];
          tagsEn = ['Movie'];
        }
      }
      
      console.log(`[기본 태그 추가] ${movie.title || movie.name}: KO=${tagsKo.join(', ')}, EN=${tagsEn.join(', ')}`);
    }
    
    // 장르 결정 (우선순위: selectedGenre > 태그에서 감지 > genre_ids로 판단)
    if (selectedGenre) {
      if (selectedGenre === '영화') {
        contentGenre = '영화';
      } else if (selectedGenre === '예능') {
        // 예능은 무조건 예능으로 저장 (TMDB에서 genre_id로 구분 안 됨)
        contentGenre = '예능';
      } else if (selectedGenre === '애니메이션') {
        // 애니메이션도 무조건 애니메이션으로 저장
        contentGenre = '애니메이션';
      } else if (selectedGenre === '드라마') {
        // 드라마도 무조건 드라마로 저장
        contentGenre = '드라마';
      } else if (genreMapForSave[selectedGenre] && movie.genre_ids.includes(genreMapForSave[selectedGenre])) {
        contentGenre = selectedGenre;
      } else if (detectedGenre) {
        contentGenre = detectedGenre; // 태그에서 감지된 장르 사용
      } else {
        // 선택한 장르가 콘텐츠에 없으면, genre_ids로 판단
        if (movie.genre_ids.includes(18)) contentGenre = '드라마';
        else if (movie.genre_ids.includes(16)) contentGenre = '애니메이션';
        else if (movie.genre_ids.includes(10770)) contentGenre = '예능';
      }
    } else {
      // selectedGenre가 없으면 태그 또는 genre_ids로 판단
      if (detectedGenre) {
        contentGenre = detectedGenre;
      } else if (movie.genre_ids.includes(18)) {
        contentGenre = '드라마';
      } else if (movie.genre_ids.includes(16)) {
        contentGenre = '애니메이션';
      } else if (movie.genre_ids.includes(10770)) {
        contentGenre = '예능';
      }
    }

    // [수정] 제목과 줄거리 - details에서 가져오거나 movie에서 fallback
    const contentTitle = details?.title || movie.title || movie.name || '';
    
    // 영어 제목 Fallback 우선순위:
    // 1. 영어 상세 제목 -> 2. 원제(Original Title) -> 3. 한국어 제목(최후의 수단)
    const contentTitleEn = detailsEn?.title || movie.original_title || movie.original_name || contentTitle;
    
    const contentDescription = details?.description || movie.overview || null;
    // 영어 줄거리가 없으면 null (UI에서 한국어를 보여주거나 'No description' 처리)
    const contentDescriptionEn = detailsEn?.description || null;

    if (!contentTitle) {
      console.warn('제목이 없는 콘텐츠:', movie.id);
      return null;
    }

    const dateString = movie.release_date || movie.first_air_date || '';
    const year = dateString ? parseInt(dateString.split('-')[0]) : null;

    const contentData = {
      title: contentTitle,
      title_en: contentTitleEn, // [수정] Fallback 적용
      description: contentDescription,
      description_en: contentDescriptionEn, // 영어 줄거리 (없으면 null)
      poster_url: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      imdb_id: imdbId,
      imdb_rating: movie.vote_average ? movie.vote_average / 2 : null,
      year: year,
      genre: contentGenre,
      tags: tagsKo,      // 한국어 태그
      tags_en: tagsEn,   // 영어 태그
      url: imdbId ? `https://www.imdb.com/title/${imdbId}` : null,
      ott_providers: ottProviders && ottProviders.length > 0 ? ottProviders : undefined,
      vector: embedding, // 임베딩 벡터 추가 (null 가능)
    };

    // [최적화] 중복 저장 방지
    // imdb_id가 있으면 imdb_id로 upsert, 없으면 title+year로 중복 체크
    if (imdbId) {
      // imdb_id가 있는 경우: imdb_id로 upsert
      const { data, error } = await supabase
        .from('contents')
        .upsert(contentData, {
          onConflict: 'imdb_id',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) {
        console.error(`콘텐츠 저장 실패: ${contentTitle}`, error.message);
        return null;
      }

      return data;
    } else {
      // imdb_id가 없는 경우: title+year로 기존 콘텐츠 확인
      const { data: existingContent } = await supabase
        .from('contents')
        .select('id')
        .eq('title', contentTitle)
        .eq('year', year)
        .maybeSingle();

      if (existingContent) {
        // 기존 콘텐츠가 있으면 업데이트
        const { data, error } = await supabase
          .from('contents')
          .update(contentData)
          .eq('id', existingContent.id)
          .select()
          .single();

        if (error) {
          console.error(`콘텐츠 업데이트 실패: ${contentTitle}`, error.message);
          return null;
        }

        console.log(`[중복 방지] 기존 콘텐츠 업데이트: ${contentTitle} (${year})`);
        return data;
      } else {
        // 기존 콘텐츠가 없으면 새로 삽입
        const { data, error } = await supabase
          .from('contents')
          .insert(contentData)
          .select()
          .single();

        if (error) {
          console.error(`콘텐츠 삽입 실패: ${contentTitle}`, error.message);
          return null;
        }

        return data;
      }
    }
  } catch (error) {
    console.error(`saveContentToSupabase 오류 (${movie.id}):`, error);
    return null;
  }
}

/**
 * [수정] 사용자 프로필 기반으로 콘텐츠 가져오기 및 저장 (최적화 버전)
 */
export async function fetchAndSaveRecommendations(
  genre: string,
  moods: string[]
): Promise<Content[]> {
  try {
    // 1. TMDB에서 콘텐츠 목록 가져오기
    const movies = await fetchMoviesFromTMDB(genre, moods, 200); // 최대 200개까지 검색 (10페이지 × 20개)
    if (!movies || movies.length === 0) {
        console.log(`[${genre}+${moods}] TMDB 검색 결과 없음`);
        return [];
    }

    // 2. [최적화] 장르 맵 한 번만 가져오기
    const isTV = genre === '드라마' || genre === '예능' || genre === '애니메이션';
    const genreType = isTV ? 'tv' : 'movie';
    const { genreMapKo, genreMapEn } = await getGenreMaps(genreType);

    // =====================================================================
    // [수정] 병렬 처리(Promise.all) -> 순차 처리(for...of)로 변경
    // 이유: 과도한 동시 요청으로 인한 TMDB Rate Limit(429 Error) 방지 및
    //       영어 데이터 누락(null) 방지
    // =====================================================================
    
    const savedContents: Content[] = []
    
    console.log(`[저장 시작] 총 ${movies.length}개 콘텐츠를 순차적으로 저장합니다...`)

    for (const [index, movie] of movies.entries()) {
      // 진행 상황 로깅 (5개마다)
      if (index % 5 === 0 && index > 0) {
        console.log(`[진행 중] ${index}/${movies.length} 처리 완료`)
      }

      const saved = await saveContentToSupabase(
        movie, 
        genre, 
        genreMapKo, 
        genreMapEn, 
        moods
      )
      
      if (saved) {
        savedContents.push(saved)
      }
      
      // (선택 사항) 안전성을 위해 각 요청 사이에 약간의 딜레이 추가 (0.1초)
      // Rate Limit 방지를 위한 최소 대기 시간
      if (index < movies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    const ottFiltered = movies.length - savedContents.length
    console.log(`[${genre}+${moods}] 저장 완료: ${savedContents.length} / ${movies.length}개 (OTT 없음/실패: ${ottFiltered}개)`)

    return savedContents
    
  } catch (error) {
    console.error('추천 콘텐츠 가져오기 실패:', error);
    return [];
  }
}

export async function importSpecificTVShows(
  tmdbIds: number[],
  moodIds: string[] = []
): Promise<Content[]> {
  try {
    if (!tmdbIds || tmdbIds.length === 0) {
      console.warn('[특정 TV 수집] tmdbIds가 비어 있음')
      return []
    }

    const uniqueIds = Array.from(new Set(tmdbIds.filter(Boolean)))
    if (uniqueIds.length === 0) {
      console.warn('[특정 TV 수집] 유효한 tmdbId 없음')
      return []
    }

    const { genreMapKo, genreMapEn } = await getGenreMaps('tv')

    const results: Content[] = []

    for (const tmdbId of uniqueIds) {
      const tvShow = await fetchTVShowById(tmdbId)
      if (!tvShow) {
        console.warn(`[특정 TV 수집] TMDB ID ${tmdbId} 상세 정보 없음`)
        continue
      }

      const saved = await saveContentToSupabase(
        tvShow,
        '드라마',
        genreMapKo,
        genreMapEn,
        moodIds,
        {
          forceSaveOTT: true,
          forceMoodTags: true,
        }
      )

      if (saved) {
        results.push(saved)
        console.log(`[특정 TV 수집] 저장 완료: ${saved.title} (ID: ${tmdbId})`)
      } else {
        console.warn(`[특정 TV 수집] 저장 실패: TMDB ID ${tmdbId}`)
      }
    }

    return results
  } catch (error) {
    console.error('[특정 TV 수집 실패]', error)
    return []
  }
}

