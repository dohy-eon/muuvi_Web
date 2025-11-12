import { useState } from 'react'
import { useRecoilValue } from 'recoil'
import { supabase } from '../../lib/supabase'
import { userState } from '../../recoil/userState'
import BottomNavigation from '../../components/BottomNavigation'
import MuuviLogoPrimary from '../../assets/MuuviLogoPrimary.svg'
import GoogleLogo from '../../assets/googleLogo.svg'

function LoginPrompt() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      
      // 현재 페이지의 origin을 사용하여 redirect URL 생성
      const redirectTo = `${window.location.origin}/mypage`
      
      console.log('[Google 로그인 시도]', { redirectTo })
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // queryParams 제거 - Supabase가 직접 처리하도록 함
        },
      })

      if (error) {
        console.error('[Google 로그인 실패]', {
          message: error.message,
          status: error.status,
          error,
        })
        
        const errorMsg = error.message || ''
        const isProviderNotEnabled = 
          errorMsg.includes('provider is not enabled') ||
          errorMsg.includes('Unsupported provider') ||
          error.status === 400
        
        if (isProviderNotEnabled) {
          setErrorMessage(
            `⚠️ Google 제공자가 활성화되지 않았습니다.\n\n다음 단계를 따라주세요:\n\n1. Supabase 대시보드 접속\n   → Authentication → Providers\n\n2. Google 찾기\n   → "Enable Google" 토글을 켜기\n\n3. Google Cloud Console에서 생성한\n   Client ID와 Client Secret 입력\n\n4. 저장 후 다시 시도`
          )
        } else {
          setErrorMessage(`로그인 실패: ${error.message || '알 수 없는 오류'}`)
        }
        setIsLoading(false)
      } else if (data) {
        // OAuth 플로우가 시작되면 브라우저가 리디렉션되므로 여기서는 처리할 것이 없음
        console.log('[Google OAuth 리디렉션 시작]', data)
      }
    } catch (error: any) {
      console.error('[Google 로그인 중 예외 발생]', error)
      setErrorMessage(
        `로그인 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`
      )
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
          {errorMessage && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line">
              {errorMessage}
            </div>
          )}
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
