import { useState } from 'react'
import { useRecoilValue } from 'recoil'
import { supabase } from '../../lib/supabase'
import { userState } from '../../recoil/userState'
import BottomNavigation from '../../components/BottomNavigation'
import MuuviLogoPrimary from '../../assets/MuuviLogoPrimary.svg'
import GoogleLogo from '../../assets/googleLogo.svg'

function LoginPrompt() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/mypage`
          : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('Google 로그인 실패:', error.message)
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Google 로그인 중 오류:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full h-[812px] bg-white relative font-pretendard">
      <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col items-center">
        <div className="flex-1 flex flex-col items-center justify-center">
          <img
            src={MuuviLogoPrimary}
            alt="Muuvi"
            className="w-[128px] h-auto"
          />
        </div>

        <div className="w-full px-6 pb-[120px]">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white border border-[#E3E3E3] rounded-[12px] py-[14px] px-6 flex items-center justify-center gap-3 text-[#101010] text-base font-semibold shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <img src={GoogleLogo} alt="Google" className="w-6 h-6" />
            <span>{isLoading ? '로그인 중...' : 'Google로 로그인'}</span>
          </button>
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}

export default function MyPage() {
  const user = useRecoilValue(userState)

  if (!user) {
    return <LoginPrompt />
  }

  return (
    <div className="w-full h-[812px] bg-white relative font-pretendard">
      <div className="px-6 pt-24">
        <h1 className="text-2xl font-semibold text-[#101010]">마이페이지</h1>
        <p className="mt-4 text-base text-gray-600">
          {user.email ?? '로그인된 사용자'}
        </p>
      </div>
      <BottomNavigation />
    </div>
  )
}
