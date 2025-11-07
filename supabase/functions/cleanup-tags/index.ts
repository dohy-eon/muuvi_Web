import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 영문 → 한글 번역 매핑
const tagTranslation: Record<string, string> = {
  'Action': '액션',
  'Adventure': '모험',
  'Animation': '애니메이션',
  'Comedy': '코미디',
  'Crime': '범죄',
  'Documentary': '다큐멘터리',
  'Drama': '드라마',
  'Family': '가족',
  'Fantasy': '판타지',
  'History': '역사',
  'Horror': '공포',
  'Music': '음악',
  'Mystery': '미스터리',
  'Romance': '로맨스',
  'Science Fiction': 'SF',
  'Sci-Fi': 'SF',
  'Thriller': '스릴러',
  'War': '전쟁',
  'Western': '서부',
  'Reality': '리얼리티',
  'Talk Show': '토크쇼',
  'News': '뉴스',
  'TV Movie': 'TV영화',
}

// 장르 키워드 매핑
const genreKeywords: Record<string, string[]> = {
  '애니메이션': ['애니메이션'],
  '드라마': ['드라마'],
  '예능': ['리얼리티', '토크쇼'],
}

console.log('Cleanup Tags Function Loaded')

serve(async (req) => {
  try {
    console.log('Starting tag cleanup...')
    
    // 1. 모든 콘텐츠 가져오기
    const { data: contents, error: fetchError } = await supabase
      .from('contents')
      .select('id, title, genre, tags')
      .not('tags', 'is', null)
    
    if (fetchError) throw fetchError
    
    console.log(`Total contents to process: ${contents?.length || 0}`)
    
    let updated = 0
    let errors = 0
    
    // 2. 각 콘텐츠 처리
    for (const content of contents || []) {
      try {
        if (!content.tags || content.tags.length === 0) continue
        
        // 2-1. 복합 태그 분리
        let cleanedTags = content.tags.flatMap((tag: string) => 
          tag.includes('&') 
            ? tag.split('&').map(t => t.trim()).filter(Boolean)
            : tag
        )
        
        // 2-2. 영문 → 한글 번역
        cleanedTags = cleanedTags.map((tag: string) => tagTranslation[tag] || tag)
        
        // 2-3. 중복 제거
        cleanedTags = [...new Set(cleanedTags)]
        
        // 2-4. 장르 감지
        let detectedGenre: string | null = null
        for (const [genre, keywords] of Object.entries(genreKeywords)) {
          if (keywords.some(keyword => cleanedTags.includes(keyword))) {
            detectedGenre = genre
            // 태그에서 장르 키워드 제거
            cleanedTags = cleanedTags.filter(tag => !keywords.includes(tag))
            break
          }
        }
        
        // 2-5. 태그가 비었으면 기본 태그 추가
        if (cleanedTags.length === 0) {
          const baseGenre = detectedGenre || content.genre || '영화'
          
          if (baseGenre === '예능') {
            cleanedTags = ['코미디', '리얼리티']
          } else if (baseGenre === '애니메이션') {
            cleanedTags = ['애니메이션']
          } else if (baseGenre === '드라마') {
            cleanedTags = ['드라마']
          } else {
            cleanedTags = ['영화']
          }
          
          console.log(`[기본 태그 추가] ${content.title}: ${cleanedTags.join(', ')}`)
        }
        
        // 2-6. 업데이트
        const updateData: any = {
          tags: cleanedTags
        }
        
        // 장르가 감지되었고, 기존 genre가 '영화'인 경우에만 업데이트
        if (detectedGenre && content.genre === '영화') {
          updateData.genre = detectedGenre
          console.log(`[장르 변경] ${content.title}: 영화 → ${detectedGenre}`)
        }
        
        const { error: updateError } = await supabase
          .from('contents')
          .update(updateData)
          .eq('id', content.id)
        
        if (updateError) {
          console.error(`[업데이트 실패] ${content.title}:`, updateError.message)
          errors++
        } else {
          updated++
          if (updated % 10 === 0) {
            console.log(`Progress: ${updated} / ${contents.length}`)
          }
        }
        
      } catch (e) {
        console.error(`[처리 실패] ${content.title}:`, e)
        errors++
      }
    }
    
    console.log(`Cleanup complete: ${updated} updated, ${errors} errors`)
    
    return new Response(
      JSON.stringify({ 
        message: 'Tag cleanup complete',
        updated,
        errors,
        total: contents?.length || 0
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
    
  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

