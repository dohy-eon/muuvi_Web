import { supabase } from '../supabase.ts'
import type { Content } from '../../types/index.ts'

/**
 * 관심없음 추가
 */
export async function addNotInterested(userId: string, contentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('not_interested')
      .insert({
        user_id: userId,
        content_id: contentId,
      })

    if (error) {
      // 이미 관심없음으로 표시한 경우 무시 (중복 에러)
      if (error.code === '23505') {
        return true
      }
      console.error('관심없음 추가 실패:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('관심없음 추가 중 오류:', error)
    return false
  }
}

/**
 * 관심없음 삭제 (취소)
 */
export async function removeNotInterested(userId: string, contentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('not_interested')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId)

    if (error) {
      console.error('관심없음 삭제 실패:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('관심없음 삭제 중 오류:', error)
    return false
  }
}

/**
 * 관심없음 상태 확인
 */
export async function isNotInterested(userId: string, contentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('not_interested')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없음
        return false
      }
      console.error('관심없음 상태 확인 실패:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('관심없음 상태 확인 중 오류:', error)
    return false
  }
}

/**
 * 사용자의 관심없음 콘텐츠 ID 목록 가져오기
 */
export async function getNotInterestedContentIds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('not_interested')
      .select('content_id')
      .eq('user_id', userId)

    if (error) {
      console.error('관심없음 목록 조회 실패:', error)
      return []
    }

    if (!data) {
      return []
    }

    return data.map((item) => item.content_id)
  } catch (error) {
    console.error('관심없음 목록 조회 중 오류:', error)
    return []
  }
}

/**
 * 사용자의 관심없음 콘텐츠 목록 가져오기
 */
export async function getNotInterestedContents(userId: string): Promise<Content[]> {
  try {
    const { data, error } = await supabase
      .from('not_interested')
      .select(`
        content_id,
        contents:content_id (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('관심없음 목록 조회 실패:', error)
      return []
    }

    if (!data) {
      return []
    }

    // contents 관계에서 콘텐츠 데이터 추출
    const contents = data
      .map((item: any) => item.contents)
      .filter((content: Content | null) => content !== null) as Content[]

    return contents
  } catch (error) {
    console.error('관심없음 목록 조회 중 오류:', error)
    return []
  }
}

/**
 * 사용자의 관심없음 개수 가져오기
 */
export async function getNotInterestedCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('not_interested')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      console.error('관심없음 개수 조회 실패:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('관심없음 개수 조회 중 오류:', error)
    return 0
  }
}

