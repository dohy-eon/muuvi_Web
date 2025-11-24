/**
 * TMDB 데이터를 앱 내부 Content 타입으로 변환하는 어댑터
 * 
 * 이 파일은 TMDB API 응답을 앱에서 사용하는 Content 타입으로 변환하는 로직을 담당합니다.
 * 변환 로직이 한 곳에 모여있어 유지보수가 용이하고, 다른 API가 추가되어도
 * Content 타입만 맞추면 되므로 확장성이 좋습니다.
 */

import type { TMDBMovie, TMDBGenre, TMDBKeyword } from '../../types/tmdb'
import type { Content, OTTProvider } from '../../types'
import { GENRE_TO_TMDB_ID, MOOD_TO_TMDB_GENRE } from '../tmdb/genreMapping'
import { moodsToImdbTags } from '../moodMapping'

/**
 * TMDB 상세 정보 (한국어/영어)
 */
export interface TMDBDetails {
  ko: {
    imdbId: string | null
    genres?: TMDBGenre[]
    keywords?: TMDBKeyword[]
    title?: string
    description?: string
  }
  en?: {
    title?: string
    description?: string
    keywords?: TMDBKeyword[]
  } | null
}

/**
 * TMDB 데이터를 Content 타입으로 변환하는 옵션
 */
export interface TMDBToContentOptions {
  selectedGenre: string
  genreMapKo: Record<number, string>
  genreMapEn: Record<number, string>
  moodIds?: string[]
  forceMoodTags?: boolean
}

/**
 * TMDB 영화/TV 데이터를 앱의 Content 타입으로 변환
 * 
 * @param movie TMDB 영화/TV 기본 정보
 * @param details 한국어/영어 상세 정보
 * @param ottProviders OTT 제공자 목록
 * @param options 변환 옵션
 * @returns Content 타입 객체 (Supabase 저장용)
 */
export function tmdbToContent(
  movie: TMDBMovie,
  details: TMDBDetails,
  ottProviders: OTTProvider[],
  options: TMDBToContentOptions
): Omit<Content, 'id' | 'created_at'> | null {
  const { selectedGenre, genreMapKo, genreMapEn, moodIds = [], forceMoodTags = false } = options

  // 제목 검증
  const contentTitle = details.ko.title || movie.title || movie.name || ''
  if (!contentTitle) {
    return null
  }

  // 영어 제목 Fallback 우선순위:
  // 1. 영어 상세 제목 -> 2. 원제(Original Title) -> 3. 한국어 제목(최후의 수단)
  const contentTitleEn = details.en?.title || movie.original_title || movie.original_name || contentTitle

  // 줄거리
  const contentDescription = details.ko.description || movie.overview || undefined
  const contentDescriptionEn = details.en?.description || undefined

  // 연도 추출
  const dateString = movie.release_date || movie.first_air_date || ''
  const year = dateString ? parseInt(dateString.split('-')[0]) : undefined

  // 포스터 URL
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : undefined

  // IMDB ID
  const imdbId = details.ko.imdbId || undefined

  // IMDB 평점 (TMDB 평점을 2로 나눔)
  const imdbRating = movie.vote_average ? movie.vote_average / 2 : undefined

  // 태그 생성
  const { tagsKo, tagsEn } = generateTags(movie, details, genreMapKo, genreMapEn, moodIds, forceMoodTags)

  // 장르 결정
  const { genre, genreEn } = determineGenre(movie, selectedGenre, tagsKo)

  // IMDB URL
  const url = imdbId ? `https://www.imdb.com/title/${imdbId}` : undefined

  return {
    title: contentTitle,
    title_en: contentTitleEn,
    description: contentDescription,
    description_en: contentDescriptionEn,
    poster_url: posterUrl,
    imdb_id: imdbId,
    imdb_rating: imdbRating,
    year: year,
    genre: genre,
    genre_en: genreEn,
    genres: movie.genre_ids.map(id => genreMapKo[id] || genreMapEn[id] || '').filter(Boolean),
    tags: tagsKo,
    tags_en: tagsEn,
    url: url,
    ott_providers: ottProviders.length > 0 ? ottProviders : undefined,
  }
}

/**
 * 태그 생성 로직 (한국어/영어 분리)
 */
function generateTags(
  movie: TMDBMovie,
  details: TMDBDetails,
  genreMapKo: Record<number, string>,
  genreMapEn: Record<number, string>,
  moodIds: string[],
  forceMoodTags: boolean
): { tagsKo: string[]; tagsEn: string[] } {
  // 장르 ID 수집
  const genreIdSet = new Set<number>(movie.genre_ids || [])
  if (details.ko.genres) {
    details.ko.genres.forEach((genre) => {
      if (typeof genre?.id === 'number') {
        genreIdSet.add(genre.id)
      }
    })
  }

  const genreIds = Array.from(genreIdSet)

  // 1. 장르 태그 (기본) - 한국어와 영어 분리
  let tagsKo: string[] = genreIds.map((id) => genreMapKo[id] || '').filter(Boolean)
  let tagsEn: string[] = genreIds.map((id) => genreMapEn[id] || '').filter(Boolean)

  // 복합 태그 분리 (예: "Action & Adventure" → ["Action", "Adventure"])
  tagsKo = tagsKo.flatMap((tag) =>
    tag.includes('&') ? tag.split('&').map((t) => t.trim()).filter(Boolean) : tag
  )
  tagsEn = tagsEn.flatMap((tag) =>
    tag.includes('&') ? tag.split('&').map((t) => t.trim()).filter(Boolean) : tag
  )

  // 영문 태그를 한글로 번역 (한국어 태그에 추가)
  const tagTranslation = getTagTranslation()

  tagsEn.forEach((tag) => {
    const translated = tagTranslation[tag]
    if (translated && !tagsKo.includes(translated)) {
      tagsKo.push(translated)
    }
  })

  // 2. 키워드 태그 - TMDB 키워드 기반 태그 보강
  // (1) 한국어 키워드 처리
  if (details.ko.keywords && details.ko.keywords.length > 0) {
    const keywordTags = extractKeywordTags(details.ko.keywords, 'ko')
    if (keywordTags.length > 0) {
      tagsKo = [...tagsKo, ...keywordTags]
    }
  }

  // (2) 영어 키워드 처리
  if (details.en?.keywords && details.en.keywords.length > 0) {
    details.en.keywords.forEach((keyword) => {
      if (keyword?.name) {
        tagsEn.push(keyword.name) // 영어 원문 그대로 추가
      }
    })
  }

  // 3. 무드 태그
  const moodTagOrder: string[] = []

  if (Array.isArray(moodIds) && moodIds.length > 0) {
    const moodTagsToAddKo = new Set<string>()
    const moodTagsToAddEn = new Set<string>()

    moodIds.forEach((moodId) => {
      const relatedGenres = MOOD_TO_TMDB_GENRE[moodId] || []
      const hasMatchingGenre =
        relatedGenres.length === 0 ||
        relatedGenres.some((genreId) => movie.genre_ids?.includes(genreId))

      if (forceMoodTags || hasMatchingGenre) {
        const moodDerivedTags = moodsToImdbTags([moodId])

        // 영어 태그 추가
        moodDerivedTags.forEach((tag) => {
          moodTagsToAddEn.add(tag)
          if (!moodTagOrder.includes(tag)) {
            moodTagOrder.push(tag)
          }
        })

        // 한국어 태그 번역 추가
        const translatedMoodTags = moodDerivedTags.map((tag) => tagTranslation[tag] || tag)
        translatedMoodTags.forEach((tag) => {
          moodTagsToAddKo.add(tag)
        })
      }
    })

    if (moodTagsToAddEn.size > 0) {
      tagsEn = [...tagsEn, ...moodTagsToAddEn]
    }
    if (moodTagsToAddKo.size > 0) {
      tagsKo = [...tagsKo, ...moodTagsToAddKo]
    }
  }

  // 4. 중복 제거 및 정제
  tagsKo = [...new Set(tagsKo)]
  tagsEn = [...new Set(tagsEn)]

  // 무드 태그 순서 적용 (한국어 태그에만)
  if (moodTagOrder.length > 0) {
    const moodTagsKo = moodTagOrder
      .map((tag) => tagTranslation[tag] || tag)
      .filter((tag) => tagsKo.includes(tag))
    const otherTagsKo = tagsKo.filter((tag) => !moodTagsKo.includes(tag))
    tagsKo = [...moodTagsKo, ...otherTagsKo]
  }

  // 5. 태그에서 장르 키워드 제거
  const genreKeywords: Record<string, string[]> = {
    애니메이션: ['애니메이션'],
    드라마: ['드라마'],
    예능: ['리얼리티', '토크쇼'],
  }

  for (const [, keywords] of Object.entries(genreKeywords)) {
    tagsKo = tagsKo.filter((tag) => !keywords.includes(tag))
  }

  // 6. 태그가 비었을 경우 기본 태그 추가
  if (tagsKo.length === 0 && tagsEn.length === 0) {
    const baseGenre = determineGenre(movie, '', []).genre
    const defaultTags = getDefaultTags(baseGenre, movie.vote_average)
    tagsKo = defaultTags.ko
    tagsEn = defaultTags.en
  }

  return { tagsKo, tagsEn }
}

/**
 * 태그 번역 맵
 */
function getTagTranslation(): Record<string, string> {
  return {
    // 장르
    Action: '액션',
    Adventure: '모험',
    Animation: '애니메이션',
    Comedy: '코미디',
    Crime: '범죄',
    Documentary: '다큐멘터리',
    Drama: '드라마',
    Family: '가족',
    Fantasy: '판타지',
    History: '역사',
    Horror: '공포',
    Music: '음악',
    Mystery: '미스터리',
    Romance: '로맨스',
    'Science Fiction': 'SF',
    'Sci-Fi': 'SF',
    Thriller: '스릴러',
    War: '전쟁',
    Western: '서부',
    Reality: '리얼리티',
    'Talk Show': '토크쇼',
    News: '뉴스',
    'War & Politics': '전쟁·정치',
    'Action & Adventure': '액션',
    'Sci-Fi & Fantasy': 'SF',
    Soap: '연속극',
    Kids: '키즈',
    // TV 타입
    'TV Movie': 'TV영화',
  }
}

/**
 * 키워드에서 태그 추출
 */
function extractKeywordTags(keywords: TMDBKeyword[], language: 'ko' | 'en'): string[] {
  if (language === 'ko') {
    const keywordTranslation: Record<string, string> = {
      'historical drama': '사극',
      'historical fiction': '사극',
      history: '역사',
      'alternate history': '퓨전 사극',
      'alternate past': '퓨전 사극',
      sageuk: '사극',
      'fusion sageuk': '퓨전 사극',
      'period drama': '사극',
      'ancient korea': '사극',
      'martial arts': '무협',
      warrior: '무협',
      'sword fight': '검술',
      sword: '검술',
      politics: '정치',
      'political intrigue': '정치',
      'power struggle': '정치',
      romance: '로맨스',
      love: '로맨스',
      assassin: '암살',
      rebellion: '혁명',
      royalty: '왕실',
      kingdom: '왕권',
      court: '궁중',
      conspiracy: '음모',
    }

    const keywordTags = new Set<string>()

    keywords.forEach((keyword) => {
      if (!keyword?.name) return

      const normalized = keyword.name.trim().toLowerCase()
      if (!normalized) return

      const translated =
        keywordTranslation[normalized] ||
        (normalized.includes('romance') ? '로맨스' : null) ||
        (normalized.includes('histor') ? '사극' : null) ||
        (normalized.includes('martial') ? '무협' : null) ||
        (normalized.includes('sword') ? '검술' : null) ||
        (normalized.includes('politic') ? '정치' : null) ||
        (normalized.includes('love') ? '로맨스' : null)

      if (translated) {
        keywordTags.add(translated)
      }
    })

    return Array.from(keywordTags)
  }

  return []
}

/**
 * 장르 결정 로직
 */
function determineGenre(
  movie: TMDBMovie,
  selectedGenre: string,
  tagsKo: string[]
): { genre: string; genreEn: string } {
  const genreMapForSave: Record<string, number> = GENRE_TO_TMDB_ID
  let contentGenre = '영화' // 기본값

  // 장르 키워드 매핑 (태그에서 장르 추론용)
  const genreKeywords: Record<string, string[]> = {
    애니메이션: ['애니메이션'],
    드라마: ['드라마'],
    예능: ['리얼리티', '토크쇼'],
  }

  // 태그에서 장르 감지
  let detectedGenre: string | null = null
  for (const [genre, keywords] of Object.entries(genreKeywords)) {
    if (keywords.some((keyword) => tagsKo.includes(keyword))) {
      detectedGenre = genre
      break
    }
  }

  // 장르 결정 (우선순위: selectedGenre > 태그에서 감지 > genre_ids로 판단)
  if (selectedGenre) {
    if (selectedGenre === '영화') {
      contentGenre = '영화'
    } else if (selectedGenre === '예능') {
      contentGenre = '예능'
    } else if (selectedGenre === '애니메이션') {
      contentGenre = '애니메이션'
    } else if (selectedGenre === '드라마') {
      contentGenre = '드라마'
    } else if (genreMapForSave[selectedGenre] && movie.genre_ids.includes(genreMapForSave[selectedGenre])) {
      contentGenre = selectedGenre
    } else if (detectedGenre) {
      contentGenre = detectedGenre
    } else {
      // 선택한 장르가 콘텐츠에 없으면, genre_ids로 판단
      if (movie.genre_ids.includes(18)) contentGenre = '드라마'
      else if (movie.genre_ids.includes(16)) contentGenre = '애니메이션'
      else if (movie.genre_ids.includes(10770)) contentGenre = '예능'
    }
  } else {
    // selectedGenre가 없으면 태그 또는 genre_ids로 판단
    if (detectedGenre) {
      contentGenre = detectedGenre
    } else if (movie.genre_ids.includes(18)) {
      contentGenre = '드라마'
    } else if (movie.genre_ids.includes(16)) {
      contentGenre = '애니메이션'
    } else if (movie.genre_ids.includes(10770)) {
      contentGenre = '예능'
    }
  }

  // 장르 영어 번역
  const genreTranslation: Record<string, string> = {
    영화: 'Movie',
    드라마: 'Drama',
    애니메이션: 'Animation',
    예능: 'Variety Show',
  }
  const contentGenreEn = genreTranslation[contentGenre] || contentGenre

  return { genre: contentGenre, genreEn: contentGenreEn }
}

/**
 * 기본 태그 가져오기
 */
function getDefaultTags(genre: string, voteAverage: number): { ko: string[]; en: string[] } {
  if (genre === '예능') {
    return { ko: ['코미디', '리얼리티'], en: ['Comedy', 'Reality'] }
  } else if (genre === '애니메이션') {
    return { ko: ['애니메이션'], en: ['Animation'] }
  } else if (genre === '드라마') {
    return { ko: ['드라마'], en: ['Drama'] }
  } else {
    // 영화는 평점 기반 태그 추가
    if (voteAverage >= 7) {
      return { ko: ['명작'], en: ['Classic'] }
    } else {
      return { ko: ['영화'], en: ['Movie'] }
    }
  }
}
