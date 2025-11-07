/**
 * 무드 ID를 한글 장르/태그로 매핑
 */
export const moodToImdbTags: Record<string, string[]> = {
  '01': ['로맨스', '드라마'], // Romance
  '02': ['공포', '스릴러'], // Horror
  '03': ['코미디'], // Comedy
  '04': ['SF'], // SF
  '05': ['판타지'], // Fantasy
  '06': ['모험'], // Adventure
  '07': ['액션'], // Action
  '08': ['드라마', '가족'], // Healing
  '09': ['미스터리', '스릴러'], // Mystery
}

/**
 * 무드 ID 배열을 IMDB 태그 배열로 변환
 */
export function moodsToImdbTags(moodIds: string[]): string[] {
  const tags = new Set<string>()
  
  moodIds.forEach((moodId) => {
    const imdbTags = moodToImdbTags[moodId] || []
    imdbTags.forEach((tag) => tags.add(tag))
  })
  
  return Array.from(tags)
}

