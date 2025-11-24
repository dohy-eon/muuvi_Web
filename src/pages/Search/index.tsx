import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import BottomNavigation from '../../components/BottomNavigation'
import { languageState } from '../../recoil/userState'
import { searchTMDB, type NormalizedSearchResult } from '../../lib/tmdb/search'
import { getRecommendationsByText } from '../../lib/supabase/recommendations'
import VoiceVisualizer from '../../components/VoiceVisualizer'

type SearchResult = NormalizedSearchResult

const RECENT_KEY = 'muuvi_recent_searches_v1'

// [추가] 타입 정의 (Web Speech API)
interface IWindow extends Window {
  webkitSpeechRecognition: any
  SpeechRecognition: any
}

// [추가] 검색 페이지 텍스트
const SEARCH_TEXT = {
  ko: {
    back: '뒤로가기',
    placeholder: '작품 이름으로 검색',
    clear: '지우기',
    recentSearches: '최근 검색',
    clearAll: '모두 지우기',
    trending: '인기 검색어',
    noResults: '검색 결과가 없어요',
  },
  en: {
    back: 'Go Back',
    placeholder: 'Search by title',
    clear: 'Clear',
    recentSearches: 'Recent Searches',
    clearAll: 'Clear All',
    trending: 'Trending',
    noResults: 'No search results found',
  },
}

export default function Search() {
  const navigate = useNavigate()
  const language = useRecoilValue(languageState)
  const t = SEARCH_TEXT[language]
  const [query, setQuery] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [focused, setFocused] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null)
  const [recognition, setRecognition] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setRecent(parsed.slice(0, 10))
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
  }, [recent])

  const trending = useMemo(
    () => {
      // 인기 검색어는 언어별로 다르게 설정
      if (language === 'en') {
        return ['The Office', 'Breaking Bad', 'Stranger Things', 'Wicked', 'The Crown']
      }
      return ['태풍상사', '피지컬: 아시아', '환승연애', '위키드', '제4차 사랑혁명']
    },
    [language]
  )

  // [추가] 공통 AI 검색 함수 (검색어 -> 임베딩 -> 추천 결과 변환)
  const searchWithAI = async (text: string): Promise<SearchResult[]> => {
    try {
      const data = await getRecommendationsByText(text)
      
      // Content 타입을 UI용 SearchResult 타입으로 변환
      return data.map(item => ({
        id: item.id,
        title: item.title,
        year: item.year?.toString(),
        posterUrl: item.poster_url,
        mediaType: (item.genre === '영화' ? 'movie' : 'tv') as 'movie' | 'tv'
      }))
    } catch (e) {
      console.error('AI 검색 중 오류:', e)
      return []
    }
  }

  // [수정] 텍스트 검색 핸들러 (하이브리드 방식 적용)
  const handleSubmit = async (q?: string) => {
    const value = (q ?? query).trim()
    if (!value) return
    
    setIsSearching(true)
    // 최근 검색어 저장
    setRecent((prev) => {
      const next = [value, ...prev.filter((v) => v !== value)]
      return next.slice(0, 10)
    })
    setResults([])

    try {
      // 1. 우선 TMDB에서 '제목'으로 검색해봅니다.
      let data = await searchTMDB(value, language)
      
      // 2. 제목 검색 결과가 하나도 없다면? -> AI에게 물어봅니다.
      if (data.length === 0) {
        console.log('제목 검색 결과 없음, AI 추천으로 전환:', value)
        data = await searchWithAI(value)
      }
      
      setResults(data)
    } catch (e) {
      console.error('검색 실패:', e)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // [추가] 음성 인식 시작 핸들러
  const startListening = async () => {
    setIsListening(true)
    setQuery('') // 검색어 초기화

    try {
      // 1. 마이크 스트림 권한 요청 (비주얼라이저용)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setVoiceStream(stream)

      // 2. Speech Recognition 초기화
      const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow
      const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition
      
      if (!SpeechRecognitionAPI) {
        alert(language === 'en' 
          ? 'This browser does not support speech recognition. Please use Chrome.'
          : '이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.')
        setIsListening(false)
        return
      }

      const recognitionInstance = new SpeechRecognitionAPI()
      recognitionInstance.lang = language === 'en' ? 'en-US' : 'ko-KR'
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = true // 말하는 도중 결과 보기

      recognitionInstance.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
        setQuery(transcript) // 말하는 대로 검색창에 입력됨
      }

      recognitionInstance.onend = () => {
        stopListening()
        // 인식이 끝나면 자동으로 검색 실행
        if (inputRef.current && inputRef.current.value) {
          handleVoiceSubmit(inputRef.current.value)
        }
      }

      recognitionInstance.start()
      setRecognition(recognitionInstance)

    } catch (error) {
      console.error('마이크 접근 실패:', error)
      setIsListening(false)
      alert(language === 'en' ? 'Microphone permission is required.' : '마이크 권한이 필요합니다.')
    }
  }

  // [추가] 음성 인식 종료 핸들러
  const stopListening = () => {
    setIsListening(false)
    if (recognition) recognition.stop()
    if (voiceStream) {
      voiceStream.getTracks().forEach(track => track.stop())
      setVoiceStream(null)
    }
  }

  // [수정] 음성 검색 핸들러 (로직 재사용)
  const handleVoiceSubmit = async (text: string) => {
    if (!text.trim()) return
    
    setIsSearching(true)
    setResults([])
    
    try {
      // 음성 입력은 사용자가 '문장'으로 말할 확률이 높으므로 바로 AI 검색을 수행합니다.
      // (필요하다면 여기도 TMDB 검색을 먼저 하도록 통일할 수 있습니다)
      const data = await searchWithAI(text)
      setResults(data)
      
      // 최근 검색어 업데이트
      setRecent((prev) => {
        const next = [text, ...prev.filter((v) => v !== text)]
        return next.slice(0, 10)
      })
    } catch (e) {
      console.error('보이스 검색 실패:', e)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const showEmptyState = !query && !focused

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden overflow-x-hidden">
      {/* 상단 검색 바 */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            aria-label={t.back}
            className="shrink-0 flex items-center justify-center"
          >
            <svg 
              width="28" 
              height="28" 
              viewBox="0 0 28 28" 
              fill="none"
              className="transform -translate-x-0.5"
            >
              <path 
                d="M16 8L10 14L16 20" 
                stroke="#2e2c6a" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <div className={`flex-1 h-11 rounded-[14px] px-3 flex items-center gap-2 transition-all ${
            focused 
              ? 'bg-white border-2 border-[#2e2c6a]' 
              : 'bg-[#f0f2f4] border-2 border-transparent'
          }`}>
            {!focused && !query && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <circle cx="9" cy="9" r="7" stroke="#60646C" strokeWidth="1.5" />
                <path d="M14 14L18 18" stroke="#60646C" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            <input
              ref={inputRef}
              className="flex-1 h-full bg-transparent outline-none text-[15px] placeholder:text-[#9aa0a6]"
              placeholder={t.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isComposing) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            {/* [추가] 마이크 버튼 (검색어가 없을 때 표시) */}
            {!query && !isListening && (
              <button
                onClick={startListening}
                className="shrink-0 w-8 h-8 flex items-center justify-center text-[#2e2c6a]"
                aria-label="음성 검색"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                  <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                </svg>
              </button>
            )}
            {!focused && query && (
              <button
                onClick={() => {
                  setQuery('')
                  setResults([])
                  inputRef.current?.focus()
                }}
                aria-label={t.clear}
                className="shrink-0 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center"
              >
                <span className="text-[#60646C] text-sm">✕</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* [추가] 음성 인식 모달 (오버레이) */}
      {isListening && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-[320px] bg-white rounded-[24px] p-6 flex flex-col items-center shadow-2xl">
            
            {/* 1. 타이틀 */}
            <h3 className="text-[#2e2c6a] text-lg font-bold mb-2">
              {language === 'en' ? 'Listening... 👂' : '듣고 있어요... 👂'}
            </h3>
            <p className="text-gray-500 text-sm mb-6 text-center">
              {language === 'en' 
                ? <>Say something like<br/>"Recommend a movie for when I'm sad"</>
                : <>"우울할 때 볼만한 영화 추천해줘"<br/>라고 말해보세요.</>
              }
            </p>

            {/* 2. 비주얼라이저 (오디오 파형) */}
            <VoiceVisualizer stream={voiceStream} isListening={isListening} />

            {/* 3. 실시간 인식 텍스트 */}
            <div className="mt-6 h-12 flex items-center justify-center w-full">
              {query ? (
                <p className="text-xl font-medium text-black text-center animate-pulse">
                  "{query}"
                </p>
              ) : (
                <p className="text-gray-400 text-sm">
                  {language === 'en' ? 'Start speaking and text will appear' : '말씀하시면 텍스트가 표시됩니다'}
                </p>
              )}
            </div>

            {/* 4. 취소 버튼 */}
            <button
              onClick={stopListening}
              className="mt-6 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 hover:bg-red-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 스크롤 영역 */}
      <div className="h-full overflow-y-auto overflow-x-hidden bg-white pt-[68px] pb-24 relative">
        <div className="px-4">
          {/* 빈 상태: 최근/인기 검색어 */}
          {showEmptyState && (
            <div className="space-y-8">
              {!!recent.length && (
                <section>
                  <h3 className="text-[15px] font-semibold text-[#2e2c6a] mb-3">{t.recentSearches}</h3>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setQuery(item)
                          handleSubmit(item)
                        }}
                        className="px-3 h-8 rounded-full bg-[#f0f2f4] text-[13px] text-[#2e2c6a] hover:bg-[#e7e9ec]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => setRecent([])}
                      className="text-[12px] text-[#60646C] underline"
                    >
                      {t.clearAll}
                    </button>
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-[15px] font-semibold text-[#2e2c6a] mb-3">{t.trending}</h3>
                <div className="flex flex-wrap gap-2">
                  {trending.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setQuery(item)
                        handleSubmit(item)
                      }}
                      className="px-3 h-8 rounded-full bg-[#2e2c6a]/10 text-[13px] text-[#2e2c6a] hover:bg-[#2e2c6a]/15"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* 검색 중: 스켈레톤 */}
          {isSearching && (
            <div className="mt-2 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-20 h-28 rounded-[8px] bg-[#f0f2f4]" />
                  <div className="flex-1 py-1">
                    <div className="h-4 w-2/3 bg-[#f0f2f4] rounded mb-2" />
                    <div className="h-3 w-1/3 bg-[#f0f2f4] rounded mb-3" />
                    <div className="h-3 w-1/2 bg-[#f0f2f4] rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 결과 리스트 */}
          {!isSearching && !!results.length && (
            <div className="mt-2 space-y-4">
              {results.map((item) => {
                // UUID 형식인지 확인 (하이픈 포함 = Supabase 콘텐츠, 숫자만 = TMDB)
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
                const contentPath = isUUID 
                  ? `/content/${item.id}` // Supabase 콘텐츠 상세 페이지
                  : `/content/tmdb/${item.mediaType}/${item.id}` // TMDB 상세 페이지
                
                return (
                <button
                  key={item.id}
                  onClick={() => navigate(contentPath)}
                  className="w-full flex gap-3"
                >
                  <div className="w-20 h-28 rounded-[8px] bg-[#e7e9ec] overflow-hidden">
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#d8dbe0] to-[#f0f2f4]" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] font-semibold text-[#111827] line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-[12px] text-[#6b7280] mt-1">{item.year ?? ''}</p>
                  </div>
                </button>
                )
              })}
            </div>
          )}

          {/* 결과 없음 */}
          {!isSearching && query && results.length === 0 && !showEmptyState && (
            <div className="mt-12 text-center">
              <p className="text-[#60646C]">{t.noResults}</p>
            </div>
          )}
        </div>
      </div>

      {/* 하단 네비게이션 (글래스모피즘) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pt-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNavigation />
        </div>
      </div>
    </div>
  )
}

