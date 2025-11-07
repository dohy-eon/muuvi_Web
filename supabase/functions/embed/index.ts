import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2'

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // localhost 및 향후 배포 도메인 허용
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. OPTIONS (preflight) 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Supabase Secret에서 API 키 가져오기
    const hfApiKey = Deno.env.get('HF_API_KEY')
    if (!hfApiKey) {
      throw new Error('Hugging Face API Key is not set in function secrets.')
    }

    const { text } = await req.json()
    if (!text) {
      throw new Error('Missing "text" property in request body')
    }

    console.log(`[임베딩 요청] 텍스트: "${text.slice(0, 50)}..."`)

    // 3. Hugging Face Inference API 호출
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfApiKey}`
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true }
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[HF API 에러] ${response.status}: ${errorBody}`)
      throw new Error(`Hugging Face API Error: ${response.status} ${errorBody}`)
    }

    // 4. 벡터 결과 반환
    const vectors = await response.json()
    
    // Hugging Face 응답은 [ [ ... ] ] 형태일 수 있으므로 0번째 벡터를 사용
    const vector = Array.isArray(vectors[0]) ? vectors[0] : vectors
    
    console.log(`[임베딩 성공] 벡터 크기: ${vector.length}`)

    return new Response(JSON.stringify({ vector }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[임베딩 에러]', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
