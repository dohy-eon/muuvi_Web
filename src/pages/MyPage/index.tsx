import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { userState, languageState } from '../../recoil/userState'
import { addFavorite, removeFavorite, getFavorites, getFavoriteCount } from '../../lib/supabase/favorites'
import { getNotInterestedContents, getNotInterestedCount, removeNotInterested } from '../../lib/supabase/notInterested'
import BottomNavigation from '../../components/BottomNavigation'
import MuuviLogoPrimary from '../../assets/MuuviLogoPrimary.svg'
import GoogleLogo from '../../assets/googleLogo.svg'
import LikeIcon from './like.svg'
import LikeCheckedIcon from './likeChecked.svg'
import RecommendInactive from '../../assets/RecommendInactive.svg'
import type { Content } from '../../types'

// [추가] 로그인 화면 텍스트
const LOGIN_TEXT = {
  ko: {
    signInGoogle: 'Google로 로그인',
    signingIn: '로그인 중...',
    error: '로그인 중 오류가 발생했습니다',
    providerError: 'Google 제공자가 활성화되지 않았습니다.',
    providerGuide: 'Supabase 대시보드에서 Google Provider를 활성화해주세요.',
  },
  en: {
    signInGoogle: 'Sign in with Google',
    signingIn: 'Signing in...',
    error: 'An error occurred during login',
    providerError: 'Google provider is not enabled.',
    providerGuide: 'Please enable Google Provider in Supabase Dashboard.',
  },
}

// [추가] 마이페이지 텍스트
const MYPAGE_TEXT = {
  ko: {
    favorites: '찜했어요',
    notInterested: '관심없어요',
    subscribed: '구독 중인 서비스',
    favoriteTitle: '찜한 콘텐츠',
    noFavorites: '찜한 콘텐츠가 없습니다',
    notInterestedTitle: '관심없음 콘텐츠',
    noNotInterested: '관심없음으로 표시한 콘텐츠가 없습니다',
    randomNickname: '랜덤닉네임',
  },
  en: {
    favorites: 'Favorites',
    notInterested: 'Not Interested',
    subscribed: 'Subscribed',
    favoriteTitle: 'Favorite Content',
    noFavorites: 'No favorite content yet',
    notInterestedTitle: 'Not Interested Content',
    noNotInterested: 'No content marked as not interested',
    randomNickname: 'RandomUser',
  },
}

function LoginPrompt() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // [추가] 언어 상태 사용
  const language = useRecoilValue(languageState)
  const t = LOGIN_TEXT[language]

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const redirectTo = `${window.location.origin}/mypage`

      console.log('[Google 로그인 시도]', { redirectTo })

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })

      if (error) {
        console.error('[Google 로그인 실패]', error)

        const errorMsg = error.message || ''
        const isProviderNotEnabled =
          errorMsg.includes('provider is not enabled') ||
          errorMsg.includes('Unsupported provider') ||
          error.status === 400

        if (isProviderNotEnabled) {
          setErrorMessage(`${t.providerError}\n${t.providerGuide}`)
        } else {
          setErrorMessage(`${t.error}: ${error.message}`)
        }
        setIsLoading(false)
      } else if (data) {
        console.log('[Google OAuth 리디렉션 시작]', data)
      }
    } catch (error: any) {
      console.error('[Google 로그인 중 예외 발생]', error)
      setErrorMessage(`${t.error}: ${error?.message || ''}`)
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="h-full overflow-y-auto bg-white">
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
              {/* [수정] 텍스트 변수 사용 */}
              <span>{isLoading ? t.signingIn : t.signInGoogle}</span>
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

// 장르/태그 색상 매핑
const genreTagColors: Record<string, string> = {
  '로맨스': 'bg-[#ffbdbd]',
  '코미디': 'bg-[#ffd93d]',
  '공포': 'bg-[#2c2c2c]',
  'SF': 'bg-[#003f5c]',
  '판타지': 'bg-[#9b59b6]',
  '모험': 'bg-[#ff8c42]',
  '액션': 'bg-[#e74c3c]',
  '드라마': 'bg-[#8fd19e]',
  '미스터리': 'bg-[#7f8c8d]',
  'default': 'bg-[#9b59b6]',
}

// 찜한 콘텐츠 카드 컴포넌트
interface FavoriteContentCardProps {
  content: Content
  isNotInterested?: boolean // 관심없음 콘텐츠인지 여부
}

function FavoriteContentCard({ content, onRemove, isNotInterested = false }: FavoriteContentCardProps & { onRemove?: () => void }) {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  const [isLiked, setIsLiked] = useState(!isNotInterested) // 관심없음이면 좋아요 상태가 아님
  const [isLoading, setIsLoading] = useState(false)

  const genreTags = content.tags && content.tags.length > 0 
    ? content.tags
        .flatMap(tag => tag.includes('&') 
          ? tag.split('&').map(t => t.trim()).filter(Boolean)
          : tag
        )
        .slice(0, 2)
    : []

  const handleClick = () => {
    if (content.id) {
      navigate(`/content/${content.id}`)
    }
  }

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // 카드 클릭 이벤트 전파 방지
    
    if (!user || !content.id) return

    setIsLoading(true)
    const newLikedState = !isLiked
    setIsLiked(newLikedState) // 낙관적 업데이트

    try {
      if (newLikedState) {
        const success = await addFavorite(user.id, content.id)
        if (!success) {
          setIsLiked(false) // 실패 시 롤백
        }
      } else {
        const success = await removeFavorite(user.id, content.id)
        if (!success) {
          setIsLiked(true) // 실패 시 롤백
        } else {
          // 좋아요 취소 성공 시 목록에서 제거
          onRemove?.()
        }
      }
    } catch (error) {
      console.error('좋아요 처리 실패:', error)
      setIsLiked(!newLikedState) // 에러 시 롤백
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="relative w-[160px] h-[257px] rounded-[10px] overflow-hidden cursor-pointer border border-[#2e2c6a]"
      onClick={handleClick}
    >
      {/* 포스터 이미지 */}
      {content.poster_url ? (
        <img 
          src={content.poster_url} 
          alt={content.title} 
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-200" />
      )}
      
      {/* 그라데이션 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
      
      {/* OTT 로고들 (좌측 상단) */}
      {content.ott_providers && content.ott_providers.length > 0 && (
        <div className="absolute top-2 left-2.5 flex gap-1 z-20">
          {content.ott_providers.slice(0, 2).map((provider, index) => (
            <div
              key={provider.provider_id || index}
              className="w-6 h-6 rounded overflow-hidden bg-white/10 backdrop-blur-sm"
            >
              {provider.logo_path ? (
                <img
                  src={provider.logo_path}
                  alt={provider.provider_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* 좋아요 아이콘 (우측 상단) - 관심없음이 아닌 경우만 표시 */}
      {user && !isNotInterested && (
        <button
          onClick={handleLikeClick}
          disabled={isLoading}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center z-10 disabled:opacity-50"
          aria-label={isLiked ? '좋아요 취소' : '좋아요'}
        >
          <img 
            src={isLiked ? LikeCheckedIcon : LikeIcon} 
            alt={isLiked ? '좋아요 취소' : '좋아요'}
            className="w-8 h-8"
          />
        </button>
      )}

      {/* 관심없음 취소 버튼 (우측 상단) - 관심없음인 경우만 표시 */}
      {user && isNotInterested && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove?.()
          }}
          disabled={isLoading}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center z-10 disabled:opacity-50"
          aria-label="관심없음 취소"
        >
          <img 
            src={RecommendInactive} 
            alt="관심없음 취소"
            className="w-8 h-8"
          />
        </button>
      )}

      {/* 제목 영역 (하단 배경) */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#f1f0fa] h-[23px] flex items-center justify-center">
        <p className="text-[14px] font-normal text-[#2e2c6a] text-center leading-[1.5]">
          {content.title}
        </p>
      </div>

      {/* 장르 태그들 (제목 영역 바로 위) */}
      {genreTags.length > 0 && (
        <div className="absolute left-2.5 bottom-[32px] flex gap-1 z-10">
          {genreTags.map((tag, tagIndex) => {
            const tagColor = genreTagColors[tag] || genreTagColors['default']
            return (
              <div
                key={tagIndex}
                className={`h-5 ${tagColor} rounded-[6px] px-2 flex items-center justify-center`}
              >
                <span className="text-[10px] font-normal text-white whitespace-nowrap">
                  {tag}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function MyPage() {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  // [추가] 언어 상태 사용
  const language = useRecoilValue(languageState)
  const t = MYPAGE_TEXT[language]

  const [favoriteCount, setFavoriteCount] = useState(0)
  const [notInterestedCount, setNotInterestedCount] = useState(0)
  const [subscribedServiceCount, _setSubscribedServiceCount] = useState(0)
  const [favoriteContents, setFavoriteContents] = useState<Content[]>([])
  const [notInterestedContents, setNotInterestedContents] = useState<Content[]>([])

  // 좋아요한 콘텐츠와 통계 가져오기
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setFavoriteCount(0)
        setFavoriteContents([])
        setNotInterestedCount(0)
        setNotInterestedContents([])
        return
      }

      try {
        const [favorites, favoriteCount, notInterested, notInterestedCount] = await Promise.all([
          getFavorites(user.id),
          getFavoriteCount(user.id),
          getNotInterestedContents(user.id),
          getNotInterestedCount(user.id)
        ])
        
        setFavoriteContents(favorites)
        setFavoriteCount(favoriteCount)
        setNotInterestedContents(notInterested)
        setNotInterestedCount(notInterestedCount)
      } catch (error) {
        console.error('데이터 로드 실패:', error)
      }
    }

    loadData()
  }, [user])

  if (!user) {
    return <LoginPrompt />
  }

  const nickname = user.user_metadata?.full_name || user.email?.split('@')[0] || t.randomNickname

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="h-full overflow-y-auto bg-white">
        <div className="px-5 pt-16 pb-24">
          {/* 프로필 섹션 */}
          <div className="relative mb-6">
            {/* 프로필 이미지 */}
            <div className="w-20 h-20 rounded-full bg-[#2e2c6a] flex items-center justify-center mb-4">
            </div>

            {/* 설정 아이콘 (우측 상단) */}
            <button 
              onClick={() => navigate('/settings')}
              className="absolute top-0 right-0 w-6 h-6"
              aria-label="설정"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#101010" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.01131 9.77251C4.28062 9.5799 4.48571 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="#101010" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* 닉네임과 편집 아이콘 */}
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-black">{nickname}</h2>
              <button className="w-4 h-4">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.3333 2.00004C11.5084 1.82498 11.7163 1.68705 11.9437 1.59431C12.1711 1.50157 12.4132 1.45605 12.6573 1.46049C12.9014 1.46493 13.1421 1.5192 13.366 1.62004C13.5898 1.72087 13.7926 1.86618 13.9627 2.04737C14.1328 2.22857 14.2665 2.44175 14.3563 2.67391C14.4462 2.90608 14.4902 3.1526 14.4858 3.40071C14.4814 3.64881 14.4287 3.89359 14.3307 4.12004C14.2326 4.34649 14.0913 4.54981 13.9133 4.72004L6.24667 12.3867L2.66667 13.3334L3.61333 9.75337L11.3333 2.00004Z" stroke="#101010" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* 통계 섹션 */}
          <div className="w-full max-w-[320px] h-[56px] bg-[#f0f2f4] rounded-[10px] overflow-hidden mb-6 flex">
            {/* 찜했어요 섹션 */}
            <div className="flex-1 h-full flex flex-col items-center justify-center relative">
              <div className="text-black text-base font-bold font-pretendard tracking-tight mb-0.5">
                {favoriteCount}
              </div>
              <div className="text-black text-xs font-normal font-pretendard tracking-tight">
                {/* [수정] 텍스트 변수 사용 */}
                {t.favorites}
              </div>
              {/* 우측 구분선 */}
              <div className="absolute right-0 top-[12px] w-0 h-9 outline outline-1 outline-offset-[-0.5px] outline-[#a8adb3]" />
            </div>

            {/* 관심없어요 섹션 */}
            <div className="flex-1 h-full flex flex-col items-center justify-center relative">
              <div className="text-black text-base font-bold font-pretendard tracking-tight mb-0.5">
                {notInterestedCount}
              </div>
              <div className="text-black text-xs font-normal font-pretendard tracking-tight">
                {/* [수정] 텍스트 변수 사용 */}
                {t.notInterested}
              </div>
              {/* 우측 구분선 */}
              <div className="absolute right-0 top-[12px] w-0 h-9 outline outline-1 outline-offset-[-0.5px] outline-[#a8adb3]" />
            </div>

            {/* 구독 중인 서비스 섹션 */}
            <div className="flex-1 h-full flex flex-col items-center justify-center">
              <div className="text-black text-base font-bold font-pretendard tracking-tight mb-0.5">
                {subscribedServiceCount}
              </div>
              <div className="text-black text-xs font-normal font-pretendard tracking-tight">
                {/* [수정] 텍스트 변수 사용 */}
                {t.subscribed}
              </div>
            </div>
          </div>

          {/* 찜한 콘텐츠 섹션 */}
          <div className="mb-8">
            <h3 className="text-[18px] font-semibold text-black mb-4 font-pretendard">{t.favoriteTitle}</h3>
            {favoriteContents.length > 0 ? (
              <div className="overflow-x-auto -mx-5 px-5 show-scrollbar">
                <div className="flex gap-4 pb-2" style={{ width: 'max-content' }}>
                  {favoriteContents.map((content) => (
                    <div key={content.id} className="flex-shrink-0">
                      <FavoriteContentCard 
                        content={content}
                        onRemove={() => {
                          setFavoriteContents(prev => prev.filter(c => c.id !== content.id))
                          setFavoriteCount(prev => Math.max(0, prev - 1))
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                {/* [수정] 텍스트 변수 사용 */}
                <p className="text-[14px] text-gray-500">{t.noFavorites}</p>
              </div>
            )}
          </div>

          {/* 관심없음 콘텐츠 섹션 */}
          <div>
            <h3 className="text-[18px] font-semibold text-black mb-4 font-pretendard">{t.notInterestedTitle}</h3>
            {notInterestedContents.length > 0 ? (
              <div className="overflow-x-auto -mx-5 px-5">
                <div className="flex gap-4" style={{ width: 'max-content' }}>
                  {notInterestedContents.map((content) => (
                    <div key={content.id} className="flex-shrink-0">
                      <FavoriteContentCard 
                        content={content}
                        isNotInterested={true}
                        onRemove={async () => {
                          if (user && content.id) {
                            try {
                              const success = await removeNotInterested(user.id, content.id)
                              if (success) {
                                setNotInterestedContents(prev => prev.filter(c => c.id !== content.id))
                                setNotInterestedCount(prev => Math.max(0, prev - 1))
                              }
                            } catch (error) {
                              console.error('관심없음 취소 실패:', error)
                            }
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                {/* [수정] 텍스트 변수 사용 */}
                <p className="text-[14px] text-gray-500">{t.noNotInterested}</p>
              </div>
            )}
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
