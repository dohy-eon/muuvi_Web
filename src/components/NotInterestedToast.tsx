import { useRecoilValue } from 'recoil'
import { languageState } from '../recoil/userState'

interface NotInterestedToastProps {
  isVisible: boolean
  message?: 'notInterested' | 'restored' // 'notInterested': 관심없음, 'restored': 관심없음 취소
}

// [추가] 메시지 번역
const TOAST_MESSAGES = {
  ko: {
    notInterested: '이제 이 작품은 추천되지 않아요!',
    restored: '다시 이 작품을 추천할게요!',
  },
  en: {
    notInterested: 'This content will not be recommended.',
    restored: 'This content will be recommended again!',
  },
}

export default function NotInterestedToast({ isVisible, message = 'notInterested' }: NotInterestedToastProps) {
  // [추가] 언어 상태 사용
  const language = useRecoilValue(languageState)
  const t = TOAST_MESSAGES[language]

  if (!isVisible) return null

  const toastMessage = message === 'restored' ? t.restored : t.notInterested

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[375px] px-5 pt-2 pointer-events-none">
      <div 
        className="bg-[#2e2c6a] h-[36px] rounded-[12px] flex items-center justify-center shadow-lg"
        style={{
          animation: 'slideDown 0.3s ease-out',
        }}
      >
        <p className="text-white text-[16px] font-medium font-pretendard text-center tracking-[0.232px]">
          {toastMessage}
        </p>
      </div>
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

