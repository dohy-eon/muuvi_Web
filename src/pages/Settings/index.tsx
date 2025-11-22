import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { supabase } from '../../lib/supabase'
import { userState, languageState } from '../../recoil/userState'
import { getProfile, updateSubscribedOtts } from '../../lib/supabase/profile'
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

// [추가] OTT 관련 텍스트
const SETTINGS_TEXT = {
  ko: {
    ottTitle: '구독 중인 서비스',
    ottDesc: '선택한 서비스의 작품 위주로 추천해드려요.',
    save: '저장',
    saved: '저장되었습니다.',
    saveFailed: '저장에 실패했습니다. 다시 시도해주세요.',
    saving: '저장 중...',
  },
  en: {
    ottTitle: 'Subscribed Services',
    ottDesc: 'We will recommend content from selected services.',
    save: 'Save',
    saved: 'Saved successfully.',
    saveFailed: 'Failed to save. Please try again.',
    saving: 'Saving...',
  },
}

// [추가] 지원하는 OTT 목록 (TMDB Provider ID 기준)
const SUPPORTED_OTTS = [
  { id: '8', name: 'Netflix' },
  { id: '97', name: 'Watcha' },
  { id: '356', name: 'Wavve' },
  { id: '337', name: 'Disney+' },
  { id: '350', name: 'Apple TV+' },
  { id: '119', name: 'Amazon Prime' },
  { id: '701', name: 'Coupang Play' },
]

export default function Settings() {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  const setUser = useSetRecoilState(userState)

  // [추가] 언어 상태 사용
  const [language, setLanguage] = useRecoilState(languageState)
  const t = { ...TRANSLATIONS[language], ...SETTINGS_TEXT[language] }

  // [추가] 구독 OTT 상태 관리
  const [selectedOtts, setSelectedOtts] = useState<string[]>([])
  const [savedOtts, setSavedOtts] = useState<string[]>([]) // DB에 저장된 상태
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // [추가] 초기 로딩 시 프로필에서 구독 정보 가져오기
  useEffect(() => {
    if (user) {
      getProfile(user.id).then((profile) => {
        const otts = profile?.subscribed_otts || []
        setSelectedOtts(otts)
        setSavedOtts(otts) // 저장된 상태도 함께 저장
      })
    }
  }, [user])

  // [수정] OTT 선택 토글 - 로컬 상태만 변경
  const toggleOtt = (id: string) => {
    const next = selectedOtts.includes(id)
      ? selectedOtts.filter((v) => v !== id)
      : [...selectedOtts, id]
    
    setSelectedOtts(next)
    setSaveMessage(null) // 변경 시 메시지 초기화
  }

  // [추가] 저장 버튼 핸들러
  const handleSaveOtts = async () => {
    if (!user) return

    // 변경사항이 없으면 저장하지 않음
    const hasChanges = JSON.stringify(selectedOtts.sort()) !== JSON.stringify(savedOtts.sort())
    if (!hasChanges) {
      setSaveMessage(t.saved)
      setTimeout(() => setSaveMessage(null), 2000)
      return
    }

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const success = await updateSubscribedOtts(user.id, selectedOtts)
      
      if (success) {
        setSavedOtts(selectedOtts) // 저장된 상태 업데이트
        setSaveMessage(t.saved)
        setTimeout(() => setSaveMessage(null), 2000)
      } else {
        setSaveMessage(t.saveFailed)
      }
    } catch (error) {
      console.error('OTT 구독 정보 저장 실패:', error)
      setSaveMessage(t.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  // 변경사항이 있는지 확인
  const hasChanges = JSON.stringify(selectedOtts.sort()) !== JSON.stringify(savedOtts.sort())

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

          {/* [추가] 구독 서비스 설정 섹션 */}
          {user && (
            <div className="mb-6">
              <h2 className="text-[16px] font-semibold text-black mb-2">{t.ottTitle}</h2>
              <p className="text-[13px] text-gray-500 mb-3">{t.ottDesc}</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {SUPPORTED_OTTS.map((ott) => {
                  const isSelected = selectedOtts.includes(ott.id)
                  return (
                    <button
                      key={ott.id}
                      onClick={() => toggleOtt(ott.id)}
                      disabled={isSaving}
                      className={`h-10 rounded-[8px] text-[13px] font-medium transition-all ${
                        isSelected
                          ? 'bg-[#2e2c6a] text-white border border-[#2e2c6a]'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {ott.name}
                    </button>
                  )
                })}
              </div>
              
              {/* 저장 버튼 및 메시지 */}
              {hasChanges && (
                <button
                  onClick={handleSaveOtts}
                  disabled={isSaving}
                  className="w-full h-[42px] bg-[#2e2c6a] text-white rounded-[8px] text-[14px] font-semibold hover:bg-[#3a3878] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? t.saving : t.save}
                </button>
              )}
              
              {saveMessage && (
                <p className={`text-[13px] font-medium mt-2 text-center ${
                  saveMessage === t.saved ? 'text-green-600' : 'text-red-600'
                }`}>
                  {saveMessage}
                </p>
              )}
            </div>
          )}

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

