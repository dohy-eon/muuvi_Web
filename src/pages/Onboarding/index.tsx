import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CheckIcon from './check.svg'

const genres = ['영화', '드라마', '애니메이션', '예능']

export default function Onboarding() {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const navigate = useNavigate()

  const toggleGenre = (genre: string) => {
    setSelectedGenre((prev) => (prev === genre ? null : genre))
  }

  const handleNext = () => {
    if (selectedGenre) {
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
        <h1 className="text-center text-black text-2xl font-semibold mb-16 leading-tight">
          보고 싶은 장르를
          <br />
          선택해주세요
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
                <span className="text-base font-semibold">{genre}</span>
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
          <span className="text-white text-base font-semibold">이전</span>
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
          <span className="text-base font-semibold">다음</span>
        </button>
      </div>
    </div>
  )
}
