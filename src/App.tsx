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
        <div
          className="w-full min-h-screen flex justify-center"
          style={{ backgroundColor: '#2e2c6a' }}
        >
          <div className="w-full max-w-[375px] min-h-screen bg-white relative">
            <Routes>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/main" element={<Main />} />
              <Route path="/content/:id" element={<Content />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/" element={<Main />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </RecoilRoot>
  )
}