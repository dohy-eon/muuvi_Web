import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { onboardingDataState } from '../../recoil/userState'
import { getProfile, saveProfile } from '../../lib/supabase/profile'
import { getRecommendations } from '../../lib/supabase/recommendations'
import RecommendationLoading from '../../components/RecommendationLoading'
import SimpleLoading from '../../components/SimpleLoading'
import RecommendationCard from '../../components/RecommendationCard'
import NotInterestedToast from '../../components/NotInterestedToast'
import BottomNavigation from '../../components/BottomNavigation'
import type { Content, Profile } from '../../types'
import Reload from '../../assets/reload.svg'
import RecommendActive from '../../assets/RecommendActive.svg'
import RecommendInactive from '../../assets/RecommendInactive.svg'

// 무드 ID를 한글 이름으로 매핑
const moodIdToKorean: Record<string, string> = {
  '01': '로맨스',
  '02': '호러',
  '03': '코미디',
  '04': '공상 과학',
  '05': '판타지',
  '06': '어드벤처',
  '07': '액션',
  '08': '힐링',
  '09': '미스테리',
}

export default function Main() {
  const navigate = useNavigate()
  const location = useLocation()
  const setOnboardingData = useSetRecoilState(onboardingDataState)
  const [recommendations, setRecommendations] = useState<Content[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showLoadingScreen, setShowLoadingScreen] = useState(false) // 온보딩에서 넘어올 때만 true
  const [showSimpleLoading, setShowSimpleLoading] = useState(false) // 마이페이지에서 넘어올 때 사용
  const [profile, setProfile] = useState<Profile | null>(null)
  const onboardingData = useRecoilValue(onboardingDataState)
  const [recommendEnabled, setRecommendEnabled] = useState(true)
  // 현재 표시 중인 카드의 인덱스 상태
  const [currentIndex, setCurrentIndex] = useState(0)
  // 이전 경로를 추적하기 위한 ref
  const prevPathRef = useRef<string | null>(null)
  // 관심없음 토스트 표시 상태
  const [showNotInterestedToast, setShowNotInterestedToast] = useState(false)

  // 온보딩으로 이동하는 함수
  const handleRestart = () => {
    setRecommendations([])
    setProfile(null)
    setOnboardingData(null)
    setIsLoading(false)
    navigate('/onboarding')
  }

  const loadRecommendations = useCallback(async (forceRefresh: boolean = false) => {
      // 이미 추천 데이터가 있고, 온보딩 데이터가 없고, 강제 새로고침이 아닌 경우에는 로드하지 않음
      if (!forceRefresh && recommendations.length > 0 && !onboardingData) {
        setIsLoading(false)
        setShowSimpleLoading(false)
        setShowLoadingScreen(false)
        return
      }

      // 온보딩에서 넘어온 경우에만 상세 로딩 화면 표시 (useEffect에서 이미 설정됨)
      const shouldShowLoading = onboardingData && !forceRefresh && recommendations.length === 0

      try {
        // 임시 user_id (실제로는 인증된 사용자 ID 사용)
        const userId = 'temp-user-id'

        // 프로필 가져오기 또는 생성
        let profile = await getProfile(userId)

        const shouldSyncOnboarding = onboardingData && (forceRefresh || !profile)

        if (shouldSyncOnboarding) {
          const updatedProfile = await saveProfile(userId, onboardingData)
          profile = updatedProfile ?? profile
        }

        if (profile) {
          // 프로필 저장
          setProfile(profile)
          // 추천 콘텐츠 가져오기 (forceRefresh가 true이면 기존 내역 무시하고 새로 가져오기)
          const contents = await getRecommendations(profile, forceRefresh)
          setRecommendations(contents)
          // 추천 로드 시 인덱스 초기화
          setCurrentIndex(0)
        }
      } catch (error) {
        console.error('추천 콘텐츠 로드 실패:', error)
      } finally {
        // 로딩 완료 처리
        if (shouldShowLoading) {
          setIsLoading(false)
          setShowLoadingScreen(false)
        }
        setShowSimpleLoading(false)
      }
  }, [onboardingData, recommendations.length])

  const handleRerecommend = () => {
    void loadRecommendations(true)
  }

  useEffect(() => {
    const currentPath = location.pathname
    // sessionStorage에서 이전 경로 가져오기
    const prevPath = sessionStorage.getItem('prevPath') || prevPathRef.current
    
    // 추천 데이터가 없을 때만 로딩 화면 표시
    if (recommendations.length === 0) {
      // 온보딩에서 넘어온 경우에만 상세 로딩 화면 표시
      if (prevPath?.includes('/onboarding')) {
        setShowLoadingScreen(true)
        setIsLoading(true)
        setShowSimpleLoading(false)
      } else {
        // 마이페이지에서 넘어온 경우 또는 다른 경로에서 넘어온 경우 간단한 로딩 화면 표시
        setShowSimpleLoading(true)
        setShowLoadingScreen(false)
        setIsLoading(false)
      }
    }
    
    // 이전 경로 저장 (다음 렌더링을 위해)
    prevPathRef.current = currentPath
    sessionStorage.setItem('prevPath', currentPath)
    
    // 데이터 로드 시작
    void loadRecommendations()
  }, [loadRecommendations, recommendations.length, location.pathname])

  // 로딩 화면 우선순위: 상세 로딩 > 간단한 로딩
  // 온보딩에서 넘어올 때 상세 로딩 화면 표시
  if (isLoading && showLoadingScreen) {
    return <RecommendationLoading profile={profile} onboardingData={onboardingData} />
  }

  // 마이페이지에서 넘어올 때 간단한 로딩 화면 표시
  // (상세 로딩이 아닐 때만)
  if (showSimpleLoading) {
    return <SimpleLoading />
  }

  // 프로필이 있으면 프로필 사용, 없으면 온보딩 데이터 사용
  const displayGenre = profile?.genre || onboardingData?.genre
  const displayMoods = profile?.moods || onboardingData?.moods || []
  
  const moodNames = displayMoods
    .map((id) => moodIdToKorean[id] || id)
    .join(', ')

  // 다음/이전 핸들러
  const handleNext = () => {
    if (currentIndex < recommendations.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  // 관심없음 핸들러
  const handleNotInterested = (contentId: string) => {
    // 추천 목록에서 해당 콘텐츠 제거
    setRecommendations((prev) => prev.filter((content) => content.id !== contentId))
    
    // 현재 인덱스 조정 (제거된 항목이 현재 인덱스보다 앞에 있으면 인덱스 감소)
    setCurrentIndex((prev) => {
      const removedIndex = recommendations.findIndex((c) => c.id === contentId)
      if (removedIndex < prev) {
        return prev - 1
      }
      if (removedIndex === prev && prev >= recommendations.length - 1) {
        return Math.max(0, prev - 1)
      }
      return prev
    })

    // 토스트 표시
    setShowNotInterestedToast(true)
    
    // 3초 후 토스트 숨김
    setTimeout(() => {
      setShowNotInterestedToast(false)
    }, 3000)
  }

  return (
    <div className="w-full h-screen bg-white relative font-pretendard flex flex-col overflow-hidden">
      {/* 관심없음 토스트 */}
      <NotInterestedToast isVisible={showNotInterestedToast} />
      
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto bg-white relative">

      {/* Selection Info Card */}
      {(displayGenre || moodNames) && (
        <div className="w-80 py-4 left-1/2 -translate-x-1/2 top-[600px] absolute bg-gray-50 rounded-xl inline-flex flex-col justify-start items-center gap-4">
          {displayGenre && (
            <div className="w-72 inline-flex justify-between items-start">
              <div className="w-6 justify-start text-gray-600 text-sm font-medium font-pretendard tracking-tight">
                장르
              </div>
              <div className="text-right justify-start text-gray-900 text-sm font-medium font-pretendard tracking-tight">
                {displayGenre}
              </div>
            </div>
          )}
          {moodNames && (
            <div className="w-72 inline-flex justify-between items-center">
              <div className="text-center justify-start text-gray-600 text-sm font-medium font-pretendard tracking-tight">
                무드
              </div>
              <div className="text-center justify-start text-gray-900 text-sm font-medium font-pretendard tracking-tight">
                {moodNames}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute left-1/2 -translate-x-1/2 top-[548px] flex items-center justify-center gap-4">
        {/* 다시하기 버튼 */}
        <button
          onClick={handleRestart}
          className="px-4 py-2 bg-[#2e2c6a] text-white text-sm font-semibold rounded-lg hover:bg-[#3a3878] transition-colors whitespace-nowrap"
        >
          다시하기
        </button>

        {/* Reload Button */}
        <button
          type="button"
          aria-label="reload-recommendations"
          className="size-8 flex items-center justify-center rounded-full bg-white/0"
          onClick={handleRerecommend}
        >
          <img src={Reload} alt="reload" className="w-[28px] h-[28px]" />
        </button>

        {/* Recommend Toggle Button */}
        <button
          type="button"
          aria-label="toggle-recommend"
          className="size-8 flex items-center justify-center rounded-full bg-white/0"
          onClick={() => setRecommendEnabled((v) => !v)}
        >
          <img
            src={recommendEnabled ? RecommendActive : RecommendInactive}
            alt="recommend-toggle"
            className="w-[28px] h-[28px]"
          />
        </button>
      </div>

      {/* 카드 네비게이션 버튼 */}
      {recommendations.length > 0 && (
        <div className="absolute top-[320px] w-full flex justify-between px-2 z-20 pointer-events-none">
          {/* 이전 버튼 */}
          <button
            onClick={handlePrev}
            aria-label="previous content"
            className={`w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl font-bold transition-opacity pointer-events-auto ${
              currentIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-black/50'
            }`}
            disabled={currentIndex === 0}
          >
            &lt;
          </button>
          {/* 다음 버튼 */}
          <button
            onClick={handleNext}
            aria-label="next content"
            className={`w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl font-bold transition-opacity pointer-events-auto ${
              currentIndex >= recommendations.length - 1 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-black/50'
            }`}
            disabled={currentIndex >= recommendations.length - 1}
          >
            &gt;
          </button>
        </div>
      )}

      {/* Recommendation Cards -> Slider Container */}
      {isLoading ? (
        // 로딩 중일 때는 아무것도 표시하지 않음 (또는 로딩 인디케이터)
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-600">
          {/* 로딩 중... */}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-600">
          추천 콘텐츠가 없습니다.
        </div>
      ) : (
        // 슬라이더의 보이는 영역 (Viewport)
        <div className="absolute top-[128px] w-full overflow-hidden z-10">
          {/* 슬라이더 트랙 (모든 카드를 담음) */}
          <div
            className="flex gap-2"
            style={{
              // transform과 transition으로 슬라이드 구현
              // w-72 (18rem) + gap-2 (0.5rem) = 18.5rem (296px)
              // 50% (중앙) - 9rem (카드 절반) = 카드 1개 중앙 정렬
              transform: `translateX(calc(50% - 9rem - ${currentIndex * 18.5}rem))`,
              transition: 'transform 0.4s ease-in-out',
            }}
          >
            {/* 모든 추천 카드를 렌더링 */}
            {recommendations.map((content) => (
              <RecommendationCard 
                key={content.id} 
                content={content}
                onNotInterested={handleNotInterested}
              />
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Sticky 하단 네비게이션 */}
      <div className="sticky bottom-0 z-30 pt-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  )
}
