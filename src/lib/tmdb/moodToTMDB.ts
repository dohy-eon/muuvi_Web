import { MOOD_TO_TMDB_GENRE, MOOD_TO_TMDB_KEYWORDS, MOOD_TO_SORT_BY } from './genreMapping.ts'

/**
 * 무드 ID 배열을 TMDB 장르 ID 배열로 변환
 */
export function moodsToTMDBGenres(moodIds: string[]): number[] {
  const genreIds = new Set<number>()
  
  moodIds.forEach((moodId) => {
    const tmdbGenres = MOOD_TO_TMDB_GENRE[moodId] || []
    tmdbGenres.forEach((genreId) => genreIds.add(genreId))
  })
  
  return Array.from(genreIds)
}

/**
 * 무드 ID 배열을 TMDB 키워드 ID 배열로 변환
 */
export function moodsToTMDBKeywords(moodIds: string[]): number[] {
  const keywordIds = new Set<number>()
  
  moodIds.forEach((moodId) => {
    const keywords = MOOD_TO_TMDB_KEYWORDS[moodId] || []
    keywords.forEach((keywordId) => keywordIds.add(keywordId))
  })
  
  return Array.from(keywordIds)
}

/**
 * 무드 ID 배열에서 가장 적합한 정렬 기준 반환
 */
export function getSortByForMoods(moodIds: string[]): string {
  // 첫 번째 무드의 정렬 기준 사용
  if (moodIds.length > 0) {
    return MOOD_TO_SORT_BY[moodIds[0]] || 'vote_average.desc'
  }
  return 'vote_average.desc'
}

/**
 * 무드를 TMDB 검색 파라미터로 변환
 */
export interface TMDBMoodParams {
  genres?: number[]
  keywords?: number[]
  sortBy?: string
}

export function moodsToTMDBParams(moodIds: string[]): TMDBMoodParams {
  const genres = moodsToTMDBGenres(moodIds)
  const keywords = moodsToTMDBKeywords(moodIds)
  const sortBy = getSortByForMoods(moodIds)
  
  return {
    genres: genres.length > 0 ? genres : undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    sortBy,
  }
}

