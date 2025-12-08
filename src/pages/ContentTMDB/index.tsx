import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import BottomNavigation from '../../components/BottomNavigation'
import { languageState } from '../../recoil/userState'
import { buildPosterUrl } from '../../lib/tmdb/search'
import { useTMDBDetail, useTMDBCredits, useTMDBProviders, useTMDBMedia } from '../../hooks/useTMDB'
import { useContentData } from '../../hooks/useContentData'

// UI 텍스트 번역
const CONTENT_TMDB_TEXT = {
  ko: {
    back: '뒤로가기',
    originalTitle: '원제',
    genre: '장르',
    releaseDate: '개봉일',
    ageRating: '연령등급',
    runtime: '러닝타임',
    watch: '보러가기',
    flatrate: '정액제',
    free: '무료',
    rent: '대여',
    buy: '구매',
    cast: '출연진/제작진',
    director: '감독',
    writer: '극본',
    castRole: '출연',
    moreCast: '출연진/제작진 더보기',
    media: '영상 및 포스터 콜라주',
    video: '비디오',
    poster: '포스터',
    noPlatform: '시청 가능한 플랫폼이 없습니다.',
    noPlatformFiltered: '해당 타입으로 시청 가능한 플랫폼이 없습니다.',
    noCast: '출연진 정보가 없습니다.',
    noCrew: '제작진 정보가 없습니다.',
    noMedia: '영상 및 포스터 정보가 없습니다.',
    detail: '상세',
    movie: '영화',
    tv: 'TV',
    hour: '시간',
    minute: '분',
    year: '년',
  },
  en: {
    back: 'Go Back',
    originalTitle: 'Original Title',
    genre: 'Genre',
    releaseDate: 'Release Date',
    ageRating: 'Age Rating',
    runtime: 'Runtime',
    watch: 'Where to Watch',
    flatrate: 'Subscription',
    free: 'Free',
    rent: 'Rent',
    buy: 'Buy',
    cast: 'Cast & Crew',
    director: 'Director',
    writer: 'Writer',
    castRole: 'Cast',
    moreCast: 'View More Cast & Crew',
    media: 'Videos & Posters',
    video: 'Video',
    poster: 'Poster',
    noPlatform: 'No streaming platforms available.',
    noPlatformFiltered: 'No streaming platforms available for this type.',
    noCast: 'No cast information available.',
    noCrew: 'No crew information available.',
    noMedia: 'No videos or posters available.',
    detail: 'Detail',
    movie: 'Movie',
    tv: 'TV',
    hour: 'h',
    minute: 'm',
    year: '',
  },
}

export default function ContentTMDB() {
  const navigate = useNavigate()
  const language = useRecoilValue(languageState)
  const t = CONTENT_TMDB_TEXT[language]
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>()

  // React Query 훅들을 사용하여 데이터 가져오기
  const { data: detail } = useTMDBDetail(type || 'movie', id || '', language)
  const { data: credits } = useTMDBCredits(type || 'movie', id || '')
  const { data: ottProviders = [] } = useTMDBProviders(type || 'movie', id || '')
  const { data: mediaItems = [] } = useTMDBMedia(type || 'movie', id || '', language)

  // 비즈니스 로직 분리된 커스텀 훅 사용
  const {
    genres,
    ageRating,
    runtime,
    cast,
    director,
    writer,
    displayOttProviders: baseDisplayOttProviders,
    flatrateCount,
    freeCount,
    rentCount,
    buyCount,
  } = useContentData({
    detail: detail || undefined,
    credits: credits || undefined,
    ottProviders,
    type: type || 'movie',
    t: { hour: t.hour, minute: t.minute },
  })

  const [isBackgroundDark, setIsBackgroundDark] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<'flatrate' | 'free' | 'rent' | 'buy' | null>(null)

  // 필터링된 OTT Providers
  const filteredOttProviders = useMemo(() => {
    if (!selectedFilter) return baseDisplayOttProviders
    return baseDisplayOttProviders.filter((p) => p.type === selectedFilter)
  }, [selectedFilter, baseDisplayOttProviders])

  const displayOttProviders = filteredOttProviders

  const handleFilterClick = useCallback((ft: 'flatrate' | 'free' | 'rent' | 'buy') => {
    setSelectedFilter((prev) => (prev === ft ? null : ft))
  }, [])

  // 제목 및 연도 계산
  const title = useMemo(() => {
    return (detail && ('title' in detail ? detail.title : detail.name)) || t.detail
  }, [detail, t.detail])

  const year = useMemo(() => {
    if (!detail) return ''
    if (detail.mediaType === 'movie') {
      return detail.release_date?.slice(0, 4) || ''
    } else {
      return detail.first_air_date?.slice(0, 4) || ''
    }
  }, [detail])

  const poster = useMemo(() => buildPosterUrl(detail?.poster_path), [detail?.poster_path])

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
          aria-label={t.back}
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
              {(type === 'movie' ? t.movie : t.tv) } • {year}
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
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.originalTitle}</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {title || '-'}
              </p>
            </div>
            {/* 장르 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.genre}</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {genres.map((g) => g.name).join(', ') || '-'}
              </p>
            </div>
            {/* 개봉일 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.releaseDate}</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {year ? `${year}${t.year}` : '-'}
              </p>
            </div>
            {/* 연령등급 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.ageRating}</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {ageRating || '-'}
              </p>
            </div>
            {/* 러닝타임 */}
            <div className="flex items-start">
              <p className="text-[14px] font-normal text-gray-700 w-[93px]">{t.runtime}</p>
              <p className="text-[14px] font-normal text-gray-900 flex-1">
                {runtime || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* 보러가기 섹션 */}
        <div className="px-5 mb-6">
          <h2 className="text-[16px] font-bold text-black mb-4">{t.watch}</h2>
          {/* OTT 필터 */}
          <div className="flex items-center gap-6 mb-4">
            <button
              onClick={() => handleFilterClick('flatrate')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'flatrate' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">{t.flatrate} {flatrateCount}</p>
              <div className={`w-[55px] h-[2px] border-b ${selectedFilter === 'flatrate' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
            </button>
            <button
              onClick={() => handleFilterClick('free')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'free' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">{t.free} {freeCount}</p>
              <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'free' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
            </button>
            <button
              onClick={() => handleFilterClick('rent')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'rent' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">{t.rent} {rentCount}</p>
              <div className={`w-[55px] h-[1px] border-b ${selectedFilter === 'rent' ? 'border-[#2e2c6a]' : 'border-transparent'}`} />
            </button>
            <button
              onClick={() => handleFilterClick('buy')}
              className={`flex flex-col items-center gap-1 ${selectedFilter === 'buy' ? 'opacity-100' : 'opacity-60'} hover:opacity-100 transition-opacity`}
            >
              <p className="text-[16px] font-normal text-black">{t.buy} {buyCount}</p>
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
                {selectedFilter ? t.noPlatformFiltered : t.noPlatform}
              </p>
            )}
          </div>
        </div>

        {/* 출연진/제작진 섹션 */}
        <div className="px-5 mb-6">
          <h2 className="text-[16px] font-semibold text-black mb-4">{t.cast}</h2>
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
                      title={actor.character || t.castRole}
                    >
                      {actor.character || t.castRole}
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
              {t.noCast}
            </div>
          )}

          {/* 구분선 */}
          <div className="w-full h-[1px] border-t border-[#2e2c6a] my-4" />

          {/* 감독/극본 */}
          <div className="space-y-4">
            {director && (
              <div className="flex items-start gap-4">
                <span className="text-[16px] font-normal text-black flex-shrink-0">{t.director}</span>
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
                <span className="text-[16px] font-normal text-black flex-shrink-0">{t.writer}</span>
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
                {t.noCrew}
              </div>
            )}
          </div>

          {/* 더보기 버튼 */}
          <button className="w-full h-[52px] bg-[#2e2c6a] rounded-[10px] mt-6 flex items-center justify-center">
            <span className="text-[16px] font-semibold text-white">{t.moreCast}</span>
          </button>
        </div>

        {/* 영상 및 포스터 콜라주 섹션 */}
        <div className="px-5 mb-6">
          <h2 className="text-[16px] font-semibold text-black mb-4">{t.media}</h2>
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
                          alt={item.type === 'video' ? t.video : t.poster}
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
                          alt={item.type === 'video' ? t.video : t.poster}
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
              {t.noMedia}
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



