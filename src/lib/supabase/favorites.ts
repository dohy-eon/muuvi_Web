import { supabase } from '../supabase.ts'
import type { Content } from '../../types/index.ts'

/**
 * 좋아요 추가
 */
export async function addFavorite(userId: string, contentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        content_id: contentId,
      })

    if (error) {
      // 이미 좋아요한 경우 무시 (중복 에러)
      if (error.code === '23505') {
        return true
      }
      console.error('좋아요 추가 실패:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('좋아요 추가 중 오류:', error)
    return false
  }
}

/**
 * 좋아요 삭제
 */
export async function removeFavorite(userId: string, contentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId)

    if (error) {
      console.error('좋아요 삭제 실패:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('좋아요 삭제 중 오류:', error)
    return false
  }
}

/**
 * 좋아요 상태 확인
 */
export async function isFavorite(userId: string, contentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없음
        return false
      }
      console.error('좋아요 상태 확인 실패:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('좋아요 상태 확인 중 오류:', error)
    return false
  }
}

/**
 * 사용자의 좋아요한 콘텐츠 목록 가져오기
 */
export async function getFavorites(userId: string): Promise<Content[]> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        content_id,
        contents:content_id (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('좋아요 목록 조회 실패:', error)
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
    console.error('좋아요 목록 조회 중 오류:', error)
    return []
  }
}

/**
 * 사용자의 좋아요 개수 가져오기
 */
export async function getFavoriteCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      console.error('좋아요 개수 조회 실패:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('좋아요 개수 조회 중 오류:', error)
    return 0
  }
}

