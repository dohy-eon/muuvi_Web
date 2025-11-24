import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { languageState } from '../../recoil/userState'
import { getContentById } from '../../lib/supabase/recommendations'
import type { Content, OTTProvider } from '../../types'
import BottomNavigation from '../../components/BottomNavigation'
import SimpleLoading from '../../components/SimpleLoading'
import { toBlob } from 'html-to-image' // [변경] html-to-image에서 toBlob 가져오기
import { saveAs } from 'file-saver'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// [추가] UI 텍스트 번역
const CONTENT_TEXT = {
  ko: {
    originalTitle: '원제',
    genre: '장르',
    releaseDate: '개봉일',
    rating: '연령등급',
    runtime: '러닝타임',
    watch: '보러가기',
    castCrew: '출연진/제작진',
    castMore: '출연진/제작진 더보기',
    media: '영상 및 포스터 콜라주',
    director: '감독',
    writer: '극본',
    year: '년',
    noContent: '콘텐츠를 찾을 수 없습니다.',
    error: '콘텐츠를 불러오는 중 오류가 발생했습니다.',
    noOtt: '시청 가능한 플랫폼이 없습니다.',
    noOttType: '해당 타입으로 시청 가능한 플랫폼이 없습니다.',
    noCast: '출연진 정보가 없습니다.',
    noCrew: '제작진 정보가 없습니다.',
    noMedia: '영상 및 포스터 정보가 없습니다.',
    actor: '출연',
    flatrate: '정액제',
    free: '무료',
    rent: '대여',
    buy: '구매',
    back: '뒤로가기',
    share: '공유하기',
  },
  en: {
    originalTitle: 'Original Title',
    genre: 'Genre',
    releaseDate: 'Release Date',
    rating: 'Rating',
    runtime: 'Runtime',
    watch: 'Where to Watch',
    castCrew: 'Cast & Crew',
    castMore: 'See More Cast & Crew',
    media: 'Media & Posters',
    director: 'Director',
    writer: 'Writer',
    year: '',
    noContent: 'Content not found.',
    error: 'An error occurred while loading content.',
    noOtt: 'No streaming platforms available.',
    noOttType: 'No platforms available for this type.',
    noCast: 'No cast information available.',
    noCrew: 'No crew information available.',
    noMedia: 'No media or posters available.',
    actor: 'Actor',
    flatrate: 'Stream',
    free: 'Free',
    rent: 'Rent',
    buy: 'Buy',
    back: 'Back',
    share: 'Share',
  },
}

// [추가] 공유 아이콘 컴포넌트 (SVG)
const ShareIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
)

interface TMDBWatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

interface TMDBWatchProvidersResponse {
  results: {
    KR?: {
      flatrate?: TMDBWatchProvider[]
      buy?: TMDBWatchProvider[]
      rent?: TMDBWatchProvider[]
      free?: TMDBWatchProvider[]
    }
  }
}

// TMDB ID 가져오기 (IMDB ID로)
async function getTMDBId(
  imdbId: string | undefined,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<number | null> {
  if (!imdbId || !TMDB_API_KEY) return null

  try {
    const findResponse = await fetch(
      `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`
    )
    
    if (!findResponse.ok) return null
    
    const findData = await findResponse.json()
    const tmdbId = contentType === 'tv' 
      ? findData.tv_results?.[0]?.id 
      : findData.movie_results?.[0]?.id
    
    return tmdbId || null
  } catch (error) {
    console.error('TMDB ID 가져오기 실패:', error)
    return null
  }
}

// [추가] 제목과 연도로 TMDB ID 찾기 (imdb_id가 없을 때 사용)
async function getTMDBIdByTitle(
  title: string,
  year: number | undefined,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<number | null> {
  if (!title || !TMDB_API_KEY) return null

  try {
    const endpoint = contentType === 'tv' ? 'tv' : 'movie'
    const searchUrl = new URL(`${TMDB_BASE_URL}/search/${endpoint}`)
    searchUrl.searchParams.set('api_key', TMDB_API_KEY)
    searchUrl.searchParams.set('query', title)
    searchUrl.searchParams.set('language', 'ko-KR')
    if (year) {
      searchUrl.searchParams.set('year', year.toString())
    }

    const response = await fetch(searchUrl.toString())
    if (!response.ok) return null

    const data = await response.json()
    const results = data.results || []
    
    if (results.length > 0) {
      // 첫 번째 결과 반환 (가장 관련성 높은 결과)
      return results[0].id || null
    }
    
    return null
  } catch (error) {
    console.error('제목으로 TMDB ID 가져오기 실패:', error)
    return null
  }
}

// TMDB API로 타입별 OTT 제공자 정보 가져오기
async function getTypedOttProviders(
  imdbId: string | undefined,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<OTTProvider[]> {
  if (!imdbId || !TMDB_API_KEY) return []

  try {
    const tmdbId = await getTMDBId(imdbId, contentType)
    if (!tmdbId) return []

    // OTT 제공자 정보 가져오기
    const endpoint = contentType === 'tv'
      ? `${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers`
      : `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers`
    
    const response = await fetch(`${endpoint}?api_key=${TMDB_API_KEY}`)
    
    if (!response.ok) return []
    
    const data: TMDBWatchProvidersResponse = await response.json()
    const krProviders = data.results?.KR
    
    if (!krProviders) return []
    
    const allProviders: OTTProvider[] = []
    
    // 정액제 (flatrate)
    if (krProviders.flatrate) {
      krProviders.flatrate.forEach((provider) => {
        allProviders.push({
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          logo_path: provider.logo_path
            ? `https://image.tmdb.org/t/p/w300${provider.logo_path}`
            : undefined,
          type: 'flatrate',
        })
      })
    }
    
    // 무료 (free)
    if (krProviders.free) {
      krProviders.free.forEach((provider) => {
        allProviders.push({
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          logo_path: provider.logo_path
            ? `https://image.tmdb.org/t/p/w300${provider.logo_path}`
            : undefined,
          type: 'free',
        })
      })
    }
    
    // 대여 (rent)
    if (krProviders.rent) {
      krProviders.rent.forEach((provider) => {
        allProviders.push({
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          logo_path: provider.logo_path
            ? `https://image.tmdb.org/t/p/w300${provider.logo_path}`
            : undefined,
          type: 'rent',
        })
      })
    }
    
    // 구매 (buy)
    if (krProviders.buy) {
      krProviders.buy.forEach((provider) => {
        allProviders.push({
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          logo_path: provider.logo_path
            ? `https://image.tmdb.org/t/p/w300${provider.logo_path}`
            : undefined,
          type: 'buy',
        })
      })
    }
    
    return allProviders
  } catch (error) {
    console.error('OTT 정보 가져오기 실패:', error)
    return []
  }
}

// TMDB API로 영상 및 이미지 정보 가져오기
async function getVideosAndImages(
  imdbId: string | undefined,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<Array<{ type: 'video' | 'image'; url: string; thumbnail: string }>> {
  if (!imdbId || !TMDB_API_KEY) {
    return []
  }

  try {
    const tmdbId = await getTMDBId(imdbId, contentType)
    if (!tmdbId) {
      return []
    }

    const endpoint = contentType === 'tv' ? 'tv' : 'movie'
    
    // videos와 images를 병렬로 가져오기
    const [videosResponse, imagesResponse] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=ko-KR`),
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}/images?api_key=${TMDB_API_KEY}`)
    ])

    const mediaItems: Array<{ type: 'video' | 'image'; url: string; thumbnail: string }> = []

    // 비디오 처리 (Trailer, Teaser 등)
    if (videosResponse.ok) {
      const videosData = await videosResponse.json()
      const videos = (videosData.results || []).filter(
        (video: any) => 
          video.type === 'Trailer' || 
          video.type === 'Teaser' || 
          video.type === 'Clip'
      ).slice(0, 3) // 최대 3개

      videos.forEach((video: any) => {
        if (video.key) {
          mediaItems.push({
            type: 'video',
            url: `https://www.youtube.com/watch?v=${video.key}`,
            thumbnail: video.key 
              ? `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`
              : ''
          })
        }
      })
    }

    // 이미지 처리 (backdrops와 posters)
    if (imagesResponse.ok) {
      const imagesData = await imagesResponse.json()
      
      // Backdrops (배경 이미지) - 최대 4개
      const backdrops = (imagesData.backdrops || []).slice(0, 4)
      backdrops.forEach((backdrop: any) => {
        if (backdrop.file_path) {
          mediaItems.push({
            type: 'image',
            url: `https://image.tmdb.org/t/p/original${backdrop.file_path}`,
            thumbnail: `https://image.tmdb.org/t/p/w500${backdrop.file_path}`
          })
        }
      })

      // Posters (포스터) - 최대 2개
      const posters = (imagesData.posters || []).slice(0, 2)
      posters.forEach((poster: any) => {
        if (poster.file_path) {
          mediaItems.push({
            type: 'image',
            url: `https://image.tmdb.org/t/p/original${poster.file_path}`,
            thumbnail: `https://image.tmdb.org/t/p/w500${poster.file_path}`
          })
        }
      })
    }

    // 총 9개까지 제한 (콜라주 레이아웃에 맞춤)
    return mediaItems.slice(0, 9)
  } catch (error) {
    console.error('영상/이미지 정보 가져오기 실패:', error)
    return []
  }
}

// TMDB API로 출연진/제작진 정보 가져오기
async function getCastAndCrew(
  imdbId: string | undefined,
  contentType: 'movie' | 'tv' = 'movie',
  title?: string,
  year?: number
): Promise<{
  cast: Array<{ id: number; name: string; character: string; profile_path: string | null }>
  director: string | null
  writer: string | null
}> {
  if (!TMDB_API_KEY) {
    return { cast: [], director: null, writer: null }
  }

  try {
    // [수정] imdb_id가 있으면 사용, 없으면 제목과 연도로 검색
    let tmdbId: number | null = null
    
    if (imdbId) {
      tmdbId = await getTMDBId(imdbId, contentType)
    }
    
    // imdb_id로 찾지 못했거나 imdb_id가 없으면 제목으로 검색
    if (!tmdbId && title) {
      tmdbId = await getTMDBIdByTitle(title, year, contentType)
      if (tmdbId) {
      }
    }
    
    if (!tmdbId) {
      return { cast: [], director: null, writer: null }
    }

    const endpoint = contentType === 'tv' ? 'tv' : 'movie'
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=ko-KR`
    )

    if (!response.ok) {
      return { cast: [], director: null, writer: null }
    }

    const data = await response.json()
    
    // 출연진 (최대 6명)
    const castList = (data.cast || [])
      .slice(0, 6)
      .map((actor: any) => {
        // character가 "Self"이거나 비어있으면 빈 문자열로 처리 (UI에서 기본 텍스트 표시)
        const character = actor.character || actor.roles?.[0]?.character || ''
        const normalizedCharacter = (character.trim().toLowerCase() === 'self' || !character.trim()) 
          ? '' 
          : character
        
        return {
          id: actor.id,
          name: actor.name || '',
          character: normalizedCharacter,
          profile_path: actor.profile_path
            ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
            : null,
        }
      })

    // 감독 찾기
    let directorName: string | null = null
    const director = (data.crew || []).find(
      (person: any) => person.job === 'Director' || person.job === 'Executive Producer'
    )
    if (director) {
      directorName = director.name
    }

    // 극본가 찾기 (Writer, Screenplay, Story 등)
    let writerName: string | null = null
    const writer = (data.crew || []).find(
      (person: any) =>
        person.job === 'Writer' ||
        person.job === 'Screenplay' ||
        person.job === 'Story' ||
        person.job === 'Novel'
    )
    if (writer) {
      writerName = writer.name
    } else {
      // 여러 명의 작가가 있을 수 있으므로 첫 번째 작가 찾기
      const writers = (data.crew || []).filter(
        (person: any) =>
          person.job === 'Writer' ||
          person.job === 'Screenplay' ||
          person.job === 'Story'
      )
      if (writers.length > 0) {
        writerName = writers[0].name
        if (writers.length > 1) {
          writerName += ` 외 ${writers.length - 1}명`
        }
      }
    }

    return {
      cast: castList,
      director: directorName,
      writer: writerName,
    }
  } catch (error) {
    console.error('출연진/제작진 정보 가져오기 실패:', error)
    return { cast: [], director: null, writer: null }
  }
}

// TMDB API로 연령 등급과 러닝타임 가져오기
async function getContentRatingAndRuntime(
  imdbId: string | undefined,
  contentType: 'movie' | 'tv' = 'movie'
): Promise<{ rating: string | null; runtime: string | null }> {
  if (!imdbId || !TMDB_API_KEY) {
    return { rating: null, runtime: null }
  }

  try {
    const tmdbId = await getTMDBId(imdbId, contentType)
    if (!tmdbId) {
      return { rating: null, runtime: null }
    }

    if (contentType === 'movie') {
      // 영화: 상세 정보와 release_dates 가져오기
      const [detailResponse, releaseDatesResponse] = await Promise.all([
        fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=ko-KR`),
        fetch(`${TMDB_BASE_URL}/movie/${tmdbId}/release_dates?api_key=${TMDB_API_KEY}`)
      ])

      if (!detailResponse.ok || !releaseDatesResponse.ok) {
        return { rating: null, runtime: null }
      }

      const detailData = await detailResponse.json()
      const releaseDatesData = await releaseDatesResponse.json()

      // 한국의 연령 등급 찾기
      let rating: string | null = null
      const krReleaseDates = releaseDatesData.results?.find(
        (result: any) => result.iso_3166_1 === 'KR'
      )
      if (krReleaseDates?.release_dates?.[0]?.certification) {
        rating = krReleaseDates.release_dates[0].certification
      }

      // 러닝타임 (분 단위)
      let runtime: string | null = null
      if (detailData.runtime) {
        const hours = Math.floor(detailData.runtime / 60)
        const minutes = detailData.runtime % 60
        if (hours > 0) {
          runtime = `${hours}시간 ${minutes}분`
        } else {
          runtime = `${minutes}분`
        }
      }

      return { rating, runtime }
    } else {
      // TV: 상세 정보와 content_ratings 가져오기
      const [detailResponse, contentRatingsResponse] = await Promise.all([
        fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=ko-KR`),
        fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/content_ratings?api_key=${TMDB_API_KEY}`)
      ])

      if (!detailResponse.ok || !contentRatingsResponse.ok) {
        return { rating: null, runtime: null }
      }

      const detailData = await detailResponse.json()
      const contentRatingsData = await contentRatingsResponse.json()

      // 한국의 연령 등급 찾기
      let rating: string | null = null
      const krRating = contentRatingsData.results?.find(
        (result: any) => result.iso_3166_1 === 'KR'
      )
      if (krRating?.rating) {
        rating = krRating.rating
      }

      // 러닝타임 (episode_run_time의 첫 번째 값 사용)
      let runtime: string | null = null
      if (detailData.episode_run_time && detailData.episode_run_time.length > 0) {
        const runtimeMinutes = detailData.episode_run_time[0]
        const hours = Math.floor(runtimeMinutes / 60)
        const minutes = runtimeMinutes % 60
        if (hours > 0) {
          runtime = `${hours}시간 ${minutes}분`
        } else {
          runtime = `${minutes}분`
        }
      }

      return { rating, runtime }
    }
  } catch (error) {
    console.error('연령 등급 및 러닝타임 가져오기 실패:', error)
    return { rating: null, runtime: null }
  }
}

// 장르/태그 색상 매핑 (RecommendationCard와 동일, 영어 키 추가)
const genreTagColors: Record<string, string> = {
  // [한국어 매핑]
  '로맨스': 'bg-[#ffbdbd]',
  '공포': 'bg-[#2c2c2c]',
  '코미디': 'bg-[#ffd93d]',
  'SF': 'bg-[#003f5c]',
  '판타지': 'bg-[#9b59b6]',
  '모험': 'bg-[#ff8c42]',
  '액션': 'bg-[#e74c3c]',
  '드라마': 'bg-[#8fd19e]',
  '가족': 'bg-[#8fd19e]',
  '미스터리': 'bg-[#7f8c8d]',
  '스릴러': 'bg-[#7f8c8d]',
  '애니메이션': 'bg-[#9b59b6]',
  '범죄': 'bg-[#2c2c2c]',
  '다큐멘터리': 'bg-[#7f8c8d]',
  '역사': 'bg-[#8d6e63]',
  '음악': 'bg-[#ff6b9d]',
  '전쟁': 'bg-[#5d4037]',
  '서부': 'bg-[#d4a574]',
  '리얼리티': 'bg-[#ffd93d]',
  '토크쇼': 'bg-[#8fd19e]',
  'TV영화': 'bg-[#9b59b6]',
  
  // [추가] 영어 매핑
  'Romance': 'bg-[#ffbdbd]',
  'Horror': 'bg-[#2c2c2c]',
  'Comedy': 'bg-[#ffd93d]',
  'Sci-Fi': 'bg-[#003f5c]',
  'Science Fiction': 'bg-[#003f5c]',
  'Fantasy': 'bg-[#9b59b6]',
  'Adventure': 'bg-[#ff8c42]',
  'Action': 'bg-[#e74c3c]',
  'Drama': 'bg-[#8fd19e]',
  'Family': 'bg-[#8fd19e]',
  'Mystery': 'bg-[#7f8c8d]',
  'Thriller': 'bg-[#7f8c8d]',
  'Animation': 'bg-[#9b59b6]',
  'Crime': 'bg-[#2c2c2c]',
  'Documentary': 'bg-[#7f8c8d]',
  'History': 'bg-[#8d6e63]',
  'Music': 'bg-[#ff6b9d]',
  'War': 'bg-[#5d4037]',
  'Western': 'bg-[#d4a574]',
  'Reality': 'bg-[#ffd93d]',
  'Talk Show': 'bg-[#8fd19e]',
  'TV Movie': 'bg-[#9b59b6]',
  'Movie': 'bg-[#9b59b6]',
  'Classic': 'bg-[#9b59b6]',
  
  'default': 'bg-[#9b59b6]',
}

type OttFilterType = 'flatrate' | 'free' | 'rent' | 'buy' | null

export default function Content() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // [추가] 언어 상태 가져오기
  const language = useRecoilValue(languageState)
  const t = CONTENT_TEXT[language]
  const [content, setContent] = useState<Content | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ottProviders, setOttProviders] = useState<OTTProvider[]>([])
  const [selectedFilter, setSelectedFilter] = useState<OttFilterType>(null)
  const [ageRating, setAgeRating] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<string | null>(null)
  const [isBackgroundDark, setIsBackgroundDark] = useState(true) // 기본값: 어두운 배경 (포스터가 있을 가능성이 높음)
  const [cast, setCast] = useState<Array<{ id: number; name: string; character: string; profile_path: string | null }>>([])
  const [director, setDirector] = useState<string | null>(null)
  const [writer, setWriter] = useState<string | null>(null)
  const [mediaItems, setMediaItems] = useState<Array<{ type: 'video' | 'image'; url: string; thumbnail: string }>>([])
  
  // [추가] 캡처할 포스터 영역 ref
  const posterRef = useRef<HTMLDivElement>(null)
  // [추가] 공유 진행 중 상태
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    const loadContent = async () => {
      if (!id) {
        setError('콘텐츠 ID가 없습니다.')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const data = await getContentById(id)
        
        if (!data) {
          setError(t.noContent)
        } else {
          setContent(data)
          
          // TMDB API로 타입별 OTT 정보, 연령 등급, 러닝타임, 출연진/제작진, 영상/이미지 가져오기
          const contentType = data.genre === '영화' ? 'movie' : 'tv'
          const [typedProviders, ratingAndRuntime, castAndCrew, videosAndImages] = await Promise.all([
            getTypedOttProviders(data.imdb_id, contentType),
            getContentRatingAndRuntime(data.imdb_id, contentType),
            getCastAndCrew(data.imdb_id, contentType, data.title, data.year), // [수정] 제목과 연도 전달
            getVideosAndImages(data.imdb_id, contentType)
          ])
          
          // [수정] OTT 정보: TMDB 결과가 없으면 Supabase에 저장된 ott_providers 사용
          if (typedProviders.length > 0) {
            setOttProviders(typedProviders)
          } else if (data.ott_providers && data.ott_providers.length > 0) {
            // Supabase에 저장된 OTT 정보를 사용 (type이 없을 수 있으므로 기본값 설정)
            const fallbackProviders: OTTProvider[] = data.ott_providers.map(provider => ({
              ...provider,
              type: provider.type || 'flatrate' // 기본값: 정액제
            }))
            setOttProviders(fallbackProviders)
          } else {
            setOttProviders([])
          }
          
          setAgeRating(ratingAndRuntime.rating)
          setRuntime(ratingAndRuntime.runtime)
          setCast(castAndCrew.cast)
          setDirector(castAndCrew.director)
          setWriter(castAndCrew.writer)
          
          // [수정] 포스터 콜라주: TMDB 결과가 없으면 Supabase 포스터를 사용
          if (videosAndImages.length > 0) {
            setMediaItems(videosAndImages)
          } else if (data.poster_url) {
            // 포스터를 콜라주로 표시
            setMediaItems([{
              type: 'image' as const,
              url: data.poster_url,
              thumbnail: data.poster_url
            }])
          } else {
            setMediaItems([])
          }
        }
      } catch (err) {
        console.error('콘텐츠 로드 실패:', err)
        setError(t.error)
      } finally {
        setIsLoading(false)
      }
    }

    loadContent()
  }, [id])

  // [수정] 언어에 따른 태그 선택
  const sourceTags = (language === 'en' && content?.tags_en && content.tags_en.length > 0)
    ? content.tags_en
    : content?.tags

  // 태그 처리 (RecommendationCard와 동일한 로직)
  const genreTags = sourceTags && sourceTags.length > 0 
    ? sourceTags
        .flatMap(tag => tag.includes('&') 
          ? tag.split('&').map(t => t.trim()).filter(Boolean)
          : tag
        )
        .slice(0, 2) // 최대 2개만 표시
    : []

  // 타입별 OTT 제공자 개수 계산
  const flatrateCount = ottProviders.filter(p => p.type === 'flatrate').length
  const freeCount = ottProviders.filter(p => p.type === 'free').length
  const rentCount = ottProviders.filter(p => p.type === 'rent').length
  const buyCount = ottProviders.filter(p => p.type === 'buy').length

  // 필터링된 OTT 제공자
  const filteredOttProviders = selectedFilter
    ? ottProviders.filter(p => p.type === selectedFilter)
    : ottProviders

  // 필터 클릭 핸들러
  const handleFilterClick = useCallback((filterType: OttFilterType) => {
    setSelectedFilter(prev => prev === filterType ? null : filterType)
  }, [])

  // [추가] 공유 버튼 클릭 핸들러 (html-to-image 적용)
  const handleShareClick = async () => {
    if (!posterRef.current || !content || isSharing) return

    setIsSharing(true)

    try {
      // 0. 폰트 로딩 대기
      await document.fonts.ready

      // 1. html-to-image를 사용하여 포스터 영역을 이미지로 변환
      const blob = await toBlob(posterRef.current, {
        cacheBust: true, // 캐시 문제 방지 (CORS 이미지 로딩용)
        pixelRatio: 4,   // 고해상도 설정
        backgroundColor: '', // 투명 배경 유지
        style: {
          fontFamily: '"Pretendard", sans-serif', // 폰트 강제 적용
        },
      })

      if (!blob) {
        console.error('이미지 생성 실패')
        setIsSharing(false)
        return
      }

      // 2. 파일 저장 및 공유
      const title = (language === 'en' && content.title_en) ? content.title_en : content.title
      const safeTitle = title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_').replace(/\s+/g, '_')
      const fileName = `muuvi_${safeTitle}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      // 3. Web Share API 시도 (모바일 등 지원 환경)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: title,
            text: language === 'en' 
              ? `Found this amazing content on Muuvi! "${title}"`
              : `Muuvi에서 발견한 인생 영화! "${title}"`,
            files: [file],
          })
        } catch (shareError) {
          // 사용자가 공유 취소한 경우 등 에러 처리
          if ((shareError as Error).name !== 'AbortError') {
            console.error('공유 실패:', shareError)
            // 공유 실패 시 폴백으로 다운로드 시도
            saveAs(blob, fileName)
          }
        }
      } else {
        // 4. Web Share API 미지원 시 폴백 (파일 다운로드 - 데스크탑 등)
        saveAs(blob, fileName)
      }
      setIsSharing(false)

    } catch (error) {
      console.error('이미지 캡처 중 오류 발생:', error)
      setIsSharing(false)
    }
  }

  // 이미지 밝기 계산 함수 (상단 부분만 샘플링하여 뒤로가기 버튼 위치의 밝기 확인)
  const calculateImageBrightness = useCallback((imageUrl: string) => {
    const img = new Image()
    // CORS 문제를 피하기 위해 crossOrigin 설정 (실패해도 fallback 사용)
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setIsBackgroundDark(true) // 기본값
          return
        }

        // 이미지 크기에 맞춰 캔버스 크기 설정
        const maxWidth = 200 // 성능을 위해 작은 크기로 리사이즈
        const maxHeight = 100
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
        
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // 상단 부분만 샘플링 (뒤로가기 버튼이 있는 위치)
        const sampleHeight = Math.min(canvas.height * 0.3, 50) // 상단 30% 또는 최대 50px
        const imageData = ctx.getImageData(0, 0, canvas.width, sampleHeight)
        const data = imageData.data
        let brightness = 0

        // 샘플링하여 성능 최적화
        const sampleStep = Math.max(1, Math.floor(data.length / 4 / 50)) // 약 50개 픽셀 샘플링
        let sampledPixels = 0

        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          // 상대적 밝기 계산 (0-255) - 인간의 눈에 맞춘 가중치
          const pixelBrightness = (r * 299 + g * 587 + b * 114) / 1000
          brightness += pixelBrightness
          sampledPixels++
        }

        if (sampledPixels > 0) {
          const averageBrightness = brightness / sampledPixels
          // 128을 기준으로 어두운지 밝은지 판단
          setIsBackgroundDark(averageBrightness < 128)
        } else {
          setIsBackgroundDark(true) // 기본값
        }
      } catch (error) {
        // CORS 에러 등으로 인한 실패 시 기본값 사용
        // 이미지 밝기 계산 실패 시 무시
        setIsBackgroundDark(true) // 포스터가 있으면 보통 어두운 배경
      }
    }

    img.onerror = () => {
      // 이미지 로드 실패 시 기본값 (포스터가 있으면 어두운 배경으로 가정)
      setIsBackgroundDark(true)
    }

    img.src = imageUrl
  }, [])

  // 포스터 이미지가 변경될 때마다 밝기 계산
  useEffect(() => {
    if (content?.poster_url) {
      calculateImageBrightness(content.poster_url)
    } else {
      // 포스터가 없으면 밝은 배경으로 설정
      setIsBackgroundDark(false)
    }
  }, [content?.poster_url, calculateImageBrightness])

  if (isLoading) {
    return <SimpleLoading />
  }

  if (error || !content) {
    return (
      <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full px-6 bg-white">
          <div className="text-red-600 mb-4">{error || t.noContent}</div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-[#2e2c6a] text-white rounded-lg hover:bg-[#3a3878] transition-colors"
          >
            {t.back}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
          <div className="pointer-events-auto">
            <BottomNavigation />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="h-full overflow-y-auto bg-white">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-[20px] left-5 z-20 w-6 h-6 flex items-center justify-center"
          aria-label={t.back}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-6 h-6 ${isBackgroundDark ? 'text-white' : 'text-black'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* [추가] 공유 버튼 (우측 상단, 뒤로가기 버튼 반대편) */}
        <button
          onClick={handleShareClick}
          disabled={isSharing}
          className={`absolute top-[20px] right-5 z-20 w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-full hover:bg-black/40 transition-colors disabled:opacity-50 ${
            isBackgroundDark ? 'text-white' : 'text-black bg-white/40'
          }`}
          aria-label={t.share}
        >
          {isSharing ? (
            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <ShareIcon className="w-6 h-6" />
          )}
        </button>

      {/* 메인 포스터 배경 (378px 높이) */}
      <div ref={posterRef} className="relative w-full h-[378px] overflow-hidden">
        {content.poster_url && (
          <>
            <img
              src={content.poster_url}
              alt={(language === 'en' && content.title_en) ? content.title_en : content.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black" />
          </>
        )}
        
        {/* 포스터 위 정보 오버레이 */}
        <div className="absolute inset-0 flex flex-col justify-end pb-4 px-5">
          {/* 제목 */}
          <h1 className="text-[20px] font-bold text-white mb-1 text-center pr-[100px] line-clamp-2 break-words">
            {/* [수정] 언어에 따른 제목 선택 */}
            {(language === 'en' && content.title_en) ? content.title_en : content.title}
          </h1>
          
          {/* 장르 • 연도 */}
          <p className="text-[14px] font-normal text-white text-center mb-4 pr-[100px]">
            {/* [수정] 언어에 따른 장르 선택 */}
            {(language === 'en' && content.genre_en) ? content.genre_en : (content.genre || (language === 'en' ? 'Movie' : '영화'))} • {content.year || ''}
          </p>
          
          {/* OTT 아이콘 및 장르 태그 */}
          <div className="flex items-center justify-center gap-2 mb-2 pr-[100px] flex-wrap">
            {/* OTT 제공자 아이콘 (작은 원형) */}
            {(selectedFilter ? filteredOttProviders : ottProviders).slice(0, 2).map((provider, index) => (
              <div
                key={provider.provider_id || index}
                className="w-5 h-5 rounded-[6px] overflow-hidden"
              >
                {provider.logo_path ? (
                  <img
                    src={provider.logo_path}
                    alt={provider.provider_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-400" />
                )}
              </div>
            ))}
            
            {/* 장르 태그 */}
            {genreTags.map((tag, tagIndex) => {
              const tagColor = genreTagColors[tag] || genreTagColors['default']
              return (
                <div
                  key={tagIndex}
                  className={`h-5 ${tagColor} rounded-[6px] px-2 flex items-center justify-center`}
                >
                  <span className="text-[10px] font-normal text-white whitespace-nowrap">
                    {tag}
                  </span>
                </div>
              )
            })}
          </div>
          
          {/* 우측 하단 포스터 썸네일 */}
          {content.poster_url && (
            <div className="absolute right-[20px] bottom-[20px] w-[84px] h-[120px] rounded-[6px] overflow-hidden">
              <img
                src={content.poster_url}
                alt={`${(language === 'en' && content.title_en) ? content.title_en : content.title} poster`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* 줄거리 섹션 (검은 배경) */}
      {((language === 'en' && content.description_en) || content.description) && (
        <div className="w-full min-h-[105px] bg-[#010100] px-5 py-4">
          <p className="text-[14px] font-normal text-white leading-[1.5]">
            {/* [수정] 언어에 따른 줄거리 선택 */}
            {(language === 'en' && content.description_en) ? content.description_en : content.description}
          </p>
        </div>
      )}

      {/* 소개 박스 */}
      <div className="mx-5 mt-5 mb-6 border border-black/10 rounded-[20px] px-4 py-4">
        <div className="space-y-[15px]">
          {/* 원제 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.originalTitle}</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {/* [수정] 원제는 언어에 따라 표시 (원제는 원래 언어의 제목이므로 반대로 표시) */}
              {(language === 'en' ? content.title : (content.title_en || content.title)) || '-'}
            </p>
          </div>
          
          {/* 장르 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.genre}</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {content.genres?.join(', ') || content.tags?.join(', ') || '-'}
            </p>
          </div>
          
          {/* 개봉일 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.releaseDate}</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {content.year ? `${content.year}${t.year}` : '-'}
            </p>
          </div>
          
          {/* 연령등급 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.rating}</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {ageRating || '-'}
            </p>
          </div>
          
          {/* 러닝타임 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.runtime}</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {runtime || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* 보러가기 섹션 */}
      <div className="px-5 mb-6">
        <h2 className="text-[16px] font-bold text-black mb-4">{t.watch}</h2>
        
        {/* OTT 필터 (정액제, 무료, 대여, 구매) */}
        <div className="flex items-center gap-6 mb-4">
          <button
            onClick={() => handleFilterClick('flatrate')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'flatrate' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">{t.flatrate} {flatrateCount}</p>
            <div className={`w-[55px] h-[2px] border-b ${selectedFilter === 'flatrate' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
          </button>
          <button
            onClick={() => handleFilterClick('free')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'free' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">{t.free} {freeCount}</p>
            <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'free' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
          </button>
          <button
            onClick={() => handleFilterClick('rent')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'rent' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">{t.rent} {rentCount}</p>
            <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'rent' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
          </button>
          <button
            onClick={() => handleFilterClick('buy')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'buy' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">{t.buy} {buyCount}</p>
            <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'buy' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
          </button>
        </div>
        
        {/* OTT 제공자 버튼들 */}
        <div className="space-y-3">
          {filteredOttProviders.length > 0 ? (
            filteredOttProviders.map((provider, index) => (
            <button
              key={provider.provider_id || index}
              className="w-full h-9 border border-[#2e2c6a] rounded-[12px] flex items-center justify-between px-2 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {provider.logo_path && (
                  <div className="w-5 h-5 rounded-[6px] overflow-hidden">
                    <img
                      src={provider.logo_path}
                      alt={provider.provider_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  </div>
                )}
                <span className="text-[14px] font-normal text-[#2e2c6a]">
                  {provider.provider_name}
                </span>
              </div>
              <svg
                className="w-4 h-4 text-[#2e2c6a] rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            ))
          ) : (
            <p className="text-[14px] font-normal text-gray-500 text-center py-4">
              {selectedFilter ? t.noOttType : t.noOtt}
            </p>
          )}
        </div>
      </div>

      {/* 출연진/제작진 섹션 */}
      <div className="px-5 mb-6">
        <h2 className="text-[16px] font-semibold text-black mb-4">{t.castCrew}</h2>
        
        {/* 출연진 그리드 */}
        {cast.length > 0 ? (
          <div className="grid grid-cols-3 gap-x-4 gap-y-4 mb-4">
            {cast.map((actor) => (
              <div key={actor.id} className="flex flex-col items-center min-w-0 max-w-[100px] mx-auto">
                {/* 프로필 이미지 */}
                <div className="w-20 h-20 rounded-full bg-gray-300 mb-2 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {actor.profile_path ? (
                    <img
                      src={actor.profile_path}
                      alt={actor.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : null}
                </div>
                {/* 배역명 */}
                <div className="bg-gray-900 rounded-[10px] px-1.5 py-0.5 mb-1 w-full min-w-0">
                  <span 
                    className="text-[14px] font-normal text-white block truncate text-center"
                    title={actor.character || t.actor}
                  >
                    {actor.character || t.actor}
                  </span>
                </div>
                {/* 배우명 */}
                <span 
                  className="text-[14px] font-normal text-gray-900 text-center w-full truncate block min-w-0"
                  title={actor.name}
                >
                  {actor.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[14px] font-normal text-gray-500 text-center py-4">
            {t.noCast}
          </div>
        )}
        
        {/* 구분선 */}
        <div className="w-full h-[1px] border-t border-[#2e2c6a] my-4" />
        
        {/* 감독/극본 */}
        <div className="space-y-4">
          {director && (
            <div className="flex items-start gap-4">
              <span className="text-[16px] font-normal text-black flex-shrink-0">{t.director}</span>
              <span 
                className="text-[16px] font-normal text-[#7a8dd6] flex-1 truncate"
                title={director}
              >
                {director}
              </span>
            </div>
          )}
          {writer && (
            <div className="flex items-start gap-4">
              <span className="text-[16px] font-normal text-black flex-shrink-0">{t.writer}</span>
              <span 
                className="text-[16px] font-normal text-[#7a8dd6] flex-1 truncate"
                title={writer}
              >
                {writer}
              </span>
            </div>
          )}
          {!director && !writer && (
            <div className="text-[14px] font-normal text-gray-500">
              {t.noCrew}
            </div>
          )}
        </div>
        
        {/* 더보기 버튼 */}
        <button className="w-full h-[52px] bg-[#2e2c6a] rounded-[10px] mt-6 flex items-center justify-center">
          <span className="text-[16px] font-semibold text-white">{t.castMore}</span>
        </button>
      </div>

      {/* 영상 및 포스터 콜라주 섹션 */}
      <div className="px-5 mb-6">
        <h2 className="text-[16px] font-semibold text-black mb-4">{t.media}</h2>
        
        {mediaItems.length > 0 ? (
          <div className="space-y-3">
            {/* 첫 번째 행 (2개) */}
            {mediaItems.length > 0 && (
              <div className="flex gap-3">
                {mediaItems.slice(0, 2).map((item, index) => {
                  const widths = [300, 190]
                  return (
                    <div
                      key={index}
                      className="h-32 rounded overflow-hidden cursor-pointer relative group"
                      style={{ width: `${widths[index]}px` }}
                      onClick={() => {
                        if (item.type === 'video') {
                          window.open(item.url, '_blank')
                        } else {
                          // 이미지 클릭 시 확대 (선택사항)
                          window.open(item.url, '_blank')
                        }
                      }}
                    >
                      <img
                        src={item.thumbnail}
                        alt={item.type === 'video' ? '비디오' : '포스터'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = ''
                          target.style.backgroundColor = '#d1d5db'
                        }}
                      />
                      {item.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                          <svg
                            className="w-10 h-10 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )
                })}
                {mediaItems.length < 2 && (
                  <div className="h-32 w-[190px] bg-gray-300 rounded" />
                )}
              </div>
            )}
            
            {/* 두 번째 행 (2개) */}
            {mediaItems.length > 2 && (
              <div className="flex gap-3">
                {mediaItems.slice(2, 4).map((item, index) => (
                  <div
                    key={index + 2}
                    className="h-32 w-[210px] rounded overflow-hidden cursor-pointer relative group"
                    style={{ width: '210px' }}
                    onClick={() => {
                      if (item.type === 'video') {
                        window.open(item.url, '_blank')
                      } else {
                        window.open(item.url, '_blank')
                      }
                    }}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.type === 'video' ? '비디오' : '포스터'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = ''
                        target.style.backgroundColor = '#d1d5db'
                      }}
                    />
                    {item.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                        <svg
                          className="w-10 h-10 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
                {mediaItems.length < 4 && (
                  <div className="h-32 w-[210px] bg-gray-300 rounded" />
                )}
              </div>
            )}
            
            {/* 세 번째 행 (3개) */}
            {mediaItems.length > 4 && (
              <div className="flex gap-3">
                {mediaItems.slice(4, 7).map((item, index) => {
                  const widths = [144, 147, 188]
                  return (
                    <div
                      key={index + 4}
                      className="h-32 rounded overflow-hidden cursor-pointer relative group"
                      style={{ width: `${widths[index]}px` }}
                      onClick={() => {
                        if (item.type === 'video') {
                          window.open(item.url, '_blank')
                        } else {
                          window.open(item.url, '_blank')
                        }
                      }}
                    >
                      <img
                        src={item.thumbnail}
                        alt={item.type === 'video' ? '비디오' : '포스터'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = ''
                          target.style.backgroundColor = '#d1d5db'
                        }}
                      />
                      {item.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                          <svg
                            className="w-8 h-8 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )
                })}
                {mediaItems.length < 7 && (
                  <>
                    {mediaItems.length === 5 && <div className="h-32 w-[147px] bg-gray-300 rounded" />}
                    {mediaItems.length === 6 && <div className="h-32 w-[188px] bg-gray-300 rounded" />}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[14px] font-normal text-gray-500 text-center py-4">
            {t.noMedia}
          </div>
        )}
      </div>
      </div>

      {/* Absolute 하단 네비게이션 (오버레이) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  )
}
