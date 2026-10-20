import { useEffect } from 'react'
import { ensureGuestSession } from '../api/guest.ts'

function MainPage() {
  useEffect(() => {
    ensureGuestSession().catch((err: unknown) => console.error(err))
  }, [])

  return <main />
}

export default MainPage
