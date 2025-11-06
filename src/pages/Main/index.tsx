import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { onboardingDataState } from '../../recoil/userState'
import { getProfile, saveProfile } from '../../lib/supabase/profile'
import { getRecommendations } from '../../lib/supabase/recommendations'
import RecommendationLoading from '../../components/RecommendationLoading'
import RecommendationCard from '../../components/RecommendationCard'
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
  const setOnboardingData = useSetRecoilState(onboardingDataState)
  const [recommendations, setRecommendations] = useState<Content[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const onboardingData = useRecoilValue(onboardingDataState)
  const [reloadKey, setReloadKey] = useState(0)
  const [recommendEnabled, setRecommendEnabled] = useState(true)

  // 온보딩으로 이동하는 함수
  const handleRestart = async () => {
    // 기존 추천 내역 초기화
    setRecommendations([])
    setIsLoading(true)
    
    // 프로필이 있으면 강제로 새로 추천 받기 (기존 내역 무시)
    if (profile) {
      try {
        const contents = await getRecommendations(profile, true) // forceRefresh = true
        setRecommendations(contents)
        setIsLoading(false)
      } catch (error) {
        console.error('새 추천 가져오기 실패:', error)
      }
    }
    
    // 온보딩 데이터 초기화
    setOnboardingData(null)
    // 프로필 초기화 (온보딩으로 돌아가기 위해)
    setProfile(null)
    // 온보딩 페이지로 이동
    navigate('/onboarding')
  }

  const loadRecommendations = useCallback(async (forceRefresh: boolean = false) => {
      try {
        // 임시 user_id (실제로는 인증된 사용자 ID 사용)
        const userId = 'temp-user-id'

        // 프로필 가져오기 또는 생성
        let profile = await getProfile(userId)
        
        if (!profile && onboardingData) {
          // 프로필이 없으면 온보딩 데이터로 생성
          profile = await saveProfile(userId, onboardingData)
        }

        if (profile) {
          // 프로필 저장
          setProfile(profile)
          // 추천 콘텐츠 가져오기 (forceRefresh가 true이면 기존 내역 무시하고 새로 가져오기)
          const contents = await getRecommendations(profile, forceRefresh)
          setRecommendations(contents)
        }
      } catch (error) {
        console.error('추천 콘텐츠 로드 실패:', error)
      } finally {
        setIsLoading(false)
      }
  }, [onboardingData])

  useEffect(() => {
    setIsLoading(true)
    loadRecommendations()
  }, [loadRecommendations, reloadKey])

  if (isLoading) {
    return <RecommendationLoading profile={profile} onboardingData={onboardingData} />
  }

  // 프로필이 있으면 프로필 사용, 없으면 온보딩 데이터 사용
  const displayGenre = profile?.genre || onboardingData?.genre
  const displayMoods = profile?.moods || onboardingData?.moods || []
  
  const moodNames = displayMoods
    .map((id) => moodIdToKorean[id] || id)
    .join(', ')

  

  return (
    <div className="w-full h-[812px] relative bg-white overflow-hidden font-pretendard">

      {/* Bottom Navigation */}
      <BottomNavigation />

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
          onClick={() => setReloadKey((k) => k + 1)}
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

      {/* Recommendation Cards */}
      {recommendations.length === 0 ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-600">
          추천 콘텐츠가 없습니다.
        </div>
      ) : (
        recommendations.slice(0, 2).map((content, index) => (
          <RecommendationCard 
            key={content.id} 
            content={content} 
            index={index} 
            selectedMoods={displayMoods}
          />
        ))
      )}
    </div>
  )
}
