import { atom } from 'recoil'
import type { User } from '@supabase/supabase-js'
import type { OnboardingData } from '../types'

// [추가] 언어 타입 정의 ('ko' 또는 'en')
export type Language = 'ko' | 'en'

// [추가] 언어 상태 atom
export const languageState = atom<Language>({
  key: 'languageState',
  default: 'ko',
})

export const userState = atom<User | null>({
  key: 'userState',
  default: null,
})

export const interestsState = atom<string[]>({
  key: 'interestsState',
  default: [],
})

export const onboardingDataState = atom<OnboardingData | null>({
  key: 'onboardingDataState',
  default: null,
})
