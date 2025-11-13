import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import type { Content } from '../types'
import { useNavigate } from 'react-router-dom'
import { userState } from '../recoil/userState'
import { addFavorite, removeFavorite, isFavorite } from '../lib/supabase/favorites'
import LikeIcon from '../pages/MyPage/like.svg'
import LikeCheckedIcon from '../pages/MyPage/likeChecked.svg'

interface RecommendationCardProps {
  content: Content
}

// 장르/태그 색상 매핑 (한글 태그 기반)
const genreTagColors: Record<string, string> = {
  // 주요 장르
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
  // 추가 장르
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
  // 기본 색상
  'default': 'bg-[#9b59b6]',
}

export default function RecommendationCard({ content }: RecommendationCardProps) {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  const [isLiked, setIsLiked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // 실제 장르 태그 사용 (최대 2개)
  // content.tags에서 실제 TMDB 장르를 가져옴
  // & 기호로 연결된 복합 태그는 분리 (예: "Action & Adventure" → "Action", "Adventure")
  const genreTags = content.tags && content.tags.length > 0 
    ? content.tags
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

  const handleClick = () => {
    if (content.id) {
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

  return (
    <div
      className="w-72 h-96 relative rounded-[20px] overflow-hidden cursor-pointer flex-shrink-0"
      onClick={handleClick}
    >
      {/* 배경 이미지 전체 + 그라데이션 오버레이 */}
      {content.poster_url ? (
        <img src={content.poster_url} alt={content.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/90" />

      {/* 좋아요 아이콘 (우측 상단) */}
      {user && (
        <button
          onClick={handleLikeClick}
          disabled={isLoading}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center z-10 disabled:opacity-50"
          aria-label={isLiked ? '좋아요 취소' : '좋아요'}
        >
          <img 
            src={isLiked ? LikeCheckedIcon : LikeIcon} 
            alt={isLiked ? '좋아요 취소' : '좋아요'}
            className="w-8 h-8"
          />
        </button>
      )}

            {/* 제목/정보 - 좌하단 정렬 */}
            <div className="absolute left-8 bottom-20 text-left text-white">
              <div className="text-base font-semibold font-pretendard">{content.title}</div>
              <div className="mt-1 text-xs font-normal font-pretendard opacity-90">
                {content.genre || content.genres?.[0] || '영화'} •{content.year || ''}
              </div>
            </div>

      {/* 작은 포스터 썸네일 - 우하단 */}
      {content.poster_url && (
        <img
          src={content.poster_url}
          alt={`${content.title} poster`}
          className="absolute right-4 bottom-4 w-[84px] h-[120px] object-cover rounded-[6px]"
        />
      )}

      {/* OTT 제공자 로고들 - 무드 태그 위 (블로그 참고: 최대 6개, 이미지 onerror 처리) */}
      {content.ott_providers && content.ott_providers.length > 0 && (
        <div className="absolute left-8 bottom-[44px] flex gap-1.5">
          {content.ott_providers.slice(0, 6).map((provider, index) => (
            <div
              key={provider.provider_id || index}
              className="w-6 h-6 rounded overflow-hidden bg-white/5 backdrop-blur-sm flex items-center justify-center"
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

      {/* 태그들 - 좌하단 (실제 장르 태그만 표시) */}
      {genreTags.length > 0 && (
        <div className="absolute left-8 bottom-4 flex gap-2">
          {genreTags.map((tag, tagIndex) => {
            const tagColor = genreTagColors[tag] || genreTagColors['default']

            return (
              <div
                key={tagIndex}
                className={`px-2 h-5 ${tagColor} rounded-md overflow-hidden flex items-center justify-center`}
              >
                <div className="text-center text-white text-[10px] font-normal font-pretendard whitespace-nowrap">
                  {tag}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

