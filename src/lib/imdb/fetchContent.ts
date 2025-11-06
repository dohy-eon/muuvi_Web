import { supabase } from '../supabase'
import { moodsToImdbTags } from '../moodMapping'
import type { Content, OTTProvider } from '../../types'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

interface TMDBMovie {
  id: number
  title: string
  overview: string
  poster_path: string
  release_date: string
  vote_average: number
  genre_ids: number[]
  imdb_id?: string
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
 * TMDB에서 영화 데이터 가져오기
 */
async function fetchMoviesFromTMDB(
  genre: string,
  tags: string[],
  limit: number = 20
): Promise<TMDBMovie[]> {
  try {
    // 장르를 TMDB 장르 ID로 변환
    const genreMap: Record<string, number> = {
      영화: 0, // 영화는 별도 처리
      드라마: 18, // Drama
      애니메이션: 16, // Animation
      예능: 10770, // TV Movie
    }

    // 무드 태그를 TMDB 장르 ID로 변환
    const moodGenres = tagsToGenreIds(tags)

    // TMDB Discover API로 영화 검색
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: 'ko-KR',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100', // 최소 평가 수
      page: '1',
    })

    // 장르 필터 추가
    const allGenreIds: number[] = []
    
    if (genre !== '영화' && genreMap[genre]) {
      allGenreIds.push(genreMap[genre])
    }
    
    // 무드 태그에서 나온 장르 ID 추가
    allGenreIds.push(...moodGenres)
    
    // 중복 제거
    const uniqueGenreIds = Array.from(new Set(allGenreIds))
    
    // 장르 ID가 있으면 필터 추가 (여러 장르는 OR 조건)
    if (uniqueGenreIds.length > 0) {
      // TMDB는 여러 장르를 쉼표로 구분
      params.append('with_genres', uniqueGenreIds.join(','))
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/discover/movie?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error(`TMDB API 오류: ${response.status}`)
    }

    const data = await response.json()
    return data.results.slice(0, limit) || []
  } catch (error) {
    console.error('TMDB 데이터 가져오기 실패:', error)
    return []
  }
}

/**
 * TMDB 영화 ID로 IMDB ID 가져오기
 */
async function getImdbIdFromTMDB(tmdbId: number): Promise<string | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`
    )

    if (!response.ok) return null

    const data = await response.json()
    return data.external_ids?.imdb_id || null
  } catch (error) {
    console.error('IMDB ID 가져오기 실패:', error)
    return null
  }
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
 * 무드 태그를 TMDB 장르로 변환
 */
function tagsToGenreIds(tags: string[]): number[] {
  const tagToGenre: Record<string, number[]> = {
    Romance: [10749], // Romance
    Horror: [27], // Horror
    Comedy: [35], // Comedy
    'Sci-Fi': [878], // Science Fiction
    Fantasy: [14], // Fantasy
    Adventure: [12], // Adventure
    Action: [28], // Action
    Drama: [18], // Drama
    Family: [10751], // Family
    Mystery: [9648], // Mystery
    Thriller: [53], // Thriller
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
async function saveContentToSupabase(movie: TMDBMovie): Promise<Content | null> {
  try {
    // IMDB ID 가져오기
    const imdbId = await getImdbIdFromTMDB(movie.id)

    // OTT 제공자 정보 가져오기 (영화는 'movie')
    const ottProviders = await getWatchProvidersFromTMDB(movie.id, 'movie')

    // 장르 이름 가져오기
    const genreResponse = await fetch(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=ko-KR`
    )
    const genreData = await genreResponse.json()
    const genreMap: Record<number, string> = {}
    genreData.genres.forEach((g: TMDBGenre) => {
      genreMap[g.id] = g.name
    })

    const genres = movie.genre_ids.map((id) => genreMap[id] || '').filter(Boolean)
    
    // TMDB 장르 이름을 IMDB 태그 형식으로도 저장 (무드 필터링을 위해)
    // TMDB 장르 이름을 영어로도 가져오기
    const genreResponseEn = await fetch(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`
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

    // 콘텐츠 데이터 구성 (Supabase 저장용 - ott_providers 제외)
    const contentData = {
      title: movie.title,
      description: movie.overview,
      poster_url: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      imdb_id: imdbId,
      imdb_rating: movie.vote_average ? movie.vote_average / 2 : null, // TMDB는 10점 만점
      year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null,
      genre: '영화', // 기본값
      tags: allTags, // 한국어 장르 + 영어 태그 (무드 필터링용)
      url: imdbId ? `https://www.imdb.com/title/${imdbId}` : null,
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
    // 무드 ID를 IMDB 태그로 변환
    const tags = moodsToImdbTags(moods)

    // TMDB에서 영화 가져오기
    const movies = await fetchMoviesFromTMDB(genre, tags, 20)

    // 각 영화를 Supabase에 저장 시도
    const savedContents: Content[] = []
    const tempContents: Content[] = [] // 저장 실패 시 임시로 사용할 데이터
    
    for (const movie of movies) {
      const content = await saveContentToSupabase(movie)
      if (content) {
        savedContents.push(content)
      } else {
        // 저장 실패해도 TMDB 데이터를 임시 Content 객체로 변환
        // OTT 정보도 함께 가져오기 (영화는 'movie')
        const ottProviders = await getWatchProvidersFromTMDB(movie.id, 'movie')
        
        const tempContent: Content = {
          id: `temp-${movie.id}`, // 임시 ID
          title: movie.title,
          description: movie.overview,
          poster_url: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : undefined,
          imdb_id: undefined,
          imdb_rating: movie.vote_average ? movie.vote_average / 2 : undefined,
          year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : undefined,
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

