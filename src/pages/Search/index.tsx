import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNavigation from '../../components/BottomNavigation'

type SearchResult = {
  id: string
  title: string
  year?: string
  posterUrl?: string
  ott?: string[]
}

const RECENT_KEY = 'muuvi_recent_searches_v1'

export default function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [focused, setFocused] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setRecent(parsed.slice(0, 10))
        }
      } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
  }, [recent])

  const trending = useMemo(
    () => ['인기', '최신', '액션', '로맨스', '스릴러', '코미디', 'SF', '드라마'],
    []
  )

  const handleSubmit = (q?: string) => {
    const value = (q ?? query).trim()
    if (!value) return
    setIsSearching(true)
    // 최근 검색어 업데이트
    setRecent((prev) => {
      const next = [value, ...prev.filter((v) => v !== value)]
      return next.slice(0, 10)
    })
    // 실제 검색 API 연결 전까지 스켈레톤 후 더미 결과 표시
    setResults([])
    setTimeout(() => {
      const dummy: SearchResult[] = Array.from({ length: 6 }).map((_, i) => ({
        id: `${value}-${i}`,
        title: `${value} 결과 ${i + 1}`,
        year: `${2018 + (i % 6)}`,
        posterUrl: undefined,
        ott: i % 2 === 0 ? ['Netflix'] : ['Disney+'],
      }))
      setResults(dummy)
      setIsSearching(false)
    }, 600)
  }

  const showEmptyState = !query && !focused

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden overflow-x-hidden">
      {/* 상단 검색 바 */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
            className="shrink-0 w-9 h-9 rounded-full bg-[#2e2c6a]/10 flex items-center justify-center"
          >
            <span className="inline-block w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-[#2e2c6a]" />
          </button>
          <div className="flex-1 h-11 rounded-[14px] bg-[#f0f2f4] px-3 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="7" stroke="#60646C" strokeWidth="1.5" />
              <path d="M14 14L18 18" stroke="#60646C" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              className="flex-1 h-full bg-transparent outline-none text-[15px] placeholder:text-[#9aa0a6]"
              placeholder="작품, 배우, 키워드 검색"
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
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setResults([])
                  inputRef.current?.focus()
                }}
                aria-label="지우기"
                className="shrink-0 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center"
              >
                <span className="text-[#60646C] text-sm">✕</span>
              </button>
            )}
            <button
              onClick={() => handleSubmit()}
              className="shrink-0 h-8 px-3 rounded-full bg-[#2e2c6a] text-white text-sm font-medium"
            >
              검색
            </button>
          </div>
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div className="h-full overflow-y-auto overflow-x-hidden bg-white pt-[68px] pb-24 relative">
        <div className="px-4">
          {/* 빈 상태: 최근/인기 검색어 */}
          {showEmptyState && (
            <div className="space-y-8">
              {!!recent.length && (
                <section>
                  <h3 className="text-[15px] font-semibold text-[#2e2c6a] mb-3">최근 검색</h3>
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
                      모두 지우기
                    </button>
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-[15px] font-semibold text-[#2e2c6a] mb-3">인기 검색어</h3>
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
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/content/${item.id}`)}
                  className="w-full flex gap-3"
                >
                  <div className="w-20 h-28 rounded-[8px] bg-[#e7e9ec] overflow-hidden">
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
                    <div className="flex gap-1 mt-2">
                      {(item.ott ?? []).map((o) => (
                        <span
                          key={o}
                          className="px-2 h-6 rounded-full bg-[#2e2c6a]/10 text-[#2e2c6a] text-[11px] inline-flex items-center"
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 결과 없음 */}
          {!isSearching && query && results.length === 0 && !showEmptyState && (
            <div className="mt-12 text-center">
              <p className="text-[#60646C]">검색 결과가 없어요</p>
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

