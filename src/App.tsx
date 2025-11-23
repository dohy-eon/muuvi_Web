import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { lazy, Suspense } from 'react'
import AuthProvider from './components/AuthProvider'
import SimpleLoading from './components/SimpleLoading'

// Lazy load pages for code splitting
const Splash = lazy(() => import('./pages/Splash'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const OnboardingStep2 = lazy(() => import('./pages/Onboarding/Step2'))
const Main = lazy(() => import('./pages/Main'))
const Content = lazy(() => import('./pages/Content'))
const ContentTMDB = lazy(() => import('./pages/ContentTMDB'))
const MyPage = lazy(() => import('./pages/MyPage'))
const Settings = lazy(() => import('./pages/Settings'))
const Search = lazy(() => import('./pages/Search'))
const Universe = lazy(() => import('./pages/Universe'))

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
              <Suspense fallback={<SimpleLoading />}>
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
                  <Route path="/universe" element={<Universe />} />
                  <Route path="/" element={<Splash />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </div>
        </div>
      </BrowserRouter>
    </RecoilRoot>
  )
}