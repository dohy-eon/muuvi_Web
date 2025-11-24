import { supabase } from '../supabase.ts'
import { GENRE_TO_TMDB_ID } from '../tmdb/genreMapping.ts'
import { moodsToTMDBParams } from '../tmdb/moodToTMDB.ts'
import type { Content, OTTProvider } from '../../types/index.ts'
import type {
  TMDBMovie,
  TMDBGenre,
  TMDBKeyword,
  TMDBWatchProvidersResponse,
} from '../../types/tmdb.ts'
import { tmdbToContent, type TMDBDetails } from '../adapters/tmdb.ts'

// Deno 환경인지 확인 (Supabase Edge Function)
// @ts-ignore: 'Deno' is not defined in Vite/Node.js environment
const isDeno = typeof Deno !== 'undefined'

// Deno(백엔드)일 경우 Deno.env.get()을, Vite(프론트엔드)일 경우 import.meta.env를 사용
const TMDB_API_KEY = isDeno
  // @ts-ignore: Deno globals only in edge runtime
  ? Deno.env.get('VITE_TMDB_API_KEY') || ''
  : import.meta.env.VITE_TMDB_API_KEY || ''

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

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
    }

    // '예능'은 with_type으로 필터링되므로 여기서는 추가 ID 없음

    // 수집된 장르 ID가 있으면 params에 추가 (여러 개일 경우 OR 조건 '|')
    if (genreIdsToFilter.size > 0) {
      const genreIdString = Array.from(genreIdsToFilter).join('|')
      params.append('with_genres', genreIdString)
    }

    // 2. [무드 필터] 적용 (키워드 기반)
    // 무드에서 파생된 장르(moodParams.genres)는 의도치 않은 AND 조건으로
    // 검색 결과를 0으로 만드므로, 키워드(moodParams.keywords)만 사용합니다.
    // 예능은 키워드 필터를 사용하지 않음 (검색 결과가 너무 제한적)
    if (genre !== '예능' && moodParams.keywords && moodParams.keywords.length > 0) {
      // 여러 키워드를 OR 조건(|)으로 연결하여 더 넓은 범위 검색
      const keywordString = moodParams.keywords.join('|')
      params.append('with_keywords', keywordString)
    }

    // 3. [정렬 기준] 적용
    params.append('sort_by', moodParams.sortBy || 'vote_average.desc')
    
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
      }
    } else {
      params.append('primary_release_date.gte', `${startYear}-01-01`)
    }

    const requestUrl = `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`

    const response = await fetch(requestUrl)

    if (!response.ok) {
      // 429 에러 (Rate Limit) 처리
      if (response.status === 429) {
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
    
    // 결과가 없으면 필터를 완화하여 재검색 (엔드포인트는 유지)
    if (!data.results || data.results.length === 0) {
      // 최소 평점 필터 제거
      params.delete('vote_average.gte')
      
      // 최소 평가 수 완화 (10 -> 5)
      params.set('vote_count.gte', '5')
      
      // 최근 10년 제한 제거
      if (isTV) {
        params.delete('first_air_date.gte')
      } else {
        params.delete('primary_release_date.gte')
      }
      
      // 중요: 엔드포인트는 변경하지 않음 (드라마는 TV, 영화는 Movie로 유지)
      const retryUrl = `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`
      
      const retryResponse = await fetch(retryUrl)
      
      if (retryResponse.ok) {
        const retryData = await retryResponse.json()
        
        if (retryData.results && retryData.results.length > 0) {
          return retryData.results.slice(0, limit) || []
        } else {
          // 키워드 필터만 제거하고 재시도 (장르 필터는 유지)
          if (moodParams.keywords && moodParams.keywords.length > 0) {
            // 키워드 필터 제거 (너무 제한적일 수 있음)
            params.delete('with_keywords')
            
            const keywordRetryUrl = `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`
            
            const keywordRetryResponse = await fetch(keywordRetryUrl)
            if (keywordRetryResponse.ok) {
              const keywordRetryData = await keywordRetryResponse.json()
              if (keywordRetryData.results && keywordRetryData.results.length > 0) {
                return keywordRetryData.results.slice(0, limit) || []
              }
            }
          }
        }
      }
    }
    
    // [최적화] 결과가 부족하면 여러 페이지 검색
    let allResults = data.results || []
    let currentPage = 1
    const maxPages = 10 // 최대 10페이지까지 검색 (더 많은 영화를 검색하기 위해 3 -> 10으로 증가)
    
    while (allResults.length < limit && currentPage < maxPages && data.total_pages > currentPage) {
      currentPage++
      params.set('page', currentPage.toString())
      
      const nextResponse = await fetch(`${TMDB_BASE_URL}/${endpoint}?${params.toString()}`)
      if (nextResponse.ok) {
        const nextData = await nextResponse.json()
        if (nextData.results && nextData.results.length > 0) {
          allResults = [...allResults, ...nextData.results]
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
async function getContentDetailsFromTMDB(
  tmdbId: number,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<{
  imdbId: string | null
  credits?: unknown
  videos?: unknown
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
        // 영어 정보 파싱 실패 시 무시
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
    let contentType: 'movie' | 'tv' = 'movie'
    if (selectedGenre === '영화') {
      contentType = 'movie'
    } else if (selectedGenre === '애니메이션' || selectedGenre === '드라마' || selectedGenre === '예능') {
      contentType = 'tv'
    } else {
      const isTVContent = movie.genre_ids.includes(18) || movie.genre_ids.includes(16) || movie.genre_ids.includes(10770)
      contentType = isTVContent ? 'tv' : 'movie'
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
      getWatchProvidersFromTMDB(movie.id, contentType),
    ])

    // 한국어 데이터 처리
    if (!responseKo || !responseKo.ok) {
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

    const detailsKo: TMDBDetails['ko'] = {
      imdbId: dataKo.external_ids?.imdb_id || null,
      genres: Array.isArray(dataKo.genres) ? dataKo.genres : [],
      keywords: keywordsKo,
      title: contentType === 'tv' ? dataKo.name : dataKo.title,
      description: dataKo.overview,
    }

    // 영어 데이터 처리 (선택적)
    let detailsEn: TMDBDetails['en'] = null

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
          // 영어 정보 파싱 실패 시 무시
        }
      }
    }

    let ottProviders = rawOttProviders

    // [필터링] OTT 제공자가 없으면 저장하지 않음 (시청 불가능한 콘텐츠 제외)
    if ((!ottProviders || ottProviders.length === 0) && !options.forceSaveOTT) {
      return null
    }

    if ((!ottProviders || ottProviders.length === 0) && options.forceSaveOTT) {
      ottProviders = [
        {
          provider_id: -1,
          provider_name: '수동 추가',
        },
      ]
    }

    // [추가] 임베딩 생성 (줄거리를 벡터로 변환)
    const textToEmbed = movie.overview || movie.title || movie.name || ''
    let embedding: number[] | null = null

    if (textToEmbed) {
      try {
        // 텍스트 길이 제한 (512자) - embed 함수와 동일
        const truncatedText = textToEmbed.slice(0, 512)

        const { data: embedData, error: embedError } = await supabase.functions.invoke('embed', {
          body: { text: truncatedText },
        })

        if (embedError) {
          console.error(`[임베딩 에러] (ID: ${movie.id}):`, embedError)
          throw embedError
        }

        if (embedData && embedData.vector) {
          embedding = embedData.vector
        }
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e)
        console.error(`[임베딩 실패] (ID: ${movie.id}, 제목: ${movie.title || movie.name}):`, error)
        // 임베딩 실패해도 콘텐츠는 저장 (vector는 null)
        embedding = null
      }
    }

    // 어댑터 함수를 사용하여 TMDB 데이터를 Content 타입으로 변환
    const details: TMDBDetails = {
      ko: detailsKo,
      en: detailsEn,
    }

    const contentData = tmdbToContent(movie, details, ottProviders, {
      selectedGenre,
      genreMapKo,
      genreMapEn,
      moodIds,
      forceMoodTags: options.forceMoodTags,
    })

    if (!contentData) {
      return null
    }

    // 임베딩 벡터 추가
    const contentDataWithVector = {
      ...contentData,
      vector: embedding,
    }

    // [최적화] 중복 저장 방지
    // imdb_id가 있으면 imdb_id로 upsert, 없으면 title+year로 중복 체크
    const imdbId = details.ko.imdbId
    if (imdbId) {
      // imdb_id가 있는 경우: imdb_id로 upsert
      const { data, error } = await supabase
        .from('contents')
        .upsert(contentDataWithVector, {
          onConflict: 'imdb_id',
          ignoreDuplicates: false,
        })
        .select()
        .single()

      if (error) {
        console.error(`콘텐츠 저장 실패: ${contentData.title}`, error.message)
        return null
      }

      return data
    } else {
      // imdb_id가 없는 경우: title+year로 기존 콘텐츠 확인
      const { data: existingContent } = await supabase
        .from('contents')
        .select('id')
        .eq('title', contentData.title)
        .eq('year', contentData.year)
        .maybeSingle()

      if (existingContent) {
        // 기존 콘텐츠가 있으면 업데이트
        const { data, error } = await supabase
          .from('contents')
          .update(contentDataWithVector)
          .eq('id', existingContent.id)
          .select()
          .single()

        if (error) {
          console.error(`콘텐츠 업데이트 실패: ${contentData.title}`, error.message)
          return null
        }

        return data
      } else {
        // 기존 콘텐츠가 없으면 새로 삽입
        const { data, error } = await supabase
          .from('contents')
          .insert(contentDataWithVector)
          .select()
          .single()

        if (error) {
          console.error(`콘텐츠 삽입 실패: ${contentData.title}`, error.message)
          return null
        }

        return data
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

    for (const [index, movie] of movies.entries()) {
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
      return []
    }

    const uniqueIds = Array.from(new Set(tmdbIds.filter(Boolean)))
    if (uniqueIds.length === 0) {
      return []
    }

    const { genreMapKo, genreMapEn } = await getGenreMaps('tv')

    const results: Content[] = []

    for (const tmdbId of uniqueIds) {
      const tvShow = await fetchTVShowById(tmdbId)
      if (!tvShow) {
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
      }
    }

    return results
  } catch (error) {
    console.error('[특정 TV 수집 실패]', error)
    return []
  }
}

/**
 * [추가] IMDB ID로 TMDB ID 찾기 (Find API 사용)
 */
async function getTMDBIdByImdbId(imdbId: string, contentType: 'movie' | 'tv' = 'movie'): Promise<number | null> {
  try {
    const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`
    const response = await fetch(findUrl)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const results = contentType === 'tv' ? data.tv_results : data.movie_results

    if (results && results.length > 0) {
      return results[0].id
    }

    return null
  } catch (error) {
    console.error(`[TMDB Find API 오류] IMDB: ${imdbId}:`, error)
    return null
  }
}

/**
 * [추가] 영화 상세 정보 가져오기 (TMDB API -> TMDBMovie 객체 변환)
 */
async function fetchMovieById(tmdbId: number): Promise<TMDBMovie | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=ko-KR`
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const genreIds = Array.isArray(data.genres)
      ? data.genres.map((genre: TMDBGenre) => genre.id)
      : []

    const movie: TMDBMovie = {
      id: data.id,
      title: data.title,
      original_title: data.original_title,
      overview: data.overview,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path,
      release_date: data.release_date,
      vote_average: data.vote_average,
      vote_count: data.vote_count,
      popularity: data.popularity,
      genre_ids: genreIds,
      imdb_id: data.imdb_id,
      original_language: data.original_language,
      production_countries: data.production_countries,
    }

    return movie
  } catch (error) {
    console.error(`[TMDB] 영화 상세 정보 가져오기 실패 (ID: ${tmdbId})`, error)
    return null
  }
}

/**
 * [추가] 특정 IMDB ID의 콘텐츠를 강제로 업데이트하는 함수
 */
export async function updateContentByImdbId(imdbId: string, genre: string): Promise<boolean> {
  try {
    // 1. 콘텐츠 타입 결정
    const contentType = (genre === '드라마' || genre === '예능' || genre === '애니메이션') ? 'tv' : 'movie'

    // 2. TMDB ID 찾기
    const tmdbId = await getTMDBIdByImdbId(imdbId, contentType)

    if (!tmdbId) {
      return false
    }

    // 3. 상세 정보 가져오기 (영화 vs TV)
    let contentData: TMDBMovie | null = null
    if (contentType === 'tv') {
      contentData = await fetchTVShowById(tmdbId)
    } else {
      contentData = await fetchMovieById(tmdbId)
    }

    if (!contentData) {
      return false
    }

    // 4. 장르 맵 가져오기
    const { genreMapKo, genreMapEn } = await getGenreMaps(contentType)

    // 5. 저장 (이때 영어 데이터도 함께 가져와서 upsert 됨)
    const saved = await saveContentToSupabase(
      contentData,
      genre, // 기존 장르 유지
      genreMapKo,
      genreMapEn,
      [], // 무드 ID는 기존 태그 유지를 위해 비워둠 (필요시 DB에서 가져와야 함)
      { forceSaveOTT: true } // 기존에 있던 거니 OTT 없어도 일단 유지
    )

    if (saved) {
      return true
    }

    return false
  } catch (error) {
    console.error(`[업데이트 에러] ${imdbId}:`, error)
    return false
  }
}

