import { supabase } from '../supabase.ts'
const isDeno = typeof Deno !== 'undefined'

async function getFunctionAuthHeaders() {
  let anonKey = ''
  let serviceKey = ''

  if (isDeno) {
    // @ts-ignore: Deno globals only in edge runtime
    anonKey =
      Deno.env.get('SUPABASE_ANON_KEY') ||
      Deno.env.get('VITE_SUPABASE_ANON_KEY') ||
      ''
    // @ts-ignore
    serviceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') ||
      ''
  } else if (typeof import.meta !== 'undefined') {
    anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
    serviceKey = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  }

  const session = await supabase.auth.getSession().catch(() => null)
  const accessToken = session?.data?.session?.access_token

  const headers: Record<string, string> = {}
  const token = accessToken || serviceKey || anonKey

  if (anonKey) {
    headers.apikey = anonKey
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}
import { moodsToImdbTags } from '../moodMapping.ts' // 1차 필터링을 위해 유지
import type { Content, Profile, OTTProvider } from '../../types/index.ts'

// [추가] 무드 ID를 한글로 변환 (검색어 생성용)
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

/**
 * 사용자 프로필 기반 AI 벡터 검색 추천
 * @param profile 사용자 프로필
 */
export async function getRecommendations(
  profile: Profile,
  _forceRefresh: boolean = false
): Promise<Content[]> {
  try {
    // 1. 사용자의 선택을 AI가 이해할 수 있는 "검색 텍스트"로 변환
    const moodNames = profile.moods.map(id => moodIdToKorean[id] || '').filter(Boolean).join(' ')
    const queryText = `${moodNames} ${profile.genre}`.trim() // 예: "로맨스 코미디 영화"
    const p_mood_tags = moodsToImdbTags(profile.moods)
    
    // 디버깅: 검색 쿼리 확인
    console.log('[추천 검색 쿼리]', {
      queryText,
      genre: profile.genre,
      moods: profile.moods,
      moodNames: moodNames,
      moodTags: p_mood_tags,
    })

    // [추가] 사용자의 구독 정보 확인
    const subscribedOtts = profile.subscribed_otts || []
    const hasSubscriptions = subscribedOtts.length > 0

    // 디버깅: 구독 정보 확인
    console.log('[OTT 필터링 정보]', {
      hasSubscriptions,
      subscribedOtts,
      subscribedOttsLength: subscribedOtts.length,
    })

    // 2. AI 벡터 검색 시도
    try {
      console.log(`[AI 추천 시도] "${queryText}" (구독필터: ${hasSubscriptions ? 'ON' : 'OFF'}, OTT: ${subscribedOtts.join(', ') || '없음'})`)
      
      // 검색 텍스트를 "검색 벡터"로 변환
      const { data: embedData, error: embedError } = await supabase.functions.invoke(
        'embed',
        { body: { text: queryText } }
      )
      
      if (embedError) {
        console.warn('[임베딩 실패] 태그 검색으로 폴백:', embedError.message)
        throw embedError
      }
      
      const query_vector = embedData.vector
      
      // DB의 'match_contents' 함수(RPC)를 호출
      // [수정] 필터링을 위해 더 많은 후보군(30개)을 가져옵니다.
      const { data, error } = await supabase.rpc('match_contents', {
        query_vector: query_vector,
        match_count: 30, // 10 -> 30 증가
        p_genre: profile.genre,
        p_mood_tags: p_mood_tags
      })

      if (error) {
        console.warn('[벡터 검색 실패] 태그 검색으로 폴백:', error.message)
        throw error
      }
      
      // [수정] OTT 필터링 로직 강화
      let contentsWithOTT = (data || []).filter(
        (content: Content) => content.ott_providers && content.ott_providers.length > 0
      )

      // 2. 사용자가 구독 서비스를 설정했다면, 해당 서비스가 포함된 콘텐츠만 필터링
      if (hasSubscriptions) {
        console.log(`[OTT 필터링 시작] ${contentsWithOTT.length}개 콘텐츠 중에서 구독 서비스(${subscribedOtts.join(', ')}) 필터링`)
        
        // 구독 중인 서비스가 하나라도 포함된 콘텐츠 필터링
        const subscribedContents = contentsWithOTT.filter((content: Content) => {
          const hasSubscribedProvider = content.ott_providers?.some((provider: OTTProvider) => {
            const providerIdStr = String(provider.provider_id)
            const isMatch = subscribedOtts.includes(providerIdStr)
            if (isMatch) {
              console.log(`[OTT 매칭] ${content.title} - Provider ID: ${providerIdStr}, Name: ${provider.provider_name}`)
            }
            return isMatch
          })
          return hasSubscribedProvider
        })
        
        console.log(`[OTT 필터링 결과] 구독 서비스 콘텐츠: ${subscribedContents.length}개`)
        
        // 만약 필터링 결과가 너무 적으면(예: 0개), 필터링을 완화하거나 원본을 사용하고 우선순위만 조정할 수도 있음
        // 여기서는 결과가 있으면 구독 컨텐츠만, 없으면 전체(OTT 있는) 컨텐츠를 보여주되 로그를 남김
        if (subscribedContents.length > 0) {
          contentsWithOTT = subscribedContents
          console.log(`[OTT 필터링 적용] ${subscribedContents.length}개 구독 서비스 콘텐츠만 반환`)
        } else {
          console.warn('[OTT 필터링 실패] 구독 중인 서비스의 콘텐츠가 없어 전체 OTT 콘텐츠를 반환합니다.')
          // 디버깅: OTT 제공자 정보 확인
          if (contentsWithOTT.length > 0) {
            console.log('[OTT 디버깅] 샘플 콘텐츠의 OTT 제공자:', {
              title: contentsWithOTT[0].title,
              providers: contentsWithOTT[0].ott_providers?.map((p: OTTProvider) => ({
                id: p.provider_id,
                name: p.provider_name,
                idStr: String(p.provider_id),
              })),
              subscribedIds: subscribedOtts,
            })
          }
        }
      }

      if (contentsWithOTT.length > 0) {
        console.log(`[AI 추천 성공] "${queryText}" => ${contentsWithOTT.length}개 반환`)
        // 최대 10개 반환 (관심없음 제외 후에도 충분한 개수 확보)
        return contentsWithOTT.slice(0, 10)
      }
      
      console.log('[AI 추천 결과 없음] 태그 검색으로 폴백')
      throw new Error('No AI results')
      
    } catch (aiError) {
      // 3. AI 검색 실패 시 태그 기반 검색으로 폴백
      console.log(`[태그 기반 검색] "${queryText}"`)
      
      let query = supabase.from('contents').select('*')
      
      // OTT 필터
      query = query.not('ott_providers', 'is', null)
      
      // 장르 필터
      if (profile.genre) {
        query = query.eq('genre', profile.genre)
      }
      
      // 무드 태그 필터
      if (p_mood_tags.length > 0) {
        query = query.overlaps('tags', p_mood_tags)
      }
      
      // 태그 검색도 충분히 많이 가져옵니다.
      const { data: tagData, error: tagError } = await query
        .order('imdb_rating', { ascending: false, nullsFirst: false })
        .limit(50)
      
      if (tagError) {
        console.error('[태그 검색 실패]:', tagError)
        return []
      }
      
      // OTT 필터링
      let contentsWithOTT = (tagData || []).filter(
        (content: Content) => content.ott_providers && content.ott_providers.length > 0
      )

      // OTT 필터링 (태그 검색에서도 동일하게 적용)
      if (hasSubscriptions) {
        console.log(`[태그 검색 OTT 필터링] ${contentsWithOTT.length}개 콘텐츠 중에서 구독 서비스(${subscribedOtts.join(', ')}) 필터링`)
        
        const subscribedContents = contentsWithOTT.filter((content: Content) => 
          content.ott_providers?.some((provider: OTTProvider) => 
            subscribedOtts.includes(String(provider.provider_id))
          )
        )
        
        if (subscribedContents.length > 0) {
          contentsWithOTT = subscribedContents
          console.log(`[태그 검색 OTT 필터링 적용] ${subscribedContents.length}개 구독 서비스 콘텐츠만 반환`)
        } else {
          console.warn('[태그 검색 OTT 필터링 실패] 구독 중인 서비스의 콘텐츠가 없어 전체 OTT 콘텐츠를 반환합니다.')
        }
      }
      
      console.log(`[태그 추천 성공] "${queryText}" => ${contentsWithOTT.length}개 반환`)

      if (contentsWithOTT.length === 0) {
        const primaryMood = profile.moods[0]
        if (profile.genre && primaryMood) {
          try {
            console.log(`[데이터 보충 요청] ${profile.genre} + ${primaryMood}`)
            const headers = await getFunctionAuthHeaders()

            await supabase.functions.invoke('populate-db', {
              body: {
                genre: profile.genre,
                mood: primaryMood,
              },
              headers,
            })
          } catch (populateError: any) {
            console.warn('[데이터 보충 실패]', populateError?.message || populateError)
          }
        }
      }

      // 최대 10개 반환 (관심없음 제외 후에도 충분한 개수 확보)
      return contentsWithOTT.slice(0, 10)
    }
    
  } catch (error) {
    console.error('추천 조회 실패:', error)
    return []
  }
}

/**
 * 콘텐츠 ID로 상세 정보 가져오기
 */
export async function getContentById(id: string): Promise<Content | null> {
  try {
    const { data, error } = await supabase
      .from('contents')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('콘텐츠 조회 실패:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('콘텐츠 조회 중 오류:', error)
    return null
  }
}

/**
 * IMDB 데이터를 Supabase에 동기화하는 함수
 * (백엔드에서 주기적으로 실행하거나 Edge Function으로 구현)
 */
export async function syncImdbContent(imdbId: string): Promise<Content | null> {
  try {
    // IMDB API 호출 (Supabase Edge Function 또는 외부 API 사용)
    // 예시: Supabase Edge Function을 통해 IMDB 데이터 가져오기
    const { data, error } = await supabase.functions.invoke('fetch-imdb', {
      body: { imdb_id: imdbId },
    })

    if (error) {
      console.error('IMDB 동기화 실패:', error)
      return null
    }

    // 콘텐츠 저장
    const { data: content, error: insertError } = await supabase
      .from('contents')
      .upsert({
        imdb_id: imdbId,
        title: data.title,
        description: data.plot,
        poster_url: data.poster,
        imdb_rating: data.rating,
        year: data.year,
        genres: data.genres,
        tags: data.tags,
      })
      .select()
      .single()

    if (insertError) {
      console.error('콘텐츠 저장 실패:', insertError)
      return null
    }

    return content
  } catch (error) {
    console.error('IMDB 동기화 중 오류:', error)
    return null
  }
}

