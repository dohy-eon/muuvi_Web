import { useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import MuuviLogoWhite from './MuuviLogoWhite.svg'

export default function Splash() {
  const navigate = useNavigate()
  const typingDelayStyle = { '--typing-delay': '0.3s' } as CSSProperties
  const logoDelayStyle = { animationDelay: '2s' } as CSSProperties

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/onboarding', { replace: true })
    }, 3500)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-indigo-900 flex items-center justify-center font-pretendard text-white">
      <div className="relative w-[375px] h-[812px]">
        <div className="absolute inset-x-0 top-[312px] flex flex-col items-center gap-6">
          <p className="text-base font-medium text-center leading-tight animate-splash-text">
            <span className="typing-mask" style={typingDelayStyle}>
              콘텐츠를 고르는 새로운 방법
            </span>
          </p>
          <img
            src={MuuviLogoWhite}
            alt="Muuvi Logo"
            className="w-40 h-8 animate-splash-logo"
            style={logoDelayStyle}
          />
        </div>
      </div>
    </div>
  )
}

