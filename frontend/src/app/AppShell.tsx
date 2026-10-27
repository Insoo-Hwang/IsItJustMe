import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { ensureGuestSession } from '../api/guest.ts'
import Toaster from '../components/Toast.tsx'
import { setProfile } from '../store/testStore.ts'
import { ScrollContainerContext } from './scrollContainer.ts'
import styles from './AppShell.module.css'

function AppShell() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { pathname, hash } = useLocation()

  useEffect(() => {
    ensureGuestSession()
      .then((session) => setProfile(session.profile))
      .catch((err: unknown) => console.error(err))
  }, [])

  // New page starts at the top, or at the #anchor when one is given.
  useLayoutEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) target.scrollIntoView()
    else if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [pathname, hash])

  return (
    <div className={styles.outer}>
      <div className={styles.frame}>
        <div ref={scrollRef} className={styles.scroll}>
          <ScrollContainerContext value={scrollRef}>
            <div className={styles.screen}>
              <Outlet />
            </div>
          </ScrollContainerContext>
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default AppShell
