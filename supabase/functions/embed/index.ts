import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// OpenAI Embeddings API
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings'

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API Key is not set in function secrets.')
    }

    const { text } = await req.json()
    if (!text) {
      throw new Error('Missing "text" property in request body')
    }

    console.log(`[임베딩 요청] 텍스트: "${text.slice(0, 50)}..."`)

    // 3. OpenAI Embeddings API 호출
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // 1536 차원, 저렴함
        input: text,
        encoding_format: 'float'
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[OpenAI API 에러] ${response.status}: ${errorBody}`)
      throw new Error(`OpenAI API Error: ${response.status} ${errorBody}`)
    }

    // 4. 벡터 결과 반환
    const data = await response.json()
    const vector = data.data[0].embedding
    
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
