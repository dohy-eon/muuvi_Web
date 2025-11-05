import type { Content } from '../types'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import RecommendActive from '../assets/RecommendActive.svg'
import RecommendInactive from '../assets/RecommendInactive.svg'
import Reload from '../assets/reload.svg'

interface RecommendationCardProps {
  content: Content
  index: number
  onToggleRecommend?: (content: Content, recommended: boolean) => void
  onReload?: () => void
}

// 무드 ID를 한글 이름으로 매핑
const moodIdToKorean: Record<string, string> = {
  '01': '로맨스',
  '02': '호러',
  '03': '코미디',
  '04': '공상 과학',
  '05': '판타지',
  '06': '어드벤처',
  '07': '액션',
  '08': '힐링',
  '09': '미스테리',
}

// 무드 태그 색상 매핑
const moodTagColors: Record<string, string> = {
  '01': 'bg-red-200', // 로맨스
  '02': 'bg-gray-800', // 호러
  '03': 'bg-yellow-300', // 코미디
  '04': 'bg-cyan-900', // 공상 과학
  '05': 'bg-purple-500', // 판타지
  '06': 'bg-orange-400', // 어드벤처
  '07': 'bg-red-600', // 액션
  '08': 'bg-green-300', // 힐링
  '09': 'bg-gray-500', // 미스테리
}

export default function RecommendationCard({ content, index, onToggleRecommend, onReload }: RecommendationCardProps) {
  const navigate = useNavigate()
  const [recommended, setRecommended] = useState(false)
  
  // 태그를 무드 한글로 변환 (임시로 tags 배열의 첫 번째 요소 사용)
  // 실제로는 Content 타입에 moods 필드가 추가되어야 함
  const getMoodTags = () => {
    // tags에서 무드 관련 태그 추출 (임시 구현)
    if (content.tags && content.tags.length > 0) {
      return content.tags.slice(0, 2).map((tag) => {
        // 태그를 무드 ID로 매핑 (실제로는 더 정확한 매핑 필요)
        const moodId = Object.entries(moodIdToKorean).find(
          ([_, korean]) => korean === tag
        )?.[0]
        return moodId || '01' // 기본값
      })
    }
    return ['01', '03'] // 기본 태그 (로맨스, 코미디)
  }

  const moodIds = getMoodTags()
  
  // 카드 위치 계산 (좌우 배치)
  const isLeft = index % 2 === 0
  const leftPosition = isLeft ? '48px' : '417px'

  const handleClick = () => {
    if (content.id) {
      navigate(`/content/${content.id}`)
    }
  }

  const handleRecommendClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRecommended((prev) => {
      const next = !prev
      onToggleRecommend?.(content, next)
      return next
    })
  }

  const handleReloadClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onReload) {
      onReload()
    } else {
      // 기본 동작: 페이지 리로드 (임시)
      location.reload()
    }
  }

  return (
    <div
      className="w-72 h-96 absolute rounded-[20px] overflow-hidden cursor-pointer"
      style={{ left: leftPosition, top: '128px' }}
      onClick={handleClick}
    >
      {/* 그라데이션 배경 */}
      <div className="w-full h-full bg-gradient-to-b from-black/0 to-black/90 absolute"></div>
      
      {/* 포스터 이미지 */}
      {content.poster_url && (
        <img
          src={content.poster_url}
          alt={content.title}
          className="absolute bottom-[68px] left-1/2 -translate-x-1/2 w-20 h-28 object-cover"
        />
      )}
      
      {/* 제목 */}
      <div className="absolute bottom-[120px] left-1/2 -translate-x-1/2 text-center text-white text-base font-semibold font-pretendard">
        {content.title}
      </div>
      
      {/* 정보 (영화 •년도) */}
      <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 text-center text-white text-xs font-normal font-pretendard">
        {content.genres?.[0] || '영화'} •{content.year || ''}
      </div>
      
      {/* 태그들 */}
      <div className="absolute bottom-[32px] left-1/2 -translate-x-1/2 flex gap-2">
        {moodIds.map((moodId, tagIndex) => {
          const tagText = moodIdToKorean[moodId] || '로맨스'
          const tagColor = moodTagColors[moodId] || 'bg-red-200'

          return (
            <div
              key={tagIndex}
              className={`w-10 h-5 ${tagColor} rounded-md overflow-hidden flex items-center justify-center`}
            >
              <div className="text-center text-white text-[10px] font-normal font-pretendard">
                {tagText}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

