import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadCategories } from './data/categories.ts'
import { syncResults } from './store/testStore.ts'

const queryClient = new QueryClient()
const root = createRoot(document.getElementById('root')!)

// Every page reads the categories, so load them before the first render.
loadCategories()
  .then((completed) => {
    syncResults(completed)
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    )
  })
  .catch((err: unknown) => {
    console.error(err)
    root.render(<p style={{ padding: 24, textAlign: 'center' }}>잠시 후 다시 시도해주세요.</p>)
  })
