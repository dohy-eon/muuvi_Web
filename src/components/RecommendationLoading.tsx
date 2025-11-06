import type { Profile, OnboardingData } from '../types'
import MLogo from '../assets/M.svg'

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

interface RecommendationLoadingProps {
  profile?: Profile | null
  onboardingData?: OnboardingData | null
}

export default function RecommendationLoading({
  profile,
  onboardingData,
}: RecommendationLoadingProps) {
  

  // 프로필이 있으면 프로필 사용, 없으면 온보딩 데이터 사용
  const displayGenre = profile?.genre || onboardingData?.genre
  const displayMoods = profile?.moods || onboardingData?.moods || []
  
  const moodNames = displayMoods
    .map((id) => moodIdToKorean[id] || id)
    .join(', ')

  return (
    <div className="w-full h-screen relative bg-white overflow-hidden font-pretendard">
      {/* Title Text and Logo Container */}
      <div className="absolute top-[299px] left-[32px] right-[32px] flex items-start gap-4">
        {/* Title Text */}
        <div className="text-black text-xl sm:text-2xl font-semibold font-['Pretendard'] leading-tight">
          마음에 쏙 드는
          <br />
          추천을
          <br />
          준비 중이야 💭
        </div>
        
        {/* Loading Animation - M Logo */}
        <div className="flex-shrink-0">
          <img 
            src={MLogo} 
            alt="Loading" 
            className="w-[154px] h-[119px]"
            style={{
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Selection Info Card */}
      {(displayGenre || moodNames) && (
        <div className="w-80 py-4 left-1/2 -translate-x-1/2 top-[441px] absolute bg-gray-50 rounded-xl inline-flex flex-col justify-start items-center gap-4">
          {displayGenre && (
            <div className="w-72 inline-flex justify-between items-start">
              <div className="w-6 justify-start text-gray-600 text-sm font-medium font-['Pretendard'] tracking-tight">
                장르
              </div>
              <div className="text-right justify-start text-gray-900 text-sm font-medium font-['Pretendard'] tracking-tight">
                {displayGenre}
              </div>
            </div>
          )}
          {moodNames && (
            <div className="w-72 inline-flex justify-between items-center">
              <div className="text-center justify-start text-gray-600 text-sm font-medium font-['Pretendard'] tracking-tight">
                무드
              </div>
              <div className="text-center justify-start text-gray-900 text-sm font-medium font-['Pretendard'] tracking-tight">
                {moodNames}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

