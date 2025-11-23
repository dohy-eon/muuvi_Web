import { useRecoilValue } from 'recoil'
import { languageState } from '../recoil/userState'
import type { Profile, OnboardingData } from '../types'
import MLogo from '../assets/M.svg'

// 무드 ID를 언어별 이름으로 매핑
const moodIdToName: Record<string, { ko: string; en: string }> = {
  '01': { ko: '로맨스', en: 'Romance' },
  '02': { ko: '호러', en: 'Horror' },
  '03': { ko: '코미디', en: 'Comedy' },
  '04': { ko: '공상 과학', en: 'Sci-Fi' },
  '05': { ko: '판타지', en: 'Fantasy' },
  '06': { ko: '어드벤처', en: 'Adventure' },
  '07': { ko: '액션', en: 'Action' },
  '08': { ko: '힐링', en: 'Healing' },
  '09': { ko: '미스테리', en: 'Mystery' },
}

// UI 텍스트 번역
const LOADING_TEXT = {
  ko: {
    title: '마음에 쏙 드는',
    subtitle: '추천을',
    subtitle2: '준비 중이야 💭',
    genre: '장르',
    mood: '무드',
  },
  en: {
    title: 'Preparing',
    subtitle: 'personalized',
    subtitle2: 'recommendations for you 💭',
    genre: 'Genre',
    mood: 'Mood',
  },
}

interface RecommendationLoadingProps {
  profile?: Profile | null
  onboardingData?: OnboardingData | null
}

export default function RecommendationLoading({
  profile,
  onboardingData,
}: RecommendationLoadingProps) {
  const language = useRecoilValue(languageState)
  const t = LOADING_TEXT[language]

  // 프로필이 있으면 프로필 사용, 없으면 온보딩 데이터 사용
  const displayGenre = profile?.genre || onboardingData?.genre
  const displayMoods = profile?.moods || onboardingData?.moods || []
  
  const moodNames = displayMoods
    .map((id) => moodIdToName[id]?.[language] || id)
    .join(', ')

  return (
    <div className="w-full h-screen relative bg-white overflow-hidden font-pretendard">
      {/* Title Text and Logo Container */}
      <div className="absolute top-[299px] left-[32px] right-[32px] flex items-start gap-4">
        {/* Title Text */}
        <div className="text-black text-xl sm:text-2xl font-semibold font-['Pretendard'] leading-tight">
          {t.title}
          <br />
          {t.subtitle}
          <br />
          {t.subtitle2}
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
                {t.genre}
              </div>
              <div className="text-right justify-start text-gray-900 text-sm font-medium font-['Pretendard'] tracking-tight">
                {displayGenre}
              </div>
            </div>
          )}
          {moodNames && (
            <div className="w-72 inline-flex justify-between items-center">
              <div className="text-center justify-start text-gray-600 text-sm font-medium font-['Pretendard'] tracking-tight">
                {t.mood}
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

