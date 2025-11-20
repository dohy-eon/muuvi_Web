import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import type { Content } from '../types'
import { useNavigate } from 'react-router-dom'
import { userState, languageState } from '../recoil/userState'
import { addFavorite, removeFavorite, isFavorite } from '../lib/supabase/favorites'
import LikeIcon from '../pages/MyPage/like.svg'
import LikeCheckedIcon from '../pages/MyPage/likeChecked.svg'

interface RecommendationCardProps {
  content: Content
  isActive?: boolean // 현재 활성화된 카드인지 여부
  distance?: number // 현재 카드로부터의 거리 (0 = 현재 카드)
  onCardClick?: (e: React.MouseEvent) => void // 부모에서 클릭 처리
}

// 장르/태그 색상 매핑 (한국어 및 영어 키 지원)
const genreTagColors: Record<string, string> = {
  // [한국어 매핑]
  '로맨스': 'bg-[#ffbdbd]',
  '공포': 'bg-[#2c2c2c]',
  '코미디': 'bg-[#ffd93d]',
  'SF': 'bg-[#003f5c]',
  '판타지': 'bg-[#9b59b6]',
  '모험': 'bg-[#ff8c42]',
  '액션': 'bg-[#e74c3c]',
  '드라마': 'bg-[#8fd19e]',
  '가족': 'bg-[#8fd19e]',
  '미스터리': 'bg-[#7f8c8d]',
  '스릴러': 'bg-[#7f8c8d]',
  '애니메이션': 'bg-[#9b59b6]',
  '범죄': 'bg-[#2c2c2c]',
  '다큐멘터리': 'bg-[#7f8c8d]',
  '역사': 'bg-[#8d6e63]',
  '음악': 'bg-[#ff6b9d]',
  '전쟁': 'bg-[#5d4037]',
  '서부': 'bg-[#d4a574]',
  '리얼리티': 'bg-[#ffd93d]',
  '토크쇼': 'bg-[#8fd19e]',
  'TV영화': 'bg-[#9b59b6]',
  
  // [추가] 영어 매핑 (한국어와 동일한 색상 매칭)
  'Romance': 'bg-[#ffbdbd]',
  'Horror': 'bg-[#2c2c2c]',
  'Comedy': 'bg-[#ffd93d]',
  'Sci-Fi': 'bg-[#003f5c]',
  'Science Fiction': 'bg-[#003f5c]',
  'Fantasy': 'bg-[#9b59b6]',
  'Adventure': 'bg-[#ff8c42]',
  'Action': 'bg-[#e74c3c]',
  'Drama': 'bg-[#8fd19e]',
  'Family': 'bg-[#8fd19e]',
  'Mystery': 'bg-[#7f8c8d]',
  'Thriller': 'bg-[#7f8c8d]',
  'Animation': 'bg-[#9b59b6]',
  'Crime': 'bg-[#2c2c2c]',
  'Documentary': 'bg-[#7f8c8d]',
  'History': 'bg-[#8d6e63]',
  'Music': 'bg-[#ff6b9d]',
  'War': 'bg-[#5d4037]',
  'Western': 'bg-[#d4a574]',
  'Reality': 'bg-[#ffd93d]',
  'Talk Show': 'bg-[#8fd19e]',
  'TV Movie': 'bg-[#9b59b6]',
  'Movie': 'bg-[#9b59b6]',
  'Classic': 'bg-[#9b59b6]',
  
  // 기본 색상
  'default': 'bg-[#9b59b6]',
}

export default function RecommendationCard({ content, isActive = false, distance = 0, onCardClick }: RecommendationCardProps) {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  const language = useRecoilValue(languageState) // [추가] 언어 상태 가져오기
  const [isLiked, setIsLiked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // [수정] 언어에 따른 태그 선택
  const sourceTags = (language === 'en' && content.tags_en && content.tags_en.length > 0)
    ? content.tags_en
    : content.tags

  // 실제 장르 태그 사용 (최대 2개)
  // & 기호로 연결된 복합 태그는 분리 (예: "Action & Adventure" → "Action", "Adventure")
  const genreTags = sourceTags && sourceTags.length > 0 
    ? sourceTags
        .flatMap(tag => tag.includes('&') 
          ? tag.split('&').map(t => t.trim()).filter(Boolean)
          : tag
        )
        .slice(0, 2) // 최대 2개만
    : [] // 태그가 없으면 표시하지 않음

  // 초기 좋아요 상태 확인
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !content.id) return
      
      try {
        const favoriteStatus = await isFavorite(user.id, content.id)
        setIsLiked(favoriteStatus)
      } catch (error) {
        console.error('좋아요 상태 확인 실패:', error)
      }
    }

    checkFavoriteStatus()
  }, [user, content.id])

  const handleClick = (e: React.MouseEvent) => {
    // 부모에서 클릭을 처리하는 경우
    if (onCardClick) {
      onCardClick(e)
      return
    }
    
    // 기본 동작: 상세 페이지로 이동 (중앙 카드만)
    if (content.id && isActive) {
      navigate(`/content/${content.id}`)
    }
  }

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // 카드 클릭 이벤트 전파 방지
    
    if (!user || !content.id) {
      // 로그인하지 않은 경우 로그인 페이지로 이동하거나 알림 표시
      return
    }

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
        }
      }
    } catch (error) {
      console.error('좋아요 처리 실패:', error)
      setIsLiked(!newLikedState) // 에러 시 롤백
    } finally {
      setIsLoading(false)
    }
  }


  // 거리에 따른 블러 및 투명도 계산
  const blurAmount = Math.abs(distance) === 0 ? 0 : Math.abs(distance) === 1 ? 8 : 12
  const opacity = Math.abs(distance) === 0 ? 1 : Math.abs(distance) === 1 ? 0.7 : 0.4
  const scale = Math.abs(distance) === 0 ? 1 : Math.abs(distance) === 1 ? 0.95 : 0.9

  return (
    <div
      className="w-[280px] h-[400px] relative rounded-[20px] overflow-hidden cursor-pointer flex-shrink-0 transition-all duration-500 ease-out"
      style={{
        opacity,
        transform: `scale(${scale})`,
        filter: `blur(${blurAmount}px)`,
      }}
      onClick={handleClick}
    >
      {/* 배경 이미지 전체 + 그라데이션 오버레이 */}
      {content.poster_url ? (
        <img src={content.poster_url} alt={content.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/90" />

      {/* 태그들 - 상단 왼쪽 */}
      {genreTags.length > 0 && (
        <div className="absolute top-4 left-4 flex gap-2 z-20">
          {genreTags.map((tag, tagIndex) => {
            const tagColor = genreTagColors[tag] || genreTagColors['default']

            return (
              <div
                key={tagIndex}
                className={`px-2 h-5 ${tagColor} rounded-[6px] overflow-hidden flex items-center justify-center flex-shrink-0`}
              >
                <div className="text-center text-white text-[10px] font-normal font-pretendard whitespace-nowrap">
                  {tag}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 좋아요 아이콘 (우측 상단) */}
      {user && (
        <button
          onClick={handleLikeClick}
          disabled={isLoading}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center z-30 disabled:opacity-50"
          aria-label={isLiked ? '좋아요 취소' : '좋아요'}
          style={{ pointerEvents: 'auto' }}
        >
          <img 
            src={isLiked ? LikeCheckedIcon : LikeIcon} 
            alt={isLiked ? '좋아요 취소' : '좋아요'}
            className="w-8 h-8"
          />
        </button>
      )}

      {/* 하단 영역 - 정보, 제목, 포스터, OTT 로고 */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <div className="relative flex items-end gap-3">
          {/* 하단 왼쪽 영역 - 텍스트와 OTT 로고 */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0" style={{ maxWidth: 'calc(100% - 100px)' }}>
            {/* 정보 텍스트 */}
            <div className="text-white text-xs font-normal font-pretendard whitespace-nowrap">
              {/* [수정] 언어에 따른 장르 선택 */}
              {(language === 'en' && content.genre_en) ? content.genre_en : (content.genre || content.genres?.[0] || (language === 'en' ? 'Movie' : '영화'))} •{content.year || ''}
            </div>

            {/* 제목 - 반응형 폰트 크기, 길면 줄바꿈 */}
            <div 
              className="text-white font-light font-pretendard leading-tight break-words"
              style={{ 
                fontSize: 'clamp(20px, 5.5vw, 28px)',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
                lineHeight: '1.2',
                maxHeight: '3.6em',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {/* [수정] 언어에 따른 제목 선택 */}
              {(language === 'en' && content.title_en) ? content.title_en : content.title}
            </div>

            {/* OTT 제공자 로고들 - 하단 왼쪽 (최대 6개) */}
            {content.ott_providers && content.ott_providers.length > 0 && (
              <div className="flex gap-2 mt-1 flex-wrap">
                {content.ott_providers.slice(0, 6).map((provider, index) => (
                  <div
                    key={provider.provider_id || index}
                    className="w-5 h-5 rounded-[6px] overflow-hidden bg-white/5 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
                  >
                    {provider.logo_path ? (
                      <img
                        src={provider.logo_path}
                        alt={provider.provider_name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // 이미지 로드 실패 시 대체 처리
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `<span class="text-[8px] text-white font-medium truncate px-0.5">${provider.provider_name}</span>`
                          }
                        }}
                      />
                    ) : (
                      <span className="text-[8px] text-white font-medium truncate px-0.5">
                        {provider.provider_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 작은 포스터 썸네일 - 우하단 */}
          {content.poster_url && (
            <img
              src={content.poster_url}
              alt={`${content.title} poster`}
              className="w-[84px] h-[120px] object-cover rounded-[6px] flex-shrink-0"
            />
          )}
        </div>
      </div>
    </div>
  )
}

