import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import Onboarding from './pages/Onboarding'
import OnboardingStep2 from './pages/Onboarding/Step2'
import Main from './pages/Main'
import Content from './pages/Content'
import MyPage from './pages/MyPage'
import Settings from './pages/Settings'
import Splash from './pages/Splash'
import Search from './pages/Search'
import ContentTMDB from './pages/ContentTMDB'
import AuthProvider from './components/AuthProvider'

export default function App() {
  return (
    <RecoilRoot>
      <BrowserRouter>
        <div
          className="w-full min-h-screen flex justify-center"
          style={{ backgroundColor: '#2e2c6a' }}
        >
          <div className="w-full max-w-[375px] min-h-screen relative">
            <AuthProvider>
              <Routes>
                <Route path="/splash" element={<Splash />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/onboarding/step2" element={<OnboardingStep2 />} />
                <Route path="/main" element={<Main />} />
                <Route path="/content/:id" element={<Content />} />
                <Route path="/content/tmdb/:type/:id" element={<ContentTMDB />} />
                <Route path="/mypage" element={<MyPage />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/search" element={<Search />} />
                <Route path="/" element={<Splash />} />
              </Routes>
            </AuthProvider>
          </div>
        </div>
      </BrowserRouter>
    </RecoilRoot>
  )
}