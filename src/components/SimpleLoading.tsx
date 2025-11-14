import MLogo from '../assets/M.svg'

export default function SimpleLoading() {
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
          추천 콘텐츠를 불러오는 중...
        </p>
      </div>
    </div>
  )
}

