/**
 * 무드 ID를 IMDB 장르/태그로 매핑
 */
export const moodToImdbTags: Record<string, string[]> = {
  '01': ['Romance', 'Drama'], // Romance
  '02': ['Horror', 'Thriller'], // Horror
  '03': ['Comedy'], // Comedy
  '04': ['Sci-Fi', 'Science Fiction'], // SF
  '05': ['Fantasy'], // Fantasy
  '06': ['Adventure'], // Adventure
  '07': ['Action'], // Action
  '08': ['Drama', 'Family'], // Healing
  '09': ['Mystery', 'Thriller'], // Mystery
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

