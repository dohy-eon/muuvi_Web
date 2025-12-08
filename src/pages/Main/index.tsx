import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { onboardingDataState, languageState } from '../../recoil/userState'
import { getProfile, saveProfile } from '../../lib/supabase/profile'
import { getRecommendations } from '../../lib/supabase/recommendations'
import { addNotInterested, getNotInterestedContentIds, removeNotInterested } from '../../lib/supabase/notInterested'
import { userState } from '../../recoil/userState'
import RecommendationLoading from '../../components/RecommendationLoading'
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

// 이미지 프리로드 함수
const preloadImages = (contents: Content[]) => {
  contents.forEach((content) => {
    if (content.poster_url) {
      const img = new Image()
      img.src = content.poster_url
    }
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

export default function Main() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const setOnboardingData = useSetRecoilState(onboardingDataState)
  const user = useRecoilValue(userState)
  const onboardingData = useRecoilValue(onboardingDataState)
  const language = useRecoilValue(languageState)
  const t = UI_TEXT[language]
  const moodMap = MOOD_TABLE[language]

  const userId = user?.id || 'temp-user-id'
  const prevPathRef = useRef<string | null>(null)
  const touchHandledRef = useRef(false)

  // UI 상태
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showNotInterestedToast, setShowNotInterestedToast] = useState(false)
  const [toastMessage, setToastMessage] = useState<'notInterested' | 'restored'>('notInterested')
  const [showShareToast, setShowShareToast] = useState(false)
  const [shareToastMessage, setShareToastMessage] = useState<'imageSaved' | 'shareFailed'>('imageSaved')
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [forceRefresh, setForceRefresh] = useState(false)

  // sessionStorage 헬퍼 함수들
  const saveRecommendationsToStorage = (contents: Content[]) => {
    try {
      sessionStorage.setItem('mainRecommendations', JSON.stringify(contents))
    } catch (error) {
      console.error('추천 데이터 저장 실패:', error)
    }
  }

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

  // 프로필 저장 Mutation
  const saveProfileMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: typeof onboardingData }) => {
      if (!data) throw new Error('온보딩 데이터가 없습니다.')
      return saveProfile(userId, data)
    },
    onSuccess: (profile) => {
      if (profile) {
        // 프로필 쿼리 캐시 무효화하여 다시 가져오기
        queryClient.invalidateQueries({ queryKey: ['profile', userId] })
        saveProfileToStorage(profile)
        setOnboardingData(null)
      }
    },
  })

  // 프로필 가져오기 Query
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      let profile = await getProfile(userId)

      // 로그인한 사용자이고 온보딩 데이터가 없으면 최신 프로필 가져오기
      if (user && profile && !onboardingData) {
        const latestProfile = await getProfile(user.id)
        if (latestProfile) {
          profile = latestProfile
        }
      }

      if (profile) {
        saveProfileToStorage(profile)
      }

      return profile
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 메모리 유지
  })

  // 온보딩 데이터가 있으면 프로필 저장
  useEffect(() => {
    if (onboardingData && userId) {
      saveProfileMutation.mutate({ userId, data: onboardingData })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingData, userId])

  // 관심없음 목록 가져오기 Query
  const { data: notInterestedIdsFromDb = [] } = useQuery({
    queryKey: ['notInterested', user?.id],
    queryFn: () => getNotInterestedContentIds(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
  })

  const notInterestedIds = new Set(notInterestedIdsFromDb)

  // 추천 데이터 가져오기 Query
  const {
    data: recommendationsData,
    isLoading: isRecommendationsLoading,
    isError: isRecommendationsError,
    refetch: refetchRecommendations,
  } = useQuery({
    queryKey: ['recommendations', userId, profile?.id, forceRefresh],
    queryFn: async () => {
      if (!profile) return []

      const contents = await getRecommendations(profile, forceRefresh)
      const filteredContents = contents.filter((content) => !notInterestedIds.has(content.id))
      const finalContents = filteredContents.slice(0, 3)

      preloadImages(finalContents)
      saveRecommendationsToStorage(finalContents)

      return finalContents
    },
    enabled: !!profile && !isProfileLoading,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 메모리 유지
  })

  const recommendations = recommendationsData || []

  // 관심없음 추가 Mutation
  const addNotInterestedMutation = useMutation({
    mutationFn: (contentId: string) => {
      if (!user) throw new Error('로그인이 필요합니다.')
      return addNotInterested(user.id, contentId)
    },
    onSuccess: () => {
      // 관심없음 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['notInterested', user?.id] })
      // 추천 데이터 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['recommendations', userId] })
    },
  })

  // 관심없음 제거 Mutation
  const removeNotInterestedMutation = useMutation({
    mutationFn: (contentId: string) => {
      if (!user) throw new Error('로그인이 필요합니다.')
      return removeNotInterested(user.id, contentId)
    },
    onSuccess: () => {
      // 관심없음 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['notInterested', user?.id] })
      // 추천 데이터 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['recommendations', userId] })
    },
  })

  // 로딩 상태 계산
  const isLoading = isProfileLoading || isRecommendationsLoading
  const isError = isProfileError || isRecommendationsError

  // 경로 변경 감지 및 sessionStorage 복원 로직
  useEffect(() => {
    const currentPath = location.pathname
    const prevPath = sessionStorage.getItem('prevPath') || prevPathRef.current

    const shouldShowLoadingScreen = onboardingData || prevPath?.includes('/onboarding')
    const navigationBarPaths = ['/main', '/mypage', '/search']
    const isNavigationBarNavigation =
      prevPath &&
      navigationBarPaths.includes(prevPath) &&
      navigationBarPaths.includes(currentPath) &&
      prevPath !== currentPath

    // 네비게이션 바 이동 시 sessionStorage에서 복원
    if (isNavigationBarNavigation && !shouldShowLoadingScreen) {
      try {
        const storedRecommendations = sessionStorage.getItem('mainRecommendations')
        const storedProfile = loadProfileFromStorage()

        if (storedRecommendations) {
          const parsed = JSON.parse(storedRecommendations) as Content[]
          if (parsed && parsed.length > 0) {
            // React Query 캐시에 직접 설정
            queryClient.setQueryData(['recommendations', userId, storedProfile?.id, false], parsed)
            if (storedProfile) {
              queryClient.setQueryData(['profile', userId], storedProfile)
            }
            setCurrentIndex(0)
          }
        }
      } catch (error) {
        console.error('[네비게이션 바 이동] 세션 데이터 복원 실패:', error)
      }
    }

    prevPathRef.current = currentPath
    sessionStorage.setItem('prevPath', currentPath)
  }, [location.pathname, userId, queryClient, onboardingData])

  // recommendations가 업데이트되면 currentIndex 리셋
  useEffect(() => {
    if (recommendations.length > 0) {
      setCurrentIndex(0)
    }
  }, [recommendations.length])

  // 온보딩으로 이동하는 함수
  const handleRestart = () => {
    queryClient.removeQueries({ queryKey: ['recommendations', userId] })
    queryClient.removeQueries({ queryKey: ['profile', userId] })
    sessionStorage.removeItem('mainRecommendations')
    sessionStorage.removeItem('mainProfile')
    setOnboardingData(null)
    setCurrentIndex(0)
    navigate('/onboarding')
  }

  // 다시 추천하기
  const handleRerecommend = () => {
    setForceRefresh((prev) => !prev)
    refetchRecommendations()
  }

  // 관심없음 핸들러
  const handleNotInterested = async (contentId: string) => {
    if (notInterestedIds.has(contentId)) {
      // 관심없음 취소
      if (user) {
        try {
          await removeNotInterestedMutation.mutateAsync(contentId)
        } catch (error) {
          console.error('관심없음 취소 실패:', error)
        }
      }
      setToastMessage('restored')
      setShowNotInterestedToast(true)
      setTimeout(() => {
        setShowNotInterestedToast(false)
      }, 3000)
      return
    }

    // 관심없음으로 표시
    if (user) {
      try {
        await addNotInterestedMutation.mutateAsync(contentId)
      } catch (error) {
        console.error('관심없음 저장 실패:', error)
      }
    }

    setToastMessage('notInterested')
    setShowNotInterestedToast(true)
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

  // 로딩 화면 표시 (온보딩에서 넘어올 때)
  const shouldShowLoadingScreen = onboardingData || location.state?.fromOnboarding
  if (isLoading && shouldShowLoadingScreen) {
    return <RecommendationLoading profile={profile || undefined} onboardingData={onboardingData || undefined} />
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

  // 스와이프 제스처 핸들러
  const minSwipeDistance = 50

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

    setTouchStart(null)
    setTouchEnd(null)

    setTimeout(() => {
      touchHandledRef.current = false
    }, 300)
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

          if (
            target.closest('button') ||
            target.closest('a') ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'A'
          ) {
            return
          }

          if (target.closest('[data-card-container]')) {
            return
          }

          if (target.closest('.bg-gray-50')) {
            return
          }

          if (touchHandledRef.current) {
            return
          }

          const containerRect = e.currentTarget.getBoundingClientRect()
          const clickX = e.clientX - containerRect.left
          const containerWidth = containerRect.width
          const isLeftClick = clickX < containerWidth / 2

          if (isLeftClick && currentIndex > 0) {
            e.stopPropagation()
            e.preventDefault()
            setCurrentIndex(currentIndex - 1)
            return
          }

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
            {t.loading}
          </div>
        ) : isError || recommendations.length === 0 ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-600">
            {t.noContent}
          </div>
        ) : (
          <div className="absolute top-[80px] w-full h-[600px] overflow-hidden z-10">
            <div className="relative w-full h-full">
              {recommendations.map((content, index) => {
                const distance = index - currentIndex
                const angle = distance * 25
                const radius = 180
                const xOffset = Math.sin((angle * Math.PI) / 180) * radius
                const yOffset = (1 - Math.cos((angle * Math.PI) / 180)) * radius * 0.3

                const handleCardClick = (e: React.MouseEvent) => {
                  if (touchHandledRef.current) {
                    e.preventDefault()
                    e.stopPropagation()
                    return
                  }

                  if ((e.target as HTMLElement).closest('button')) {
                    return
                  }

                  if (index !== currentIndex) {
                    return
                  }

                  const cardElement = e.currentTarget as HTMLElement
                  const rect = cardElement.getBoundingClientRect()
                  const clickX = e.clientX - rect.left
                  const cardWidth = rect.width
                  const cardCenter = cardWidth / 2
                  const clickOffset = Math.abs(clickX - cardCenter)
                  const centerThreshold = cardWidth * 0.3

                  if (clickOffset < centerThreshold) {
                    if (content.id) {
                      navigate(`/content/${content.id}`)
                    }
                    e.stopPropagation()
                    return
                  }

                  const isLeftClick = clickX < cardCenter

                  if (isLeftClick && currentIndex > 0) {
                    e.stopPropagation()
                    setCurrentIndex(currentIndex - 1)
                  } else if (!isLeftClick && currentIndex < recommendations.length - 1) {
                    e.stopPropagation()
                    setCurrentIndex(currentIndex + 1)
                  } else {
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

        {/* 인디케이터 도트 */}
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
          <button
            onClick={handleRestart}
            className="px-4 py-2 bg-[#2e2c6a] text-white text-sm font-semibold rounded-lg hover:bg-[#3a3878] transition-colors whitespace-nowrap"
          >
            {t.restart}
          </button>

          <button
            type="button"
            aria-label="reload-recommendations"
            className="size-8 flex items-center justify-center rounded-full bg-white/0"
            onClick={handleRerecommend}
          >
            <img src={Reload} alt="reload" className="w-[28px] h-[28px]" />
          </button>

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

      {/* 유니버스 진입 버튼 */}
      <button
        onClick={() => navigate('/universe')}
        className={`fixed right-5 z-40 w-14 h-14 rounded-full backdrop-blur-md bg-[#2e2c6a]/90 shadow-[0_8px_32px_0_rgba(46,44,106,0.3),inset_0px_0px_4px_0px_rgba(255,255,255,0.1)] border border-white/10 flex items-center justify-center text-white hover:bg-[#3a3878]/90 hover:scale-105 transition-all active:scale-95 ${
          (displayGenre || moodNames) ? 'bottom-36' : 'bottom-20'
        }`}
        aria-label="Go to Universe"
      >
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

      {/* 하단 네비게이션 */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  )
}
