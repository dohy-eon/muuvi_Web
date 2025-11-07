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
      .single()

    if (error) {
      console.error('프로필 조회 실패:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('프로필 조회 중 오류:', error)
    return null
  }
}

