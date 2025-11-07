import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { pipeline, env } from '@xenova/transformers'

// AI 모델은 싱글톤(한 번만 로드)으로 관리
class EmbeddingPipeline {
  static task = 'feature-extraction'
  static model = 'Xenova/all-MiniLM-L6-v2'
  static instance: any = null
  static loading: boolean = false
  static loadError: any = null

  static async getInstance(timeout: number = 50000) {
    // 이미 로드 실패한 경우
    if (this.loadError) {
      throw this.loadError
    }

    // 이미 로드된 경우
    if (this.instance !== null) {
      return this.instance
    }

    // 로딩 중인 경우 대기
    if (this.loading) {
      console.log('[모델] 로딩 중... 대기')
      // 최대 60초 대기
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        if (this.instance !== null) return this.instance
        if (this.loadError) throw this.loadError
      }
      throw new Error('Model loading timeout')
    }

    // 새로 로드
    this.loading = true
    try {
      console.log('[모델] 로드 시작')
      // Supabase 엣지 환경에 맞게 설정
      env.allowLocalModels = false
      env.useBrowserCache = false
      
      // 타임아웃과 함께 로드
      const loadPromise = pipeline(this.task, this.model)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model load timeout')), timeout)
      )
      
      this.instance = await Promise.race([loadPromise, timeoutPromise])
      console.log('[모델] 로드 완료')
      return this.instance
    } catch (error) {
      console.error('[모델] 로드 실패:', error)
      this.loadError = error
      throw error
    } finally {
      this.loading = false
    }
  }
}

serve(async (req) => {
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // OPTIONS 요청 처리 (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()
    
    // 입력 검증
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Missing "text" property in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 텍스트 길이 제한 (512자로 제한 - 모델 성능 고려)
    const truncatedText = text.slice(0, 512)
    console.log(`[임베딩 요청] 텍스트 길이: ${text.length} → ${truncatedText.length}`)

    // AI 모델 인스턴스 가져오기
    console.log('[임베딩] 모델 로드 중...')
    const embedder = await EmbeddingPipeline.getInstance()
    console.log('[임베딩] 모델 로드 완료')

    // 텍스트를 벡터로 변환
    console.log('[임베딩] 벡터 생성 중...')
    const output = await embedder(truncatedText, {
      pooling: 'mean',
      normalize: true,
    })

    // 벡터 데이터 추출
    const vector = Array.from(output.data)
    console.log(`[임베딩 성공] 벡터 크기: ${vector.length}`)

    return new Response(JSON.stringify({ vector }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[임베딩 에러]', error)
    console.error('[임베딩 에러 스택]', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})