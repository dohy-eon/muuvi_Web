const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'

export type TMDBSearchItem = {
  id: number
  media_type?: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  profile_path?: string | null
}

export type NormalizedSearchResult = {
  id: string
  title: string
  year?: string
  posterUrl?: string
  mediaType: 'movie' | 'tv'
}

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

export type TMDBDetail =
  | ({
      id: number
      title: string
      release_date?: string
      overview?: string
      poster_path?: string | null
      backdrop_path?: string | null
      runtime?: number
      genres?: { id: number; name: string }[]
    } & { mediaType: 'movie' })
  | ({
      id: number
      name: string
      first_air_date?: string
      overview?: string
      poster_path?: string | null
      backdrop_path?: string | null
      episode_run_time?: number[]
      genres?: { id: number; name: string }[]
    } & { mediaType: 'tv' })

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

function normalizeDetail(type: 'movie' | 'tv', data: any): TMDBDetail {
  if (type === 'movie') {
    return {
      mediaType: 'movie',
      id: data.id,
      title: data.title,
      release_date: data.release_date,
      overview: data.overview,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path,
      runtime: data.runtime,
      genres: data.genres,
      // append_to_response로 받은 데이터 포함
      credits: data.credits,
      release_dates: data.release_dates,
      content_ratings: data.content_ratings,
      created_by: data.created_by,
    } as any
  }
  return {
    mediaType: 'tv',
    id: data.id,
    name: data.name,
    first_air_date: data.first_air_date,
    overview: data.overview,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    episode_run_time: data.episode_run_time,
    genres: data.genres,
    // append_to_response로 받은 데이터 포함
    credits: data.credits,
    release_dates: data.release_dates,
    content_ratings: data.content_ratings,
    created_by: data.created_by,
  } as any
}


