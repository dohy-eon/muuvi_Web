import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { onboardingDataState, languageState } from '../../recoil/userState'
import CheckIcon from './check.svg'

// [추가] 온보딩 페이지 텍스트
const ONBOARDING_TEXT = {
  ko: {
    title: '보고 싶은 장르를\n선택해주세요',
    prev: '이전',
    next: '다음',
  },
  en: {
    title: 'Select the genre\nyou want to watch',
    prev: 'Previous',
    next: 'Next',
  },
}

// [추가] 장르 번역 매핑
const GENRE_TRANSLATION = {
  ko: {
    '영화': '영화',
    '드라마': '드라마',
    '애니메이션': '애니메이션',
    '예능': '예능',
  },
  en: {
    '영화': 'Movie',
    '드라마': 'Drama',
    '애니메이션': 'Animation',
    '예능': 'Variety Show',
  },
}

const genres = ['영화', '드라마', '애니메이션', '예능']

export default function Onboarding() {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const navigate = useNavigate()
  const setOnboardingData = useSetRecoilState(onboardingDataState)
  const language = useRecoilValue(languageState)
  const t = ONBOARDING_TEXT[language]
  const genreMap = GENRE_TRANSLATION[language]

  const toggleGenre = (genre: string) => {
    setSelectedGenre((prev) => (prev === genre ? null : genre))
  }

  const handleNext = () => {
    if (selectedGenre) {
      // 첫 번째 선택 데이터를 Recoil에 저장
      setOnboardingData({
        genre: selectedGenre,
        moods: [],
      })
      navigate('/onboarding/step2')
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
          <div className="w-36 h-1 bg-gray-50 rounded-xs"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-5 max-w-md mx-auto flex flex-col justify-center min-h-[calc(100vh-8rem-80px)]">
        {/* Title */}
        <h1 className="text-center text-black text-2xl font-semibold mb-16 leading-tight whitespace-pre-line">
          {t.title}
        </h1>

        {/* Genre Selection */}
        <div className="space-y-4 relative">
          {genres.map((genre) => {
            const isSelected = selectedGenre === genre
            return (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`w-full h-12 rounded-[10px] flex items-center px-4 relative transition-colors ${
                  isSelected
                    ? 'bg-white border-2 text-primary-900'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                }`}
                style={
                  isSelected
                    ? { borderColor: '#2e2c6a' }
                    : undefined
                }
              >
                <span className="text-base font-semibold">{genreMap[genre as keyof typeof genreMap] || genre}</span>
                {isSelected && (
                  <div className="absolute right-4 w-6 h-6 flex items-center justify-center">
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
        <button className="flex-1 h-12 bg-gray-300 rounded-[10px] flex items-center justify-center">
          <span className="text-white text-base font-semibold">{t.prev}</span>
        </button>
        <button
          onClick={handleNext}
          className={`flex-1 h-12 rounded-[10px] flex items-center justify-center transition-colors ${
            selectedGenre !== null
              ? 'text-white'
              : 'bg-gray-300 text-white cursor-not-allowed'
          }`}
          style={
            selectedGenre !== null
              ? { backgroundColor: '#2e2c6a' }
              : undefined
          }
          disabled={selectedGenre === null}
        >
          <span className="text-base font-semibold">{t.next}</span>
        </button>
      </div>
    </div>
  )
}
