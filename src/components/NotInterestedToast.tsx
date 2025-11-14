interface NotInterestedToastProps {
  isVisible: boolean
  message?: 'notInterested' | 'restored' // 'notInterested': 관심없음, 'restored': 관심없음 취소
}

export default function NotInterestedToast({ isVisible, message = 'notInterested' }: NotInterestedToastProps) {
  if (!isVisible) return null

  const toastMessage = message === 'restored' 
    ? '다시 이 작품을 추천할게요!'
    : '이제 이 작품은 추천되지 않아요!'

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

