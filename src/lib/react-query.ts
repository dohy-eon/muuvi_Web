import { QueryClient } from '@tanstack/react-query'

/**
 * React Query QueryClient 설정
 * 캐싱, 리패칭, 에러 처리 등의 전역 설정을 관리합니다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 기본 캐시 시간: 5분
      staleTime: 5 * 60 * 1000,
      // 캐시 유지 시간: 10분
      gcTime: 10 * 60 * 1000, // 이전 버전에서는 cacheTime이었지만 v5에서는 gcTime
      // 자동 리패칭 비활성화 (필요시 개별 쿼리에서 활성화)
      refetchOnWindowFocus: false,
      // 네트워크 재연결 시 자동 리패칭 비활성화
      refetchOnReconnect: false,
      // 마운트 시 자동 리패칭 비활성화 (캐시된 데이터 우선 사용)
      refetchOnMount: false,
      // 에러 재시도 횟수
      retry: 1,
      // 에러 재시도 지연 시간
      retryDelay: 1000,
    },
    mutations: {
      // Mutation 에러 재시도 비활성화
      retry: false,
    },
  },
})

