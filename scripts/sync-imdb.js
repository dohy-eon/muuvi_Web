require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// 인기 영화 가져오기
async function fetchPopularMovies() {
  const movies = []
  
  // 여러 페이지에서 가져오기
  for (let page = 1; page <= 5; page++) {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=ko-KR&page=${page}`
    )
    const data = await response.json()
    movies.push(...data.results)
  }
  
  return movies
}

// IMDB ID 가져오기
async function getImdbId(tmdbId) {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`
    )
    const data = await response.json()
    return data.external_ids?.imdb_id || null
  } catch (error) {
    return null
  }
}

// 콘텐츠 저장
async function saveContent(movie) {
  const imdbId = await getImdbId(movie.id)
  
  if (!imdbId) {
    console.log(`IMDB ID 없음: ${movie.title}`)
    return null
  }

  // 장르 이름 가져오기
  const genreResponse = await fetch(
    `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=ko-KR`
  )
  const genreData = await genreResponse.json()
  const genreMap = {}
  genreData.genres.forEach((g) => {
    genreMap[g.id] = g.name
  })

  const genres = movie.genre_ids.map((id) => genreMap[id] || '').filter(Boolean)

  const contentData = {
    title: movie.title,
    description: movie.overview,
    poster_url: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : null,
    imdb_id: imdbId,
    imdb_rating: movie.vote_average ? movie.vote_average / 2 : null,
    year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null,
    genre: '영화',
    tags: genres,
    url: `https://www.imdb.com/title/${imdbId}`,
  }

  const { data, error } = await supabase
    .from('contents')
    .upsert(contentData, {
      onConflict: 'imdb_id',
    })
    .select()
    .single()

  if (error) {
    console.error(`저장 실패: ${movie.title}`, error)
    return null
  }

  console.log(`저장 완료: ${movie.title}`)
  return data
}

// 메인 실행
async function main() {
  console.log('TMDB 데이터 동기화 시작...')
  
  const movies = await fetchPopularMovies()
  console.log(`${movies.length}개 영화 발견`)
  
  let savedCount = 0
  for (const movie of movies) {
    const content = await saveContent(movie)
    if (content) savedCount++
    
    // API 제한 방지
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  
  console.log(`동기화 완료: ${savedCount}개 저장`)
}

main().catch(console.error)

