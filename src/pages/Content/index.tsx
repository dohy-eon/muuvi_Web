import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getContentById } from '../../lib/supabase/recommendations'
import type { Content, OTTProvider } from '../../types'
import BottomNavigation from '../../components/BottomNavigation'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || ''
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

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

// 장르/태그 색상 매핑 (RecommendationCard와 동일)
const genreTagColors: Record<string, string> = {
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
  'default': 'bg-[#9b59b6]',
}

type OttFilterType = 'flatrate' | 'free' | 'rent' | 'buy' | null

export default function Content() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState<Content | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ottProviders, setOttProviders] = useState<OTTProvider[]>([])
  const [selectedFilter, setSelectedFilter] = useState<OttFilterType>(null)
  const [ageRating, setAgeRating] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<string | null>(null)
  const [isBackgroundDark, setIsBackgroundDark] = useState(true) // 기본값: 어두운 배경 (포스터가 있을 가능성이 높음)

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
          setError('콘텐츠를 찾을 수 없습니다.')
        } else {
          setContent(data)
          
          // TMDB API로 타입별 OTT 정보, 연령 등급, 러닝타임 가져오기
          const contentType = data.genre === '영화' ? 'movie' : 'tv'
          const [typedProviders, ratingAndRuntime] = await Promise.all([
            getTypedOttProviders(data.imdb_id, contentType),
            getContentRatingAndRuntime(data.imdb_id, contentType)
          ])
          setOttProviders(typedProviders)
          setAgeRating(ratingAndRuntime.rating)
          setRuntime(ratingAndRuntime.runtime)
        }
      } catch (err) {
        console.error('콘텐츠 로드 실패:', err)
        setError('콘텐츠를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    loadContent()
  }, [id])

  // 태그 처리 (RecommendationCard와 동일한 로직)
  const genreTags = content?.tags && content.tags.length > 0 
    ? content.tags
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
        console.warn('이미지 밝기 계산 실패 (CORS 또는 기타 오류):', error)
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
    return (
      <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
        <div className="flex items-center justify-center h-full bg-white">
          <div className="text-gray-600">로딩 중...</div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
          <div className="pointer-events-auto">
            <BottomNavigation />
          </div>
        </div>
      </div>
    )
  }

  if (error || !content) {
    return (
      <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full px-6 bg-white">
          <div className="text-red-600 mb-4">{error || '콘텐츠를 찾을 수 없습니다.'}</div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-[#2e2c6a] text-white rounded-lg hover:bg-[#3a3878] transition-colors"
          >
            뒤로가기
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
          aria-label="뒤로가기"
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

      {/* 메인 포스터 배경 (378px 높이) */}
      <div className="relative w-full h-[378px] overflow-hidden">
        {content.poster_url && (
          <>
            <img
              src={content.poster_url}
              alt={content.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black" />
          </>
        )}
        
        {/* 포스터 위 정보 오버레이 */}
        <div className="absolute inset-0 flex flex-col justify-end pb-4 px-5">
          {/* 제목 */}
          <h1 className="text-[20px] font-bold text-white mb-1 text-center">
            {content.title}
          </h1>
          
          {/* 장르 • 연도 */}
          <p className="text-[14px] font-normal text-white text-center mb-4">
            {content.genre || '영화'} • {content.year || ''}
          </p>
          
          {/* OTT 아이콘 및 장르 태그 */}
          <div className="flex items-center justify-center gap-2 mb-2">
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
                alt={`${content.title} poster`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* 줄거리 섹션 (검은 배경) */}
      {content.description && (
        <div className="w-full min-h-[105px] bg-[#010100] px-5 py-4">
          <p className="text-[14px] font-normal text-white leading-[1.5]">
            {content.description}
          </p>
        </div>
      )}

      {/* 소개 박스 */}
      <div className="mx-5 mt-5 mb-6 border border-black/10 rounded-[20px] px-4 py-4">
        <div className="space-y-[15px]">
          {/* 원제 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">원제</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {content.title || '-'}
            </p>
          </div>
          
          {/* 장르 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">장르</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {content.genres?.join(', ') || content.tags?.join(', ') || '-'}
            </p>
          </div>
          
          {/* 개봉일 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">개봉일</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {content.year ? `${content.year}년` : '-'}
            </p>
          </div>
          
          {/* 연령등급 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">연령등급</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {ageRating || '-'}
            </p>
          </div>
          
          {/* 러닝타임 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">러닝타임</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">
              {runtime || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* 보러가기 섹션 */}
      <div className="px-5 mb-6">
        <h2 className="text-[16px] font-bold text-black mb-4">보러가기</h2>
        
        {/* OTT 필터 (정액제, 무료, 대여, 구매) */}
        <div className="flex items-center gap-6 mb-4">
          <button
            onClick={() => handleFilterClick('flatrate')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'flatrate' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">정액제 {flatrateCount}</p>
            <div className={`w-[55px] h-[2px] border-b ${selectedFilter === 'flatrate' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
          </button>
          <button
            onClick={() => handleFilterClick('free')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'free' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">무료 {freeCount}</p>
            <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'free' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
          </button>
          <button
            onClick={() => handleFilterClick('rent')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'rent' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">대여 {rentCount}</p>
            <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'rent' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
          </button>
          <button
            onClick={() => handleFilterClick('buy')}
            className={`flex flex-col items-center gap-1 ${selectedFilter === 'buy' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
          >
            <p className="text-[16px] font-normal text-black">구매 {buyCount}</p>
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
              {selectedFilter 
                ? '해당 타입으로 시청 가능한 플랫폼이 없습니다.'
                : '시청 가능한 플랫폼이 없습니다.'}
            </p>
          )}
        </div>
      </div>

      {/* 출연진/제작진 섹션 */}
      <div className="px-5 mb-6">
        <h2 className="text-[16px] font-semibold text-black mb-4">출연진/제작진</h2>
        
        {/* 출연진 그리드 (3열) */}
        <div className="flex gap-[43px] mb-4 overflow-x-auto">
          {/* Placeholder 출연진 카드들 */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gray-300 mb-2" />
              <div className="bg-gray-900 rounded-[10px] px-1.5 py-0.5 mb-1">
                <span className="text-[14px] font-normal text-white">이름</span>
              </div>
              <span className="text-[14px] font-normal text-gray-900">본명</span>
            </div>
          ))}
        </div>
        
        <div className="flex gap-[48px] mb-4 overflow-x-auto">
          {[4, 5, 6].map((i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gray-300 mb-2" />
              <div className="bg-gray-900 rounded-[10px] px-1.5 py-0.5 mb-1">
                <span className="text-[14px] font-normal text-white">이름</span>
              </div>
              <span className="text-[14px] font-normal text-gray-900">본명</span>
            </div>
          ))}
        </div>
        
        {/* 구분선 */}
        <div className="w-full h-[1px] border-t border-[#2e2c6a] my-4" />
        
        {/* 감독/극본 */}
        <div className="space-y-4">
          <div>
            <span className="text-[16px] font-normal text-black">감독</span>
            <span className="text-[16px] font-normal text-[#7a8dd6] ml-4">감독이름</span>
          </div>
          <div>
            <span className="text-[16px] font-normal text-black">극본</span>
            <span className="text-[16px] font-normal text-[#7a8dd6] ml-4">극본가이름</span>
          </div>
        </div>
        
        {/* 더보기 버튼 */}
        <button className="w-full h-[52px] bg-[#2e2c6a] rounded-[10px] mt-6 flex items-center justify-center">
          <span className="text-[16px] font-semibold text-white">출연진/제작진 더보기</span>
        </button>
      </div>

      {/* 영상 및 포스터 콜라주 섹션 */}
      <div className="px-5 mb-6">
        <h2 className="text-[16px] font-semibold text-black mb-4">영상 및 포스터 콜라주</h2>
        
        {/* 그리드 레이아웃 */}
        <div className="space-y-2">
          {/* 첫 번째 행 */}
          <div className="flex gap-2">
            <div className="h-20 w-[200px] bg-gray-300 rounded" />
            <div className="h-20 w-[127px] bg-gray-300 rounded" />
          </div>
          
          {/* 두 번째 행 */}
          <div className="flex gap-2">
            <div className="h-20 w-[140px] bg-gray-300 rounded" />
            <div className="h-20 w-[140px] bg-gray-300 rounded" />
          </div>
          
          {/* 세 번째 행 */}
          <div className="flex gap-2">
            <div className="h-20 w-[96px] bg-gray-300 rounded" />
            <div className="h-20 w-[98px] bg-gray-300 rounded" />
            <div className="h-20 w-[125px] bg-gray-300 rounded" />
          </div>
        </div>
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
