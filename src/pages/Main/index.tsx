import { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { onboardingDataState } from '../../recoil/userState'
import { getProfile, saveProfile } from '../../lib/supabase/profile'
import { getRecommendations } from '../../lib/supabase/recommendations'
import type { Content } from '../../types'

export default function Main() {
  const [recommendations, setRecommendations] = useState<Content[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const onboardingData = useRecoilValue(onboardingDataState)

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        // 임시 user_id (실제로는 인증된 사용자 ID 사용)
        const userId = 'temp-user-id'

        // 프로필 가져오기 또는 생성
        let profile = await getProfile(userId)
        
        if (!profile && onboardingData) {
          // 프로필이 없으면 온보딩 데이터로 생성
          profile = await saveProfile(userId, onboardingData)
        }

        if (profile) {
          // 추천 콘텐츠 가져오기
          const contents = await getRecommendations(profile)
          setRecommendations(contents)
        }
      } catch (error) {
        console.error('추천 콘텐츠 로드 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecommendations()
  }, [onboardingData])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">추천 콘텐츠</h1>
        
        {isLoading ? (
          <p className="text-center text-gray-600">추천 콘텐츠를 불러오는 중...</p>
        ) : recommendations.length === 0 ? (
          <p className="text-center text-gray-600">추천 콘텐츠가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.map((content) => (
              <div
                key={content.id}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                {content.poster_url && (
                  <img
                    src={content.poster_url}
                    alt={content.title}
                    className="w-full h-64 object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="text-xl font-bold mb-2">{content.title}</h3>
                  {content.description && (
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {content.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    {content.imdb_rating && (
                      <span className="text-yellow-500 font-semibold">
                        ⭐ {content.imdb_rating}
                      </span>
                    )}
                    {content.year && (
                      <span className="text-gray-500 text-sm">{content.year}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
