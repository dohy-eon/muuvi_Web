import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// 카운터 상태 인터페이스
export interface CounterState {
  value: number;
  status: 'idle' | 'loading' | 'failed';
}

// 초기 상태
const initialState: CounterState = {
  value: 0,
  status: 'idle',
};

// 카운터 슬라이스 생성
export const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    // 증가
    increment: (state) => {
      state.value += 1;
    },
    // 감소
    decrement: (state) => {
      state.value -= 1;
    },
    // 특정 값만큼 증가
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
  },
});

export const { increment, decrement, incrementByAmount } = counterSlice.actions;

export default counterSlice.reducer;
