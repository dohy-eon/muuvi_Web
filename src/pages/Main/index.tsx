import { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { onboardingDataState } from '../../recoil/userState'
import { getProfile, saveProfile } from '../../lib/supabase/profile'
import { getRecommendations } from '../../lib/supabase/recommendations'
import RecommendationLoading from '../../components/RecommendationLoading'
import RecommendationCard from '../../components/RecommendationCard'
import BottomNavigation from '../../components/BottomNavigation'
import type { Content, Profile } from '../../types'

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
  const [recommendations, setRecommendations] = useState<Content[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const onboardingData = useRecoilValue(onboardingDataState)

  useEffect(() => {
    const loadRecommendations = async () => {
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
          // 추천 콘텐츠 가져오기
          const contents = await getRecommendations(profile)
          setRecommendations(contents)
        }
      } catch (error) {
        console.error('추천 콘텐츠 로드 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecommendations()
  }, [onboardingData])

  if (isLoading) {
    return <RecommendationLoading profile={profile} onboardingData={onboardingData} />
  }

  // 프로필이 있으면 프로필 사용, 없으면 온보딩 데이터 사용
  const displayGenre = profile?.genre || onboardingData?.genre
  const displayMoods = profile?.moods || onboardingData?.moods || []
  
  const moodNames = displayMoods
    .map((id) => moodIdToKorean[id] || id)
    .join(', ')

  const currentTime = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

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

      {/* Loading Indicators */}
      <div className="size-8 left-[148px] top-[548px] absolute overflow-hidden">
        <div className="size-7 left-[2px] top-[2px] absolute bg-primary-900"></div>
      </div>
      <div className="size-8 left-[196px] top-[548px] absolute overflow-hidden">
        <div className="size-7 left-[2px] top-[2px] absolute border-[3px] border-primary-900"></div>
        <div className="size-5 left-[6.50px] top-[7px] absolute outline outline-[3px] outline-offset-[-1.50px] outline-primary-900"></div>
      </div>

      {/* Recommendation Cards */}
      {recommendations.length === 0 ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-600">
          추천 콘텐츠가 없습니다.
        </div>
      ) : (
        recommendations.slice(0, 2).map((content, index) => (
          <RecommendationCard key={content.id} content={content} index={index} />
        ))
      )}
    </div>
  )
}
