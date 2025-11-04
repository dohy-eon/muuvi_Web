import { atom, selector } from 'recoil';

export const counterState = atom({
  key: 'counterState',
  default: 0,
});

export const counterSelector = selector({
  key: 'counterSelector',
  get: ({ get }) => {
    const count = get(counterState);
    return {
      count,
      isPositive: count > 0,
      isNegative: count < 0,
    };
  },
});

// 비동기 selector 예제
export const asyncCounterSelector = selector({
  key: 'asyncCounterSelector',
  get: async ({ get }) => {
    const count = get(counterState);
    // API 호출 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return count * 2;
  },
});