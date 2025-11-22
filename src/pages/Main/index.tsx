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

// [추가] 언어별 무드 이름 매핑
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

// [추가] 장르 번역 맵 (한국어 -> 영어)
const GENRE_TRANSLATION: Record<string, { ko: string; en: string }> = {
  '영화': { ko: '영화', en: 'Movie' },
  '드라마': { ko: '드라마', en: 'Drama' },
  '애니메이션': { ko: '애니메이션', en: 'Animation' },
  '예능': { ko: '예능', en: 'Variety Show' },
}

// [추가] UI 텍스트 다국어 정의
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

  // [수정] recommendations.length를 의존성에서 제거하여 무한 루프 방지
  // 대신 함수 내부에서 현재 상태를 체크하도록 변경
  const loadRecommendations = useCallback(async (forceRefresh: boolean = false) => {
      try {
        // 실제 user_id 사용 (로그인한 사용자는 user.id, 비로그인은 temp-user-id)
        const userId = user?.id || 'temp-user-id'

        // 프로필 가져오기 또는 생성
        let profile = await getProfile(userId)

        // [수정] 온보딩 데이터가 있으면 항상 업데이트 (forceRefresh가 아니어도)
        // 온보딩에서 새로 선택한 데이터가 기존 프로필을 덮어써야 함
        // 사용 후에는 클리어하여 다음 로드 시 세션 삭제를 방지
        if (onboardingData) {
          const updatedProfile = await saveProfile(userId, onboardingData)
          profile = updatedProfile ?? profile
          // 온보딩 데이터 사용 후 클리어 (한 번만 사용되도록)
          setOnboardingData(null)
          console.log('[온보딩 데이터 처리 완료 및 클리어]')
        }

        // 로그인한 사용자의 경우 최신 프로필 정보 다시 가져오기 (subscribed_otts 포함)
        // 단, 온보딩 데이터가 있으면 이미 업데이트했으므로 다시 가져올 필요 없음
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
          
          // 디버깅: 프로필 정보 전체 확인 (장르, 무드, 구독 정보)
          console.log('[프로필 로드]', {
            userId,
            genre: profile.genre,
            moods: profile.moods,
            moodNames: profile.moods.map(id => MOOD_TABLE.ko[id as keyof typeof MOOD_TABLE.ko] || id),
            hasSubscribedOtts: !!profile.subscribed_otts,
            subscribedOtts: profile.subscribed_otts,
            onboardingData: onboardingData ? { genre: onboardingData.genre, moods: onboardingData.moods } : null,
          })
          
          // 관심없음 콘텐츠 ID 목록 가져오기 (로그인한 사용자인 경우)
          let notInterestedIdsFromDb: string[] = []
          if (user) {
            try {
              notInterestedIdsFromDb = await getNotInterestedContentIds(user.id)
              // 초기 로드 시 관심없음 상태 반영
              setNotInterestedIds(new Set(notInterestedIdsFromDb))
            } catch (error) {
              console.error('관심없음 목록 조회 실패:', error)
            }
          }
          
          // 추천 콘텐츠 가져오기 (최대 10개 반환되므로 한 번 호출로 충분)
          let contents = await getRecommendations(profile, forceRefresh)
          
          // 관심없음 콘텐츠 필터링
          contents = contents.filter((content) => !notInterestedIdsFromDb.includes(content.id))
          
          // 최대 3개만 사용
          contents = contents.slice(0, 3)
          
          setRecommendations(contents)
          // sessionStorage에 저장 (페이지 이동 후에도 유지)
          saveRecommendationsToStorage(contents)
          // 추천 로드 시 인덱스 초기화
          setCurrentIndex(0)
        }
      } catch (error) {
        console.error('추천 콘텐츠 로드 실패:', error)
      } finally {
        // 로딩 완료 처리 (항상 실행)
        setIsLoading(false)
        setShowLoadingScreen(false)
        setShowSimpleLoading(false)
      }
  }, [onboardingData, user]) // [수정] recommendations.length 제거

  const handleRerecommend = () => {
    void loadRecommendations(true)
  }

  useEffect(() => {
    const currentPath = location.pathname
    const prevPath = sessionStorage.getItem('prevPath') || prevPathRef.current
    
    // [리팩토링] 네비게이션 바 경로 목록
    const navigationBarPaths = ['/main', '/mypage', '/search']
    const isNavigationBarNavigation = 
      prevPath && 
      navigationBarPaths.includes(prevPath) && 
      navigationBarPaths.includes(currentPath) && 
      prevPath !== currentPath
    
    console.log('[Main useEffect]', { 
      currentPath, 
      prevPath, 
      isNavigationBarNavigation,
      hasRecommendations: recommendations.length > 0,
      hasProfile: !!profile,
      hasOnboardingData: !!onboardingData
    })
    
    // [리팩토링] 1. 네비게이션 바 이동 감지 및 처리
    if (isNavigationBarNavigation) {
      console.log('[네비게이션 바 이동] 감지됨 - 세션 데이터 복원 시도')
      
      try {
        // 세션에서 추천 데이터 복원
        const storedRecommendations = sessionStorage.getItem('mainRecommendations')
        const storedProfile = loadProfileFromStorage()
        
        if (storedRecommendations) {
          const parsed = JSON.parse(storedRecommendations) as Content[]
          if (parsed && parsed.length > 0) {
            console.log('[네비게이션 바 이동] 세션 데이터 복원 성공:', parsed.length, '개')
            
            // 추천 데이터 복원
            setRecommendations(parsed)
            
            // 프로필 데이터 복원 (없을 때만)
            if (storedProfile) {
              setProfile(prev => prev || storedProfile)
            }
            
            // 로딩 상태 해제
            setIsLoading(false)
            setShowSimpleLoading(false)
            setShowLoadingScreen(false)
            
            // 경로 업데이트
            prevPathRef.current = currentPath
            sessionStorage.setItem('prevPath', currentPath)
            return // 네비게이션 바 이동 시 절대 새로 로드하지 않음
          }
        }
      } catch (error) {
        console.error('[네비게이션 바 이동] 세션 데이터 복원 실패:', error)
      }
      
      // 세션 데이터가 없어도 기존 데이터 유지 (로드하지 않음)
      console.log('[네비게이션 바 이동] 세션 데이터 없음, 기존 데이터 유지')
      setIsLoading(false)
      setShowSimpleLoading(false)
      setShowLoadingScreen(false)
      prevPathRef.current = currentPath
      sessionStorage.setItem('prevPath', currentPath)
      return // 네비게이션 바 이동 시 절대 새로 로드하지 않음
    }
    
    // [리팩토링] 2. 온보딩 데이터 처리 (새로운 추천이 필요한 경우)
    if (onboardingData) {
      console.log('[온보딩 데이터 처리] 세션 초기화 및 새로 로드')
      sessionStorage.removeItem('mainRecommendations')
      sessionStorage.removeItem('mainProfile')
      setRecommendations([])
      // 프로필은 loadRecommendations에서 업데이트됨
    }
    
    // [리팩토링] 3. 기존 데이터가 있으면 유지 (온보딩이 아닐 때)
    if (recommendations.length > 0 && !onboardingData) {
      console.log('[데이터 유지] 기존 추천 데이터 사용:', recommendations.length, '개')
      
      // 프로필이 없으면 세션에서 복원 시도
      if (!profile) {
        const storedProfile = loadProfileFromStorage()
        if (storedProfile) {
          console.log('[프로필 복원] 세션에서 프로필 복원')
          setProfile(storedProfile)
        }
      }
      
      // 로딩 상태 해제
      setIsLoading(false)
      setShowSimpleLoading(false)
      setShowLoadingScreen(false)
      
      // 경로 업데이트
      prevPathRef.current = currentPath
      sessionStorage.setItem('prevPath', currentPath)
      return
    }
    
    // [리팩토링] 4. 세션 데이터 복원 시도 (데이터가 없을 때)
    if (recommendations.length === 0 && !onboardingData) {
      try {
        const storedRecommendations = sessionStorage.getItem('mainRecommendations')
        const storedProfile = loadProfileFromStorage()
        
        if (storedRecommendations) {
          const parsed = JSON.parse(storedRecommendations) as Content[]
          if (parsed && parsed.length > 0) {
            console.log('[세션 데이터 복원] 성공:', parsed.length, '개')
            
            // 추천 데이터 복원
            setRecommendations(parsed)
            
            // 프로필 데이터 복원
            if (storedProfile) {
              setProfile(storedProfile)
            }
            
            // 로딩 상태 해제
            setIsLoading(false)
            setShowSimpleLoading(false)
            setShowLoadingScreen(false)
            
            // 경로 업데이트
            prevPathRef.current = currentPath
            sessionStorage.setItem('prevPath', currentPath)
            return // 복원 성공 시 로드 스킵
          }
        }
      } catch (error) {
        console.error('[세션 데이터 복원] 실패:', error)
      }
    }
    
    // [리팩토링] 5. 로딩 화면 표시 및 데이터 로드
    if (prevPath?.includes('/onboarding')) {
      setShowLoadingScreen(true)
      setIsLoading(true)
      setShowSimpleLoading(false)
    } else {
      setShowSimpleLoading(false)
      setShowLoadingScreen(false)
      setIsLoading(false)
    }
    
    // 경로 업데이트
    prevPathRef.current = currentPath
    sessionStorage.setItem('prevPath', currentPath)
    
    // 데이터 로드 시작
    console.log('[데이터 로드 시작]', { currentPath, prevPath, onboardingData: !!onboardingData })
    void loadRecommendations()
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

  // [수정] 현재 언어에 맞는 장르 이름 표시
  const displayGenre = genreValue
    ? (GENRE_TRANSLATION[genreValue]?.[language] || genreValue)
    : null

  // [수정] 현재 언어에 맞는 무드 이름 표시
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

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden overflow-x-hidden">
      {/* 관심없음 토스트 */}
      <NotInterestedToast isVisible={showNotInterestedToast} message={toastMessage} />
      
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
              // [수정] 관심없음 텍스트
              alt={notInterestedIds.has(recommendations[currentIndex]?.id || '') ? t.notInterestedCancel : t.notInterested}
              className="w-[28px] h-[28px]"
            />
          </button>
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

