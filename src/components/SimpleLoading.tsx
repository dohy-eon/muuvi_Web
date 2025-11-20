import { useRecoilValue } from 'recoil'
import { languageState } from '../recoil/userState'
import MLogo from '../assets/M.svg'

// [추가] 로딩 텍스트 번역
const LOADING_TEXT = {
  ko: {
    loading: '추천 콘텐츠를 불러오는 중...',
  },
  en: {
    loading: 'Loading recommendations...',
  },
}

export default function SimpleLoading() {
  // [추가] 언어 상태 사용
  const language = useRecoilValue(languageState)
  const t = LOADING_TEXT[language]

  return (
    <div className="w-full h-screen relative bg-white overflow-hidden font-pretendard flex items-center justify-center">
      {/* Loading Animation - M Logo */}
      <div className="flex flex-col items-center gap-4">
        <img 
          src={MLogo} 
          alt="Loading" 
          className="w-[154px] h-[119px]"
          style={{
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
        <p className="text-black text-lg font-medium">
          {t.loading}
        </p>
      </div>
    </div>
  )
}

