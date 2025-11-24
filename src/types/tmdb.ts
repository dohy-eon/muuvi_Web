/**
 * TMDB API 관련 타입 정의
 * 모든 TMDB API 응답 타입을 중앙에서 관리합니다.
 */

// 기본 TMDB 영화/TV 타입
export interface TMDBMovie {
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

// TMDB 장르 타입
export interface TMDBGenre {
  id: number
  name: string
}

// TMDB 키워드 타입
export interface TMDBKeyword {
  id: number
  name: string
}

// TMDB Watch Provider 타입
export interface TMDBWatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

// TMDB Watch Providers 응답 타입
export interface TMDBWatchProvidersResponse {
  results: {
    KR?: {
      flatrate?: TMDBWatchProvider[] // 구독 서비스
      buy?: TMDBWatchProvider[] // 구매
      rent?: TMDBWatchProvider[] // 대여
      free?: TMDBWatchProvider[] // 무료
    }
    US?: {
      flatrate?: TMDBWatchProvider[]
      buy?: TMDBWatchProvider[]
      rent?: TMDBWatchProvider[]
      free?: TMDBWatchProvider[]
    }
    JP?: {
      flatrate?: TMDBWatchProvider[]
      buy?: TMDBWatchProvider[]
      rent?: TMDBWatchProvider[]
      free?: TMDBWatchProvider[]
    }
  }
}

// TMDB Search Item 타입 (검색 결과)
export interface TMDBSearchItem {
  id: number
  media_type?: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  profile_path?: string | null
}

// 정규화된 검색 결과 타입
export interface NormalizedSearchResult {
  id: string
  title: string
  year?: string
  posterUrl?: string
  mediaType: 'movie' | 'tv'
}

// TMDB 상세 정보 타입 (Movie)
export interface TMDBMovieDetail {
  id: number
  title: string
  release_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  runtime?: number
  genres?: TMDBGenre[]
  mediaType: 'movie'
  // append_to_response로 받은 데이터
  credits?: TMDBCredits
  release_dates?: TMDBReleaseDates
  content_ratings?: never // Movie는 content_ratings 없음
  created_by?: never // Movie는 created_by 없음
}

// TMDB 상세 정보 타입 (TV)
export interface TMDBTVDetail {
  id: number
  name: string
  first_air_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  episode_run_time?: number[]
  genres?: TMDBGenre[]
  mediaType: 'tv'
  // append_to_response로 받은 데이터
  credits?: TMDBCredits
  release_dates?: never // TV는 release_dates 없음
  content_ratings?: TMDBContentRatings
  created_by?: Array<{ id: number; name: string }>
}

// TMDB 상세 정보 유니온 타입
export type TMDBDetail = TMDBMovieDetail | TMDBTVDetail

// TMDB Credits 타입
export interface TMDBCredits {
  cast?: Array<{
    id: number
    name: string
    character?: string
    profile_path?: string | null
    roles?: Array<{ character: string }>
  }>
  crew?: Array<{
    id: number
    name: string
    job?: string
    department?: string
  }>
}

// TMDB Release Dates 타입 (Movie용)
export interface TMDBReleaseDates {
  results?: Array<{
    iso_3166_1: string
    release_dates?: Array<{
      certification?: string
      release_date?: string
    }>
  }>
}

// TMDB Content Ratings 타입 (TV용)
export interface TMDBContentRatings {
  results?: Array<{
    iso_3166_1: string
    rating?: string
  }>
}

// TMDB 상세 정보 가져오기 응답 타입 (내부용)
export interface TMDBContentDetails {
  imdbId: string | null
  credits?: TMDBCredits
  videos?: any // TODO: 추후 타입 정의 필요
  genres?: TMDBGenre[]
  keywords?: TMDBKeyword[]
  title?: string
  titleEn?: string | null
  description?: string
  descriptionEn?: string | null
}
