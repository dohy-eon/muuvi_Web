import { supabase } from '../supabase.ts'
import { GENRE_TO_TMDB_ID } from '../tmdb/genreMapping.ts'
import { moodsToTMDBParams } from '../tmdb/moodToTMDB.ts'
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
      'vote_count.gte': '10', // 최소 평가 수 (100 -> 10으로 완화)
      'vote_average.gte': '5.0', // 최소 평점 (6.0 -> 5.0으로 완화)
      page: '1',
      'with_original_language': 'ko', // 한국 작품 우선 (선택사항)
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
    // '영화'는 엔드포인트(/discover/movie) 자체로 필터링됩니다.
    // '예능'은 아래 'with_type'으로 필터링됩니다.
    // '드라마', '애니메이션'만 with_genres에 ID를 명시적으로 추가합니다.
    const selectedGenreId = genre !== '영화' && GENRE_TO_TMDB_ID[genre] ? GENRE_TO_TMDB_ID[genre] : null

    if (selectedGenreId && (genre === '드라마' || genre === '애니메이션')) {
      params.append('with_genres', selectedGenreId.toString())
      console.log('[장르 필터 적용]', { genre, genreId: selectedGenreId })
    } else {
      console.log('[장르 필터] 없음 (영화 또는 예능)', { genre })
    }

    // 2. [무드 필터] 적용 (키워드 기반)
    // 무드에서 파생된 장르(moodParams.genres)는 의도치 않은 AND 조건으로
    // 검색 결과를 0으로 만드므로, 키워드(moodParams.keywords)만 사용합니다.
    if (moodParams.keywords && moodParams.keywords.length > 0) {
      // 여러 키워드를 OR 조건(|)으로 연결하여 더 넓은 범위 검색
      const keywordString = moodParams.keywords.join('|')
      params.append('with_keywords', keywordString)
      console.log('[무드 필터 적용]', {
        keywordIds: moodParams.keywords,
        keywordString,
        논리: 'OR (|)',
      })
    } else {
      console.log('[무드 필터] 없음')
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
async function saveContentToSupabase(
  movie: TMDBMovie,
  selectedGenre: string,
  genreMapKo: Record<number, string>,
  genreMapEn: Record<number, string>
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

    // [최적화] 상세정보와 OTT 정보를 병렬로 호출
    const [details, ottProviders] = await Promise.all([
      getContentDetailsFromTMDB(movie.id, contentType),
      getWatchProvidersFromTMDB(movie.id, contentType)
    ]);
    
    const imdbId = details?.imdbId || null;

    // [최적화] 장르 API 호출 제거 (인자로 받은 맵 사용)
    const genres = movie.genre_ids.map((id) => genreMapKo[id] || '').filter(Boolean);
    const englishTags = movie.genre_ids.map((id) => genreMapEn[id] || '').filter(Boolean);
    const allTags = [...new Set([...genres, ...englishTags])]; // 중복 제거

    // [기존 로직] 저장할 장르명 결정
    const genreMapForSave: Record<string, number> = GENRE_TO_TMDB_ID;
    let contentGenre = '영화'; // 기본값
    
    if (selectedGenre) {
      if (selectedGenre === '영화') {
        contentGenre = '영화';
      } else if (genreMapForSave[selectedGenre] && movie.genre_ids.includes(genreMapForSave[selectedGenre])) {
        contentGenre = selectedGenre;
      } else {
          // 선택한 장르가 콘텐츠에 없으면, 콘텐츠의 주 장르로 대체
          if (movie.genre_ids.includes(18)) contentGenre = '드라마';
          else if (movie.genre_ids.includes(16)) contentGenre = '애니메이션';
          else if (movie.genre_ids.includes(10770)) contentGenre = '예능';
      }
    } else {
        if (movie.genre_ids.includes(18)) contentGenre = '드라마';
        else if (movie.genre_ids.includes(16)) contentGenre = '애니메이션';
        else if (movie.genre_ids.includes(10770)) contentGenre = '예능';
    }

    const contentTitle = movie.title || movie.name || '';
    if (!contentTitle) {
      console.warn('제목이 없는 콘텐츠:', movie.id);
      return null;
    }

    const dateString = movie.release_date || movie.first_air_date || '';
    const year = dateString ? parseInt(dateString.split('-')[0]) : null;

    const contentData = {
      title: contentTitle,
      description: movie.overview || null,
      poster_url: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      imdb_id: imdbId,
      imdb_rating: movie.vote_average ? movie.vote_average / 2 : null,
      year: year,
      genre: contentGenre,
      tags: allTags,
      url: imdbId ? `https://www.imdb.com/title/${imdbId}` : null,
      ott_providers: ottProviders.length > 0 ? ottProviders : undefined,
    };

    // [기존 로직] DB 저장
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
    const movies = await fetchMoviesFromTMDB(genre, moods, 20);
    if (!movies || movies.length === 0) {
        console.log(`[${genre}+${moods}] TMDB 검색 결과 없음`);
        return [];
    }

    // 2. [최적화] 장르 맵 한 번만 가져오기
    const isTV = genre === '드라마' || genre === '예능' || genre === '애니메이션';
    const genreType = isTV ? 'tv' : 'movie';
    const { genreMapKo, genreMapEn } = await getGenreMaps(genreType);

    // 3. [최적화] 20개 콘텐츠 저장을 병렬로 실행
    const savePromises = movies.map(movie => 
      saveContentToSupabase(movie, genre, genreMapKo, genreMapEn)
    );
    
    const savedContents = (await Promise.all(savePromises)).filter(Boolean) as Content[];
    
    console.log(`[${genre}+${moods}] 저장 완료: ${savedContents.length} / ${movies.length}개`);

    return savedContents;
    
  } catch (error) {
    console.error('추천 콘텐츠 가져오기 실패:', error);
    return [];
  }
}

