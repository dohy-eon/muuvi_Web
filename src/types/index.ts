// 온보딩 관련 타입
export interface OnboardingData {
  genre: string // '영화', '드라마', '애니메이션', '예능'
  moods: string[] // 선택한 무드 ID 배열 (최대 2개)
}

// 콘텐츠 타입
export interface Content {
  id: string
  title: string
  description?: string
  poster_url?: string
  imdb_id?: string
  imdb_rating?: number
  year?: number
  genres?: string[]
  tags?: string[]
  url?: string
  created_at?: string
}

// 프로필 타입
export interface Profile {
  id: string
  user_id: string
  genre: string
  moods: string[]
  created_at: string
  updated_at: string
}

