import { useState, useEffect, useRef } from 'react'
import { useRecoilValue } from 'recoil'
import type { Content } from '../types'
import { useNavigate } from 'react-router-dom'
import { userState, languageState } from '../recoil/userState'
import { addFavorite, removeFavorite, isFavorite } from '../lib/supabase/favorites'
import LikeIcon from '../pages/MyPage/like.svg'
import LikeCheckedIcon from '../pages/MyPage/likeChecked.svg'
import { toBlob } from 'html-to-image' // [변경] html-to-image에서 toBlob 가져오기
import { saveAs } from 'file-saver'

interface RecommendationCardProps {
  content: Content
  isActive?: boolean // 현재 활성화된 카드인지 여부
  distance?: number // 현재 카드로부터의 거리 (0 = 현재 카드)
  onCardClick?: (e: React.MouseEvent) => void // 부모에서 클릭 처리
  onShareSuccess?: () => void // 공유 성공 콜백
  onShareError?: () => void // 공유 실패 콜백
}

// [추가] 공유 아이콘 컴포넌트 (SVG)
const ShareIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
)

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

export default function RecommendationCard({ content, isActive = false, distance = 0, onCardClick, onShareSuccess, onShareError }: RecommendationCardProps) {
  const navigate = useNavigate()
  const user = useRecoilValue(userState)
  const language = useRecoilValue(languageState) // [추가] 언어 상태 가져오기
  const [isLiked, setIsLiked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // [추가] 카드를 캡처하기 위한 ref 선언
  const cardRef = useRef<HTMLDivElement>(null)
  // [추가] 공유 진행 중 상태
  const [isSharing, setIsSharing] = useState(false)
  
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

  // [수정] 공유 버튼 클릭 핸들러 (텍스트 위치 보정 강화)
  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cardRef.current || !content || isSharing) return

    setIsSharing(true)

    try {
      // 0. 폰트 로딩 대기
      await document.fonts.ready

      // 1. 원본 요소 및 크기 측정
      const originalElement = cardRef.current
      const originalRect = originalElement.getBoundingClientRect()
      const originalWidth = originalRect.width
      const originalHeight = originalRect.height

      // [핵심] 원본 타이틀의 '계산된' 스타일 가져오기
      const originalTitle = originalElement.querySelector('[data-title]')
      let computedTitleStyle: CSSStyleDeclaration | null = null
      if (originalTitle) {
        computedTitleStyle = window.getComputedStyle(originalTitle)
      }

      // 2. 복제
      const clone = originalElement.cloneNode(true) as HTMLElement
      clone.setAttribute('data-card-container', 'true')

      // 3. 복제본 기본 스타일 초기화 ('증명사진' 모드)
      Object.assign(clone.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        zIndex: '-9999', // 화면 뒤로 숨김
        transform: 'none',
        filter: 'none',
        opacity: '1',
        width: `${originalWidth}px`,
        height: `${originalHeight}px`,
        borderRadius: '20px',
        margin: '0',
        padding: '0',
        transition: 'none',
        backgroundColor: 'transparent', // 투명 배경
        // 텍스트 렌더링 옵션
        fontSmooth: 'antialiased',
        webkitFontSmoothing: 'antialiased',
        mozOsxFontSmoothing: 'grayscale',
      })

      // 4. DOM 추가
      document.body.appendChild(clone)

      // ==================================================================
      // [수정 포인트 1] 태그 텍스트 정렬 방식 변경 (Flex -> Line-height)
      // Flexbox 정렬은 캡처 시 오차가 크므로, 줄 높이를 강제하여 맞춥니다.
      // ==================================================================
      const cloneTags = clone.querySelectorAll('[data-tag-text]')
      const originalTags = originalElement.querySelectorAll('[data-tag-text]')
      
      cloneTags.forEach((tag, index) => {
        const el = tag as HTMLElement
        const parent = el.parentElement as HTMLElement
        const originalTag = originalTags[index] as HTMLElement
        
        if (parent && originalTag) {
          const originalParent = originalTag.parentElement as HTMLElement
          
          if (originalParent) {
            // 원본 부모의 스타일을 정확히 복사
            const originalParentStyle = window.getComputedStyle(originalParent)
            
            // 부모 컨테이너 스타일 복사 (배경색, 패딩, 크기 등)
            parent.style.display = originalParentStyle.display || 'flex'
            parent.style.alignItems = 'center'
            parent.style.justifyContent = 'center'
            parent.style.height = originalParentStyle.height || '20px'
            parent.style.width = originalParentStyle.width || 'auto'
            parent.style.padding = originalParentStyle.padding || '8px 8px'
            parent.style.margin = originalParentStyle.margin || '0'
            parent.style.borderRadius = originalParentStyle.borderRadius || '6px'
            parent.style.overflow = originalParentStyle.overflow || 'hidden'
            parent.style.backgroundColor = originalParentStyle.backgroundColor || ''
            // 폰트 렌더링 보정
            parent.style.fontFamily = '"Pretendard", sans-serif'
          } else {
            // fallback
            parent.style.display = 'flex'
            parent.style.alignItems = 'center'
            parent.style.justifyContent = 'center'
            parent.style.height = '20px'
            parent.style.padding = '8px'
          }
        }

        // 텍스트 스타일: 원본 텍스트의 스타일을 정확히 복사
        if (originalTag) {
          const originalTagStyle = window.getComputedStyle(originalTag)
          
          el.style.height = 'auto'
          el.style.lineHeight = originalTagStyle.lineHeight || '1'
          el.style.display = originalTagStyle.display || 'block'
          el.style.textAlign = originalTagStyle.textAlign || 'center'
          el.style.margin = originalTagStyle.margin || '0'
          el.style.padding = originalTagStyle.padding || '0'
          el.style.transform = 'none'
          el.style.fontFamily = originalTagStyle.fontFamily || '"Pretendard", sans-serif'
          el.style.fontSize = originalTagStyle.fontSize || '10px'
          el.style.fontWeight = originalTagStyle.fontWeight || 'normal'
          el.style.color = originalTagStyle.color || 'white'
          el.style.whiteSpace = originalTagStyle.whiteSpace || 'nowrap'
        } else {
          // fallback
          el.style.height = 'auto'
          el.style.lineHeight = '1'
          el.style.display = 'flex'
          el.style.alignItems = 'center'
          el.style.justifyContent = 'center'
          el.style.margin = '0'
          el.style.padding = '0'
          el.style.transform = 'none'
          el.style.fontFamily = '"Pretendard", sans-serif'
          el.style.fontSize = '10px'
        }
      })

      // ==================================================================
      // [수정 포인트 2] 타이틀 위치 및 줄바꿈 강제 고정
      // ==================================================================
      const cloneTitle = clone.querySelector('[data-title]') as HTMLElement
      if (cloneTitle && computedTitleStyle) {
        // 1. 폰트 크기와 줄 높이를 px 단위로 고정
        cloneTitle.style.fontSize = computedTitleStyle.fontSize
        cloneTitle.style.lineHeight = computedTitleStyle.lineHeight
        
        // 2. 위치 보정: relative로 변경하여 top 값을 미세 조정
        cloneTitle.style.position = 'relative'
        cloneTitle.style.top = '-2px' // html-to-image는 오차가 적어 조정값 줄임
        cloneTitle.style.marginTop = '0'
        cloneTitle.style.marginBottom = '0'
        
        // 3. 너비 고정 (줄바꿈이 원본과 달라지는 것 방지)
        cloneTitle.style.width = computedTitleStyle.width
        cloneTitle.style.whiteSpace = 'normal' // 줄바꿈 허용
        cloneTitle.style.fontFamily = '"Pretendard", sans-serif'
      }

      // (3) Absolute 요소 위치 동기화 (기존 유지)
      const originalElements = originalElement.querySelectorAll('*')
      const cloneElements = clone.querySelectorAll('*')
      originalElements.forEach((originalEl, index) => {
        const cloneEl = cloneElements[index] as HTMLElement
        if (!cloneEl) return
        const computedStyle = window.getComputedStyle(originalEl)
        if (computedStyle.position === 'absolute') {
          const oRect = originalEl.getBoundingClientRect()
          const pRect = (originalEl.parentElement || originalElement).getBoundingClientRect()
          cloneEl.style.top = `${oRect.top - pRect.top}px`
          cloneEl.style.left = `${oRect.left - pRect.left}px`
        }
      })

      // 5. 렌더링 안정화를 위한 지연 시간 증가
      await new Promise(resolve => setTimeout(resolve, 300))

      // 6. 이미지 생성 (html-to-image 사용)
      // toBlob을 사용하여 바로 Blob 데이터를 얻습니다.
      const blob = await toBlob(clone, {
        cacheBust: true, // 캐시 문제 방지 (CORS 이미지 로딩용)
        pixelRatio: 4,   // 고해상도 설정 (html2canvas의 scale과 유사)
        backgroundColor: '', // 투명 배경 유지
        width: originalWidth,
        height: originalHeight,
        style: {
          fontFamily: '"Pretendard", sans-serif', // 폰트 강제 적용
        },
      })

      // 7. 복제본 제거
      document.body.removeChild(clone)

      if (!blob) {
        console.error('이미지 생성 실패')
        setIsSharing(false)
        onShareError?.()
        return
      }

      // 8. 파일 저장 및 공유
      const title = (language === 'en' && content.title_en) ? content.title_en : content.title
      const safeTitle = title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_').replace(/\s+/g, '_')
      const fileName = `muuvi_${safeTitle}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: title,
            text: language === 'en' ? `Check this out on Muuvi: "${title}"` : `Muuvi 추천: "${title}"`,
          })
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
            saveAs(blob, fileName)
          }
        }
      } else {
        saveAs(blob, fileName)
      }
      
      setIsSharing(false)
      onShareSuccess?.()

    } catch (error) {
      console.error('Capture error:', error)
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        })
      }
      
      setIsSharing(false)
      onShareError?.()
      // 복제본이 남아있을 경우 제거
      const existingClone = document.querySelector('[data-card-container]')
      if (existingClone && existingClone.parentElement) {
        existingClone.parentElement.removeChild(existingClone)
      }
    }
  }


  // 거리에 따른 블러 및 투명도 계산
  const blurAmount = Math.abs(distance) === 0 ? 0 : Math.abs(distance) === 1 ? 8 : 12
  const opacity = Math.abs(distance) === 0 ? 1 : Math.abs(distance) === 1 ? 0.7 : 0.4
  const scale = Math.abs(distance) === 0 ? 1 : Math.abs(distance) === 1 ? 0.95 : 0.9

  return (
    <div
        ref={cardRef}
        data-card-container="true"
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
                {/* [수정] data-tag-text 속성 추가 */}
                <div 
                  data-tag-text
                  className="text-center text-white text-[10px] font-normal font-pretendard whitespace-nowrap"
                >
                  {tag}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 공유 버튼 (우측 상단, 좋아요 버튼 왼쪽) */}
      <button
        onClick={handleShareClick}
        disabled={isSharing}
        className="absolute top-4 right-14 z-20 w-8 h-8 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/40 transition-colors disabled:opacity-50"
        aria-label={language === 'en' ? 'Share' : '공유하기'}
        style={{ pointerEvents: 'auto' }}
      >
        {isSharing ? (
          // 로딩 중일 때 표시할 스피너
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <ShareIcon className="w-5 h-5" />
        )}
      </button>

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

            {/* [수정] 제목 영역: data-title 속성 추가 */}
            <div 
              data-title
              className="text-white font-light font-pretendard leading-tight break-words"
              style={{ 
                fontSize: 'clamp(20px, 5.5vw, 28px)', // 이 clamp 값이 캡처 시 문제를 일으킴 -> 위 로직에서 px로 고정
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

