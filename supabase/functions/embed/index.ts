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
  try {
    const { text } = await req.json()
    if (!text) {
      throw new Error('Missing "text" property in request body')
    }

    // AI 모델 인스턴스 가져오기
    const embedder = await EmbeddingPipeline.getInstance()

    // 텍스트를 벡터로 변환
    const output = await embedder(text, {
      pooling: 'mean',
      normalize: true,
    })

    // 벡터 데이터 추출
    const vector = Array.from(output.data)

    return new Response(JSON.stringify({ vector }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})