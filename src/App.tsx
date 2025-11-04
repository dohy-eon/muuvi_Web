import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import Onboarding from './pages/Onboarding'
import Main from './pages/Main'
import Content from './pages/Content'
import MyPage from './pages/MyPage'

export default function App() {
  return (
    <RecoilRoot>
      <BrowserRouter>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/main" element={<Main />} />
          <Route path="/content/:id" element={<Content />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/" element={<Main />} />
        </Routes>
      </BrowserRouter>
    </RecoilRoot>
  )
}