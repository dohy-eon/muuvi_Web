import MuuviLogoWhite from './MuuviLogoWhite.svg'

export default function Splash() {
  return (
    <div className="min-h-screen bg-indigo-900 flex items-center justify-center font-pretendard text-white">
      <div className="relative w-[375px] h-[812px]">
        <div className="absolute inset-x-0 top-[312px] flex flex-col items-center gap-6">
          <p className="text-base font-medium text-center leading-tight">
            콘텐츠를 고르는 새로운 방법
          </p>
          <img src={MuuviLogoWhite} alt="Muuvi Logo" className="w-40 h-8" />
        </div>
      </div>
    </div>
  )
}

