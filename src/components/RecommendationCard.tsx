import type { Content } from '../types'
import { useNavigate } from 'react-router-dom'
 

interface RecommendationCardProps {
  content: Content
  index: number
  selectedMoods?: string[] // 선택한 무드 ID 배열 (최대 2개)
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

// 무드 태그 색상 매핑 (피그마 스펙 근사치)
const moodTagColors: Record<string, string> = {
  '01': 'bg-[#ffbdbd]', // 로맨스
  '02': 'bg-[#2c2c2c]', // 호러
  '03': 'bg-[#ffd93d]', // 코미디
  '04': 'bg-[#003f5c]', // 공상 과학
  '05': 'bg-[#9b59b6]', // 판타지
  '06': 'bg-[#ff8c42]', // 어드벤처
  '07': 'bg-[#e74c3c]', // 액션
  '08': 'bg-[#8fd19e]', // 힐링
  '09': 'bg-[#7f8c8d]', // 미스테리
}

export default function RecommendationCard({ content, index, selectedMoods }: RecommendationCardProps) {
  const navigate = useNavigate()
  
  // 실제 무드 데이터 사용 (최대 2개)
  // 우선순위: 1. content.moods (콘텐츠에 저장된 무드) 2. selectedMoods (사용자가 선택한 무드)
  const moodIds = content.moods && content.moods.length > 0 
    ? content.moods.slice(0, 2) 
    : (selectedMoods && selectedMoods.length > 0 
      ? selectedMoods.slice(0, 2) 
      : []) // 무드가 없으면 태그를 표시하지 않음
  
  // 카드 위치 계산 (좌우 배치)
  const isLeft = index % 2 === 0
  const leftPosition = isLeft ? '48px' : '417px'

  const handleClick = () => {
    if (content.id) {
      navigate(`/content/${content.id}`)
    }
  }

  

  return (
    <div
      className="w-72 h-96 absolute rounded-[20px] overflow-hidden cursor-pointer"
      style={{ left: leftPosition, top: '128px' }}
      onClick={handleClick}
    >
      {/* 배경 이미지 전체 + 그라데이션 오버레이 */}
      {content.poster_url ? (
        <img src={content.poster_url} alt={content.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/90" />

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
              className="w-6 h-6 rounded overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center"
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

      {/* 태그들 - 좌하단 (무드가 있을 때만 표시) */}
      {moodIds.length > 0 && (
        <div className="absolute left-8 bottom-4 flex gap-2">
          {moodIds.map((moodId, tagIndex) => {
            const tagText = moodIdToKorean[moodId] || '로맨스'
            const tagColor = moodTagColors[moodId] || 'bg-[#ffbdbd]'

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
      )}
    </div>
  )
}

