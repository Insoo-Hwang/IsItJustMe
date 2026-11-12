import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { MaintenanceError } from './api/categories.ts'
import App from './App.tsx'
import BootScreen, { type BootProblem } from './app/BootScreen.tsx'
import ErrorBoundary from './app/ErrorBoundary.tsx'
import { loadCategories } from './data/categories.ts'
import { syncResults } from './store/testStore.ts'

const queryClient = new QueryClient()
const root = createRoot(document.getElementById('root')!)

function problemOf(err: unknown): BootProblem {
  if (err instanceof MaintenanceError) return { kind: 'maintenance', notice: err.notice }
  if (!navigator.onLine) return { kind: 'offline' }
  return { kind: 'server' }
}

// Every page reads the categories, so load them before the first render. When that fails
// the boot screen says why and tries again from here, without reloading the page.
async function start(): Promise<void> {
  try {
    syncResults(await loadCategories())
  } catch (err) {
    console.error(err)
    // The admin page has to open during maintenance too, or nobody could switch it off.
    // Without the categories it shows codes instead of category names.
    if (!window.location.pathname.startsWith('/backstage')) {
      root.render(<BootScreen problem={problemOf(err)} retry={start} />)
      return
    }
  }
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void start()
