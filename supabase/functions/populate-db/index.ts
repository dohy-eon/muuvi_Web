import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { fetchAndSaveRecommendations } from '../../../src/lib/imdb/fetchContent.ts'

const GENRES = ['영화', '드라마', '애니메이션', '예능']
const MOODS = ['01', '02', '03', '04', '05', '06', '07', '08', '09']

console.log('Populate DB Function Loaded (Single Job Mode)')

serve(async (req) => {
  try {
    // [수정] 36개 조합 중 1개만 선택
    const minute = new Date().getMinutes(); // 현재 '분' (0-59)
    const totalCombinations = GENRES.length * MOODS.length; // 4 * 9 = 36
    
    // 현재 '분'을 기준으로 36개 조합 중 하나를 선택
    // (0-35분은 0-35 인덱스, 36-59분은 0-23 인덱스 재사용)
    const index = minute % totalCombinations; 
    
    const genreIndex = Math.floor(index / MOODS.length);
    const moodIndex = index % MOODS.length;
    
    const genre = GENRES[genreIndex];
    const mood = MOODS[moodIndex];

    console.log(`Running population for index ${index}: ${genre} + ${mood}`);

    // [수정] 선택된 1개의 조합만 실행
    await fetchAndSaveRecommendations(genre, [mood]);

    return new Response(
      JSON.stringify({ message: `DB Population complete for: ${genre} + ${mood}` }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})

