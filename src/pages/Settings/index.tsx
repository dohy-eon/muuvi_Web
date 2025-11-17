import { useNavigate } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { supabase } from '../../lib/supabase'
import { userState } from '../../recoil/userState'
import BottomNavigation from '../../components/BottomNavigation'

export default function Settings() {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  const setUser = useSetRecoilState(userState)

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('로그아웃 실패:', error)
        alert('로그아웃에 실패했습니다. 다시 시도해주세요.')
      } else {
        // 사용자 상태 초기화
        setUser(null)
        // 마이페이지로 이동 (로그인 프롬프트가 표시됨)
        navigate('/mypage')
      }
    } catch (error) {
      console.error('로그아웃 중 오류 발생:', error)
      alert('로그아웃 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="h-full overflow-y-auto bg-white">
        <div className="px-5 pt-16 pb-24">
          {/* 헤더 */}
          <div className="flex items-center mb-8">
            <button
              onClick={() => navigate(-1)}
              className="w-6 h-6 flex items-center justify-center mr-4"
              aria-label="뒤로가기"
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
            <h1 className="text-[20px] font-bold text-black">설정</h1>
          </div>

          {/* 사용자 정보 섹션 */}
          {user && (
            <div className="mb-6">
              <div className="bg-[#f0f2f4] rounded-[10px] p-4">
                <p className="text-[14px] font-normal text-gray-700 mb-1">이메일</p>
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
              <span className="text-[16px] font-semibold text-white">로그아웃</span>
            </button>
          </div>
        </div>
      </div>

      {/* Absolute 하단 네비게이션 (오버레이) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  )
}

