import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { onboardingDataState } from '../../recoil/userState'
import { saveProfile } from '../../lib/supabase/profile'
import CheckIcon from './check.svg'

interface Genre {
  id: string
  number: string
  english: string
  korean: string
  gradient: string
}

const genres: Genre[] = [
  {
    id: '01',
    number: '01',
    english: 'Romance',
    korean: '로맨스',
    gradient: 'from-red-100 via-orange-100 to-pink-200',
  },
  {
    id: '02',
    number: '02',
    english: 'Horror',
    korean: '호러',
    gradient: 'from-gray-900 via-gray-500 to-red-500',
  },
  {
    id: '03',
    number: '03',
    english: 'Comedy',
    korean: '코미디',
    gradient: 'from-amber-300 via-amber-100 to-amber-300',
  },
  {
    id: '04',
    number: '04',
    english: 'SF',
    korean: '공상 과학',
    gradient: 'from-gray-900 via-slate-800 to-cyan-900',
  },
  {
    id: '05',
    number: '05',
    english: 'Fantasy',
    korean: '판타지',
    gradient: 'from-fuchsia-950 via-purple-500 to-violet-200',
  },
  {
    id: '06',
    number: '06',
    english: 'Adventure',
    korean: '어드벤처',
    gradient: 'from-orange-300 via-red-400 to-yellow-300',
  },
  {
    id: '07',
    number: '07',
    english: 'Action',
    korean: '액션',
    gradient: 'from-stone-900 via-stone-600 to-red-600',
  },
  {
    id: '08',
    number: '08',
    english: 'Healing',
    korean: '힐링',
    gradient: 'from-gray-300 via-lime-100 to-green-300',
  },
  {
    id: '09',
    number: '09',
    english: 'Mystery',
    korean: '미스테리',
    gradient: 'from-slate-800 via-gray-400 to-gray-500',
  },
]

/**
 * 특정 장르와 호환되지 않는 무드 ID 맵
 * (현재는 사용하지 않음 - 드라마, 예능 장르 제거됨)
 */
const GENRE_INCOMPATIBLE_MOODS: Record<string, string[]> = {
  // 필요시 다른 장르의 규칙도 추가 가능
}

export default function OnboardingStep2() {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const onboardingData = useRecoilValue(onboardingDataState)
  const setOnboardingData = useSetRecoilState(onboardingDataState)

  // 현재 선택된 장르 (1단계에서 선택한 장르)
  const selectedGenre = onboardingData?.genre
  // 비활성화할 무드 ID 목록
  const incompatibleMoods =
    (selectedGenre ? GENRE_INCOMPATIBLE_MOODS[selectedGenre] : []) || []

  /**
   * 무드 선택/해제 토글 함수
   * 비활성화된 무드 클릭 시 알림창을 띄웁니다.
   */
  const toggleGenre = (id: string) => {
    const isDisabled = incompatibleMoods.includes(id)

    if (isDisabled && selectedGenre) {
      alert(`'${selectedGenre}' 장르와 조합하기 어려운 무드입니다.`)
      return // 선택 방지
    }

    setSelectedGenres((prev) => {
      if (prev.includes(id)) {
        return prev.filter((g) => g !== id)
      } else if (prev.length < 2) {
        return [...prev, id]
      }
      return prev
    })
  }

  const handleBack = () => {
    navigate('/onboarding')
  }

  const handleComplete = async () => {
    if (!onboardingData || selectedGenres.length === 0) {
      return
    }

    setIsLoading(true)

    try {
      // 온보딩 데이터 업데이트
      const updatedData = {
        ...onboardingData,
        moods: selectedGenres,
      }
      setOnboardingData(updatedData)

      // Supabase에 저장 (임시로 localStorage 사용, 실제로는 인증된 user_id 필요)
      const userId = 'temp-user-id' // 실제로는 인증된 사용자 ID 사용
      await saveProfile(userId, updatedData)

      // 메인 페이지로 이동하기 전에 이전 경로 저장
      sessionStorage.setItem('prevPath', '/onboarding/step2')
      navigate('/main')
    } catch (error) {
      console.error('온보딩 완료 처리 중 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="w-full min-h-screen bg-white relative overflow-hidden font-pretendard"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Progress Bar */}
      <div className="w-full h-6 relative overflow-hidden mt-4">
        <div className="w-full h-1 absolute left-0 top-[18px] flex justify-center gap-4">
          <div
            className="w-36 h-1 rounded-xs"
            style={{ backgroundColor: '#2e2c6a' }}
          ></div>
          <div
            className="w-36 h-1 rounded-xs"
            style={{ backgroundColor: '#2e2c6a' }}
          ></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-5 max-w-md mx-auto flex flex-col justify-center min-h-[calc(100vh-8rem-80px)]">
        {/* Title */}
        <h1 className="text-center text-black text-2xl font-semibold mb-2 leading-tight">
          {selectedGenre ? `'${selectedGenre}' 장르 중에서` : '오늘은 어떤 영상으로'}
          <br />
          추천드릴까요?
        </h1>
        <p className="text-center text-primary-900 text-xs font-semibold mb-12">
          * 최대 2개까지 선택할 수 있어요!
        </p>

        {/* Genre Grid */}
        <div className="w-full grid grid-cols-3 gap-2">
          {genres.map((genre) => {
            const isSelected = selectedGenres.includes(genre.id)
            // 비활성화 여부 확인
            const isDisabled = incompatibleMoods.includes(genre.id)
            
            return (
              <button
                key={genre.id}
                onClick={() => toggleGenre(genre.id)}
                className={`aspect-square rounded-[10px] relative overflow-hidden transition-colors ${
                  isSelected && !isDisabled
                    ? 'bg-white border-2' // 선택됨 (비활성화 아님)
                    : 'border-2 border-transparent' // 선택 안됨
                } ${
                  isDisabled
                    ? 'bg-gray-200 opacity-60 cursor-not-allowed' // 비활성화됨
                    : 'bg-gray-50' // 기본
                }`}
                style={
                  isSelected && !isDisabled // 비활성화 상태가 아닐 때만 선택 테두리 표시
                    ? { borderColor: '#2e2c6a' }
                    : undefined
                }
              >
                <div className="absolute left-2 top-2 text-gray-900 text-xs font-light">
                  {genre.number}
                </div>
                <div className="absolute left-2 top-[21px] text-gray-900 text-xs font-light">
                  {genre.english}
                </div>
                <div className="absolute left-2 bottom-2 pr-10 text-gray-900 text-xs font-bold">
                  {genre.korean}
                </div>
                <div
                  className={`absolute w-7 h-7 right-2 bottom-2 bg-gradient-to-b ${genre.gradient} rounded-full`}
                ></div>
                {isSelected && (
                  <div className="absolute right-2 top-2 w-6 h-6 flex items-center justify-center">
                    <img src={CheckIcon} alt="check" className="w-6 h-6" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className="fixed left-0 right-0 w-full px-5 flex gap-3"
        style={{
          bottom: `calc(3rem + env(safe-area-inset-bottom, 0px))`,
          maxWidth: '375px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <button
          onClick={handleBack}
          className="flex-1 h-12 rounded-[10px] flex items-center justify-center"
          style={{ backgroundColor: '#7a8dd6' }}
        >
          <span className="text-white text-base font-semibold">이전</span>
        </button>
        <button
          onClick={handleComplete}
          className={`flex-1 h-12 rounded-[10px] flex items-center justify-center transition-colors ${
            selectedGenres.length > 0 && !isLoading
              ? 'text-white'
              : 'bg-gray-300 text-white cursor-not-allowed'
          }`}
          style={
            selectedGenres.length > 0 && !isLoading
              ? { backgroundColor: '#2e2c6a' }
              : undefined
          }
          disabled={selectedGenres.length === 0 || isLoading}
        >
          <span className="text-base font-semibold">
            {isLoading ? '저장 중...' : '완료'}
          </span>
        </button>
      </div>
    </div>
  )
}

