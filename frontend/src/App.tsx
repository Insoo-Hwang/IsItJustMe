import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppShell from './app/AppShell.tsx'
import IntroPage from './pages/IntroPage.tsx'
import LandingPage from './pages/LandingPage.tsx'
import ProfilePage from './pages/ProfilePage.tsx'
import QuizPage from './pages/QuizPage.tsx'
import ResultDetailPage from './pages/ResultDetailPage.tsx'
import ResultPage from './pages/ResultPage.tsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/main" replace />} />
          <Route path="/main" element={<LandingPage />} />
          <Route path="/test/:catId" element={<IntroPage />} />
          <Route path="/test/:catId/q/:n" element={<QuizPage />} />
          <Route path="/result/:catId" element={<ResultPage />} />
          <Route path="/result/:catId/detail" element={<ResultDetailPage />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/main" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
