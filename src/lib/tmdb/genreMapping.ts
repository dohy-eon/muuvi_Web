/**
 * TMDB 장르 ID 매핑 (로컬 캐싱)
 * https://developers.themoviedb.org/3/genres/get-movie-list
 */
export const TMDB_GENRE_MAPPING: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
}

/**
 * 한국어 장르명을 TMDB 장르 ID로 매핑
 */
export const GENRE_TO_TMDB_ID: Record<string, number> = {
  영화: 0, // 영화는 별도 처리
  드라마: 18, // Drama
  애니메이션: 16, // Animation
  예능: 10770, // TV Movie
}

/**
 * 무드 ID를 TMDB 장르 ID로 매핑
 */
export const MOOD_TO_TMDB_GENRE: Record<string, number[]> = {
  '01': [10749], // Romance - Romance
  '02': [27, 53], // Horror - Horror, Thriller
  '03': [35], // Comedy - Comedy
  '04': [878], // SF - Science Fiction
  '05': [14], // Fantasy - Fantasy
  '06': [12], // Adventure - Adventure
  '07': [28], // Action - Action
  '08': [18, 10751], // Healing - Drama, Family
  '09': [9648, 53], // Mystery - Mystery, Thriller
}

/**
 * 무드 ID를 TMDB 키워드로 매핑 (감정/분위기 기반)
 */
export const MOOD_TO_TMDB_KEYWORDS: Record<string, number[]> = {
  '01': [1744, 972], // Romance - romantic, love
  '02': [2099, 969, 9712, 18038, 974], // Horror - horror, scary, ghost, supernatural, mystery
  '03': [971], // Comedy - comedy, funny
  '04': [2091, 2092], // SF - science fiction, futuristic
  '05': [9725, 2093], // Fantasy - fantasy, magical
  '06': [9715, 9716], // Adventure - adventure, journey
  '07': [9717, 9718], // Action - action, explosive
  '08': [9719, 9720], // Healing - emotional, heartwarming
  '09': [9721, 9722], // Mystery - mystery, suspense
}

/**
 * 무드 ID를 정렬 기준으로 매핑
 */
export const MOOD_TO_SORT_BY: Record<string, string> = {
  '01': 'popularity.desc', // Romance - (수정) 인기순으로 변경
  '02': 'popularity.desc', // Horror - 인기
  '03': 'popularity.desc', // Comedy - 인기
  '04': 'vote_average.desc', // SF - 높은 평점
  '05': 'vote_average.desc', // Fantasy - 높은 평점
  '06': 'popularity.desc', // Adventure - 인기
  '07': 'popularity.desc', // Action - 인기
  '08': 'vote_average.desc', // Healing - 높은 평점 (감성적)
  '09': 'vote_average.desc', // Mystery - 높은 평점
}

