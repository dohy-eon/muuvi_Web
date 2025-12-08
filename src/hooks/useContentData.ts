import { useMemo } from 'react'
import type { TMDBDetail, TMDBMovieDetail, TMDBTVDetail, TMDBProvider, TMDBCredits } from '../types/tmdb'

interface UseContentDataParams {
  detail: TMDBDetail | null | undefined
  credits: { cast: TMDBCredits['cast']; crew: TMDBCredits['crew'] } | null | undefined
  ottProviders: TMDBProvider[] | undefined
  type: 'movie' | 'tv'
  t: {
    hour: string
    minute: string
  }
}

interface ProcessedCast {
  id: number
  name: string
  character: string
  profile_path: string | null
}

interface UseContentDataReturn {
  genres: Array<{ id: number; name: string }>
  ageRating: string | null
  runtime: string | null
  cast: ProcessedCast[]
  director: string | null
  writer: string | null
  displayOttProviders: TMDBProvider[]
  flatrateCount: number
  freeCount: number
  rentCount: number
  buyCount: number
}

/**
 * Content 데이터를 가공하는 커스텀 훅
 * 런타임 계산, 연령 등급 추출, OTT 중복 제거 등의 로직을 담당합니다.
 */
export function useContentData({
  detail,
  credits,
  ottProviders = [],
  type,
  t,
}: UseContentDataParams): UseContentDataReturn {
  // 장르 추출
  const genres = useMemo(() => {
    return detail?.genres ?? []
  }, [detail?.genres])

  // 연령 등급 및 런타임 계산
  const { ageRating, runtime } = useMemo(() => {
    if (!detail) return { ageRating: null, runtime: null }

    let rating: string | null = null
    let runtimeValue: string | null = null

    if (type === 'movie' && detail.mediaType === 'movie') {
      const movieData = detail as TMDBMovieDetail
      // 연령 등급
      const rel = movieData.release_dates?.results?.find((r) => r.iso_3166_1 === 'KR')
      rating = rel?.release_dates?.[0]?.certification || null
      // 런타임
      const rt = movieData.runtime
      if (rt) {
        const h = Math.floor(rt / 60)
        const m = rt % 60
        runtimeValue = h > 0 ? `${h}${t.hour} ${m}${t.minute}` : `${m}${t.minute}`
      }
    } else if (type === 'tv' && detail.mediaType === 'tv') {
      const tvData = detail as TMDBTVDetail
      // 연령 등급
      const ratings = tvData.content_ratings?.results || []
      const kr = ratings.find((r) => r.iso_3166_1 === 'KR')
      rating = kr?.rating || null
      if (!rating) {
        const us = ratings.find((r) => r.iso_3166_1 === 'US')
        rating = us?.rating || null
        if (!rating) {
          rating = ratings?.[0]?.rating || null
        }
      }
      // 런타임
      const epi = tvData.episode_run_time?.[0]
      if (epi) {
        const h = Math.floor(epi / 60)
        const m = epi % 60
        runtimeValue = h > 0 ? `${h}${t.hour} ${m}${t.minute}` : `${m}${t.minute}`
      }
    }

    return { ageRating: rating, runtime: runtimeValue }
  }, [detail, type, t])

  // 출연진/제작진 처리
  const { cast, director, writer } = useMemo(() => {
    let processedCast: ProcessedCast[] = []
    let processedDirector: string | null = null
    let processedWriter: string | null = null

    // Credits는 detail에 포함되어 있거나 별도로 가져온 credits 사용
    const creditsData = detail?.credits || credits

    if (creditsData && (creditsData.cast || creditsData.crew)) {
      // 출연진
      const castList = (creditsData.cast || []).slice(0, 6).map((actor) => ({
        id: actor.id,
        name: actor.name || '',
        character: actor.character || actor.roles?.[0]?.character || '',
        profile_path: actor.profile_path
          ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
          : null,
      }))
      processedCast = castList

      // 제작진
      const crew = creditsData.crew || []
      // 감독: Director 우선, 없으면 Directing 부서 최상위, TV는 Executive Producer 보조
      const directorCandidate =
        crew.find((p) => p.job === 'Director') ||
        crew.find((p) => p.department === 'Directing') ||
        (type === 'tv' ? crew.find((p) => p.job === 'Executive Producer') : undefined)
      processedDirector = directorCandidate?.name ?? null

      // 극본: Writer, Screenplay, Story, Novel, TV는 Creator 포함
      const writerCandidate =
        crew.find((p) => p.job === 'Writer') ||
        crew.find((p) => p.job === 'Screenplay') ||
        crew.find((p) => p.job === 'Story') ||
        crew.find((p) => p.job === 'Novel') ||
        (type === 'tv' ? crew.find((p) => p.job === 'Creator') : undefined)

      if (!writerCandidate && type === 'tv' && detail?.mediaType === 'tv') {
        const tvData = detail as TMDBTVDetail
        const createdBy = tvData.created_by
        if (Array.isArray(createdBy) && createdBy.length > 0) {
          processedWriter = createdBy.map((c) => c.name).filter(Boolean).join(', ')
        }
      } else {
        processedWriter = writerCandidate?.name ?? null
      }
    }

    return { cast: processedCast, director: processedDirector, writer: processedWriter }
  }, [detail, credits, type])

  // OTT Provider 필터링 및 중복 제거
  const { displayOttProviders, flatrateCount, freeCount, rentCount, buyCount } = useMemo(() => {
    const flatrate = ottProviders.filter((p) => p.type === 'flatrate').length
    const free = ottProviders.filter((p) => p.type === 'free').length
    const rent = ottProviders.filter((p) => p.type === 'rent').length
    const buy = ottProviders.filter((p) => p.type === 'buy').length

    // 필터 미선택 시 동일 플랫폼(예: wavve)이 여러 타입으로 중복 노출되는 문제 방지
    const priority: Record<'flatrate' | 'free' | 'rent' | 'buy', number> = {
      flatrate: 0,
      free: 1,
      rent: 2,
      buy: 3,
    }
    const map = new Map<number, TMDBProvider>()
    for (const p of ottProviders) {
      const existing = map.get(p.provider_id)
      if (!existing) {
        map.set(p.provider_id, p)
      } else {
        // 더 높은 우선순위 타입을 유지
        if (priority[p.type] < priority[existing.type]) {
          map.set(p.provider_id, p)
        }
      }
    }
    const dedupedProviders = Array.from(map.values())

    return {
      displayOttProviders: dedupedProviders,
      flatrateCount: flatrate,
      freeCount: free,
      rentCount: rent,
      buyCount: buy,
    }
  }, [ottProviders])

  return {
    genres,
    ageRating,
    runtime,
    cast,
    director,
    writer,
    displayOttProviders,
    flatrateCount,
    freeCount,
    rentCount,
    buyCount,
  }
}
