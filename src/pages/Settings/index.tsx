import { useNavigate } from 'react-router-dom'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { supabase } from '../../lib/supabase'
import { userState, languageState } from '../../recoil/userState'
import BottomNavigation from '../../components/BottomNavigation'

// [추가] 번역 텍스트 정의
const TRANSLATIONS = {
  ko: {
    title: '설정',
    email: '이메일',
    language: '언어 설정',
    logout: '로그아웃',
    back: '뒤로가기',
    logoutConfirm: '로그아웃 하시겠습니까?',
    logoutSuccess: '로그아웃 되었습니다.',
    logoutFail: '로그아웃에 실패했습니다. 다시 시도해주세요.',
    error: '오류가 발생했습니다.',
  },
  en: {
    title: 'Settings',
    email: 'Email',
    language: 'Language',
    logout: 'Log Out',
    back: 'Go Back',
    logoutConfirm: 'Are you sure you want to log out?',
    logoutSuccess: 'Logged out successfully.',
    logoutFail: 'Failed to log out. Please try again.',
    error: 'An error occurred.',
  },
}

export default function Settings() {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  const setUser = useSetRecoilState(userState)

  // [추가] 언어 상태 사용
  const [language, setLanguage] = useRecoilState(languageState)
  const t = TRANSLATIONS[language] // 현재 언어에 맞는 텍스트 선택

  const handleLogout = async () => {
    // [추가] 로그아웃 확인 (선택 사항)
    if (!window.confirm(t.logoutConfirm)) return

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('로그아웃 실패:', error)
        alert(t.logoutFail)
      } else {
        setUser(null)
        navigate('/mypage')
      }
    } catch (error) {
      console.error('로그아웃 중 오류 발생:', error)
      alert(t.error)
    }
  }

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
      <div className="h-full overflow-y-auto bg-white">
        <div className="px-5 pt-16 pb-24">
          {/* 헤더 */}
          <div className="flex items-center mb-8">
            <button
              onClick={() => navigate(-1)}
              className="w-6 h-6 flex items-center justify-center mr-4"
              aria-label={t.back}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-[20px] font-bold text-black">{t.title}</h1>
          </div>

          {/* [추가] 언어 설정 섹션 */}
          <div className="mb-6">
            <div className="bg-[#f0f2f4] rounded-[10px] p-4 flex justify-between items-center">
              <p className="text-[16px] font-semibold text-black">{t.language}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage('ko')}
                  className={`px-3 py-1 rounded-[8px] text-[14px] font-medium transition-colors ${
                    language === 'ko'
                      ? 'bg-black text-white'
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  한국어
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded-[8px] text-[14px] font-medium transition-colors ${
                    language === 'en'
                      ? 'bg-black text-white'
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* 사용자 정보 섹션 */}
          {user && (
            <div className="mb-6">
              <div className="bg-[#f0f2f4] rounded-[10px] p-4">
                <p className="text-[14px] font-normal text-gray-700 mb-1">{t.email}</p>
                <p className="text-[16px] font-semibold text-black">{user.email || '-'}</p>
              </div>
            </div>
          )}

          {/* 로그아웃 버튼 */}
          <div className="mt-8">
            <button
              onClick={handleLogout}
              className="w-full h-[52px] bg-[#e74c3c] rounded-[10px] flex items-center justify-center hover:bg-[#c0392b] transition-colors"
            >
              <span className="text-[16px] font-semibold text-white">{t.logout}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  )
}

