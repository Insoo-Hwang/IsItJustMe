import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppShell from './app/AppShell.tsx'
import DexPage from './pages/DexPage.tsx'
import IntroPage from './pages/IntroPage.tsx'
import LandingPage from './pages/LandingPage.tsx'
import QuizPage from './pages/QuizPage.tsx'
import ResultPage from './pages/ResultPage.tsx'
import StatsPage from './pages/StatsPage.tsx'

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
          <Route path="/dex" element={<DexPage />} />
          <Route path="/stats/:catId?" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/main" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
