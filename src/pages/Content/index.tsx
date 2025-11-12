import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getContentById } from '../../lib/supabase/recommendations'
import type { Content } from '../../types'
import BottomNavigation from '../../components/BottomNavigation'

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

export default function Content() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState<Content | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // OTT 제공자 필터링 (현재는 모든 제공자 표시, 나중에 필터 타입별로 분리 가능)
  const filteredOttProviders = content?.ott_providers || []

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
          className="absolute top-[65px] left-5 z-20 w-6 h-6 flex items-center justify-center"
          aria-label="뒤로가기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6"
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
            {filteredOttProviders.slice(0, 2).map((provider, index) => (
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
            <p className="text-[14px] font-normal text-gray-900 flex-1">-</p>
          </div>
          
          {/* 러닝타임 */}
          <div className="flex items-start">
            <p className="text-[14px] font-normal text-gray-700 w-[93px]">러닝타임</p>
            <p className="text-[14px] font-normal text-gray-900 flex-1">-</p>
          </div>
        </div>
      </div>

      {/* 보러가기 섹션 */}
      <div className="px-5 mb-6">
        <h2 className="text-[16px] font-bold text-black mb-4">보러가기</h2>
        
        {/* OTT 필터 (정액제, 무료, 대여, 구매) */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-1">
            <div className="w-[55px] h-[1px] border-b border-[#2e2c6a]" />
            <p className="text-[16px] font-normal text-black">정액제 2</p>
          </div>
          <p className="text-[16px] font-normal text-black">무료 0</p>
          <p className="text-[16px] font-normal text-black">대여 4</p>
          <p className="text-[16px] font-normal text-black">구매 4</p>
        </div>
        
        {/* OTT 제공자 버튼들 */}
        <div className="space-y-3">
          {filteredOttProviders.slice(0, 2).map((provider, index) => (
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
          ))}
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
