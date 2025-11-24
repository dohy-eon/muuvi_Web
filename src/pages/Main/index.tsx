import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { onboardingDataState, languageState } from '../../recoil/userState'
import { getProfile, saveProfile } from '../../lib/supabase/profile'
import { getRecommendations } from '../../lib/supabase/recommendations'
import { addNotInterested, getNotInterestedContentIds, removeNotInterested } from '../../lib/supabase/notInterested'
import { userState } from '../../recoil/userState'
import RecommendationLoading from '../../components/RecommendationLoading'
import SimpleLoading from '../../components/SimpleLoading'
import RecommendationCard from '../../components/RecommendationCard'
import NotInterestedToast from '../../components/NotInterestedToast'
import BottomNavigation from '../../components/BottomNavigation'
import type { Content, Profile } from '../../types'
import Reload from '../../assets/reload.svg'
import RecommendInactive from '../../assets/RecommendInactive.svg'
import RecommendActive from '../../assets/RecommendActive.svg'

const MOOD_TABLE = {
  ko: {
    '01': '로맨스',
    '02': '호러',
    '03': '코미디',
    '04': '공상 과학',
    '05': '판타지',
    '06': '어드벤처',
    '07': '액션',
    '08': '힐링',
    '09': '미스테리',
  },
  en: {
    '01': 'Romance',
    '02': 'Horror',
    '03': 'Comedy',
    '04': 'Sci-Fi',
    '05': 'Fantasy',
    '06': 'Adventure',
    '07': 'Action',
    '08': 'Healing',
    '09': 'Mystery',
  },
}

const GENRE_TRANSLATION: Record<string, { ko: string; en: string }> = {
  '영화': { ko: '영화', en: 'Movie' },
  '드라마': { ko: '드라마', en: 'Drama' },
  '애니메이션': { ko: '애니메이션', en: 'Animation' },
  '예능': { ko: '예능', en: 'Variety Show' },
}

const UI_TEXT = {
  ko: {
    genre: '장르',
    mood: '무드',
    noContent: '추천 콘텐츠가 없습니다.',
    loading: '로딩 중...',
    restart: '다시하기',
    notInterested: '관심없음',
    notInterestedCancel: '관심없음 취소',
  },
  en: {
    genre: 'Genre',
    mood: 'Mood',
    noContent: 'No recommendations available.',
    loading: 'Loading...',
    restart: 'Restart',
    notInterested: 'Not Interested',
    notInterestedCancel: 'Restore Interest',
  },
}

export default function Main() {
  const navigate = useNavigate()
  const location = useLocation()
  const setOnboardingData = useSetRecoilState(onboardingDataState)
  const user = useRecoilValue(userState)

  // [추가] 언어 상태 가져오기
  const language = useRecoilValue(languageState)
  const t = UI_TEXT[language]
  const moodMap = MOOD_TABLE[language]

  const [recommendations, setRecommendations] = useState<Content[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showLoadingScreen, setShowLoadingScreen] = useState(false) // 온보딩에서 넘어올 때만 true
  const [showSimpleLoading, setShowSimpleLoading] = useState(false) // 마이페이지에서 넘어올 때 사용
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isDataReady, setIsDataReady] = useState(false) // 데이터가 준비되어 렌더링 대기 중인지
  
  // 추천 데이터를 sessionStorage에 저장하는 함수
  const saveRecommendationsToStorage = (contents: Content[]) => {
    try {
      sessionStorage.setItem('mainRecommendations', JSON.stringify(contents))
    } catch (error) {
      console.error('추천 데이터 저장 실패:', error)
    }
  }
  
  // 프로필 데이터를 sessionStorage에 저장하는 함수
  const saveProfileToStorage = (profileData: Profile | null) => {
    try {
      if (profileData) {
        sessionStorage.setItem('mainProfile', JSON.stringify(profileData))
      } else {
        sessionStorage.removeItem('mainProfile')
      }
    } catch (error) {
      console.error('프로필 데이터 저장 실패:', error)
    }
  }
  
  // 프로필 데이터를 sessionStorage에서 복원하는 함수
  const loadProfileFromStorage = (): Profile | null => {
    try {
      const storedProfile = sessionStorage.getItem('mainProfile')
      if (storedProfile) {
        return JSON.parse(storedProfile) as Profile
      }
    } catch (error) {
      console.error('프로필 데이터 복원 실패:', error)
    }
    return null
  }
  const onboardingData = useRecoilValue(onboardingDataState)
  // 현재 표시 중인 카드의 인덱스 상태
  const [currentIndex, setCurrentIndex] = useState(0)
  // 이전 경로를 추적하기 위한 ref
  const prevPathRef = useRef<string | null>(null)
  // 관심없음 토스트 표시 상태
  const [showNotInterestedToast, setShowNotInterestedToast] = useState(false)
  // 토스트 메시지 타입 ('notInterested': 관심없음, 'restored': 관심없음 취소)
  const [toastMessage, setToastMessage] = useState<'notInterested' | 'restored'>('notInterested')
  // 공유 토스트 표시 상태
  const [showShareToast, setShowShareToast] = useState(false)
  // 공유 토스트 메시지 타입 ('imageSaved': 이미지 저장 성공, 'shareFailed': 공유 실패)
  const [shareToastMessage, setShareToastMessage] = useState<'imageSaved' | 'shareFailed'>('imageSaved')
  // 관심없음으로 표시된 콘텐츠 ID 목록
  const [notInterestedIds, setNotInterestedIds] = useState<Set<string>>(new Set())
  // 스와이프 제스처를 위한 터치 상태
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  // 터치 이벤트가 처리되었는지 추적 (클릭 이벤트와 중복 방지)
  const touchHandledRef = useRef(false)

  // 온보딩으로 이동하는 함수
  const handleRestart = () => {
    setRecommendations([])
    saveRecommendationsToStorage([]) // sessionStorage도 초기화
    sessionStorage.removeItem('mainRecommendations') // [추가] 명시적 초기화
    setProfile(null)
    setOnboardingData(null)
    setIsLoading(false)
    navigate('/onboarding')
  }

  // [추가] 이미지 프리로드 함수
  const preloadImages = (contents: Content[]) => {
    contents.forEach((content) => {
      if (content.poster_url) {
        const img = new Image()
        img.src = content.poster_url
      }
      // OTT 로고 이미지도 프리로드
      if (content.ott_providers) {
        content.ott_providers.forEach((provider) => {
          if (provider.logo_path) {
            const img = new Image()
            img.src = provider.logo_path
          }
        })
      }
    })
  }

  const loadRecommendations = useCallback(async (forceRefresh: boolean = false) => {
      const startTime = Date.now()
      const MIN_LOADING_TIME = 1500 // 최소 로딩 시간 1.5초
      
      try {
        // 실제 user_id 사용 (로그인한 사용자는 user.id, 비로그인은 temp-user-id)
        const userId = user?.id || 'temp-user-id'

        // 프로필 가져오기 또는 생성
        let profile = await getProfile(userId)

        if (onboardingData) {
          const updatedProfile = await saveProfile(userId, onboardingData)
          profile = updatedProfile ?? profile
          // 온보딩 데이터 사용 후 클리어 (한 번만 사용되도록)
          setOnboardingData(null)
        }

        if (user && profile && !onboardingData) {
          const latestProfile = await getProfile(user.id)
          if (latestProfile) {
            profile = latestProfile // subscribed_otts 등 최신 정보 반영
          }
        }

        if (profile) {
          // 프로필 저장
          setProfile(profile)
          // 세션 스토리지에도 프로필 저장 (네비게이션 바 이동 시 복원용)
          saveProfileToStorage(profile)
          
          const [notInterestedIdsFromDb, contents] = await Promise.all([
            // 관심없음 콘텐츠 ID 목록 가져오기 (로그인한 사용자인 경우)
            user ? getNotInterestedContentIds(user.id).catch(() => [] as string[]) : Promise.resolve([] as string[]),
            getRecommendations(profile, forceRefresh)
          ])
          
          if (user && notInterestedIdsFromDb.length > 0) {
            setNotInterestedIds(new Set(notInterestedIdsFromDb))
          }
          
          const filteredContents = contents.filter((content) => !notInterestedIdsFromDb.includes(content.id))
          
          const finalContents = filteredContents.slice(0, 3)
          
          preloadImages(finalContents)
          
          const elapsedTime = Date.now() - startTime
          const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
          
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime))
          }
          
          setRecommendations(finalContents)
          saveRecommendationsToStorage(finalContents)
          setCurrentIndex(0)
          setIsDataReady(true)
        }
      } catch (error) {
        console.error('추천 콘텐츠 로드 실패:', error)
        // 에러 발생 시에도 최소 로딩 시간 유지
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime))
        }
        // 에러 발생 시 빈 배열로 설정하고 데이터 준비 완료 플래그 설정
        setRecommendations([])
        setIsDataReady(true)
      }
  }, [onboardingData, user])

  // [추가] recommendations가 업데이트되고 렌더링된 후 로딩 종료
  useEffect(() => {
    if (isDataReady && recommendations.length > 0) {
      // React가 상태를 업데이트하고 DOM에 렌더링할 시간을 줌
      // requestAnimationFrame을 두 번 사용: 한 번은 React 업데이트, 한 번은 브라우저 렌더링
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 이미지가 로드될 시간을 조금 더 줌
          setTimeout(() => {
            setIsLoading(false)
            setShowLoadingScreen(false)
            setShowSimpleLoading(false)
            setIsDataReady(false) // 플래그 리셋
          }, 100)
        })
      })
    } else if (isDataReady && recommendations.length === 0) {
      // 데이터가 없어도 로딩 종료
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsLoading(false)
          setShowLoadingScreen(false)
          setShowSimpleLoading(false)
          setIsDataReady(false) // 플래그 리셋
        })
      })
    }
  }, [isDataReady, recommendations.length])

  const handleRerecommend = () => {
    void loadRecommendations(true)
  }

  useEffect(() => {
    const currentPath = location.pathname
    const prevPath = sessionStorage.getItem('prevPath') || prevPathRef.current
    
    const shouldShowLoadingScreen = onboardingData || prevPath?.includes('/onboarding')
    if (shouldShowLoadingScreen) {
      setShowLoadingScreen(true)
      setIsLoading(true)
      setShowSimpleLoading(false)
      
      try {
        const storedRecommendations = sessionStorage.getItem('mainRecommendations')
        const storedProfile = loadProfileFromStorage()
        
        if (storedRecommendations && storedProfile) {
          const parsed = JSON.parse(storedRecommendations) as Content[]
          if (parsed && parsed.length > 0) {
            setRecommendations(parsed)
            setProfile(storedProfile)
            
            // 이미지 프리로드
            preloadImages(parsed)
            setIsDataReady(true)
            return
          }
        }
      } catch (error) {
        console.error('[온보딩에서 메인 이동] 미리 로드된 데이터 확인 실패:', error)
      }
      
      // [추가] 미리 로드된 데이터가 없으면 즉시 데이터 로딩 시작
      void loadRecommendations()
    }
    
    const navigationBarPaths = ['/main', '/mypage', '/search']
    const isNavigationBarNavigation = 
      prevPath && 
      navigationBarPaths.includes(prevPath) && 
      navigationBarPaths.includes(currentPath) && 
      prevPath !== currentPath
    
    // [리팩토링] 1. 네비게이션 바 이동 감지 및 처리
    // 온보딩에서 넘어온 경우는 네비게이션 바 이동이 아니므로 건너뜀
    if (isNavigationBarNavigation && !shouldShowLoadingScreen) {
      try {
        // 세션에서 추천 데이터 복원
        const storedRecommendations = sessionStorage.getItem('mainRecommendations')
        const storedProfile = loadProfileFromStorage()
        
        if (storedRecommendations) {
          const parsed = JSON.parse(storedRecommendations) as Content[]
          if (parsed && parsed.length > 0) {
            setRecommendations(parsed)
            
            if (storedProfile) {
              setProfile(prev => prev || storedProfile)
            }
            
            setIsLoading(false)
            setShowSimpleLoading(false)
            setShowLoadingScreen(false)
            prevPathRef.current = currentPath
            sessionStorage.setItem('prevPath', currentPath)
            return
          }
        }
      } catch (error) {
        console.error('[네비게이션 바 이동] 세션 데이터 복원 실패:', error)
      }
      
      setIsLoading(false)
      setShowSimpleLoading(false)
      setShowLoadingScreen(false)
      prevPathRef.current = currentPath
      sessionStorage.setItem('prevPath', currentPath)
      return
    }
    
    // [리팩토링] 2. 온보딩 데이터 처리 (새로운 추천이 필요한 경우)
    // [수정] 온보딩에서 넘어온 경우는 이미 위에서 처리했으므로 여기서는 건너뜀
    if (onboardingData && !shouldShowLoadingScreen) {
      sessionStorage.removeItem('mainRecommendations')
      sessionStorage.removeItem('mainProfile')
      setRecommendations([])
    }
    
    if (recommendations.length > 0 && !onboardingData) {
      if (!profile) {
        const storedProfile = loadProfileFromStorage()
        if (storedProfile) {
          setProfile(storedProfile)
        }
      }
      
      setIsLoading(false)
      setShowSimpleLoading(false)
      setShowLoadingScreen(false)
      prevPathRef.current = currentPath
      sessionStorage.setItem('prevPath', currentPath)
      return
    }
    
    if (recommendations.length === 0 && !onboardingData) {
      try {
        const storedRecommendations = sessionStorage.getItem('mainRecommendations')
        const storedProfile = loadProfileFromStorage()
        
        if (storedRecommendations) {
          const parsed = JSON.parse(storedRecommendations) as Content[]
          if (parsed && parsed.length > 0) {
            setRecommendations(parsed)
            
            if (storedProfile) {
              setProfile(storedProfile)
            }
            
            setIsLoading(false)
            setShowSimpleLoading(false)
            setShowLoadingScreen(false)
            prevPathRef.current = currentPath
            sessionStorage.setItem('prevPath', currentPath)
            return
          }
        }
      } catch (error) {
        console.error('[세션 데이터 복원] 실패:', error)
      }
    }
    
    // [리팩토링] 5. 로딩 화면 표시 및 데이터 로드
    // 온보딩 데이터가 있거나 이전 경로가 온보딩 경로를 포함하면 로딩 화면 표시
    // (이미 위에서 설정하고 데이터 로딩도 시작했으므로 여기서는 else 케이스만 처리)
    if (!shouldShowLoadingScreen) {
      setShowSimpleLoading(false)
      setShowLoadingScreen(false)
      setIsLoading(false)
      prevPathRef.current = currentPath
      sessionStorage.setItem('prevPath', currentPath)
      void loadRecommendations()
    } else {
      prevPathRef.current = currentPath
      sessionStorage.setItem('prevPath', currentPath)
    }
  }, [location.pathname, loadRecommendations, onboardingData])

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
  const genreValue = profile?.genre || onboardingData?.genre
  const displayMoods = profile?.moods || onboardingData?.moods || []

  const displayGenre = genreValue
    ? (GENRE_TRANSLATION[genreValue]?.[language] || genreValue)
    : null

  const moodNames = displayMoods
    .map((id) => moodMap[id as keyof typeof moodMap] || id)
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

  // 스와이프 제스처 핸들러 (터치만)
  const minSwipeDistance = 50

  // 터치 이벤트 (모바일)
  const onTouchStart = (e: React.TouchEvent) => {
    touchHandledRef.current = false
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setTouchStart(null)
      setTouchEnd(null)
      return
    }
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentIndex < recommendations.length - 1) {
      touchHandledRef.current = true
      handleNext()
    } else if (isRightSwipe && currentIndex > 0) {
      touchHandledRef.current = true
      handlePrev()
    }
    
    // 상태 초기화
    setTouchStart(null)
    setTouchEnd(null)
    
    // 짧은 시간 후 터치 처리 플래그 리셋 (클릭 이벤트와 중복 방지)
    setTimeout(() => {
      touchHandledRef.current = false
    }, 300)
  }

  // 관심없음 핸들러
  const handleNotInterested = async (contentId: string) => {
    // 이미 관심없음으로 표시된 경우 취소
    if (notInterestedIds.has(contentId)) {
      // 관심없음 취소
      if (user) {
        try {
          await removeNotInterested(user.id, contentId)
        } catch (error) {
          console.error('관심없음 취소 실패:', error)
        }
      }
      setNotInterestedIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(contentId)
        return newSet
      })
      
      // 토스트 표시 (관심없음 취소)
      setToastMessage('restored')
      setShowNotInterestedToast(true)
      
      // 3초 후 토스트 숨김
      setTimeout(() => {
        setShowNotInterestedToast(false)
      }, 3000)
      return
    }

    // 관심없음으로 표시
    // 로그인한 사용자인 경우 데이터베이스에 저장
    if (user) {
      try {
        await addNotInterested(user.id, contentId)
      } catch (error) {
        console.error('관심없음 저장 실패:', error)
        // 에러가 발생해도 UI는 업데이트 (낙관적 업데이트)
      }
    }

    // 관심없음 목록에 추가 (콘텐츠는 제거하지 않음)
    setNotInterestedIds((prev) => new Set(prev).add(contentId))

    // 토스트 표시 (관심없음)
    setToastMessage('notInterested')
    setShowNotInterestedToast(true)
    
    // 3초 후 토스트 숨김
    setTimeout(() => {
      setShowNotInterestedToast(false)
    }, 3000)
  }

  // 공유 성공 핸들러
  const handleShareSuccess = () => {
    setShareToastMessage('imageSaved')
    setShowShareToast(true)
    setTimeout(() => {
      setShowShareToast(false)
    }, 3000)
  }

  // 공유 실패 핸들러
  const handleShareError = () => {
    setShareToastMessage('shareFailed')
    setShowShareToast(true)
    setTimeout(() => {
      setShowShareToast(false)
    }, 3000)
  }

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden overflow-x-hidden">
      {/* 관심없음 토스트 */}
      <NotInterestedToast isVisible={showNotInterestedToast} message={toastMessage} />
      {/* 공유 토스트 */}
      <NotInterestedToast isVisible={showShareToast} message={shareToastMessage} />
      
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div 
        className="h-full overflow-y-auto overflow-x-hidden bg-white relative"
        onClick={(e) => {
          const target = e.target as HTMLElement
          
          // 버튼이나 다른 인터랙티브 요소 클릭은 무시
          if (target.closest('button') || 
              target.closest('a') ||
              target.tagName === 'BUTTON' ||
              target.tagName === 'A') {
            return
          }
          
          // 카드 자체를 클릭한 경우는 무시 (카드의 handleCardClick에서 처리)
          if (target.closest('[data-card-container]')) {
            return
          }
          
          // Selection Info Card나 다른 요소 클릭은 무시
          if (target.closest('.bg-gray-50')) {
            return
          }
          
          // 터치 이벤트가 이미 처리된 경우 무시
          if (touchHandledRef.current) {
            return
          }
          
          // 화면의 좌우 절반을 나눠서 처리
          const containerRect = e.currentTarget.getBoundingClientRect()
          const clickX = e.clientX - containerRect.left
          const containerWidth = containerRect.width
          const isLeftClick = clickX < containerWidth / 2
          
          // 좌측 클릭: 이전 카드로 이동
          if (isLeftClick && currentIndex > 0) {
            e.stopPropagation()
            e.preventDefault()
            setCurrentIndex(currentIndex - 1)
            return
          }
          
          // 우측 클릭: 다음 카드로 이동
          if (!isLeftClick && currentIndex < recommendations.length - 1) {
            e.stopPropagation()
            e.preventDefault()
            setCurrentIndex(currentIndex + 1)
            return
          }
        }}
      >

      {/* Selection Info Card */}
      {(displayGenre || moodNames) && (
        <div className="w-80 py-4 left-1/2 -translate-x-1/2 top-[600px] absolute bg-gray-50 rounded-xl inline-flex flex-col justify-start items-center gap-4">
          {displayGenre && (
            <div className="w-72 inline-flex justify-between items-start">
              {/* [수정] 장르 텍스트 변수 사용 */}
              <div className="w-16 justify-start text-gray-600 text-sm font-medium font-pretendard tracking-tight">
                {t.genre}
              </div>
              <div className="text-right justify-start text-gray-900 text-sm font-medium font-pretendard tracking-tight">
                {displayGenre}
              </div>
            </div>
          )}
          {moodNames && (
            <div className="w-72 inline-flex justify-between items-center">
              {/* [수정] 무드 텍스트 변수 사용 */}
              <div className="w-16 text-left justify-start text-gray-600 text-sm font-medium font-pretendard tracking-tight">
                {t.mood}
              </div>
              <div className="text-right justify-start text-gray-900 text-sm font-medium font-pretendard tracking-tight">
                {moodNames}
              </div>
            </div>
          )}
        </div>
      )}



      {/* Recommendation Cards -> Slider Container */}
      {isLoading ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-600">
          {/* [수정] 로딩 텍스트 */}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-600">
          {/* [수정] 결과 없음 텍스트 */}
          {t.noContent}
        </div>
      ) : (
        // 카루셀 컨테이너 (반원 배치)
        <div 
          className="absolute top-[80px] w-full h-[600px] overflow-hidden z-10"
        >
          {/* 카드들을 반원으로 배치 */}
          <div className="relative w-full h-full">
            {recommendations.map((content, index) => {
              const distance = index - currentIndex
              // 반원의 각도 계산 (최대 ±45도)
              const angle = distance * 25 // 각 카드당 25도씩 회전
              // 반원의 반지름 (픽셀)
              const radius = 180
              // 원형 배치를 위한 x, y 오프셋
              const xOffset = Math.sin((angle * Math.PI) / 180) * radius
              const yOffset = (1 - Math.cos((angle * Math.PI) / 180)) * radius * 0.3
              
              const handleCardClick = (e: React.MouseEvent) => {
                // 터치 이벤트가 이미 처리된 경우 클릭 이벤트 무시 (중복 방지)
                if (touchHandledRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
                
                // 카드 내부 버튼 클릭은 무시 (좋아요 버튼 등)
                if ((e.target as HTMLElement).closest('button')) {
                  return
                }
                
                // 현재 활성화된 카드가 아닌 경우 무시
                if (index !== currentIndex) {
                  return
                }
                
                // 카드의 실제 위치 계산
                const cardElement = e.currentTarget as HTMLElement
                const rect = cardElement.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const cardWidth = rect.width
                const cardCenter = cardWidth / 2
                const clickOffset = Math.abs(clickX - cardCenter)
                const centerThreshold = cardWidth * 0.3 // 중앙 30% 영역
                
                // 중앙 부분을 클릭한 경우 상세 페이지로 이동
                if (clickOffset < centerThreshold) {
                  if (content.id) {
                    navigate(`/content/${content.id}`)
                  }
                  e.stopPropagation()
                  return
                }
                
                // 좌우 클릭으로 카드 이동 (현재 인덱스 기준)
                const isLeftClick = clickX < cardCenter
                
                if (isLeftClick && currentIndex > 0) {
                  // 좌측 클릭: 이전 카드로 이동
                  e.stopPropagation()
                  setCurrentIndex(currentIndex - 1)
                } else if (!isLeftClick && currentIndex < recommendations.length - 1) {
                  // 우측 클릭: 다음 카드로 이동
                  e.stopPropagation()
                  setCurrentIndex(currentIndex + 1)
                } else {
                  // 경계에 있는 경우 이벤트 전파 차단
                  e.stopPropagation()
                }
              }

              return (
                <div
                  key={content.id}
                  data-card-container
                  className="absolute left-1/2 top-0 origin-center transition-all duration-500 ease-out"
                  style={{
                    transform: `translateX(calc(-50% + ${xOffset}px)) translateY(${yOffset}px) rotate(${angle}deg)`,
                    zIndex: recommendations.length - Math.abs(distance),
                  }}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  onClick={(e) => {
                    // 카드 클릭은 이벤트 전파를 막아서 컨테이너의 클릭 이벤트가 발생하지 않도록
                    e.stopPropagation()
                  }}
                >
                  <RecommendationCard 
                    content={content}
                    isActive={index === currentIndex}
                    distance={distance}
                    onCardClick={handleCardClick}
                    onShareSuccess={handleShareSuccess}
                    onShareError={handleShareError}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 인디케이터 도트 - 카드 아래, 버튼들 위에 배치 */}
      {recommendations.length > 1 && (
        <div className="absolute top-[508px] left-1/2 -translate-x-1/2 z-30 flex gap-2 pointer-events-none">
          {recommendations.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`pointer-events-auto transition-all ${
                index === currentIndex 
                  ? 'w-2 h-2 bg-[#2e2c6a] rounded-full' 
                  : 'w-2 h-2 bg-[#2e2c6a]/40 rounded-full hover:bg-[#2e2c6a]/60'
              }`}
              aria-label={`Go to recommendation ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* 다시하기, 리로드, 관심없음 버튼들 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[540px] flex items-center justify-center gap-4 z-30">
        {/* 다시하기 버튼 */}
        <button
          onClick={handleRestart}
          className="px-4 py-2 bg-[#2e2c6a] text-white text-sm font-semibold rounded-lg hover:bg-[#3a3878] transition-colors whitespace-nowrap"
        >
          {/* [수정] 다시하기 텍스트 */}
          {t.restart}
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

        {/* 관심없음 버튼 */}
        {recommendations.length > 0 && recommendations[currentIndex] && (
          <button
            type="button"
            aria-label="not-interested"
            className="size-8 flex items-center justify-center rounded-full bg-white/0"
            onClick={() => {
              const currentContent = recommendations[currentIndex]
              if (currentContent?.id) {
                handleNotInterested(currentContent.id)
              }
            }}
          >
            <img
              src={notInterestedIds.has(recommendations[currentIndex]?.id || '') ? RecommendInactive : RecommendActive}
              alt={notInterestedIds.has(recommendations[currentIndex]?.id || '') ? t.notInterestedCancel : t.notInterested}
              className="w-[28px] h-[28px]"
            />
          </button>
        )}
      </div>
      </div>

      {/* [추가] 유니버스 진입 버튼 (우측 하단 플로팅) */}
      {/* Selection Info Card가 있을 때는 더 위로 배치하여 겹침 방지 */}
      <button
        onClick={() => navigate('/universe')}
        className={`fixed right-5 z-40 w-14 h-14 rounded-full backdrop-blur-md bg-[#2e2c6a]/90 shadow-[0_8px_32px_0_rgba(46,44,106,0.3),inset_0px_0px_4px_0px_rgba(255,255,255,0.1)] border border-white/10 flex items-center justify-center text-white hover:bg-[#3a3878]/90 hover:scale-105 transition-all active:scale-95 ${
          (displayGenre || moodNames) ? 'bottom-36' : 'bottom-20'
        }`}
        aria-label="Go to Universe"
      >
        {/* 별/우주 아이콘 */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
          />
        </svg>
      </button>

      {/* Absolute 하단 네비게이션 (오버레이) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  )
}

