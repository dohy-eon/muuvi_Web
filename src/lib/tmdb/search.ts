import type {
  TMDBSearchItem,
  NormalizedSearchResult,
  TMDBDetail,
  TMDBMovieDetail,
  TMDBTVDetail,
  TMDBCredits,
  TMDBReleaseDates,
  TMDBContentRatings,
} from '../../types/tmdb'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'

// Re-export for backward compatibility
export type { TMDBSearchItem, NormalizedSearchResult, TMDBDetail }

function buildImageUrl(path?: string | null, size: 'w154' | 'w185' | 'w342' | 'w500' | 'original' = 'w342') {
  if (!path) return undefined
  return `${IMG_BASE}/${size}${path}`
}

export async function searchTMDB(query: string, language: 'ko' | 'en' = 'ko'): Promise<NormalizedSearchResult[]> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  if (!apiKey) {
    console.warn('VITE_TMDB_API_KEY가 설정되어 있지 않습니다.')
    return []
  }

  const langParam = language === 'en' ? 'en-US' : 'ko-KR'

  const url = new URL(`${TMDB_BASE}/search/multi`)
  url.searchParams.set('query', query)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', langParam)
  url.searchParams.set('page', '1')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey.startsWith('eyJ') ? apiKey : ''}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
  })

  // 만약 사용자가 API 키를 v3 key로만 넣은 경우 쿼리 파라미터로 시도
  if (res.status === 401) {
    const urlWithKey = new URL(`${TMDB_BASE}/search/multi`)
    urlWithKey.searchParams.set('api_key', apiKey)
    urlWithKey.searchParams.set('query', query)
    urlWithKey.searchParams.set('include_adult', 'false')
    urlWithKey.searchParams.set('language', langParam)
    urlWithKey.searchParams.set('page', '1')
    const res2 = await fetch(urlWithKey.toString())
    const json2 = await res2.json()
    return normalizeResults(json2?.results ?? [])
  }

  const json = await res.json()
  return normalizeResults(json?.results ?? [])
}

function normalizeResults(items: TMDBSearchItem[]): NormalizedSearchResult[] {
  return items
    .filter((it) => it.media_type === 'movie' || it.media_type === 'tv')
    .map((it) => {
      const title = it.title || it.name || ''
      const date = it.release_date || it.first_air_date || ''
      const year = date ? date.slice(0, 4) : undefined
      const poster = it.poster_path || it.profile_path || null
      return {
        id: String(it.id),
        title,
        year,
        posterUrl: buildImageUrl(poster, 'w342'),
        mediaType: (it.media_type as 'movie' | 'tv') ?? 'movie',
      }
    })
}


export async function getTMDBDetail(
  type: 'movie' | 'tv',
  id: string,
  language: 'ko' | 'en' = 'ko'
): Promise<TMDBDetail | null> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  if (!apiKey) {
    console.warn('VITE_TMDB_API_KEY가 설정되어 있지 않습니다.')
    return null
  }
  const langParam = language === 'en' ? 'en-US' : 'ko-KR'
  const path = type === 'movie' ? `/movie/${id}` : `/tv/${id}`
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('language', langParam)
  url.searchParams.set('append_to_response', 'credits,release_dates,content_ratings')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey.startsWith('eyJ') ? apiKey : ''}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
  })
  if (res.status === 401) {
    const urlWithKey = new URL(`${TMDB_BASE}${path}`)
    urlWithKey.searchParams.set('api_key', apiKey)
    urlWithKey.searchParams.set('language', langParam)
    urlWithKey.searchParams.set('append_to_response', 'credits,release_dates,content_ratings')
    const res2 = await fetch(urlWithKey.toString())
    if (!res2.ok) return null
    const json2 = await res2.json()
    return normalizeDetail(type, json2)
  }
  if (!res.ok) return null
  const json = await res.json()
  return normalizeDetail(type, json)
}

export function buildPosterUrl(path?: string | null, size: 'w342' | 'w500' | 'original' = 'w500') {
  return buildImageUrl(path ?? undefined, size)
}
export function buildBackdropUrl(
  path?: string | null,
  size: 'w342' | 'w500' | 'original' = 'original'
) {
  return buildImageUrl(path ?? undefined, size)
}

function normalizeDetail(type: 'movie' | 'tv', data: unknown): TMDBDetail | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }

  const obj = data as Record<string, unknown>

  if (type === 'movie') {
    const movieDetail: TMDBMovieDetail = {
      mediaType: 'movie',
      id: typeof obj.id === 'number' ? obj.id : 0,
      title: typeof obj.title === 'string' ? obj.title : '',
      release_date: typeof obj.release_date === 'string' ? obj.release_date : undefined,
      overview: typeof obj.overview === 'string' ? obj.overview : undefined,
      poster_path: typeof obj.poster_path === 'string' ? obj.poster_path : obj.poster_path === null ? null : undefined,
      backdrop_path:
        typeof obj.backdrop_path === 'string'
          ? obj.backdrop_path
          : obj.backdrop_path === null
            ? null
            : undefined,
      runtime: typeof obj.runtime === 'number' ? obj.runtime : undefined,
      genres: Array.isArray(obj.genres)
        ? obj.genres.map((g: unknown) => {
            const genre = g as Record<string, unknown>
            return {
              id: typeof genre.id === 'number' ? genre.id : 0,
              name: typeof genre.name === 'string' ? genre.name : '',
            }
          })
        : undefined,
      credits: obj.credits as TMDBCredits | undefined,
      release_dates: obj.release_dates as TMDBReleaseDates | undefined,
    }
    return movieDetail
  }

  const tvDetail: TMDBTVDetail = {
    mediaType: 'tv',
    id: typeof obj.id === 'number' ? obj.id : 0,
    name: typeof obj.name === 'string' ? obj.name : '',
    first_air_date: typeof obj.first_air_date === 'string' ? obj.first_air_date : undefined,
    overview: typeof obj.overview === 'string' ? obj.overview : undefined,
    poster_path: typeof obj.poster_path === 'string' ? obj.poster_path : obj.poster_path === null ? null : undefined,
    backdrop_path:
      typeof obj.backdrop_path === 'string'
        ? obj.backdrop_path
        : obj.backdrop_path === null
          ? null
          : undefined,
    episode_run_time: Array.isArray(obj.episode_run_time)
      ? obj.episode_run_time.filter((t): t is number => typeof t === 'number')
      : undefined,
    genres: Array.isArray(obj.genres)
      ? obj.genres.map((g: unknown) => {
          const genre = g as Record<string, unknown>
          return {
            id: typeof genre.id === 'number' ? genre.id : 0,
            name: typeof genre.name === 'string' ? genre.name : '',
          }
        })
      : undefined,
    credits: obj.credits as TMDBCredits | undefined,
    content_ratings: obj.content_ratings as TMDBContentRatings | undefined,
    created_by: Array.isArray(obj.created_by)
      ? obj.created_by.map((c: unknown) => {
          const creator = c as Record<string, unknown>
          return {
            id: typeof creator.id === 'number' ? creator.id : 0,
            name: typeof creator.name === 'string' ? creator.name : '',
          }
        })
      : undefined,
  }
  return tvDetail
}


