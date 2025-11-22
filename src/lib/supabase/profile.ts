import { supabase } from '../supabase.ts'
import type { OnboardingData, Profile } from '../../types/index.ts'

/**
 * 사용자 프로필 저장 (온보딩 데이터)
 */
export async function saveProfile(
  userId: string,
  data: OnboardingData
): Promise<Profile | null> {
  try {
    // 먼저 기존 프로필 확인
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    let profile
    let error

    if (existingProfile) {
      // 업데이트
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({
          genre: data.genre,
          moods: data.moods,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single()

      profile = updated
      error = updateError
    } else {
      // 삽입
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          genre: data.genre,
          moods: data.moods,
        })
        .select()
        .single()

      profile = inserted
      error = insertError
    }

    if (error) {
      console.error('프로필 저장 실패:', error)
      return null
    }

    return profile
  } catch (error) {
    console.error('프로필 저장 중 오류:', error)
    return null
  }
}

/**
 * 사용자 프로필 가져오기
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle() // .single() 대신 .maybeSingle() 사용 - 레코드가 없어도 에러가 아님

    if (error) {
      console.error('프로필 조회 실패:', error)
      console.error('에러 상세:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return null
    }

    // data가 null이면 프로필이 없는 것 (정상)
    return data || null
  } catch (error) {
    console.error('프로필 조회 중 오류:', error)
    return null
  }
}

/**
 * [추가] 사용자의 구독 중인 OTT 목록 업데이트
 * 프로필이 없으면 먼저 생성합니다.
 */
export async function updateSubscribedOtts(
  userId: string,
  ottIds: string[]
): Promise<boolean> {
  try {
    // 먼저 프로필이 있는지 확인
    const existingProfile = await getProfile(userId)

    let result
    let error

    if (existingProfile) {
      // 프로필이 있으면 업데이트
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          subscribed_otts: ottIds,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()

      result = data
      error = updateError
    } else {
      // 프로필이 없으면 기본 프로필 생성 (OTT 정보만)
      console.log('⚠️ 프로필이 없어서 기본 프로필을 생성합니다.')
      
      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          genre: '영화', // 기본값 (나중에 온보딩에서 변경 가능)
          moods: [], // 기본값
          subscribed_otts: ottIds,
        })
        .select()
        .single()

      result = data ? [data] : null
      error = insertError
    }

    if (error) {
      console.error('OTT 구독 정보 업데이트/생성 실패:', error)
      console.error('에러 상세:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      
      // 컬럼이 없는 경우 에러 메시지 확인
      if (error.message?.includes('column') || error.message?.includes('subscribed_otts')) {
        console.error('⚠️ subscribed_otts 컬럼이 없습니다. Supabase에서 SQL을 실행해주세요:')
        console.error('ALTER TABLE profiles ADD COLUMN subscribed_otts text[] DEFAULT \'{}\';')
      }
      
      return false
    }

    if (!result || result.length === 0) {
      console.warn('⚠️ 업데이트/생성된 레코드가 없습니다.')
      return false
    }

    console.log('✅ OTT 구독 정보 업데이트/생성 성공:', result[0])
    return true
  } catch (error) {
    console.error('OTT 구독 정보 업데이트 중 오류:', error)
    return false
  }
}

