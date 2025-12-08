import { useQuery } from '@tanstack/react-query'
import { getTMDBDetail } from '../lib/tmdb/search'
import type { TMDBDetail, TMDBCredits, TMDBProvider, TMDMMediaItem } from '../types/tmdb'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'

/**
 * TMDB 상세 정보를 가져오는 React Query 훅
 */
export const useTMDBDetail = (type: 'movie' | 'tv', id: string, language: 'ko' | 'en') => {
  return useQuery<TMDBDetail | null>({
    queryKey: ['tmdb', 'detail', type, id, language],
    queryFn: () => getTMDBDetail(type, id, language),
    enabled: !!id && !!type,
  })
}

/**
 * TMDB Credits를 가져오는 React Query 훅
 */
export const useTMDBCredits = (type: 'movie' | 'tv', id: string) => {
  return useQuery<{ cast: TMDBCredits['cast']; crew: TMDBCredits['crew'] } | null>({
    queryKey: ['tmdb', 'credits', type, id],
    queryFn: async () => {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      if (!apiKey) return null
      const endpoint = type === 'movie' ? 'movie' : 'tv'
      const url = new URL(`${TMDB_BASE}/${endpoint}/${id}/credits`)

      if (!apiKey.startsWith('eyJ')) {
        url.searchParams.set('api_key', apiKey)
      }

      const res = await fetch(url.toString(), {
        headers: apiKey.startsWith('eyJ') ? { Authorization: `Bearer ${apiKey}` } : undefined,
      }).catch(() => null)

      if (!res || !res.ok) return null
      const json = (await res.json()) as { cast?: TMDBCredits['cast']; crew?: TMDBCredits['crew'] }
      return {
        cast: json.cast || [],
        crew: json.crew || [],
      }
    },
    enabled: !!id && !!type,
  })
}

/**
 * TMDB OTT Providers를 가져오는 React Query 훅
 */
export const useTMDBProviders = (type: 'movie' | 'tv', id: string) => {
  return useQuery<TMDBProvider[]>({
    queryKey: ['tmdb', 'providers', type, id],
    queryFn: async () => {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      if (!apiKey) return []
      const endpoint = type === 'movie' ? 'movie' : 'tv'
      const url = new URL(`${TMDB_BASE}/${endpoint}/${id}/watch/providers`)

      if (!apiKey.startsWith('eyJ')) {
        url.searchParams.set('api_key', apiKey)
      }

      const res = await fetch(url.toString(), {
        headers: apiKey.startsWith('eyJ') ? { Authorization: `Bearer ${apiKey}` } : undefined,
      }).catch(() => null)

      if (!res || !res.ok) return []
      const json = await res.json()
      // KR가 비어있을 때를 대비해 US, JP 순으로 fallback
      const regionOrder = ['KR', 'US', 'JP']
      const regionKey = regionOrder.find((code) => json?.results?.[code]) as 'KR' | 'US' | 'JP' | undefined
      const region = regionKey ? json.results[regionKey] : null
      if (!region) return []

      const list: TMDBProvider[] = []
      ;(['flatrate', 'free', 'rent', 'buy'] as const).forEach((k) => {
        const arr = region[k]
        if (Array.isArray(arr)) {
          arr.forEach((p) => {
            if (p.provider_id && p.provider_name) {
              list.push({
                provider_id: p.provider_id,
                provider_name: p.provider_name,
                logo_path: p.logo_path ? `${IMG_BASE}/w300${p.logo_path}` : undefined,
                type: k,
              })
            }
          })
        }
      })
      return list
    },
    enabled: !!id && !!type,
  })
}

/**
 * TMDB Media (비디오/이미지)를 가져오는 React Query 훅
 */
export const useTMDBMedia = (type: 'movie' | 'tv', id: string, language: 'ko' | 'en' = 'ko') => {
  return useQuery<TMDMMediaItem[]>({
    queryKey: ['tmdb', 'media', type, id, language],
    queryFn: async () => {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      if (!apiKey) return []
      const langParam = language === 'en' ? 'en-US' : 'ko-KR'
      const endpoint = type === 'movie' ? 'movie' : 'tv'
      const headers = apiKey.startsWith('eyJ') ? { Authorization: `Bearer ${apiKey}` } : undefined
      const videosUrl = new URL(`${TMDB_BASE}/${endpoint}/${id}/videos`)
      const imagesUrl = new URL(`${TMDB_BASE}/${endpoint}/${id}/images`)
      videosUrl.searchParams.set('language', langParam)
      if (!apiKey.startsWith('eyJ')) {
        videosUrl.searchParams.set('api_key', apiKey)
        imagesUrl.searchParams.set('api_key', apiKey)
      }

      const [videosRes, imagesRes] = await Promise.all([
        fetch(videosUrl.toString(), { headers }).catch(() => null),
        fetch(imagesUrl.toString(), { headers }).catch(() => null),
      ])

      const items: TMDMMediaItem[] = []
      if (videosRes && videosRes.ok) {
        const vd = (await videosRes.json()) as {
          results?: Array<{ type?: string; key?: string }>
        }
        const vids = (vd.results || [])
          .filter((v) => v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip')
          .slice(0, 3)
        vids.forEach((v) => {
          if (v.key) {
            items.push({
              type: 'video',
              url: `https://www.youtube.com/watch?v=${v.key}`,
              thumbnail: `https://img.youtube.com/vi/${v.key}/hqdefault.jpg`,
            })
          }
        })
      }
      if (imagesRes && imagesRes.ok) {
        const im = (await imagesRes.json()) as {
          backdrops?: Array<{ file_path?: string }>
          posters?: Array<{ file_path?: string }>
        }
        const backdrops = (im.backdrops || []).slice(0, 4)
        backdrops.forEach((b) => {
          if (b.file_path) {
            items.push({
              type: 'image',
              url: `${IMG_BASE}/original${b.file_path}`,
              thumbnail: `${IMG_BASE}/w500${b.file_path}`,
            })
          }
        })
        const posters = (im.posters || []).slice(0, 2)
        posters.forEach((p) => {
          if (p.file_path) {
            items.push({
              type: 'image',
              url: `${IMG_BASE}/original${p.file_path}`,
              thumbnail: `${IMG_BASE}/w500${p.file_path}`,
            })
          }
        })
      }
      return items.slice(0, 9)
    },
    enabled: !!id && !!type,
  })
}
