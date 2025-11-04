import { supabase } from '../supabase'
import { moodsToImdbTags } from '../moodMapping'
import type { Content } from '../../types'

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

    // TMDB Discover API로 영화 검색
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: 'ko-KR',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100', // 최소 평가 수
      page: '1',
    })

    // 장르 필터 추가
    if (genre !== '영화' && genreMap[genre]) {
      params.append('with_genres', genreMap[genre].toString())
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

    // 콘텐츠 데이터 구성
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
      tags: genres,
      url: imdbId ? `https://www.imdb.com/title/${imdbId}` : null,
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

    return data
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

