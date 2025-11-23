import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNavigation from '../../components/BottomNavigation'
import { buildPosterUrl, getTMDBDetail, TMDBDetail } from '../../lib/tmdb/search'

export default function ContentTMDB() {
  const navigate = useNavigate()
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>()
  const [detail, setDetail] = useState<TMDBDetail | null>(null)
  // no explicit loading UI; we still fetch but render progressively
  const [isBackgroundDark, setIsBackgroundDark] = useState(true)
  const [ageRating, setAgeRating] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<string | null>(null)
  const [genres, setGenres] = useState<Array<{ id: number; name: string }>>([])
  const [cast, setCast] = useState<Array<{ id: number; name: string; character: string; profile_path: string | null }>>([])
  const [director, setDirector] = useState<string | null>(null)
  const [writer, setWriter] = useState<string | null>(null)
  const [mediaItems, setMediaItems] = useState<Array<{ type: 'video' | 'image'; url: string; thumbnail: string }>>([])
  const [ottProviders, setOttProviders] = useState<
    Array<{ provider_id: number; provider_name: string; logo_path?: string; type: 'flatrate' | 'free' | 'rent' | 'buy' }>
  >([])
  const [selectedFilter, setSelectedFilter] = useState<'flatrate' | 'free' | 'rent' | 'buy' | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!type || !id) return
      try {
        const data = await getTMDBDetail(type, id)
        if (mounted) {
          if (!data) {
            // TMDB에서 데이터를 찾을 수 없는 경우
            console.error('TMDB 상세 정보를 찾을 수 없습니다:', { type, id })
            return
          }
          setDetail(data)
          // 기본 정보
          const g = (data as any).genres ?? []
          setGenres(g)

          // 연령등급
          if (type === 'movie') {
            const rel = (data as any).release_dates?.results?.find((r: any) => r.iso_3166_1 === 'KR')
            const cert = rel?.release_dates?.[0]?.certification || null
            setAgeRating(cert || null)
            const rt = (data as any).runtime
            if (rt) {
              const h = Math.floor(rt / 60)
              const m = rt % 60
              setRuntime(h > 0 ? `${h}시간 ${m}분` : `${m}분`)
            } else {
              setRuntime(null)
            }
          } else {
            const ratings = (data as any).content_ratings?.results || []
            const kr = ratings.find((r: any) => r.iso_3166_1 === 'KR')
            let rating = kr?.rating || null
            if (!rating) {
              const us = ratings.find((r: any) => r.iso_3166_1 === 'US')
              rating = us?.rating || null
              if (!rating) {
                rating = ratings?.[0]?.rating || null
              }
            }
            setAgeRating(rating)
            const epi = (data as any).episode_run_time?.[0]
            if (epi) {
              const h = Math.floor(epi / 60)
              const m = epi % 60
              setRuntime(h > 0 ? `${h}시간 ${m}분` : `${m}분`)
            } else {
              setRuntime(null)
            }
          }

          // 출연/제작
          const credits = (data as any).credits
          if (credits) {
            const castList = (credits.cast || []).slice(0, 6).map((actor: any) => ({
              id: actor.id,
              name: actor.name || '',
              character: actor.character || actor.roles?.[0]?.character || '',
              profile_path: actor.profile_path
                ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                : null,
            }))
            setCast(castList)
            const crew: any[] = credits.crew || []
            // 감독: Director 우선, 없으면 Directing 부서 최상위, TV는 Executive Producer 보조
            const directorCandidate =
              crew.find((p) => p.job === 'Director') ||
              crew.find((p) => p.department === 'Directing') ||
              (type === 'tv' ? crew.find((p) => p.job === 'Executive Producer') : undefined)
            setDirector(directorCandidate?.name ?? null)
            // 극본: Writer, Screenplay, Story, Novel, TV는 Creator 포함
            let writerCandidate =
              crew.find((p) => p.job === 'Writer') ||
              crew.find((p) => p.job === 'Screenplay') ||
              crew.find((p) => p.job === 'Story') ||
              crew.find((p) => p.job === 'Novel') ||
              (type === 'tv' ? crew.find((p) => p.job === 'Creator') : undefined)
            if (!writerCandidate && type === 'tv') {
              const createdBy = (data as any).created_by
              if (Array.isArray(createdBy) && createdBy.length > 0) {
                setWriter(createdBy.map((c: any) => c.name).filter(Boolean).join(', '))
              } else {
                setWriter(null)
              }
            } else {
              setWriter(writerCandidate?.name ?? null)
            }
          }

          // 이미지/비디오
          fetchMedia(type, id).then((items) => mounted && setMediaItems(items))
          // OTT 제공자
          fetchOttProviders(type, id).then((providers) => mounted && setOttProviders(providers))
        }
      } finally {
      }
    })()
    return () => {
      mounted = false
    }
  }, [type, id])

  const title =
    (detail && ('title' in detail ? detail.title : detail.name)) || '상세'
  const year = (() => {
    if (!detail) return ''
    if ('release_date' in detail) return detail.release_date?.slice(0, 4) || ''
    return (detail as any).first_air_date?.slice(0, 4) || ''
  })()
  const poster = buildPosterUrl(detail && detail.poster_path)
  // const backdrop = buildBackdropUrl(detail && detail.backdrop_path)

  const filteredOttProviders = selectedFilter ? ottProviders.filter((p) => p.type === selectedFilter) : ottProviders
  const flatrateCount = ottProviders.filter((p) => p.type === 'flatrate').length
  const freeCount = ottProviders.filter((p) => p.type === 'free').length
  const rentCount = ottProviders.filter((p) => p.type === 'rent').length
  const buyCount = ottProviders.filter((p) => p.type === 'buy').length

  // 필터 미선택 시 동일 플랫폼(예: wavve)이 여러 타입으로 중복 노출되는 문제 방지
  const dedupedOttProviders = (() => {
    const priority: Record<'flatrate' | 'free' | 'rent' | 'buy', number> = {
      flatrate: 0,
      free: 1,
      rent: 2,
      buy: 3,
    }
    const map = new Map<number, { provider_id: number; provider_name: string; logo_path?: string; type: 'flatrate' | 'free' | 'rent' | 'buy' }>()
    for (const p of ottProviders) {
      const existing = map.get(p.provider_id)
      if (!existing) {
        map.set(p.provider_id, p)
      } else {
        // 더 높은 우선순위 타입을 유지
        if (priority[p.type] < priority[existing.type]) {
          map.set(p.provider_id, p)
        }
      }
    }
    return Array.from(map.values())
  })()

  const displayOttProviders = selectedFilter ? filteredOttProviders : dedupedOttProviders

  const handleFilterClick = useCallback((ft: 'flatrate' | 'free' | 'rent' | 'buy') => {
    setSelectedFilter((prev) => (prev === ft ? null : ft))
  }, [])

  useEffect(() => {
    if (poster) {
      setIsBackgroundDark(true)
    } else {
      setIsBackgroundDark(false)
    }
  }, [poster])

  return (
    <div className="w-full h-screen bg-white relative font-pretendard overflow-hidden">
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="h-full overflow-y-auto bg-white">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-[20px] left-5 z-20 w-6 h-6 flex items-center justify-center"
          aria-label="뒤로가기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-6 h-6 ${isBackgroundDark ? 'text-white' : 'text-black'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 메인 포스터 배경 (378px 높이) */}
        <div className="relative w-full h-[378px] overflow-hidden">
          {poster && (
            <>
              <img
                src={poster}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black" />
            </>
          )}

          {/* 포스터 위 정보 오버레이 */}
          <div className="absolute inset-0 flex flex-col justify-end pb-4 px-5">
            {/* 제목 */}
            <h1 className="text-[20px] font-bold text-white mb-1 text-center">
              {title}
            </h1>
            {/* 장르 • 연도 */}
            <p className="text-[14px] font-normal text-white text-center mb-4">
              {(type === 'movie' ? '영화' : 'TV') } • {year}
            </p>
            {/* OTT 아이콘 및 장르 태그 */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {displayOttProviders.slice(0, 2).map((provider, index) => (
                <div
                  key={provider.provider_id || index}
                  className="w-5 h-5 rounded-[6px] overflow-hidden"
                >
                  {provider.logo_path ? (
                    <img
                      src={provider.logo_path}
                      alt={provider.provider_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-400" />
                  )}
                </div>
              ))}
              {/* 장르 태그 (최대 2개) */}
              {genres.slice(0, 2).map((g) => (
                <div
                  key={g.id}
                  className="h-5 bg-[#9b59b6] rounded-[6px] px-2 flex items-center justify-center"
                >
                  <span className="text-[10px] font-normal text-white whitespace-nowrap">
                    {g.name}
                  </span>
                </div>
              ))}
            </div>

            {/* 우측 하단 포스터 썸네일 */}
            {poster && (
              <div className="absolute right-[20px] bottom-[20px] w-[84px] h-[120px] rounded-[6px] overflow-hidden">
                <img
                  src={poster}
                  alt={`${title} poster`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* 줄거리 섹션 (검은 배경) */}
        {detail?.overview && (
          <div className="w-full min-h-[105px] bg-[#010100] px-5 py-4">
            <p className="text-[14px] font-normal text-white leading-[1.5]">
              {detail.overview}
            </p>
          </div>
        )}

        {/* 소개 박스 */}
        <div className="mx-5 mt-5 mb-6 border border-black/10 rounded-[20px] px-4 py-4">
          <div className="space-y-[15px]">
            {/* 원제 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">원제</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {title || '-'}
              </p>
            </div>
            {/* 장르 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">장르</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {genres.map((g) => g.name).join(', ') || '-'}
              </p>
            </div>
            {/* 개봉일 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">개봉일</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {year ? `${year}년` : '-'}
              </p>
            </div>
            {/* 연령등급 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">연령등급</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {ageRating || '-'}
              </p>
            </div>
            {/* 러닝타임 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">러닝타임</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {runtime || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* 보러가기 섹션 */}
        <div className="px-5 mb-6">
          <h2 className="text-[16px] font-bold text-black mb-4">보러가기</h2>
          {/* OTT 필터 */}
          <div className="flex items-center gap-6 mb-4">
            <button
              onClick={() => handleFilterClick('flatrate')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'flatrate' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">정액제 {flatrateCount}</p>
              <div className={`w-[55px] h-[2px] border-b ${selectedFilter === 'flatrate' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
            </button>
            <button
              onClick={() => handleFilterClick('free')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'free' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">무료 {freeCount}</p>
              <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'free' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
            </button>
            <button
              onClick={() => handleFilterClick('rent')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'rent' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">대여 {rentCount}</p>
              <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'rent' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
            </button>
            <button
              onClick={() => handleFilterClick('buy')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'buy' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">구매 {buyCount}</p>
              <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'buy' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
            </button>
          </div>

          {/* OTT 제공자 버튼들 */}
          <div className="space-y-3">
            {displayOttProviders.length > 0 ? (
              displayOttProviders.map((provider, index) => (
                <button
                  key={provider.provider_id || index}
                  className="w-full h-9 border border-[#2e2c6a] rounded-[12px] flex items-center justify-between px-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {provider.logo_path && (
                      <div className="w-5 h-5 rounded-[6px] overflow-hidden">
                        <img
                          src={provider.logo_path}
                          alt={provider.provider_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <span className="text-[14px] font-normal text-[#2e2c6a]">
                      {provider.provider_name}
                    </span>
                  </div>
                  <svg
                    className="w-4 h-4 text-[#2e2c6a] rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              ))
            ) : (
              <p className="text-[14px] font-normal text-gray-500 text-center py-4">
                {selectedFilter ? '해당 타입으로 시청 가능한 플랫폼이 없습니다.' : '시청 가능한 플랫폼이 없습니다.'}
              </p>
            )}
          </div>
        </div>

        {/* 출연진/제작진 섹션 */}
        <div className="px-5 mb-6">
          <h2 className="text-[16px] font-semibold text-black mb-4">출연진/제작진</h2>
          {/* 출연진 그리드 */}
          {cast.length > 0 ? (
            <div className="grid grid-cols-3 gap-x-4 gap-y-4 mb-4">
              {cast.map((actor) => (
                <div key={actor.id} className="flex flex-col items-center min-w-0 max-w-[100px] mx-auto">
                  <div className="w-20 h-20 rounded-full bg-gray-300 mb-2 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {actor.profile_path ? (
                      <img
                        src={actor.profile_path}
                        alt={actor.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="bg-gray-900 rounded-[10px] px-1.5 py-0.5 mb-1 w-full min-w-0">
                    <span
                      className="text-[14px] font-normal text-white block truncate text-center"
                      title={actor.character || '출연'}
                    >
                      {actor.character || '출연'}
                    </span>
                  </div>
                  <span
                    className="text-[14px] font-normal text-gray-900 text-center w-full truncate block min-w-0"
                    title={actor.name}
                  >
                    {actor.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[14px] font-normal text-gray-500 text-center py-4">
              출연진 정보가 없습니다.
            </div>
          )}

          {/* 구분선 */}
          <div className="w-full h-[1px] border-t border-[#2e2c6a] my-4" />

          {/* 감독/극본 */}
          <div className="space-y-4">
            {director && (
              <div className="flex items-start gap-4">
                <span className="text-[16px] font-normal text-black flex-shrink-0">감독</span>
                <span
                  className="text-[16px] font-normal text-[#7a8dd6] flex-1 truncate"
                  title={director}
                >
                  {director}
                </span>
              </div>
            )}
            {writer && (
              <div className="flex items-start gap-4">
                <span className="text-[16px] font-normal text-black flex-shrink-0">극본</span>
                <span
                  className="text-[16px] font-normal text-[#7a8dd6] flex-1 truncate"
                  title={writer}
                >
                  {writer}
                </span>
              </div>
            )}
            {!director && !writer && (
              <div className="text-[14px] font-normal text-gray-500">
                제작진 정보가 없습니다.
              </div>
            )}
          </div>

          {/* 더보기 버튼 */}
          <button className="w-full h-[52px] bg-[#2e2c6a] rounded-[10px] mt-6 flex items-center justify-center">
            <span className="text-[16px] font-semibold text-white">출연진/제작진 더보기</span>
          </button>
        </div>

        {/* 영상 및 포스터 콜라주 섹션 */}
        <div className="px-5 mb-6">
          <h2 className="text-[16px] font-semibold text-black mb-4">영상 및 포스터 콜라주</h2>
          {mediaItems.length > 0 ? (
            <div className="space-y-3">
              {/* 첫 번째 행 (2개) */}
              {mediaItems.length > 0 && (
                <div className="flex gap-3">
                  {mediaItems.slice(0, 2).map((item, index) => {
                    const widths = [300, 190]
                    return (
                      <div
                        key={index}
                        className="h-32 rounded overflow-hidden cursor-pointer relative group"
                        style={{ width: `${widths[index]}px` }}
                        onClick={() => {
                          if (item.type === 'video') {
                            window.open(item.url, '_blank')
                          } else {
                            window.open(item.url, '_blank')
                          }
                        }}
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.type === 'video' ? '비디오' : '포스터'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = ''
                            target.style.backgroundColor = '#d1d5db'
                          }}
                        />
                        {item.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {mediaItems.length < 2 && <div className="h-32 w-[190px] bg-gray-300 rounded" />}
                </div>
              )}
              {/* 두 번째 행 (2개) */}
              {mediaItems.length > 2 && (
                <div className="flex gap-3">
                  {mediaItems.slice(2, 4).map((item, index) => (
                    <div
                      key={index + 2}
                      className="h-32 w-[210px] rounded overflow-hidden cursor-pointer relative group"
                      style={{ width: '210px' }}
                      onClick={() => {
                        if (item.type === 'video') {
                          window.open(item.url, '_blank')
                        } else {
                          window.open(item.url, '_blank')
                        }
                      }}
                    >
                      <img
                        src={item.thumbnail}
                        alt={item.type === 'video' ? '비디오' : '포스터'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = ''
                          target.style.backgroundColor = '#d1d5db'
                        }}
                      />
                      {item.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                  {mediaItems.length < 4 && <div className="h-32 w-[210px] bg-gray-300 rounded" />}
                </div>
              )}
              {/* 세 번째 행 (3개) */}
              {mediaItems.length > 4 && (
                <div className="flex gap-3">
                  {mediaItems.slice(4, 7).map((item, index) => {
                    const widths = [144, 147, 188]
                    return (
                      <div
                        key={index + 4}
                        className="h-32 rounded overflow-hidden cursor-pointer relative group"
                        style={{ width: `${widths[index]}px` }}
                        onClick={() => {
                          if (item.type === 'video') {
                            window.open(item.url, '_blank')
                          } else {
                            window.open(item.url, '_blank')
                          }
                        }}
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.type === 'video' ? '비디오' : '포스터'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = ''
                            target.style.backgroundColor = '#d1d5db'
                          }}
                        />
                        {item.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {mediaItems.length < 7 && (
                    <>
                      {mediaItems.length === 5 && <div className="h-32 w-[147px] bg-gray-300 rounded" />}
                      {mediaItems.length === 6 && <div className="h-32 w-[188px] bg-gray-300 rounded" />}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[14px] font-normal text-gray-500 text-center py-4">
              영상 및 포스터 정보가 없습니다.
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

async function fetchOttProviders(
  type: 'movie' | 'tv',
  id: string
): Promise<Array<{ provider_id: number; provider_name: string; logo_path?: string; type: 'flatrate' | 'free' | 'rent' | 'buy' }>> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  if (!apiKey) return []
  const endpoint = type === 'movie' ? 'movie' : 'tv'
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}/${id}/watch/providers`)
  // watch/providers는 language 파라미터 무시되지만 형식을 통일
  if (!apiKey.startsWith('eyJ')) {
    url.searchParams.set('api_key', apiKey)
  }
  const res = await fetch(url.toString(), {
    headers: apiKey.startsWith('eyJ') ? { Authorization: `Bearer ${apiKey}` } : undefined,
  }).catch(() => null)
  if (!res || !res.ok) return []
  const json = await res.json()
  // KR가 비어있을 때를 대비해 US, JP 순으로 fallback
  const regionOrder = ['KR', 'US', 'JP']
  const regionKey = regionOrder.find((code) => json?.results?.[code]) as 'KR' | 'US' | 'JP' | undefined
  const region = regionKey ? json.results[regionKey] : null
  if (!region) return []
  const list: Array<{ provider_id: number; provider_name: string; logo_path?: string; type: 'flatrate' | 'free' | 'rent' | 'buy' }> = []
  ;(['flatrate', 'free', 'rent', 'buy'] as const).forEach((k) => {
    const arr = (region as any)[k]
    if (Array.isArray(arr)) {
      arr.forEach((p: any) => {
        list.push({
          provider_id: p.provider_id,
          provider_name: p.provider_name,
          logo_path: p.logo_path ? `https://image.tmdb.org/t/p/w300${p.logo_path}` : undefined,
          type: k,
        })
      })
    }
  })
  return list
}

async function fetchMedia(
  type: 'movie' | 'tv',
  id: string
): Promise<Array<{ type: 'video' | 'image'; url: string; thumbnail: string }>> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  if (!apiKey) return []
  const endpoint = type === 'movie' ? 'movie' : 'tv'
  const headers = apiKey.startsWith('eyJ') ? { Authorization: `Bearer ${apiKey}` } : undefined
  const videosUrl = new URL(`https://api.themoviedb.org/3/${endpoint}/${id}/videos`)
  const imagesUrl = new URL(`https://api.themoviedb.org/3/${endpoint}/${id}/images`)
  videosUrl.searchParams.set('language', 'ko-KR')
  if (!apiKey.startsWith('eyJ')) {
    videosUrl.searchParams.set('api_key', apiKey)
    imagesUrl.searchParams.set('api_key', apiKey)
  }
  const [videosRes, imagesRes] = await Promise.all([
    fetch(videosUrl.toString(), { headers }).catch(() => null),
    fetch(imagesUrl.toString(), { headers }).catch(() => null),
  ])
  const items: Array<{ type: 'video' | 'image'; url: string; thumbnail: string }> = []
  if (videosRes && videosRes.ok) {
    const vd = await videosRes.json()
    const vids = (vd.results || [])
      .filter((v: any) => v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip')
      .slice(0, 3)
    vids.forEach((v: any) => {
      if (v.key) {
        items.push({
          type: 'video',
          url: `https://www.youtube.com/watch?v=${v.key}`,
          thumbnail: `https://img.youtube.com/vi/${v.key}/hqdefault.jpg`,
        })
      }
    })
  }
  if (imagesRes && imagesRes.ok) {
    const im = await imagesRes.json()
    const backdrops = (im.backdrops || []).slice(0, 4)
    backdrops.forEach((b: any) => {
      if (b.file_path) {
        items.push({
          type: 'image',
          url: `https://image.tmdb.org/t/p/original${b.file_path}`,
          thumbnail: `https://image.tmdb.org/t/p/w500${b.file_path}`,
        })
      }
    })
    const posters = (im.posters || []).slice(0, 2)
    posters.forEach((p: any) => {
      if (p.file_path) {
        items.push({
          type: 'image',
          url: `https://image.tmdb.org/t/p/original${p.file_path}`,
          thumbnail: `https://image.tmdb.org/t/p/w500${p.file_path}`,
        })
      }
    })
  }
  return items.slice(0, 9)
}


