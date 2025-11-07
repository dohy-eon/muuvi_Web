import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { pipeline, env } from 'https://esm.sh/@xenova/transformers'

// AI 모델은 싱글톤(한 번만 로드)으로 관리
class EmbeddingPipeline {
  static task = 'feature-extraction'
  static model = 'Xenova/all-MiniLM-L6-v2'
  static instance: any = null

  static async getInstance() {
    if (this.instance === null) {
      // Supabase 엣지 환경에 맞게 설정
      env.allowLocalModels = false
      env.useBrowserCache = false
      this.instance = await pipeline(this.task, this.model)
    }
    return this.instance
  }
}

serve(async (req) => {
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
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